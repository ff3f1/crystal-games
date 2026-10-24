class_name World
extends Node3D
## Арена: уровень, бойцы, волны, правила, события.

signal finished(victory: bool)
signal wave_started(n: int, total: int)
signal level_up
signal boss_spawned(b: Actor)
signal toast(text: String, color: Color)
signal hit_marker(kill: bool, crit: bool)

var mission: Dictionary
var menu_mode = false
var fx: FX
var cam: CamRig
var post: ColorRect
var player: Player
var units = [[], []]
var corpses: Array = []
var zones: Array = []
var props: Array = []
var spawn_points: Array = []
var arena_half = 24.0
var nav_region: NavigationRegion3D
var nav_ready = false
var level: Node3D
var env: WorldEnvironment
var boss: Actor
var director: Director
var combo = 0
var combo_t = 0.0
var army_rage_t = 0.0
var time_slow_t = 0.0
var game_over = false
var hurt_flash = 0.0
var biome = "graveyard"
var rage_v = 0.0

const MAX_CORPSES := 60

func setup(m: Dictionary, menu := false) -> void:
	mission = m
	menu_mode = menu
	biome = String(m.get("biome", "graveyard"))
	if biome == "random":
		biome = ["graveyard", "camp", "crypt", "cathedral"][randi() % 4]

func _ready() -> void:
	G.world = self
	fx = FX.new()
	fx.world = self
	add_child(fx)
	cam = CamRig.new()
	add_child(cam)
	level = LevelBuilder.build(self, biome)
	add_child(level)
	_setup_post()
	_bake_nav()
	if not menu_mode:
		_spawn_player()
		director = Director.new()
		director.world = self
		add_child(director)
		director.start(mission)
	else:
		cam.position = Vector3(0, 0, 4)
		cam.dist_target = 15.0
		director = Director.new()
		director.world = self
		director.menu_mode = true
		add_child(director)
		director.start_menu()

func _setup_post() -> void:
	var cl = CanvasLayer.new()
	cl.layer = 0
	add_child(cl)
	post = ColorRect.new()
	post.mouse_filter = Control.MOUSE_FILTER_IGNORE
	post.set_anchors_preset(Control.PRESET_FULL_RECT)
	var m = ShaderMaterial.new()
	m.shader = load("res://assets/shaders/grade.gdshader")
	post.material = m
	cl.add_child(post)
	_apply_post_settings()
	G.settings_changed.connect(_apply_post_settings)

func _apply_post_settings() -> void:
	var m: ShaderMaterial = post.material
	m.set_shader_parameter("mono", 0.0)
	m.set_shader_parameter("grain", 0.035 if G.settings.grain else 0.0)
	m.set_shader_parameter("brightness", float(G.settings.brightness))
	var gt = {"graveyard": Vector3(0.98, 1.0, 1.02), "camp": Vector3(0.98, 1.0, 1.02), "crypt": Vector3(1.0, 1.0, 1.0), "cathedral": Vector3(1.0, 1.0, 1.0)}
	m.set_shader_parameter("grade_tint", gt.get(biome, Vector3.ONE))
	if env:
		LevelBuilder.apply_quality(env.environment)

func _bake_nav() -> void:
	nav_region = level.get_node_or_null("Nav")
	if nav_region == null:
		return
	nav_region.bake_finished.connect(func(): nav_ready = true, CONNECT_ONE_SHOT)
	nav_region.bake_navigation_mesh(true)

func _spawn_player() -> void:
	player = Player.new()
	player.setup_hero(self, String(G.run.get("hero", "lich")))
	add_child(player)
	player.global_position = Vector3(0, 0, 0)
	register(player)
	cam.target = player
	cam.global_position = player.global_position
	var hl = OmniLight3D.new()
	hl.name = "HeroLight"
	hl.light_color = Color(0.85, 0.9, 1.0)
	hl.light_energy = 2.4 if biome == "crypt" else 1.7
	hl.omni_range = 13.0
	hl.omni_attenuation = 1.4
	hl.shadow_enabled = int(G.settings.shadows) >= 1
	hl.shadow_bias = 0.05
	hl.light_size = 0.25
	hl.light_specular = 0.25
	player.add_child(hl)
	hl.position = Vector3(0, 4.5, 0)
	player.recalc_perks()
	for i in 2 * G.upgrade_level("u_start"):
		var u = spawn_unit("u_ghoul", player.global_position + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3)), 0)
		u.rise(0.8)

func register(a: Actor) -> void:
	units[a.team].append(a)

func units_of(team: int) -> Array:
	return units[team]

func army() -> Array:
	var out = []
	for u in units[0]:
		if not u.is_player and not u.dead:
			out.append(u)
	return out

func army_center() -> Vector3:
	var a = army()
	if a.is_empty():
		return Vector3.INF
	var c = Vector3.ZERO
	for u in a:
		c += u.global_position
	return c / a.size()

func spawn_unit(id: String, pos: Vector3, team_override := -1) -> Unit:
	var d: Dictionary = G.UNITS[id].duplicate(true)
	if team_override >= 0:
		d["team"] = team_override
	var u: Unit
	if d.has("script"):
		u = load(d["script"]).new()
	else:
		u = Unit.new()
	u.setup(self, id, d)
	if u.team == 0 and not u.is_player:
		var k = (1.0 + 0.3 * G.perk_level("minion_hp")) * (1.0 + 0.1 * G.upgrade_level("u_army"))
		u.max_hp *= k; u.hp = u.max_hp
		u.dmg_mul = (1.0 + 0.25 * G.perk_level("minion_dmg")) * (1.0 + 0.1 * G.upgrade_level("u_army"))
		if G.perk_level("elite_raise") > 0:
			u.max_hp *= 1.4; u.hp = u.max_hp; u.dmg_mul *= 1.4
	add_child(u)
	u.global_position = pos
	register(u)
	return u

func spawn_projectile(kind: String, from: Vector3, dir: Vector3, src: Actor, dmg: float, extra := {}) -> Projectile:
	var p = Projectile.new()
	add_child(p)
	p.setup(self, kind, from, dir, src, dmg, extra)
	p.global_position = from
	return p

func _physics_process(delta: float) -> void:
	_cleanup()
	_zones_tick(delta)
	if combo_t > 0.0:
		combo_t -= delta
		if combo_t <= 0.0:
			G.run["max_combo"] = maxi(int(G.run.get("max_combo", 0)), combo)
			combo = 0
	if army_rage_t > 0.0:
		army_rage_t -= delta
	if not menu_mode and not game_over:
		G.run["time"] = float(G.run.get("time", 0.0)) + delta

func _process(delta: float) -> void:
	var m: ShaderMaterial = post.material
	m.set_shader_parameter("time_k", fmod(Time.get_ticks_msec() * 0.001, 100.0))
	hurt_flash = maxf(0.0, hurt_flash - delta * 1.5)
	if player and not player.dead:
		var low = clampf(1.0 - player.hp / player.max_hp / 0.35, 0.0, 1.0)
		m.set_shader_parameter("hurt", maxf(low * (0.6 + 0.4 * sin(Time.get_ticks_msec() * 0.006)), hurt_flash))
		rage_v = lerpf(rage_v, 1.0 if player.harvest_t > 0.0 else 0.0, clampf(delta * 3.0, 0, 1))
		m.set_shader_parameter("rage", rage_v)
	if not menu_mode and not get_tree().paused and Input.is_action_just_pressed("zoom_in"):
		cam.dist_target = clampf(cam.dist_target - 1.5, 11.0, 26.0)
	if not menu_mode and not get_tree().paused and Input.is_action_just_pressed("zoom_out"):
		cam.dist_target = clampf(cam.dist_target + 1.5, 11.0, 26.0)

func _cleanup() -> void:
	for t in 2:
		var arr: Array = units[t]
		for i in range(arr.size() - 1, -1, -1):
			var u = arr[i]
			if not is_instance_valid(u) or u.dead:
				arr.remove_at(i)

# ---------------------------------------------------------------- события боя
func hit_confirm(kill: bool, crit: bool) -> void:
	hit_marker.emit(kill, crit)
	if kill:
		fx.shake(0.06)

func on_damage(a: Actor, h: Dictionary) -> void:
	var src = h.get("src")
	if src is Player and a.team == 1:
		(src as Player).on_damage_dealt(float(h.get("final", 0.0)))
	if G.settings.dmg_numbers and (src is Player or a is Player):
		_number(a, float(h.get("final", 0.0)), h.get("crit", false), a is Player)

var _num_font: Font
func _number(a: Actor, v: float, crit: bool, on_player: bool) -> void:
	if v < 1.0:
		return
	if _num_font == null:
		UIK.fonts()
		_num_font = UIK.f_bold
	var l = Label3D.new()
	l.text = str(int(round(v))) + ("!" if crit else "")
	l.font = _num_font
	l.font_size = 54 if not crit else 84
	l.outline_size = 14
	l.outline_modulate = Color(0, 0, 0, 0.9)
	l.modulate = Color(1, 0.25, 0.2) if on_player else (Color(1, 0.78, 0.3) if crit else Color(0.96, 0.94, 0.9))
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = false
	l.pixel_size = 0.0055
	add_child(l)
	var side = randf_range(-0.6, 0.6)
	l.global_position = a.center() + Vector3(side, 0.9 * a.scale_f, 0)
	l.scale = Vector3.ONE * 0.4
	var tw = l.create_tween().set_parallel(true)
	tw.tween_property(l, "scale", Vector3.ONE * (1.25 if crit else 1.0), 0.09).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "global_position", l.global_position + Vector3(side * 0.6, 1.1, 0), 0.6).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.3).set_delay(0.4)
	tw.chain().tween_callback(l.queue_free)

func on_death(a: Actor, h: Dictionary) -> void:
	var src = h.get("src")
	if a.is_player:
		_player_died()
		return
	if a.team == 1:
		G.run["kills"] = int(G.run.get("kills", 0)) + 1
		G.save["total_kills"] = int(G.save.get("total_kills", 0)) + 1
		combo += 1
		combo_t = 3.0
		var soul_k = 1.0 + 0.15 * G.upgrade_level("u_souls")
		G.run["souls"] = float(G.run.get("souls", 0)) + float(a.def.get("souls", 1)) * soul_k
		add_xp(int(a.def.get("xp", 5)))
		if a.has_meta("champion"):
			for ch in a.get_children():
				if ch is Label3D or ch is OmniLight3D:
					ch.queue_free()
			fx.beam(a.global_position, Color(0.4, 1.0, 0.55), 5.0, 0.7, 1.0)
			toast.emit("Чемпион повержен", G.C_NECRO)
		var orbs = clampi(int(a.def.get("souls", 1)), 1, 6) * (4 if a.has_meta("champion") else 1)
		for i in mini(orbs, 12):
			var o = SoulOrb.new()
			o.setup(self, a.center(), 3.0 + (2.0 if a.has_meta("champion") else 0.0))
		if player and not player.dead:
			player.on_kill(a)
		if src is Player or (src is Actor and src.team == 0):
			pass
		if director:
			director.on_enemy_died(a)
		if a == boss:
			_boss_killed()
	else:
		if G.perk_level("minion_boom") > 0:
			fx.gib_explode(a, h)
			area_damage(a.center(), 3.0, 40.0, null, {"kind": "explosion", "team": 0, "knock": 6.0})
	Sfx.at(a.def.get("death_sfx", "death") if a.team == 1 else "death_undead", a.global_position, 0.0)

func on_corpse(a: Actor) -> void:
	if not is_instance_valid(a) or a.gibbed:
		return
	corpses.append(a)
	fx.blood_pool(a.get_meta("corpse_at", a.corpse_pos()), randf_range(1.3, 2.2) * a.scale_f)
	while corpses.size() > MAX_CORPSES:
		var old = corpses.pop_front()
		if is_instance_valid(old):
			_sink_corpse(old)

func _sink_corpse(a: Actor) -> void:
	var tw = a.create_tween()
	tw.tween_property(a, "global_position:y", a.global_position.y - 1.2, 3.0)
	tw.tween_callback(a.queue_free)

func on_broken(a: Actor) -> void:
	if player:
		toast.emit("", Color.WHITE)

func break_threshold() -> float:
	return 0.3 if G.perk_level("headsman") > 0 else 0.22

func can_ragdoll() -> bool:
	return Ragdoll.active_count < 16

func on_player_hurt(v: float) -> void:
	hurt_flash = clampf(v / 40.0, 0.25, 0.8)
	fx.shake(clampf(v / 60.0, 0.1, 0.5))

func line_of_sight(a: Vector3, b: Vector3) -> bool:
	var q = PhysicsRayQueryParameters3D.create(a, b, 1)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()

func area_damage(p: Vector3, r: float, dmg: float, src, opts := {}) -> int:
	var team: int = int(opts.get("team", src.team if src else 0))
	var n = 0
	for e in units_of(1 - team).duplicate():
		if e.dead:
			continue
		var d = Vector2(e.global_position.x - p.x, e.global_position.z - p.z).length()
		if d > r + e.radius:
			continue
		var dir = (e.global_position - p)
		dir.y = 0
		dir = dir.normalized() if dir.length() > 0.05 else Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
		var fall = clampf(1.0 - d / (r + e.radius) * 0.5, 0.5, 1.0)
		var h = {"dmg": dmg * fall, "src": src, "dir": dir, "point": e.center() - dir * 0.3, "knock": float(opts.get("knock", 5.0)) * fall,
			"heavy": opts.get("heavy", true), "kind": String(opts.get("kind", "explosion")), "stagger": dmg * 1.5, "fire": opts.get("fire", false), "team": team}
		if src is Player:
			(src as Player).roll_crit(h)
		e.take_hit(h)
		if opts.get("knockdown", false) and not e.dead:
			e.knockdown(dir, float(opts.get("knock", 5.0)))
		n += 1
	for pr in props.duplicate():
		if is_instance_valid(pr) and pr.global_position.distance_to(p) < r + 0.8:
			pr.damage(dmg, (pr.global_position - p).normalized())
	return n

func hit_props(org: Vector3, fwd: Vector3, r: float, arc: float, h: Dictionary) -> void:
	for pr in props.duplicate():
		if not is_instance_valid(pr):
			continue
		var to: Vector3 = pr.global_position - org
		to.y = 0
		if to.length() > r + 0.6:
			continue
		if rad_to_deg(fwd.angle_to(to.normalized())) > arc * 0.5 and to.length() > 0.8:
			continue
		pr.damage(float(h.get("dmg", 10)), to.normalized())

func add_zone(p: Vector3, r: float, life: float, dps: float, team: int, kind: String) -> void:
	zones.append({"p": p, "r": r, "life": life, "dps": dps, "team": team, "kind": kind})

func holy_zone(p: Vector3, r: float, life: float, src: Actor) -> void:
	var t = 1.1
	fx.telegraph_circle(p, r, t, Color(1.0, 0.75, 0.25))
	get_tree().create_timer(t, false).timeout.connect(func():
		fx.sigil(p, r, life, Color(1.0, 0.78, 0.3), 2.2)
		fx.flash_light(p + Vector3.UP, Color(1, 0.8, 0.4), 4.0, r * 3.0, 0.5)
		add_zone(p, r, life, 18.0, 1, "holy"))

func _zones_tick(delta: float) -> void:
	for i in range(zones.size() - 1, -1, -1):
		var z: Dictionary = zones[i]
		z["life"] = float(z["life"]) - delta
		if z["life"] <= 0.0:
			zones.remove_at(i)
			continue
		var tick: float = float(z.get("tick", 0.0)) - delta
		if tick <= 0.0:
			tick = 0.5
			for e in units_of(1 - int(z["team"])).duplicate():
				if e.dead:
					continue
				if Vector2(e.global_position.x - z.p.x, e.global_position.z - z.p.z).length() < float(z["r"]) + e.radius * 0.5:
					var k: String = String(z["kind"])
					if k == "holy" and not e.undead and not e.is_player:
						continue
					e.take_hit({"dmg": float(z["dps"]) * 0.5, "src": null, "dir": Vector3.UP, "kind": "fire" if k == "fire" else "holy_zone", "knock": 0.0, "team": z["team"]})
					if k == "fire":
						e.ignite(2.0, 5.0)
		z["tick"] = tick

# ---------------------------------------------------------------- игрок: способности
func corpses_near(p: Vector3, r: float) -> Array:
	var out = []
	for c in corpses:
		if is_instance_valid(c) and c.corpse and not c.gibbed and c.get_meta("corpse_at", c.corpse_pos()).distance_to(p) < r:
			out.append(c)
	return out

func raise_cost() -> float:
	var k = 1.0 - 0.3 * G.perk_level("raise_cost")
	if player and player.hero == "lich":
		k *= 0.75
	return 12.0 * k

func player_raise(pl: Player) -> void:
	var cap = G.army_cap() - army().size()
	if cap <= 0:
		toast.emit("Армия полна", G.C_NECRO)
		return
	var cs = corpses_near(pl.global_position, 11.0)
	cs = cs.filter(func(c): return c.raisable and G.UNITS.has(String(c.def.get("raise", ""))))
	cs.sort_custom(func(a, b): return a.global_position.distance_to(pl.global_position) < b.global_position.distance_to(pl.global_position))
	var cost = raise_cost()
	if cs.is_empty():
		var c2 = 45.0 * (cost / 12.0)
		if pl.mana < c2:
			no_mana(); return
		pl.mana -= c2
		pl.raise_cd = 0.8
		for i in mini(2, cap):
			var p = pl.global_position + Vector3(randf_range(-2.5, 2.5), 0, randf_range(-2.5, 2.5))
			fx.sigil(p, 1.0, 0.8)
			fx.necro_burst(p, 0.7)
			var u = spawn_unit("u_ghoul", p, 0)
			u.rise(1.0)
		pl.play_upper("a1/Spell_Simple_Shoot", 1.2)
		Sfx.at("raise", pl.global_position, 0.0)
		return
	var n = mini(cs.size(), cap)
	n = mini(n, int(pl.mana / cost))
	if n <= 0:
		no_mana(); return
	pl.mana -= n * cost
	pl.raise_cd = 0.6
	pl.play_upper("a1/Spell_Simple_Shoot", 1.0)
	fx.sigil(pl.global_position, 3.0, 0.8)
	fx.shockwave(pl.global_position, 11.0)
	Sfx.at("raise", pl.global_position, 2.0)
	for i in n:
		var c: Actor = cs[i]
		corpses.erase(c)
		var p: Vector3 = c.get_meta("corpse_at", c.corpse_pos())
		var rid: String = c.def["raise"]
		var delay = 0.32 + i * 0.08
		fx.wisp(pl.center() + Vector3.UP * 0.5, p + Vector3.UP * 0.4, Color(0.4, 1.0, 0.55), delay)
		get_tree().create_timer(delay, false).timeout.connect(func():
			fx.necro_burst(p, 0.9)
			fx.beam(p, Color(0.35, 1.0, 0.5), 5.0, 0.55, 1.0)
			fx.sigil(p, 1.1, 1.0)
			var u = spawn_unit(rid, p, 0)
			u.rotation.y = randf() * TAU
			u.rise(1.25)
			G.run["raised"] = int(G.run.get("raised", 0)) + 1
			if is_instance_valid(c):
				var tw = c.create_tween()
				tw.tween_method(func(v): c.set_shader_all("dissolve", v), 0.0, 1.0, 0.6)
				tw.tween_callback(c.queue_free))

func player_explode(pl: Player, at: Vector3) -> void:
	var cs = corpses_near(at, 5.0)
	if cs.is_empty():
		cs = corpses_near(pl.global_position, 7.0)
	if cs.is_empty():
		toast.emit("Нет трупов рядом", G.C_ASH)
		return
	if pl.mana < 20.0:
		no_mana(); return
	cs.sort_custom(func(a, b): return a.global_position.distance_to(at) < b.global_position.distance_to(at))
	pl.mana -= 20.0
	pl.explode_cd = 0.35
	pl.play_upper("a1/Spell_Simple_Shoot", 1.5)
	var n = 1 + (2 if G.perk_level("chain") > 0 else 0)
	for i in mini(n, cs.size()):
		var c: Actor = cs[i]
		get_tree().create_timer(i * 0.18, false).timeout.connect(_explode_corpse.bind(c))

func _explode_corpse(c: Actor) -> void:
	if not is_instance_valid(c):
		return
	corpses.erase(c)
	var p: Vector3 = c.get_meta("corpse_at", c.corpse_pos())
	var k = 1.0 + 0.35 * G.perk_level("explode")
	if player and player.hero == "lich":
		k *= 1.2
	var r = 4.0 * k
	fx.gib_explode(c, {"dir": Vector3.ZERO, "point": p})
	fx.shockwave(p, r, Color(0.8, 0.05, 0.03))
	fx.flash_light(p + Vector3.UP, Color(1.0, 0.2, 0.1), 8.0, r * 2.5, 0.35)
	fx.blood_decal(p, r * 1.4)
	fx.smoke(p + Vector3.UP * 0.4, r * 0.5, 12)
	fx.muzzle(p + Vector3.UP * 0.8, Color(1.0, 0.35, 0.2), r * 0.6)
	fx.necro_burst(p, 0.6)
	area_damage(p + Vector3.UP * 0.5, r, 75.0 * k * (player.dmg_mul if player else 1.0), player, {"kind": "explosion", "knock": 10.0, "team": 0})
	fx.shake(0.55)
	hitstop(0.06, 0.15)
	Sfx.at("corpse_boom", p, 4.0)
	c.queue_free()

func player_harvest(pl: Player) -> void:
	pl.harvest = 0.0
	pl.harvest_t = 10.0
	army_rage_t = 10.0
	for u in army():
		u.frenzy_t = 10.0
	fx.shockwave(pl.global_position, 14.0, Color(0.85, 0.05, 0.05))
	fx.flash_light(pl.global_position + Vector3.UP * 2, Color(1, 0.1, 0.05), 10.0, 20.0, 0.8)
	hitstop(0.25, 0.2)
	cam.add_trauma(0.6)
	Sfx.at("harvest", pl.global_position, 4.0)
	toast.emit("ЖАТВА", G.C_BLOOD)

func on_harvest_end() -> void:
	pass

func player_command(pl: Player, at: Vector3) -> void:
	var best: Actor = null
	var bd = 3.5
	for e in units_of(1):
		if e.dead:
			continue
		var d = Vector2(e.global_position.x - at.x, e.global_position.z - at.z).length()
		if d < bd:
			bd = d; best = e
	if best:
		for u in army():
			u.command_target = best
			u.command_t = 6.0
		fx.telegraph_circle(best.global_position, 1.4, 0.5, Color(0.3, 1.0, 0.45))
		toast.emit("Армия: в атаку!", G.C_NECRO)
	else:
		for u in army():
			u.command_t = 0.0
			u.target = null
			u.retarget_t = 2.0
		fx.telegraph_circle(pl.global_position, 3.0, 0.5, Color(0.3, 1.0, 0.45))
		toast.emit("Армия: ко мне!", G.C_NECRO)
	Sfx.ui("command")

func no_mana() -> void:
	toast.emit("Не хватает маны", Color(0.4, 0.6, 1.0))
	Sfx.ui("ui_err")

func find_executable(p: Vector3, r: float) -> Actor:
	var best: Actor = null
	var bd = r
	for e in units_of(1):
		if e.dead or e.state != Actor.S.BROKEN:
			continue
		var d = e.flat_dist(p)
		if d < bd:
			bd = d; best = e
	return best

func execute(pl: Player, t: Actor) -> void:
	pl.exec_t = 0.9
	pl.invuln_t = 1.2
	t.state = Actor.S.STAGGER
	t.state_t = -10.0
	var dir = (t.global_position - pl.global_position); dir.y = 0
	pl.face(dir); pl.rotation.y = atan2(pl.face_dir.x, pl.face_dir.z)
	var clip = "a2/Sword_Regular_C" if pl.hero != "lich" else "a1/Spell_Simple_Shoot"
	pl.play_full(clip, 1.1)
	cam.zoom_override = 9.0
	time_slow(0.35, 0.55)
	G.run["executions"] = int(G.run.get("executions", 0)) + 1
	get_tree().create_timer(0.32, true, false, true).timeout.connect(func():
		if not is_instance_valid(t) or t.dead:
			return
		var h = {"dmg": t.hp + 50.0, "src": pl, "dir": dir.normalized(), "point": t.center() + Vector3.UP * 0.4, "knock": 6.0, "heavy": true, "kind": "slash", "crit": true, "team": 0}
		if pl.hero == "lich":
			fx.necro_burst(t.center(), 1.0)
		t.take_hit(h)
		if is_instance_valid(t) and t.skel and G.gore() >= 1:
			fx.sever(t, "head", h)
		var k = 2.0 if G.perk_level("headsman") > 0 else 1.0
		pl.heal(pl.max_hp * 0.18 * k)
		pl.mana = minf(pl.max_mana, pl.mana + 25.0 * k)
		pl.add_harvest(0.12)
		fx.shake(0.7)
		cam.kick(dir.normalized(), 0.6)
		Sfx.at("execute", t.global_position, 5.0))
	get_tree().create_timer(0.95, true, false, true).timeout.connect(func(): cam.zoom_override = -1.0)

func time_slow(scale: float, t: float) -> void:
	Engine.time_scale = scale
	get_tree().create_timer(t, true, false, true).timeout.connect(func():
		if not get_tree().paused:
			Engine.time_scale = 1.0)

func hitstop(t: float, scale := 0.05) -> void:
	if Engine.time_scale < 0.99:
		return
	time_slow(scale, t)

# ---------------------------------------------------------------- прогресс
func add_xp(v: int) -> void:
	G.run["xp"] = int(G.run.get("xp", 0)) + v
	var need = G.xp_for_level(int(G.run["level"]))
	if int(G.run["xp"]) >= need:
		G.run["xp"] = int(G.run["xp"]) - need
		G.run["level"] = int(G.run["level"]) + 1
		level_up.emit()

func apply_perk(id: String) -> void:
	var perks: Dictionary = G.run.get("perks", {})
	perks[id] = int(perks.get(id, 0)) + 1
	G.run["perks"] = perks
	if player:
		match id:
			"hp":
				player.max_hp += 50; player.hp = player.max_hp
			"mana":
				player.max_mana += 30; player.mana = player.max_mana
		player.recalc_perks()

func spawn_boss(id: String, pos: Vector3) -> Actor:
	var b = spawn_unit(id, pos, 1)
	b.is_boss = true
	boss = b
	boss_spawned.emit(b)
	return b

func _boss_killed() -> void:
	time_slow(0.25, 1.4)
	cam.add_trauma(0.8)
	toast.emit("БОСС ПОВЕРЖЕН", G.C_BLOOD)
	if director and director.endless:
		Sfx.play_music("battle")

func _player_died() -> void:
	if game_over:
		return
	game_over = true
	time_slow(0.3, 1.8)
	get_tree().create_timer(2.6, true, false, true).timeout.connect(func(): finished.emit(false))

func win() -> void:
	if game_over:
		return
	game_over = true
	get_tree().create_timer(2.5, true, false, true).timeout.connect(func(): finished.emit(true))
