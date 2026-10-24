class_name Boss extends Unit
## Боссы: фазы, телеграфы, окна уязвимости, призыв подкреплений.

var kind = ""
var phase_i = 0
var move_cd = 2.0
var busy = false
var seq: Array = []
var seq_t = 0.0
var seq_end = 0.0
var cont = null
var vuln_t = 0.0
var intro_t = 2.2
var hit_once = {}
var aura: OmniLight3D
var last_move = ""
var blink_cd = 4.0
var lunge_v = Vector3.ZERO
var leap_from = Vector3.ZERO
var leap_to = Vector3.ZERO
var leap_t = -1.0
var beam: MeshInstance3D
var beam_ang = 0.0
var beam_spd = 0.0
var beam_tick = 0.0
var channel_hp = 0.0
var channeling = false
var vuln_ring: MeshInstance3D
var slam_count = 0
var cur_tele: MeshInstance3D

const THRESH = [0.66, 0.33]

func _ready() -> void:
	super._ready()
	kind = String(def.get("boss_kind", uid))
	invuln_t = intro_t
	if kind == "colossus" or kind == "inquisitor":
		aura = OmniLight3D.new()
		aura.light_color = Color(1.0, 0.75, 0.4)
		aura.light_energy = 0.8
		aura.omni_range = 3.0 * scale_f
		aura.position = Vector3(0, 1.5 * scale_f, 0)
		add_child(aura)
	call_deferred("_intro")

func _intro() -> void:
	face(Vector3(0, 0, 1))
	play_full("a2/Idle_Rail_Call", 0.8, 0.1)
	Sfx.at("boss_roar", global_position, 6.0)
	world.fx.shake(0.5)
	world.fx.dust(global_position, 3.0 * scale_f, 24)
	if kind == "colossus":
		world.fx.flash_light(center(), Color(1, 0.8, 0.4), 8.0, 20.0, 1.2)

# ---------------------------------------------------------------- основа
func dmgv(k: float) -> float:
	return dmg * dmg_mul * k * (1.0 + 0.12 * phase_i)

func take_hit(h: Dictionary) -> void:
	if dead:
		return
	if vuln_t > 0.0:
		h["dmg"] = float(h["dmg"]) * 1.75
		h["no_block"] = true
	if h.get("src") is Actor and (h.get("src") as Actor).team == 0 and not (h.get("src") is Player):
		h["dmg"] = float(h["dmg"]) * (0.45 if kind == "colossus" else 0.6)
	var before = hp
	super.take_hit(h)
	if channeling and before - hp > 0.0:
		channel_hp -= before - hp
		if channel_hp <= 0.0:
			_interrupt()

func _die(h: Dictionary) -> void:
	if dead:
		return
	_end_beam()
	if is_instance_valid(vuln_ring):
		vuln_ring.queue_free()
	super._die(h)
	if aura:
		var tw = aura.create_tween()
		tw.tween_property(aura, "light_energy", 0.0, 2.0)
	world.time_slow(0.18, 1.6)
	world.cam.add_trauma(0.9)
	var c = center()
	if kind == "colossus":
		for i in 26:
			var v = Vector3(randf_range(-6, 6), randf_range(5, 13), randf_range(-6, 6))
			world.fx.gib_chunk(c + Vector3(randf_range(-1, 1), randf_range(-1.5, 1.5), randf_range(-1, 1)), v, true)
		world.fx.dust(global_position, 6.0, 60)
		world.fx.flash_light(c, Color(1, 0.85, 0.5), 14.0, 30.0, 1.5)
		Sfx.at("stone_break", c, 8.0)
		visible = false
		raisable = false
	else:
		for i in 3:
			world.fx.blood_hit(c + Vector3(0, randf_range(-0.5, 0.8), 0), Vector3(randf_range(-1, 1), 0.5, randf_range(-1, 1)).normalized(), 200.0, self)
		world.fx.blood_pool(global_position, 4.0)
		if G.gore() >= 1:
			world.fx.sever(self, "head", h)
		raisable = false

func think(dt: float) -> void:
	if state == S.SPAWN:
		spawn_t -= dt
		if spawn_t <= 0.0:
			state = S.IDLE
		return
	if intro_t > 0.0:
		intro_t -= dt
		_stop()
		return
	retarget_t -= dt
	if retarget_t <= 0.0 or target == null or not is_instance_valid(target) or target.dead:
		target = pick_target()
		retarget_t = 1.2
	# смена фаз
	if phase_i < THRESH.size() and hp < max_hp * THRESH[phase_i] and not busy:
		phase_i += 1
		_phase_up()
		return
	if vuln_t > 0.0:
		vuln_t -= dt
		_stop()
		if vuln_t <= 0.0:
			set_hold("")
			if is_instance_valid(vuln_ring):
				vuln_ring.queue_free()
			move_cd = 0.4
		return
	if busy:
		seq_t += dt
		while not seq.is_empty() and float(seq[0][0]) <= seq_t:
			var st = seq.pop_front()
			(st[1] as Callable).call()
			if not busy:
				return
		if cont != null:
			(cont as Callable).call(dt)
		if busy and seq_t >= seq_end and seq.is_empty():
			_end_move()
		return
	if state != S.IDLE:
		return
	if target == null:
		_stop()
		return
	move_cd -= dt
	blink_cd -= dt
	var dist = flat_dist(target.global_position)
	if move_cd <= 0.0:
		var m = _choose(dist)
		if m != "":
			_start(m)
			return
	_approach(dt, dist)

func _approach(dt: float, dist: float) -> void:
	var tp = target.global_position
	face(tp - global_position)
	if kind == "inquisitor":
		if dist < 3.5 and blink_cd <= 0.0:
			_start("blink")
			return
		if dist < 8.0:
			var away = (global_position - tp)
			away.y = 0
			_steer(global_position + away.normalized() * 4.0, cur_speed())
		elif dist > 13.0:
			_steer(tp, cur_speed())
		else:
			var side = (tp - global_position).cross(Vector3.UP).normalized() * strafe_sign
			move_vel = side * cur_speed() * 0.6
		return
	var reach = 2.4 * scale_f * 0.75
	if dist < reach + 0.6 and attack_cd <= 0.0:
		var atks: Array = def.get("attacks", [])
		if not atks.is_empty():
			_stop()
			var a: Dictionary = atks[randi() % atks.size()].duplicate()
			a["tele"] = true
			start_attack(a, 1.0 + 0.1 * phase_i)
			attack_cd = randf_range(0.9, 1.6) / (1.0 + 0.2 * phase_i)
			return
	if dist > reach * 0.8:
		_steer(tp, cur_speed() * (1.0 + 0.12 * phase_i))
	else:
		_stop()

func _start(m: String) -> void:
	last_move = m
	busy = true
	seq = []
	seq_t = 0.0
	seq_end = 1.0
	cont = null
	hit_once.clear()
	_stop()
	if target:
		face(target.global_position - global_position)
	call("_m_" + m)
	seq.sort_custom(func(a, b): return float(a[0]) < float(b[0]))

func _end_move() -> void:
	busy = false
	cont = null
	seq = []
	move_vel = Vector3.ZERO
	lunge_v = Vector3.ZERO
	channeling = false
	_end_beam()
	move_cd = randf_range(1.6, 2.8) / (1.0 + 0.25 * phase_i)
	attack_cd = 0.6

func at(t: float, f: Callable) -> void:
	seq.append([t, f])

func stun(t: float, msg := "") -> void:
	busy = false
	cont = null
	seq = []
	move_vel = Vector3.ZERO
	channeling = false
	_end_beam()
	vuln_t = t
	stop_full()
	set_hold("a1/Fixing_Kneeling")
	Sfx.at("guard_break", global_position, 4.0)
	world.fx.flash_light(center(), Color(1, 0.85, 0.4), 4.0, 8.0, 0.4)
	if msg != "":
		world.toast.emit(msg, G.C_GOLD)
	if is_instance_valid(vuln_ring):
		vuln_ring.queue_free()
	vuln_ring = world.fx.telegraph_circle(global_position, 1.6 * scale_f, t, Color(1, 0.8, 0.3))

func _interrupt() -> void:
	channeling = false
	stun(2.4, "Ритуал прерван!")

func anim_speed(s: float) -> void:
	if tree:
		tree.set("parameters/full_ts/scale", s)

func _impact_speed(clip: String, frac: float, t: float) -> float:
	return maxf(0.2, AnimLib.length(clip) * frac / maxf(0.05, t))

# ---------------------------------------------------------------- урон
func hit_circle(p: Vector3, r: float, k: float, knock: float, opts := {}) -> int:
	var o = {"team": team, "kind": String(opts.get("kind", "blunt")), "knock": knock, "heavy": true, "knockdown": opts.get("knockdown", knock >= 10.0), "fire": opts.get("fire", false)}
	return world.area_damage(p, r, dmgv(k), self, o)

func hit_line(from: Vector3, dir: Vector3, length: float, width: float, k: float, knock: float, opts := {}) -> int:
	var d = Vector3(dir.x, 0, dir.z).normalized()
	var n = 0
	for e in world.units_of(1 - team).duplicate():
		if e.dead or hit_once.has(e.get_instance_id()) and opts.get("once", false):
			continue
		var to = e.global_position - from
		to.y = 0
		var along = to.dot(d)
		if along < -e.radius or along > length + e.radius:
			continue
		var lat = (to - d * along).length()
		if lat > width * 0.5 + e.radius:
			continue
		if opts.get("once", false):
			hit_once[e.get_instance_id()] = true
		var pushd = (to - d * along).normalized() if lat > 0.2 else d
		var h = {"dmg": dmgv(k), "src": self, "dir": (pushd + d * 0.6).normalized(), "point": e.center(), "knock": knock, "heavy": true,
			"kind": String(opts.get("kind", "slash")), "stagger": 999.0, "fire": opts.get("fire", false), "team": team, "no_block": true}
		e.take_hit(h)
		if knock >= 10.0 and not e.dead:
			e.knockdown(h.dir, knock)
		n += 1
	return n

func crack_line(from: Vector3, dir: Vector3, length: float, w := 1.4) -> void:
	var d = Vector3(dir.x, 0, dir.z).normalized()
	var steps = int(length / 1.6) + 1
	for i in steps:
		var p = from + d * (0.8 + i * 1.6)
		world.fx.blood_decal(p, w * randf_range(1.0, 1.5), Color(0.25, 0.22, 0.2), world.fx.crack_tex)
		if i % 2 == 0:
			world.fx.dust(p, 1.0, 6)

func _gate_spawn(ids: Array) -> void:
	var sp: Array = world.spawn_points
	var i = 0
	for id in ids:
		var p: Vector3 = sp[(i + randi()) % sp.size()] if not sp.is_empty() else global_position + Vector3(6, 0, 0)
		p += Vector3(randf_range(-1.5, 1.5), 0, randf_range(-1.5, 1.5))
		var u = world.spawn_unit(String(id), p, 1)
		if world.director:
			world.director._scale_enemy(u)
		i += 1

# ---------------------------------------------------------------- выбор приёма
func _choose(dist: float) -> String:
	var opts = []
	match kind:
		"executioner":
			if dist < 5.5:
				opts += ["sweep", "chop", "chop"]
			if dist > 4.0 and dist < 16.0:
				opts += ["charge", "chop"]
			if phase_i >= 1 and dist > 5.0:
				opts += ["leap", "leap"]
			if phase_i >= 2:
				opts += ["sweep"]
		"marshal":
			opts += ["volley"]
			if dist < 6.0:
				opts += ["combo", "combo"]
			if dist > 5.0 and dist < 14.0:
				opts += ["shield_charge"]
			if phase_i >= 1 and dist > 6.0:
				opts += ["leap"]
		"inquisitor":
			opts += ["pillars", "bolts", "bolts"]
			if world.corpses_near(global_position, 12.0).size() >= 3:
				opts += ["purge", "purge"]
			if phase_i >= 1:
				opts += ["pillar_line"]
		"colossus":
			if dist < 7.5:
				opts += ["smash", "sweep_big"]
			opts += ["rings"]
			if phase_i >= 1:
				opts += ["beam", "debris"]
			if phase_i >= 2:
				opts += ["beam"]
	opts = opts.filter(func(m): return m != last_move or opts.size() == 1)
	if opts.is_empty():
		return ""
	return opts[randi() % opts.size()]

# ---------------------------------------------------------------- фазы
func _phase_up() -> void:
	_start("roar")

func _m_roar() -> void:
	invuln_t = 1.6
	play_full("a2/Idle_Rail_Call", 1.0, 0.1)
	seq_end = 1.7
	at(0.35, func():
		Sfx.at("boss_roar", global_position, 8.0)
		world.fx.shockwave(global_position, 9.0, Color(1, 0.12, 0.06) if kind != "colossus" else Color(1, 0.8, 0.4))
		world.fx.flash_light(center(), Color(1, 0.2, 0.1), 6.0, 14.0, 0.6)
		world.cam.add_trauma(0.7)
		hit_circle(global_position, 7.0, 0.25, 13.0, {"knockdown": true})
		world.toast.emit(["", "ЯРОСТЬ", "ПОСЛЕДНИЙ ВЗДОХ"][mini(phase_i, 2)], G.C_BLOOD))
	at(0.9, func():
		var adds = {
			"executioner": [["zealot", "zealot", "torch", "torch", "zealot"], ["flagellant", "flagellant", "flagellant", "torch", "zealot", "zealot"]],
			"marshal": [["knight", "knight", "crossbow", "crossbow"], ["knight", "knight", "knight", "priest", "crossbow"]],
			"inquisitor": [["flagellant", "flagellant", "witchhunter", "witchhunter"], ["flagellant", "flagellant", "flagellant", "witchhunter", "witchhunter", "priest"]],
			"colossus": [["templar", "knight", "knight"], ["templar", "templar", "priest", "priest"]],
		}
		var lst: Array = adds.get(kind, [[], []])
		_gate_spawn(lst[mini(phase_i - 1, lst.size() - 1)])
		Sfx.ui("horn", 0.0))
	if kind == "colossus" and phase_i == 2:
		at(1.2, func(): world.toast.emit("Камень трескается — бей, пока он слаб", G.C_GOLD))

# ---------------------------------------------------------------- Палач
func _m_chop() -> void:
	var tl = 0.85 / (1.0 + 0.12 * phase_i)
	var clip = "a2/TreeChopping"
	play_full(clip, _impact_speed(clip, 0.48, tl), 0.08)
	var fwd = forward() if target == null else (target.global_position - global_position).normalized()
	face(fwd)
	var L = 9.0 if kind == "executioner" else 7.5
	cur_tele = world.fx.telegraph_line(global_position, fwd, L, 2.4, tl)
	seq_end = tl + 0.7
	cont = func(_dt):
		if seq_t < tl * 0.55 and target:
			var nf = (target.global_position - global_position)
			nf.y = 0
			face(forward().slerp(nf.normalized(), 0.04))
			if is_instance_valid(cur_tele):
				cur_tele.global_rotation.y = atan2(face_dir.x, face_dir.z)
				cur_tele.global_position = global_position + face_dir * L * 0.5 + Vector3.UP * 0.05
	at(tl, func():
		var f = face_dir
		hit_line(global_position, f, L, 2.4, 1.6, 9.0)
		crack_line(global_position, f, L, 1.6)
		world.cam.add_trauma(0.55)
		Sfx.at("slam", global_position + f * 3.0, 6.0)
		Sfx.at("hit_heavy", global_position + f * 3.0, 2.0)
		if kind == "executioner" and phase_i >= 1:
			for i in 3:
				var p = global_position + f * (2.5 + i * 2.8)
				world.fx.fire_patch(p, 1.5, 4.0)
				world.add_zone(p, 1.5, 4.0, 14.0, team, "fire"))

func _m_sweep() -> void:
	var tl = 0.75 / (1.0 + 0.1 * phase_i)
	var clip = "a2/Sword_Regular_C"
	play_full(clip, _impact_speed(clip, 0.45, tl), 0.08)
	var R = 4.6 * (scale_f / 1.65)
	world.fx.telegraph_circle(global_position, R, tl)
	seq_end = tl + 0.6
	at(tl, func():
		hit_circle(global_position, R, 1.2, 11.0, {"kind": "slash"})
		world.fx.shockwave(global_position, R, Color(0.9, 0.85, 0.8))
		Sfx.at("swing_heavy", global_position, 4.0)
		world.cam.add_trauma(0.35))
	if phase_i >= 2:
		var t2 = tl + 0.55
		seq_end = t2 + 0.6
		at(tl + 0.05, func():
			play_full(clip, _impact_speed(clip, 0.45, 0.5), 0.05)
			world.fx.telegraph_circle(global_position, R * 1.2, 0.5))
		at(t2, func():
			hit_circle(global_position, R * 1.2, 1.2, 11.0, {"kind": "slash"})
			world.fx.shockwave(global_position, R * 1.2, Color(0.9, 0.85, 0.8))
			Sfx.at("swing_heavy", global_position, 4.0))

func _m_charge() -> void:
	_charge(16.0, 21.0, "a2/Sword_Dash_RM", 1.4)

func _m_shield_charge() -> void:
	_charge(12.0, 19.0, "a2/Shield_Dash_RM", 1.1)

func _charge(L: float, spd: float, clip: String, k: float) -> void:
	var tl = 0.9 / (1.0 + 0.1 * phase_i)
	var dir = forward() if target == null else (target.global_position - global_position)
	dir.y = 0
	dir = dir.normalized()
	face(dir)
	rotation.y = atan2(dir.x, dir.z)
	world.fx.telegraph_line(global_position, dir, L, 2.6 * scale_f / 1.5, tl)
	play_full("a2/Slide_Start", 0.6, 0.1)
	Sfx.at("boss_grunt", global_position, 4.0)
	var dur = L / spd
	seq_end = tl + dur + 0.6
	at(tl, func():
		play_full(clip, 1.6, 0.05)
		Sfx.at("dash", global_position, 4.0)
		cont = func(_dt):
			if seq_t > tl + dur:
				move_vel = Vector3.ZERO
				return
			move_vel = dir * spd
			face(dir)
			hit_line(global_position - dir * 0.5, dir, 2.2 * scale_f / 1.5, 2.6 * scale_f / 1.5, k, 12.0, {"once": true})
			if seq_t > tl + 0.12 and is_on_wall():
				move_vel = Vector3.ZERO
				world.cam.add_trauma(0.8)
				world.fx.dust(global_position + dir * radius, 2.5, 30)
				world.fx.blood_decal(global_position + dir * (radius + 0.5), 2.5, Color(0.25, 0.22, 0.2), world.fx.crack_tex)
				Sfx.at("stone_break", global_position, 6.0)
				stun(2.6, "%s оглушён!" % String(def.get("name", "Босс"))))

func _m_leap() -> void:
	var tp = target.global_position if target else global_position + forward() * 6.0
	var d = tp - global_position
	d.y = 0
	if d.length() > 14.0:
		tp = global_position + d.normalized() * 14.0
	var R = 4.0
	var tl = 1.15
	world.fx.telegraph_circle(tp, R, tl)
	play_full("a2/NinjaJump_Start", 1.0, 0.08)
	leap_from = global_position
	leap_to = tp
	face(d)
	seq_end = tl + 0.9
	at(0.25, func():
		set_hold("a2/NinjaJump_Idle")
		collision_mask = 0
		cont = func(_dt):
			var k = clampf((seq_t - 0.25) / (tl - 0.25), 0.0, 1.0)
			var p = leap_from.lerp(leap_to, k)
			p.y = sin(k * PI) * 5.0
			global_position = p
			velocity = Vector3.ZERO
			move_vel = Vector3.ZERO)
	at(tl, func():
		cont = null
		collision_mask = 1
		velocity = Vector3.ZERO
		global_position = Vector3(leap_to.x, 0.0, leap_to.z)
		set_hold("")
		play_full("a2/NinjaJump_Land", 1.0, 0.02)
		hit_circle(leap_to, R, 1.5, 14.0, {"knockdown": true})
		world.fx.shockwave(leap_to, R * 1.4, Color(1, 0.15, 0.08))
		world.fx.ground_slam(leap_to, R, team)
		world.fx.flash_light(leap_to + Vector3.UP, Color(1, 0.3, 0.15), 6.0, 12.0, 0.4)
		Sfx.at("slam", leap_to, 8.0)
		world.cam.add_trauma(0.85))
	at(tl + 0.1, func(): stun(1.1))

# ---------------------------------------------------------------- Маршал
func _m_combo() -> void:
	var clips = ["a2/Sword_Regular_A", "a2/Sword_Regular_B", "a2/Sword_Regular_C"]
	var t = 0.0
	for i in 3:
		var c = clips[i]
		var tl = 0.5 if i < 2 else 0.7
		var t0 = t
		at(t0, func():
			if target:
				face(target.global_position - global_position)
				rotation.y = atan2(face_dir.x, face_dir.z)
			play_full(c, _impact_speed(c, 0.5, tl), 0.06)
			var a = {"range": 3.0, "arc": 110 if i < 2 else 200, "t": 0.5}
			world.fx.telegraph_circle(global_position + face_dir * 1.6, 2.2 if i < 2 else 3.4, tl)
			move_vel = face_dir * 5.0)
		at(t0 + tl, func():
			move_vel = Vector3.ZERO
			hit_circle(global_position + face_dir * 1.6, 2.2 if i < 2 else 3.4, 1.0 if i < 2 else 1.5, 7.0 if i < 2 else 12.0, {"kind": "slash"})
			Sfx.at("swing_heavy", global_position, 3.0))
		t += tl + 0.15
	seq_end = t + 0.5

func _m_volley() -> void:
	play_full("a2/Idle_Rail_Call", 1.0, 0.1)
	Sfx.at("boss_grunt", global_position, 4.0)
	world.toast.emit("ЗАЛП!", G.C_BLOOD)
	var n = [7, 11, 15][mini(phase_i, 2)]
	var tl = 1.35
	var pts = []
	var tp = target.global_position if target else global_position
	var vel = target.velocity if target else Vector3.ZERO
	pts.append(tp + Vector3(vel.x, 0, vel.z) * 0.8)
	for i in n - 1:
		var a = randf() * TAU
		var r = randf_range(1.5, 7.0)
		pts.append(tp + Vector3(cos(a) * r, 0, sin(a) * r))
	var i = 0
	for p in pts:
		var delay = i * 0.06
		at(0.2 + delay, func(): world.fx.telegraph_circle(p, 2.0, tl))
		at(0.2 + delay + tl, func():
			_bolt_fall(p)
			world.area_damage(p, 2.0, dmgv(0.8), self, {"team": team, "kind": "pierce", "knock": 4.0, "heavy": false}))
		i += 1
	seq_end = 0.2 + tl + n * 0.06 + 0.3

func _bolt_fall(p: Vector3) -> void:
	for j in 4:
		var q = p + Vector3(randf_range(-1.2, 1.2), 0, randf_range(-1.2, 1.2))
		world.fx.spark(q + Vector3.UP * 0.1, Vector3.UP, 6)
	world.fx.dust(p, 1.4, 8)
	world.fx.blood_decal(p, 1.6, Color(0.3, 0.27, 0.25), world.fx.crack_tex)
	Sfx.at("hit_pierce", p, 0.0)

# ---------------------------------------------------------------- Инквизитор
func _m_blink() -> void:
	blink_cd = 5.0 / (1.0 + 0.3 * phase_i)
	seq_end = 0.5
	world.fx.dust(global_position, 2.0, 30)
	world.fx.flash_light(center(), Color(1, 0.6, 0.2), 6.0, 8.0, 0.3)
	Sfx.at("holy_cast", global_position, 2.0)
	var best = global_position
	var bd = -1.0
	for k in 10:
		var a = randf() * TAU
		var r = randf_range(8.0, 18.0)
		var p = Vector3(cos(a) * r, 0, sin(a) * r)
		p.x = clampf(p.x, -world.arena_half + 3, world.arena_half - 3)
		p.z = clampf(p.z, -world.arena_half + 3, world.arena_half - 3)
		var d = p.distance_to(target.global_position) if target else 0.0
		if d > bd:
			bd = d; best = p
	at(0.15, func():
		global_position = best
		world.fx.dust(best, 2.0, 30)
		world.fx.sigil(best, 1.6, 0.8, Color(1, 0.7, 0.3), 2.0))

func _m_bolts() -> void:
	var tl = 0.55
	play_full("a1/Spell_Simple_Shoot", 0.9, 0.08)
	seq_end = 1.6
	for v in 2:
		at(tl + v * 0.65, func():
			if target == null:
				return
			var to = target.global_position - global_position
			var base = atan2(to.x, to.z)
			var n = 7 + 2 * phase_i
			for i in n:
				var ang = base + deg_to_rad(-40.0 + 80.0 * float(i) / float(n - 1)) + (0.08 if v == 1 else 0.0)
				world.spawn_projectile("holy", center() + Vector3.UP * 0.3, Vector3(sin(ang), 0, cos(ang)), self, dmgv(0.55), {})
			Sfx.at("holy_cast", global_position, 2.0)
			if v == 1:
				play_full("a1/Spell_Simple_Shoot", 1.1, 0.05))

func _pillar(p: Vector3, tl: float, delay: float) -> void:
	at(delay, func(): world.fx.telegraph_circle(p, 2.2, tl, Color(1, 0.45, 0.1)))
	at(delay + tl, func():
		world.fx.fire_patch(p, 2.0, 3.5)
		world.fx.flash_light(p + Vector3.UP * 1.5, Color(1, 0.5, 0.15), 6.0, 7.0, 0.4)
		world.area_damage(p, 2.2, dmgv(0.95), self, {"team": team, "kind": "fire", "fire": true, "knock": 6.0})
		world.add_zone(p, 1.8, 3.5, 12.0, team, "fire")
		Sfx.at("firebomb", p, 2.0))

func _m_pillars() -> void:
	play_full("a1/Spell_Simple_Enter", 0.8, 0.1)
	set_hold("a1/Spell_Simple_Idle", true)
	var tp = target.global_position if target else global_position
	_pillar(tp, 1.1, 0.2)
	var n = 5 + 2 * phase_i
	for i in n:
		var a = TAU * float(i) / float(n) + randf() * 0.3
		_pillar(tp + Vector3(cos(a), 0, sin(a)) * randf_range(3.0, 4.5), 1.1, 0.25 + i * 0.04)
	seq_end = 1.7
	at(1.5, func(): set_hold(""))

func _m_pillar_line() -> void:
	play_full("a1/Spell_Simple_Shoot", 0.7, 0.1)
	var d = (target.global_position - global_position) if target else forward()
	d.y = 0
	d = d.normalized()
	for i in 9:
		_pillar(global_position + d * (2.5 + i * 2.2), 0.7, 0.2 + i * 0.12)
	seq_end = 2.4

func _m_purge() -> void:
	channeling = true
	channel_hp = max_hp * 0.06
	play_full("a1/Spell_Simple_Enter", 0.7, 0.1)
	set_hold("a1/Spell_Simple_Idle", true)
	var R = 12.0
	var tl = 2.4
	world.fx.telegraph_circle(global_position, R, tl, Color(1, 0.75, 0.25))
	world.fx.sigil(global_position, 2.5, tl, Color(1, 0.75, 0.3), 3.0)
	world.toast.emit("Инквизитор сжигает мёртвых — прерви ритуал!", G.C_GOLD)
	Sfx.at("holy_cast", global_position, 6.0)
	seq_end = tl + 0.5
	at(tl, func():
		channeling = false
		set_hold("")
		var n = 0
		for c in world.corpses_near(global_position, R):
			world.fx.fire_patch(c.corpse_pos(), 1.2, 2.5)
			c.raisable = false
			c.corpse = false
			world.corpses.erase(c)
			world._sink_corpse(c)
			n += 1
		heal(max_hp * 0.035 * mini(n, 10))
		world.fx.shockwave(global_position, R, Color(1, 0.75, 0.25))
		world.fx.flash_light(center(), Color(1, 0.8, 0.4), 8.0, 20.0, 0.6)
		Sfx.at("holy_heal", global_position, 6.0))

# ---------------------------------------------------------------- Колосс
func _m_smash() -> void:
	var tl = 1.1 / (1.0 + 0.1 * phase_i)
	var clip = "a2/TreeChopping"
	play_full(clip, _impact_speed(clip, 0.48, tl), 0.1)
	var p = global_position + face_dir * 4.2
	var R = 4.0
	cur_tele = world.fx.telegraph_circle(p, R, tl)
	seq_end = tl + 0.4
	cont = func(_dt):
		if seq_t < tl * 0.5 and target:
			var nf = target.global_position - global_position
			nf.y = 0
			face(forward().slerp(nf.normalized(), 0.05))
			if is_instance_valid(cur_tele):
				cur_tele.global_position = global_position + face_dir * 4.2 + Vector3.UP * 0.05
	at(tl, func():
		var q = global_position + face_dir * 4.2
		hit_circle(q, R, 1.7, 14.0, {"knockdown": true})
		world.fx.ground_slam(q, R, team)
		world.fx.shockwave(q, R * 1.5, Color(1, 0.8, 0.45))
		Sfx.at("slam", q, 9.0)
		Sfx.at("stone_break", q, 4.0)
		world.cam.add_trauma(0.9)
		slam_count += 1
		if slam_count % 2 == 0 or phase_i >= 2:
			stun(2.2, "Колосс застрял — бей!"))

func _m_sweep_big() -> void:
	var tl = 1.0
	var clip = "a2/Sword_Regular_C"
	play_full(clip, _impact_speed(clip, 0.45, tl), 0.1)
	var R = 7.5
	world.fx.telegraph_circle(global_position, R, tl)
	seq_end = tl + 0.6
	at(tl, func():
		hit_circle(global_position, R, 1.3, 13.0, {"kind": "blunt", "knockdown": true})
		world.fx.shockwave(global_position, R, Color(1, 0.8, 0.45))
		world.fx.dust(global_position, R * 0.7, 30)
		Sfx.at("swing_heavy", global_position, 8.0)
		world.cam.add_trauma(0.5))

func _m_rings() -> void:
	play_full("a2/NinjaJump_Land", 0.7, 0.1)
	var n = 2 + phase_i
	world.fx.telegraph_circle(global_position, 3.0, 0.6, Color(1, 0.8, 0.3))
	for i in n:
		at(0.6 + i * 0.75, func():
			Sfx.at("slam", global_position, 7.0)
			world.cam.add_trauma(0.45)
			world.fx.dust(global_position, 3.0, 20)
			_ring_wave(global_position, 20.0, 1.8))
	seq_end = 0.6 + n * 0.75 + 0.4

func _ring_wave(p: Vector3, max_r: float, dur: float) -> void:
	var mi = MeshInstance3D.new()
	var tm = TorusMesh.new(); tm.inner_radius = 0.96; tm.outer_radius = 1.0; tm.rings = 64; tm.ring_segments = 6
	mi.mesh = tm
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1, 0.75, 0.35, 0.95)
	m.emission_enabled = true; m.emission = Color(1, 0.7, 0.3); m.emission_energy_multiplier = 4.0
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.fx.add_child(mi)
	mi.global_position = p + Vector3.UP * 0.25
	mi.scale = Vector3(1, 3.0, 1)
	var hit = {}
	var tw = mi.create_tween()
	tw.tween_method(func(r):
		mi.scale = Vector3(r, 3.0, r)
		m.albedo_color.a = 0.95 * (1.0 - r / max_r * 0.6)
		for e in world.units_of(1 - team):
			if e.dead or hit.has(e.get_instance_id()) or e.invuln_t > 0.0:
				continue
			var d = Vector2(e.global_position.x - p.x, e.global_position.z - p.z).length()
			if absf(d - r) < 0.55 + e.radius * 0.5:
				hit[e.get_instance_id()] = true
				var dir = (e.global_position - p); dir.y = 0; dir = dir.normalized()
				e.take_hit({"dmg": dmgv(0.9), "src": self, "dir": dir, "point": e.center(), "knock": 9.0, "heavy": true, "kind": "holy_zone", "stagger": 999.0, "team": team, "no_block": true})
				if not e.dead:
					e.knockdown(dir, 9.0), 1.0, max_r, dur)
	tw.tween_callback(mi.queue_free)

func _m_beam() -> void:
	var tl = 1.0
	var L = 26.0
	var d = (target.global_position - global_position) if target else forward()
	d.y = 0
	d = d.normalized()
	face(d)
	rotation.y = atan2(d.x, d.z)
	world.fx.telegraph_line(global_position, d, L, 1.8, tl, Color(1, 0.75, 0.3))
	play_full("a1/Spell_Simple_Enter", 0.6, 0.1)
	set_hold("a1/Spell_Simple_Idle", true)
	Sfx.at("holy_cast", global_position, 8.0)
	beam_ang = atan2(d.x, d.z)
	beam_spd = deg_to_rad(42.0 + 12.0 * phase_i) * (1.0 if randf() < 0.5 else -1.0)
	var dur = 2.6
	seq_end = tl + dur + 0.4
	at(tl, func():
		beam = MeshInstance3D.new()
		var bm = BoxMesh.new(); bm.size = Vector3(1.0, 1.0, L)
		beam.mesh = bm
		var m = StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.albedo_color = Color(1, 0.75, 0.35, 0.8)
		m.emission_enabled = true; m.emission = Color(1, 0.7, 0.3); m.emission_energy_multiplier = 6.0
		beam.material_override = m
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		world.fx.add_child(beam)
		var bl = OmniLight3D.new(); bl.light_color = Color(1, 0.75, 0.35); bl.light_energy = 4.0; bl.omni_range = 10.0
		beam.add_child(bl)
		Sfx.at("holy_hit", global_position, 8.0)
		cont = func(dt):
			if seq_t > tl + dur:
				_end_beam()
				return
			beam_ang += beam_spd * dt
			var bd = Vector3(sin(beam_ang), 0, cos(beam_ang))
			face(bd)
			rotation.y = beam_ang
			if is_instance_valid(beam):
				beam.global_position = global_position + Vector3.UP * 1.4 * scale_f * 0.55 + bd * (L * 0.5 + 0.8)
				beam.global_rotation = Vector3(0, beam_ang, 0)
				beam.scale = Vector3(1.0 + 0.15 * sin(seq_t * 40.0), 1.0, 1.0)
			beam_tick -= dt
			if beam_tick <= 0.0:
				beam_tick = 0.18
				hit_line(global_position, bd, L, 1.4, 0.35, 5.0, {"kind": "holy_zone", "fire": true})
				world.fx.dust(global_position + bd * randf_range(3.0, L), 1.0, 4))

func _end_beam() -> void:
	if is_instance_valid(beam):
		beam.queue_free()
	beam = null
	if kind == "colossus" or kind == "inquisitor":
		set_hold("")

func _m_debris() -> void:
	play_full("a2/Idle_Rail_Call", 0.9, 0.1)
	Sfx.at("boss_roar", global_position, 6.0)
	world.cam.add_trauma(0.4)
	var n = 8 + 3 * phase_i
	var tp = target.global_position if target else global_position
	for i in n:
		var p = tp + Vector3(randf_range(-8, 8), 0, randf_range(-8, 8))
		if i == 0:
			p = tp
		var delay = 0.3 + i * 0.09
		at(delay, func(): world.fx.telegraph_circle(p, 1.8, 1.2))
		at(delay + 0.75, func(): _rock_fall(p, 0.45))
	seq_end = 0.3 + n * 0.09 + 1.6

func _rock_fall(p: Vector3, t: float) -> void:
	var rk = MeshInstance3D.new()
	var sm = SphereMesh.new(); sm.radius = 0.7; sm.height = 1.1; sm.radial_segments = 7; sm.rings = 4
	rk.mesh = sm
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color(0.4, 0.38, 0.35); mat.roughness = 0.95
	rk.material_override = mat
	world.fx.add_child(rk)
	rk.global_position = p + Vector3.UP * 16.0
	rk.rotation = Vector3(randf() * TAU, randf() * TAU, 0)
	var tw = rk.create_tween()
	tw.tween_property(rk, "global_position", p + Vector3.UP * 0.4, t).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_QUAD)
	tw.tween_callback(func():
		world.area_damage(p, 1.9, dmgv(1.0), self, {"team": team, "kind": "blunt", "knock": 7.0})
		world.fx.dust(p, 1.8, 14)
		world.fx.blood_decal(p, 2.2, Color(0.25, 0.22, 0.2), world.fx.crack_tex)
		for j in 3:
			world.fx.gib_chunk(p + Vector3.UP * 0.5, Vector3(randf_range(-4, 4), randf_range(3, 7), randf_range(-4, 4)), true)
		Sfx.at("stone_break", p, 2.0)
		world.cam.add_trauma(0.15))
	tw.tween_interval(0.05)
	tw.tween_callback(rk.queue_free)
