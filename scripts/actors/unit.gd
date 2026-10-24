class_name Unit
extends Actor
## Боец под управлением ИИ: враги Ордена и армия нежити.

var ai = "melee"
var target: Actor
var retarget_t = 0.0
var nav: NavigationAgent3D
var nav_t = 0.0
var goal = Vector3.ZERO
var strafe_sign = 1.0
var aim_t = 0.0
var aim_line: Node3D
var special_t = 0.0
var command_target: Actor
var command_t = 0.0
var spawn_t = 0.0
var formation_off = Vector3.ZERO
var heal_cd = 3.0
var zone_cd = 6.0
var idle_bark = 0.0
var stuck_t = 0.0
var unstick_t = 0.0
var unstick_dir = Vector3.ZERO

func _ready() -> void:
	super._ready()
	speed *= 0.86
	ai = String(def.get("ai", "melee"))
	nav = NavigationAgent3D.new()
	nav.path_desired_distance = 0.7
	nav.target_desired_distance = 0.6
	nav.radius = radius + 0.05
	nav.height = 1.8
	nav.avoidance_enabled = true
	nav.neighbor_distance = 4.0
	nav.max_neighbors = 8
	nav.max_speed = speed * 1.6
	nav.time_horizon_agents = 0.8
	nav.avoidance_priority = 0.5 if not elite else 0.9
	add_child(nav)
	nav.velocity_computed.connect(_on_safe_velocity)
	strafe_sign = 1.0 if randf() < 0.5 else -1.0
	attack_cd = randf_range(0.2, 1.2)
	formation_off = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized() * randf_range(2.2, 4.2)

func _on_safe_velocity(v: Vector3) -> void:
	if unstick_t > 0.0:
		return
	if state == S.IDLE or state == S.BLOCK:
		move_vel = Vector3(v.x, 0, v.z)

func _steer(to: Vector3, spd: float) -> void:
	var p = global_position
	var desired: Vector3
	nav_t -= get_physics_process_delta_time()
	if world and world.nav_ready:
		if nav_t <= 0.0 or nav.target_position.distance_to(to) > 1.0:
			nav.target_position = to
			nav_t = 0.25
		var nxt = nav.get_next_path_position()
		desired = nxt - p
	else:
		desired = to - p
	desired.y = 0
	var dist = desired.length()
	var v = Vector3.ZERO
	if dist > 0.05:
		v = desired / dist * spd
	# застревание о препятствие/толпу: обходим боком
	var dt = get_physics_process_delta_time()
	var real = get_real_velocity(); real.y = 0
	if spd > 1.0 and state == S.IDLE and real.length() < spd * 0.25:
		stuck_t += dt
	else:
		stuck_t = maxf(0.0, stuck_t - dt * 2.0)
	if unstick_t > 0.0:
		unstick_t -= dt
		move_vel = unstick_dir * spd + v * 0.35
		return
	if stuck_t > 0.45:
		stuck_t = 0.0
		var side = v.cross(Vector3.UP).normalized() * (1.0 if randf() < 0.5 else -1.0)
		if side.length() < 0.1:
			side = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
		unstick_dir = side
		unstick_t = randf_range(0.4, 0.7)
		nav_t = 0.0
		move_vel = unstick_dir * spd
		return
	if nav.avoidance_enabled and world and world.nav_ready:
		nav.velocity = v
	else:
		move_vel = v + _separation() * spd * 0.6

func _separation() -> Vector3:
	var s = Vector3.ZERO
	for e in world.units_of(team):
		if e == self or e.dead:
			continue
		var d = global_position - e.global_position
		d.y = 0
		var l = d.length()
		if l < 1.2 and l > 0.001:
			s += d / l * (1.2 - l)
	return s

func _stop() -> void:
	move_vel = Vector3.ZERO
	if nav.avoidance_enabled and world and world.nav_ready:
		nav.velocity = Vector3.ZERO

func pick_target() -> Actor:
	var best: Actor = null
	var bd = 1e9
	var aggro = 60.0 if team == 1 else 14.0
	var anchor = global_position
	if team == 0 and world.player and not world.player.dead:
		anchor = world.player.global_position
	for e in world.units_of(1 - team):
		if e.dead or e.state == S.SPAWN:
			continue
		var d = flat_dist(e.global_position)
		if team == 0 and e.global_position.distance_to(anchor) > aggro + 4.0:
			continue
		if e.is_player:
			d *= 0.75
		if e.state == S.BROKEN:
			d *= 3.0
		if d < bd:
			bd = d; best = e
	return best

func think(dt: float) -> void:
	if state == S.SPAWN:
		spawn_t -= dt
		if spawn_t <= 0.0:
			state = S.IDLE
		return
	if state == S.BROKEN or state == S.STAGGER or state == S.KNOCKDOWN:
		_stop()
		return
	retarget_t -= dt
	if command_t > 0.0:
		command_t -= dt
		if is_instance_valid(command_target) and not command_target.dead:
			target = command_target
		else:
			command_t = 0.0
	if retarget_t <= 0.0 or target == null or not is_instance_valid(target) or target.dead:
		if command_t <= 0.0:
			target = pick_target()
		retarget_t = randf_range(0.5, 1.0)
	match ai:
		"melee", "berserk", "heavy":
			_ai_melee(dt)
		"shield":
			_ai_shield(dt)
		"ranged":
			_ai_ranged(dt)
		"priest":
			_ai_priest(dt)
		"bomber":
			_ai_bomber(dt)
		"minion":
			_ai_minion(dt, false)
		"minion_ranged":
			_ai_minion(dt, true)
		_:
			_ai_melee(dt)

func _choose_attack(dist: float) -> Dictionary:
	var atks: Array = def.get("attacks", [])
	var opts = []
	for a in atks:
		if a.get("ranged", false):
			continue
		if dist <= float(a.get("range", 2.0)) * maxf(1.0, scale_f * 0.9) + 0.3:
			opts.append(a)
	if opts.is_empty():
		return {}
	return opts[randi() % opts.size()].duplicate()

func _ai_melee(dt: float) -> void:
	if target == null:
		_stop()
		return
	var tp = target.global_position
	var dist = flat_dist(tp) - target.radius
	face(tp - global_position)
	if state != S.IDLE:
		return
	var reach = 1.8 * maxf(1.0, scale_f * 0.9)
	if dist <= reach + 0.2 and attack_cd <= 0.0:
		var a = _choose_attack(dist + target.radius * 0.5)
		if not a.is_empty():
			_stop()
			if ai == "heavy" and not a.has("tele"):
				a["tele"] = true
			start_attack(a, 1.0 if ai != "berserk" else 1.15)
			attack_cd = randf_range(0.6, 1.4) * (0.7 if ai == "berserk" else 1.0) * (1.5 if ai == "heavy" else 1.0)
			return
	if dist > reach * 0.85:
		var spd = cur_speed()
		if ai == "berserk" and dist < 7.0:
			spd *= 1.25
		_steer(tp, spd)
	else:
		# кружим, пока ждём удара
		var side = (tp - global_position).cross(Vector3.UP).normalized() * strafe_sign
		move_vel = side * cur_speed() * 0.35 + _separation() * 2.0

func _ai_shield(dt: float) -> void:
	if target == null:
		_stop()
		return
	var dist = flat_dist(target.global_position) - target.radius
	if dist < 5.0 and state == S.IDLE:
		set_hold("a2/Idle_Shield", true)
	else:
		set_hold("")
	_ai_melee(dt)
	if state == S.IDLE and dist < 5.0:
		move_vel *= 0.7

func _ai_ranged(dt: float) -> void:
	if target == null:
		_stop()
		return
	var tp = target.global_position
	var dist = flat_dist(tp)
	face(tp - global_position)
	if state != S.IDLE:
		return
	var keep: float = float(def.get("keep", 10.0))
	var rng: float = float(def.get("range", 15.0))
	if aim_t > 0.0:
		aim_t -= dt
		_stop()
		if aim_line and is_instance_valid(aim_line):
			_update_aim_line(tp)
		if aim_t <= 0.0:
			_clear_aim()
			if dist <= rng + 2.0 and world.line_of_sight(center(), target.center()):
				var atks: Array = def.get("attacks", [])
				for a in atks:
					if a.get("ranged", false):
						start_attack(a.duplicate())
						break
			attack_cd = float(def.get("cd", 2.5)) * randf_range(0.85, 1.2)
			set_hold("")
		return
	if dist < keep * 0.6:
		var away = (global_position - tp).normalized()
		_steer(global_position + away * 4.0, cur_speed())
	elif dist > rng * 0.9 or not world.line_of_sight(center(), target.center()):
		_steer(tp, cur_speed())
	else:
		var side = (tp - global_position).cross(Vector3.UP).normalized() * strafe_sign
		move_vel = side * cur_speed() * 0.4 + _separation() * 2.0
		if randf() < dt * 0.3:
			strafe_sign = -strafe_sign
		if attack_cd <= 0.0:
			_begin_aim()

func _begin_aim() -> void:
	aim_t = 0.75 if ai == "ranged" else 0.5
	set_hold("a1/Pistol_Aim_Neutral" if def.get("proj", "") in ["bolt", "bonebolt"] else "a1/Spell_Simple_Idle", true)
	if def.get("proj", "") == "bolt" and world:
		aim_line = world.fx.telegraph_line(center(), forward(), 14.0, 0.08, aim_t, Color(1, 0.05, 0.03))

func _update_aim_line(_tp: Vector3) -> void:
	pass

func _clear_aim() -> void:
	aim_line = null

func fire_ranged(a: Dictionary) -> void:
	if target == null or not is_instance_valid(target):
		return
	var kind: String = def.get("proj", "bolt")
	var from = center() + forward() * 0.5 + Vector3.UP * 0.25
	var aim = target.center()
	if kind in ["bolt", "bonebolt"]:
		# небольшой разброс и упреждение
		aim += target.velocity * 0.18 + Vector3(randf_range(-0.4, 0.4), 0, randf_range(-0.4, 0.4))
	var d = (aim - from)
	d.y *= 0.3
	var extra = {}
	if kind in ["firebomb", "soulfire"]:
		extra["target_pos"] = Vector3(target.global_position.x, 0.0, target.global_position.z) + target.velocity * 0.4
	world.spawn_projectile(kind, from, d, self, dmg * dmg_mul, extra)
	Sfx.at({"bolt": "crossbow", "bonebolt": "crossbow", "holy": "holy_cast", "firebomb": "throw", "soulfire": "throw"}.get(kind, "throw"), global_position, -2.0)

func _ai_priest(dt: float) -> void:
	heal_cd -= dt
	zone_cd -= dt
	if state == S.IDLE and heal_cd <= 0.0:
		var hurt = _most_hurt_ally(12.0)
		if hurt:
			heal_cd = 4.5
			face(hurt.global_position - global_position)
			play_full("a1/Spell_Simple_Shoot", 0.8)
			state = S.ACTION; action = {"anim": "a1/Spell_Simple_Shoot", "t": 0.5, "end": 0.9, "ranged": false, "heal": hurt}
			action_t = 0.0; action_len = AnimLib.length("a1/Spell_Simple_Shoot") / 0.8; action_hit = false
			return
	if state == S.IDLE and zone_cd <= 0.0 and target and flat_dist(target.global_position) < 14.0:
		zone_cd = 9.0
		var zp = world.army_center() if team == 1 else target.global_position
		if zp != Vector3.INF:
			world.holy_zone(zp, 3.2, 6.0, self)
			play_full("a1/Spell_Simple_Shoot", 0.7)
			return
	_ai_ranged(dt)

func on_action_event(a: Dictionary) -> void:
	if a.has("heal"):
		var h: Actor = a["heal"]
		if is_instance_valid(h) and not h.dead:
			h.heal(30.0 + h.max_hp * 0.12)
			world.fx.sigil(h.global_position, 1.2, 0.6, Color(1.0, 0.78, 0.3), 2.5)
			Sfx.at("holy_heal", h.global_position, -3.0)
		return
	super.on_action_event(a)

func _most_hurt_ally(r: float) -> Actor:
	var best: Actor = null
	var bv = 0.92
	for e in world.units_of(team):
		if e.dead or e == self or flat_dist(e.global_position) > r:
			continue
		var f = e.hp / e.max_hp
		if f < bv:
			bv = f; best = e
	return best

func _ai_bomber(dt: float) -> void:
	if target and flat_dist(target.global_position) < 2.4:
		_ai_melee(dt)
		return
	_ai_ranged(dt)

func _ai_minion(dt: float, ranged: bool) -> void:
	var pl: Actor = world.player
	if target and is_instance_valid(target) and not target.dead:
		var leash = 20.0 if command_t > 0.0 else 16.0
		if pl and not pl.dead and target.global_position.distance_to(pl.global_position) > leash:
			target = null
	if target == null or not is_instance_valid(target):
		if pl and not pl.dead:
			var home = pl.global_position + formation_off
			if flat_dist(home) > 1.2:
				_steer(home, cur_speed() * (1.4 if flat_dist(home) > 6.0 else 1.0))
				face(home - global_position)
			else:
				_stop()
				face(pl.forward())
		else:
			_stop()
		return
	if ranged:
		_ai_ranged(dt)
	else:
		_ai_melee(dt)

func rise(t := 1.2) -> void:
	state = S.SPAWN
	spawn_t = t
	play_full("a2/LayToIdle", 1.25, 0.0)
