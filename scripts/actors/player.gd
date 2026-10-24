class_name Player
extends Actor
## Герой-некромант: управление, атаки, способности.

var hero = "lich"
var hdef: Dictionary
var mana = 100.0
var max_mana = 100.0
var mana_regen = 6.0
var harvest = 0.0
var harvest_t = 0.0
var dash_charges = 1
var dash_max = 1
var dash_cd = 0.0
var dash_cd_max = 1.2
var dash_t = 0.0
var dash_dir = Vector3.ZERO
var combo = 0
var combo_t = 0.0
var buffered = false
var cast_t = 0.0
var shot_n = 0
var spin_t = 0.0
var spin_tick = 0.0
var aim = Vector3.ZERO
var input_dir = Vector3.ZERO
var bot = false
var bot_t = 0.0
var crit = 0.05
var execute_target: Actor
var raise_cd = 0.0
var explode_cd = 0.0
var special_cd = 0.0
var lifesteal = 0.0
var exec_t = 0.0

func setup_hero(w: Node, h: String) -> void:
	hero = h
	hdef = G.HEROES[h]
	var d = {"team": 0, "hp": hdef.hp, "speed": hdef.speed, "armor": hdef.armor, "dmg": hdef.dmg, "look": hdef.look, "poise": 60}
	setup(w, h, d)
	is_player = true
	undead = false
	max_hp += 25 * G.upgrade_level("u_hp")
	hp = max_hp
	max_mana = float(hdef.mana) + 15 * G.upgrade_level("u_mana")
	mana = max_mana
	mana_regen = 4.6 * (1.0 + 0.1 * G.upgrade_level("u_mana"))
	dmg_mul = 1.0 + 0.08 * G.upgrade_level("u_dmg")
	dash_max = 1 + G.upgrade_level("u_dash") + (1 if h == "reaper" else 0)
	dash_charges = dash_max
	if h == "reaper":
		lifesteal = 0.04

func _ready() -> void:
	super._ready()
	collision_mask = 1
	if hero == "lich":
		def["idle"] = "a1/Idle"

func perk_slow() -> bool:
	return G.perk_level("grip") > 0

func recalc_perks() -> void:
	dmg_mul = (1.0 + 0.08 * G.upgrade_level("u_dmg")) * (1.0 + 0.15 * G.perk_level("dmg"))
	aspd = 1.0 + 0.12 * G.perk_level("aspd")
	spd_mul = 1.0 + 0.1 * G.perk_level("speed")
	dash_cd_max = 1.2 * pow(0.8, G.perk_level("speed"))
	crit = 0.05 + 0.08 * G.perk_level("crit")

func roll_crit(h: Dictionary) -> void:
	if randf() < crit:
		h["crit"] = true
		h["dmg"] = float(h["dmg"]) * 2.0
		h["knock"] = float(h.get("knock", 3.0)) * 1.6

func make_hit(a: Dictionary, target) -> Dictionary:
	var h = super.make_hit(a, target)
	if harvest_t > 0.0:
		h["dmg"] = float(h["dmg"]) * 1.3
	roll_crit(h)
	return h

# ---------------------------------------------------------------- ввод
func think(dt: float) -> void:
	var w = world
	mana = minf(max_mana, mana + mana_regen * dt * (1.0 + 0.25 * G.perk_level("mana")))
	dash_cd -= dt
	if dash_cd <= 0.0 and dash_charges < dash_max:
		dash_charges += 1
		dash_cd = dash_cd_max if dash_charges < dash_max else 0.0
	combo_t -= dt
	if combo_t <= 0.0:
		combo = 0
	cast_t -= dt
	raise_cd -= dt; explode_cd -= dt; special_cd -= dt
	if harvest_t > 0.0:
		harvest_t -= dt
		if harvest_t <= 0.0:
			w.on_harvest_end()
	if exec_t > 0.0:
		exec_t -= dt
		move_vel = Vector3.ZERO
		return
	var mp = get_viewport().get_mouse_position()
	aim = w.cam.mouse_ground(mp, 0.0) if not bot else _bot_aim()
	w.cam.aim_point = aim
	var iv = Vector2.ZERO
	if bot:
		iv = _bot_move(dt)
	else:
		iv = Input.get_vector("left", "right", "up", "down")
	var b: Basis = w.cam.cam_basis_flat()
	input_dir = (b * Vector3(iv.x, 0, iv.y))
	if input_dir.length() > 1.0:
		input_dir = input_dir.normalized()
	if dash_t > 0.0:
		dash_t -= dt
		move_vel = dash_dir * 16.0
		if dash_t <= 0.0:
			state = S.IDLE
		return
	if spin_t > 0.0:
		_spin_tick(dt)
	var want_attack = Input.is_action_pressed("attack") if not bot else _bot_attack()
	var want_special = Input.is_action_just_pressed("special") if not bot else _bot_special()
	var to_aim = aim - global_position
	to_aim.y = 0
	if state == S.IDLE or state == S.ACTION:
		if (Input.is_action_just_pressed("dash") or (bot and _bot_dash())) and dash_charges > 0:
			_dash()
			return
	if state == S.IDLE:
		var spd = cur_speed()
		move_vel = input_dir * spd
		if spin_t > 0.0:
			move_vel *= 0.75
		if input_dir.length() > 0.1 and not want_attack and cast_t <= -0.25:
			face(input_dir)
		elif to_aim.length() > 0.3 and (want_attack or cast_t > -0.25):
			face(to_aim)
		if hero == "lich" and cast_t > -0.25:
			move_vel *= 0.72
		if want_attack:
			_primary(to_aim)
		if want_special and special_cd <= 0.0:
			_special(to_aim)
		if (Input.is_action_just_pressed("raise") or (bot and randf() < dt * 0.3)) and raise_cd <= 0.0:
			w.player_raise(self)
		if (Input.is_action_just_pressed("explode") or (bot and randf() < dt * 0.25)) and explode_cd <= 0.0:
			w.player_explode(self, aim)
		if Input.is_action_just_pressed("execute") or (bot and randf() < dt * 1.5):
			_try_execute()
		if (Input.is_action_just_pressed("ult") or (bot and randf() < dt * 0.4)) and harvest >= 1.0 and harvest_t <= 0.0:
			w.player_harvest(self)
		if Input.is_action_just_pressed("command"):
			w.player_command(self, aim)
	elif state == S.ACTION:
		move_vel = input_dir * cur_speed() * 0.25
		if want_attack and action_t / maxf(0.01, action_len) > 0.45:
			buffered = true
	execute_target = w.find_executable(global_position, 2.8)

func _primary(to_aim: Vector3) -> void:
	match hero:
		"lich":
			if cast_t <= 0.0:
				shot_n += 1
				var heavy = shot_n % 4 == 0
				cast_t = (0.34 if not heavy else 0.5) / aspd
				play_upper("a1/Spell_Simple_Shoot", 1.6 * aspd)
				var from = center() + Vector3.UP * 0.3 + forward() * 0.6
				var d = aim + Vector3.UP * 1.0 - from
				d.y = 0
				var pierce = 1 + G.perk_level("pierce")
				var k = "lance" if heavy else "bonespear"
				var dm = dmg * dmg_mul * (2.2 if heavy else 1.0)
				if harvest_t > 0.0: dm *= 1.3
				world.spawn_projectile(k, from, d, self, dm, {"pierce": pierce})
				world.fx.muzzle(from, Color(0.4, 1.0, 0.55), 0.55 if not heavy else 0.95)
				world.cam.kick(-forward(), 0.05 if not heavy else 0.14)
				if G.perk_level("multi") > 0:
					pass
				Sfx.at("bone_cast" if not heavy else "bone_lance", global_position, -3.0)
				world.fx.shake(0.04 if not heavy else 0.12)
		"deathknight":
			_melee_combo([
				{"anim": "a2/Sword_Regular_A", "t": 0.5, "range": 2.9, "arc": 150, "dmg": 1.0, "knock": 3.5, "lunge": 4.0, "speed": 1.15, "end": 0.78, "swing_sfx": "swing_heavy", "kind": "slash"},
				{"anim": "a2/Sword_Regular_B", "t": 0.48, "range": 2.9, "arc": 160, "dmg": 1.05, "knock": 4.0, "lunge": 4.0, "speed": 1.15, "end": 0.78, "swing_sfx": "swing_heavy", "kind": "slash"},
				{"anim": "a2/Sword_Regular_C", "t": 0.32, "range": 3.3, "arc": 220, "dmg": 1.7, "knock": 9.0, "lunge": 5.0, "speed": 1.05, "end": 0.6, "heavy": true, "swing_sfx": "swing_heavy", "kind": "slash", "stagger": 120.0}])
		"reaper":
			_melee_combo([
				{"anim": "a2/Sword_Regular_A", "t": 0.5, "range": 3.2, "arc": 170, "dmg": 1.0, "knock": 2.5, "lunge": 5.0, "speed": 1.5, "end": 0.72, "swing_sfx": "swing", "kind": "slash"},
				{"anim": "a2/Sword_Regular_B", "t": 0.48, "range": 3.2, "arc": 170, "dmg": 1.0, "knock": 2.5, "lunge": 5.0, "speed": 1.5, "end": 0.72, "swing_sfx": "swing", "kind": "slash"},
				{"anim": "a1/Sword_Attack", "t": 0.4, "range": 3.4, "arc": 200, "dmg": 1.2, "knock": 3.5, "lunge": 6.0, "speed": 1.45, "end": 0.6, "swing_sfx": "swing", "kind": "slash"},
				{"anim": "a2/Sword_Regular_C", "t": 0.3, "range": 3.6, "arc": 360, "dmg": 1.6, "knock": 7.0, "lunge": 3.0, "speed": 1.3, "end": 0.55, "heavy": true, "swing_sfx": "swing_heavy", "kind": "slash"}])

func _melee_combo(chain: Array) -> void:
	if state != S.IDLE:
		return
	var a: Dictionary = chain[combo % chain.size()].duplicate()
	a["arc_bonus"] = 20.0 * G.perk_level("pierce")
	combo += 1
	combo_t = 0.9
	buffered = false
	start_attack(a)

func on_action_end(a: Dictionary) -> void:
	if buffered and hero != "lich" and not a.get("special", false):
		buffered = false
		state = S.IDLE
		_primary(aim - global_position)

const TRAIL_COL = {"lich": Color(0.45, 1.0, 0.6), "deathknight": Color(1.0, 0.28, 0.16), "reaper": Color(1.0, 0.85, 0.8)}
var _swing_n = 0
func on_swing(a: Dictionary) -> void:
	_swing_n += 1
	var r = float(a.get("range", 2.0)) * scale_f + float(a.get("range_bonus", 0.0)) + 0.3
	var arc = minf(float(a.get("arc", 120.0)) + float(a.get("arc_bonus", 0.0)), 330.0)
	var col: Color = TRAIL_COL.get(hero, Color(1, 0.9, 0.8))
	if harvest_t > 0.0:
		col = Color(1.0, 0.2, 0.12)
	world.fx.swing_arc(self, r, arc, col, 0.13 / aspd, _swing_n % 2 == 0, randf_range(-0.2, 0.2) + (0.0 if _swing_n % 2 == 0 else 0.15))

func on_hit_landed(a: Dictionary, n: int) -> void:
	var heavy: bool = a.get("heavy", false)
	world.fx.shake(0.12 + 0.05 * n + (0.25 if heavy else 0.0))
	world.cam.kick(forward(), 0.15 if not heavy else 0.4)
	if heavy:
		world.hitstop(0.07, 0.08)
	Sfx.at("hit_heavy" if heavy else "hit_flesh", global_position + forward(), 0.0)

func on_damage_dealt(d: float) -> void:
	add_harvest(d * 0.0012 * (1.0 + 0.4 * G.perk_level("frenzy")))
	if lifesteal > 0.0 or harvest_t > 0.0:
		heal(d * (lifesteal + (0.25 if harvest_t > 0.0 else 0.0)))

func add_harvest(v: float) -> void:
	if harvest_t > 0.0:
		return
	harvest = minf(1.0, harvest + v)

func _special(to_aim: Vector3) -> void:
	match hero:
		"lich":
			if mana < 30:
				world.no_mana(); return
			mana -= 30
			special_cd = 0.6
			face(to_aim); rotation.y = atan2(face_dir.x, face_dir.z)
			play_upper("a1/Spell_Simple_Shoot", 1.3)
			var from = center() + Vector3.UP * 0.3 + forward() * 0.6
			var base = atan2(to_aim.x, to_aim.z)
			var n = 5 + G.perk_level("multi") * 2
			for i in n:
				var ang = base + deg_to_rad(-30.0 + 60.0 * float(i) / float(n - 1))
				world.spawn_projectile("skull", from, Vector3(sin(ang), 0, cos(ang)), self, dmg * dmg_mul * 1.4, {})
			Sfx.at("skull_cast", global_position, 0.0)
			world.fx.shake(0.15)
		"deathknight":
			if mana < 35:
				world.no_mana(); return
			mana -= 35
			special_cd = 1.0
			face(to_aim)
			start_attack({"anim": "a2/TreeChopping", "t": 0.45, "range": 2.0, "arc": 360, "dmg": 1.8, "knock": 11.0, "heavy": true, "aoe": 4.5, "speed": 1.0, "end": 0.75, "special": true, "slam": true, "swing_sfx": "swing_heavy", "kind": "blunt", "stagger": 200.0})
		"reaper":
			if mana < 30:
				world.no_mana(); return
			mana -= 30
			special_cd = 0.4
			spin_t = 2.0
			spin_tick = 0.0
			Sfx.at("whirl", global_position, 0.0)

func on_action_event(a: Dictionary) -> void:
	if a.get("slam", false):
		var p = global_position + forward() * 1.5
		world.fx.shockwave(p, 5.0, Color(0.3, 1.0, 0.45))
		world.fx.necro_burst(p, 1.2)
		world.area_damage(p, 4.8, dmg * dmg_mul * 1.8, self, {"kind": "blunt", "knock": 11.0, "heavy": true, "team": team, "knockdown": true})
		world.fx.ground_slam(p, 3.5, team)
		world.hitstop(0.09, 0.06)
		Sfx.at("slam", p, 4.0)
		return
	super.on_action_event(a)

func _spin_tick(dt: float) -> void:
	spin_t -= dt
	spin_tick -= dt
	model.rotation.y += dt * 22.0
	if spin_tick <= 0.0:
		spin_tick = 0.2
		hit_ids.clear()
		var n = melee_hit({"range": 3.3, "arc": 360, "dmg": 0.75, "knock": 3.0, "kind": "slash", "stagger": 20.0})
		world.fx.swing_arc(self, 3.6, 330.0, Color(1.0, 0.2, 0.12), 0.18, false, randf_range(-0.15, 0.15), 0.9)
		if n > 0:
			world.fx.blood_hit(center(), forward(), 10.0 * n, null)
	if spin_t <= 0.0:
		model.rotation.y = 0.0

func _dash() -> void:
	dash_charges -= 1
	if dash_cd <= 0.0:
		dash_cd = dash_cd_max
	var d = input_dir if input_dir.length() > 0.1 else forward()
	dash_dir = d.normalized()
	face(dash_dir)
	rotation.y = atan2(dash_dir.x, dash_dir.z)
	dash_t = 0.3
	invuln_t = 0.36
	state = S.ACTION
	action = {"end": 10.0, "move_mul": 1.0, "turn": 20.0}
	action_t = 0.0; action_len = 1.0; action_hit = true
	if hero == "reaper":
		play_full("a2/Slide_Start", 2.0)
	else:
		play_full("a1/Roll", 2.2)
	world.fx.dust(global_position, 0.8, 6)
	Sfx.at("dash", global_position, -2.0)
	var gc = TRAIL_COL.get(hero, Color(0.5, 1, 0.6))
	for i in 4:
		get_tree().create_timer(0.02 + i * 0.065, false).timeout.connect(func():
			if is_instance_valid(self) and not dead:
				world.fx.afterimage(self, gc, 0.35))
	if hero == "lich":
		world.fx.necro_burst(global_position + Vector3.UP * 0.5, 0.4)

func _try_execute() -> void:
	var t = world.find_executable(global_position, 2.8)
	if t == null:
		return
	world.execute(self, t)

func on_kill(v: Actor) -> void:
	if hero == "reaper":
		dash_charges = mini(dash_max, dash_charges + 1)
	var leech = 5.0 * G.perk_level("leech")
	if leech > 0.0:
		heal(leech)
	add_harvest(0.04 * (1.0 + 0.4 * G.perk_level("frenzy")) * (2.5 if v.elite else 1.0))

func take_hit(h: Dictionary) -> void:
	if exec_t > 0.0:
		return
	var before = hp
	h["stagger"] = float(h.get("stagger", h.get("dmg", 0))) * 0.4
	super.take_hit(h)
	if dead:
		return
	var lost = before - hp
	if lost > 0.0:
		world.on_player_hurt(lost)
		var th = 0.3 * G.perk_level("thorns")
		var src = h.get("src")
		if th > 0.0 and src is Actor and not src.dead:
			src.take_hit({"dmg": lost * th, "src": self, "dir": -Vector3(h["dir"]), "kind": "bleed", "knock": 0.0})

# ---------------------------------------------------------------- бот для автотестов
func _bot_target() -> Actor:
	var best: Actor = null
	var bd = 1e9
	for e in world.units_of(1):
		if e.dead:
			continue
		var d = flat_dist(e.global_position)
		if d < bd:
			bd = d; best = e
	return best

func _bot_aim() -> Vector3:
	var t = _bot_target()
	return t.global_position if t else global_position + forward() * 3.0

func _bot_move(dt: float) -> Vector2:
	var t = _bot_target()
	if t == null:
		return Vector2.ZERO
	var to = t.global_position - global_position
	var d = to.length()
	var want = 7.0 if hero == "lich" else 1.8
	var v = Vector3.ZERO
	if d > want + 1.0:
		v = to.normalized()
	elif d < want - 1.0:
		v = -to.normalized()
	else:
		v = to.cross(Vector3.UP).normalized() * 0.6
	var b: Basis = world.cam.cam_basis_flat()
	var l = b.inverse() * v
	return Vector2(l.x, l.z)

func _bot_attack() -> bool:
	var t = _bot_target()
	return t != null and flat_dist(t.global_position) < (16.0 if hero == "lich" else 3.2)

func _bot_special() -> bool:
	return randf() < 0.01 and mana > 60

func _bot_dash() -> bool:
	return randf() < 0.004
