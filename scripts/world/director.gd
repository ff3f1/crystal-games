class_name Director
extends Node
## Волны врагов, передышки, появление босса, бесконечный режим.

var world: World
var mission: Dictionary
var waves: Array = []
var wave = -1
var queue: Array = []
var spawn_t = 0.0
var phase = "intro"
var phase_t = 0.0
var endless = false
var menu_mode = false
var boss_wave = false
var alive_order = 0

const ENDLESS_POOL := [["zealot", 1, 0], ["torch", 1, 1], ["flagellant", 2, 1], ["knight", 3, 2], ["crossbow", 2, 2], ["priest", 4, 3], ["witchhunter", 3, 3], ["templar", 7, 5]]
const BOSSES := ["executioner", "marshal", "inquisitor", "colossus"]

func start(m: Dictionary) -> void:
	mission = m
	endless = String(m.get("id", "")) == "endless"
	waves = m.get("waves", []).duplicate(true)
	phase = "intro"
	phase_t = 3.0
	world.toast.emit(String(m.get("title", "")), G.C_BONE)
	Sfx.play_music("battle")

func start_menu() -> void:
	phase = "menu"

func total_waves() -> int:
	return 0 if endless else waves.size() + (1 if String(mission.get("boss", "")) != "" else 0)

func _physics_process(delta: float) -> void:
	if menu_mode or world.game_over:
		return
	phase_t -= delta
	match phase:
		"intro", "break":
			if phase_t <= 0.0:
				_next_wave()
		"wave":
			_spawn_tick(delta)
			if queue.is_empty() and _alive() == 0:
				_wave_cleared()
		"boss":
			_spawn_tick(delta)
			if world.boss == null or not is_instance_valid(world.boss) or world.boss.dead:
				if endless:
					boss_wave = false
					if queue.is_empty() and _alive() == 0:
						_wave_cleared()
					return
				if phase_t > 3.0:
					phase_t = 3.0
				if phase_t <= 0.0 and _alive() == 0:
					phase = "done"
					world.win()
		"done":
			pass

func _alive() -> int:
	var n = 0
	for u in world.units_of(1):
		if not u.dead and u.state != Actor.S.BROKEN:
			n += 1
	return n

func _next_wave() -> void:
	wave += 1
	G.run["wave"] = wave + 1
	if endless:
		var n = wave + 1
		if n % 5 == 0:
			_start_boss(BOSSES[(n / 5 - 1) % BOSSES.size()], 1.0 + 0.25 * (n / 5 - 1))
			_enqueue(_endless_mix(n, 0.5))
			return
		_enqueue(_endless_mix(n, 1.0))
	else:
		if wave >= waves.size():
			var b = String(mission.get("boss", ""))
			if b != "":
				_start_boss(b, 1.0)
				return
			world.win()
			phase = "done"
			return
		_enqueue(waves[wave])
	phase = "wave"
	spawn_t = 0.5
	world.wave_started.emit(wave + 1, total_waves())
	Sfx.ui("horn")

func _endless_mix(n: int, k: float) -> Array:
	var budget = int((8 + n * 3.2) * k)
	var out = {}
	var pool = ENDLESS_POOL.filter(func(e): return n >= int(e[2]))
	var guard = 0
	while budget > 0 and guard < 200:
		guard += 1
		var e = pool[randi() % pool.size()]
		if int(e[1]) > budget and budget < 3:
			e = pool[0]
		out[e[0]] = int(out.get(e[0], 0)) + 1
		budget -= int(e[1])
	var arr = []
	for k2 in out:
		arr.append([k2, out[k2]])
	return arr

func _enqueue(groups: Array) -> void:
	var list = []
	for g in groups:
		for i in int(g[1]):
			list.append(String(g[0]))
	list.shuffle()
	# группами по 3-5 из одних ворот
	var t = 0.0
	var gate = randi() % maxi(1, world.spawn_points.size())
	var in_group = 0
	for id in list:
		queue.append([id, t, gate])
		in_group += 1
		t += randf_range(0.25, 0.55)
		if in_group >= randi_range(3, 5):
			in_group = 0
			t += randf_range(1.2, 2.6)
			gate = _far_gate()

func _far_gate() -> int:
	var sp: Array = world.spawn_points
	if sp.is_empty():
		return 0
	var best = randi() % sp.size()
	if world.player and randf() < 0.75:
		var bd = -1.0
		for i in sp.size():
			var d: float = (sp[i] as Vector3).distance_to(world.player.global_position) + randf() * 8.0
			if d > bd:
				bd = d; best = i
	return best

func _spawn_tick(delta: float) -> void:
	if queue.is_empty():
		return
	spawn_t += delta
	var cap = 34
	while not queue.is_empty() and float(queue[0][1]) <= spawn_t:
		if _alive() >= cap:
			for q in queue:
				q[1] = float(q[1]) + 0.5
			return
		var q = queue.pop_front()
		var sp: Array = world.spawn_points
		var p: Vector3 = sp[int(q[2]) % sp.size()] if not sp.is_empty() else Vector3(0, 0, -20)
		p += Vector3(randf_range(-1.8, 1.8), 0, randf_range(-1.8, 1.8))
		var u = world.spawn_unit(String(q[0]), p, 1)
		_scale_enemy(u)
		if not u.is_boss and randf() < 0.05 + 0.012 * wave:
			_make_champion(u)

func _scale_enemy(u: Actor) -> void:
	var lvl = float(wave)
	if endless:
		u.max_hp *= 1.0 + lvl * 0.06
		u.hp = u.max_hp
		u.dmg_mul = 1.0 + lvl * 0.04
	var mi = G.MISSIONS.find(mission)
	if mi > 0:
		u.max_hp *= 1.0 + mi * 0.08
		u.hp = u.max_hp

## Чемпион: сильнее, крупнее, с аурой; даёт больше душ.
func _make_champion(u: Actor) -> void:
	u.set_meta("champion", true)
	u.elite = true
	u.max_hp *= 2.6; u.hp = u.max_hp
	u.dmg_mul *= 1.35
	u.poise_max *= 2.5; u.poise = u.poise_max
	u.armor = minf(0.5, u.armor + 0.1)
	u.def["xp"] = int(u.def.get("xp", 5)) * 3
	u.model.scale *= 1.12
	var l = OmniLight3D.new()
	l.light_color = Color(1.0, 0.2, 0.1)
	l.light_energy = 2.2
	l.omni_range = 3.2
	l.position = Vector3(0, 0.4, 0)
	u.add_child(l)
	var lb = Label3D.new()
	UIK.fonts()
	lb.font = UIK.f_bold
	lb.text = "Чемпион · " + String(u.def.get("name", ""))
	lb.font_size = 40
	lb.outline_size = 10
	lb.modulate = Color(1, 0.45, 0.3)
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.pixel_size = 0.005
	lb.no_depth_test = true
	lb.position = Vector3(0, 2.4, 0)
	u.add_child(lb)
	world.fx.beam(u.global_position, Color(1.0, 0.25, 0.12), 4.0, 0.6, 0.8)

func _start_boss(id: String, hp_k: float) -> void:
	phase = "boss"
	phase_t = 999.0
	boss_wave = true
	world.wave_started.emit(wave + 1, total_waves())
	var p = Vector3(0, 0, -14)
	if world.biome == "cathedral":
		p = Vector3(0, 0, -16)
	var b = world.spawn_boss(id, p)
	b.max_hp *= hp_k
	b.hp = b.max_hp
	Sfx.play_music("boss")

func _wave_cleared() -> void:
	phase = "break"
	phase_t = 5.0
	world.toast.emit("Волна отбита", G.C_NECRO)
	if world.player and not world.player.dead:
		world.player.heal(world.player.max_hp * 0.15)
		world.player.mana = minf(world.player.max_mana, world.player.mana + 30)

func on_enemy_died(_a: Actor) -> void:
	pass
