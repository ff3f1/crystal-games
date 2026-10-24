class_name Actor
extends CharacterBody3D
## Базовый боец: модель, анимационное дерево, урон, реакции, смерть.

signal died(a: Actor, hit: Dictionary)

enum S {IDLE, ACTION, STAGGER, KNOCKDOWN, BROKEN, DEAD, SPAWN, BLOCK}

const UPPER_BONES := ["Spine", "Chest", "UpperChest", "Neck", "Head", "LeftShoulder", "LeftUpperArm", "LeftLowerArm", "LeftHand",
	"RightShoulder", "RightUpperArm", "RightLowerArm", "RightHand",
	"LeftThumbMetacarpal", "LeftThumbProximal", "LeftThumbDistal", "LeftIndexProximal", "LeftIndexIntermediate", "LeftIndexDistal",
	"LeftMiddleProximal", "LeftMiddleIntermediate", "LeftMiddleDistal", "LeftRingProximal", "LeftRingIntermediate", "LeftRingDistal",
	"LeftLittleProximal", "LeftLittleIntermediate", "LeftLittleDistal",
	"RightThumbMetacarpal", "RightThumbProximal", "RightThumbDistal", "RightIndexProximal", "RightIndexIntermediate", "RightIndexDistal",
	"RightMiddleProximal", "RightMiddleIntermediate", "RightMiddleDistal", "RightRingProximal", "RightRingIntermediate", "RightRingDistal",
	"RightLittleProximal", "RightLittleIntermediate", "RightLittleDistal"]

var world: Node
var uid = ""
var def: Dictionary = {}
var look_key = ""
var look: Dictionary = {}
var team = 1
var hp = 100.0
var max_hp = 100.0
var armor = 0.0
var poise = 10.0
var poise_max = 10.0
var speed = 4.0
var dmg = 10.0
var radius = 0.42
var is_player = false
var is_boss = false
var undead = false
var elite = false
var dead = false
var corpse = false
var gibbed = false
var raisable = true
var scale_f = 1.0
var dmg_mul = 1.0
var aspd = 1.0
var spd_mul = 1.0

var model: Node3D
var skel: Skeleton3D
var tree: AnimationTree
var bt: AnimationNodeBlendTree
var geo: Array = []
var item_nodes: Dictionary = {}
var loco_kind = "human"

var state = S.IDLE
var action: Dictionary = {}
var action_t = 0.0
var action_len = 0.0
var action_spd = 1.0
var action_hit = false
var hit_ids = {}
var local_ts = 1.0
var hitstop_t = 0.0
var face_dir = Vector3(0, 0, 1)
var move_vel = Vector3.ZERO
var push_vel = Vector3.ZERO
var slow_t = 0.0
var slow_amt = 0.0
var burn_t = 0.0
var burn_dps = 0.0
var flash = 0.0
var flash_col = Color(1, 1, 1)
var blood = 0.0
var invuln_t = 0.0
var state_t = 0.0
var broken_t = 0.0
var last_hit: Dictionary = {}
var dead_t = 0.0
var severed = {}
var frenzy_t = 0.0
var attack_cd = 0.0
var regen = 0.0
var hit_flinch_cd = 0.0
var _last_shader_push = {}

func setup(w: Node, id: String, d: Dictionary) -> void:
	world = w
	uid = id
	def = d
	team = int(d.get("team", 1))
	undead = bool(d.get("undead", false))
	elite = bool(d.get("elite", false))
	max_hp = float(d.get("hp", 100)); hp = max_hp
	armor = float(d.get("armor", 0.0))
	poise_max = float(d.get("poise", 10)); poise = poise_max
	speed = float(d.get("speed", 4.0))
	dmg = float(d.get("dmg", 10))
	is_boss = bool(d.get("boss", false))
	look_key = String(d.get("look", "zealot"))
	look = G.LOOKS[look_key].duplicate(true)
	if undead:
		look["undead"] = 1.0
		look["eyes"] = Color(0.3, 1.0, 0.45, 5.0)
		look_key += "@u"
		loco_kind = "zombie" if d.get("ai", "") == "minion" and not elite and look_key.begins_with("ghoul") else "human"
	if d.has("look_over"):
		look.merge(d["look_over"], true)
	scale_f = float(look.get("scale", 1.0)) * float(d.get("scale", 1.0))
	look["scale"] = scale_f

func _ready() -> void:
	collision_layer = 2
	collision_mask = 1
	var cs = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	radius = 0.38 * scale_f
	cap.radius = radius
	cap.height = 1.75 * scale_f
	cs.shape = cap
	cs.position.y = cap.height * 0.5
	add_child(cs)
	floor_snap_length = 0.4
	safe_margin = 0.02
	_build_model()

func _build_model() -> void:
	model = CharBuilder.build(look, look_key)
	add_child(model)
	skel = model.find_children("*", "Skeleton3D", true, false)[0]
	for gi in model.find_children("*", "GeometryInstance3D", true, false):
		geo.append(gi)
	for ba in skel.get_children():
		if ba is BoneAttachment3D and ba.has_meta("item"):
			item_nodes[ba.get_meta("item")] = ba
			var idd: Dictionary = G.ITEMS.get(ba.get_meta("item"), {})
			if idd.get("fire", false):
				var f: Node3D = world.fx.torch_fire() if world and world.fx else null
				if f:
					ba.add_child(f)
					f.position = Vector3(0, 0.085, float(idd.get("fire_at", 0.42)))
	_build_tree()

# естественная скорость клипов (м/с), измерена по ходу стоп
const WALK_V := 1.1
const JOG_V := 3.5
const SPRINT_V := 5.8

func _clip(name: String) -> AnimationNodeAnimation:
	var a = AnimationNodeAnimation.new()
	a.animation = StringName(name)
	return a

func _build_tree() -> void:
	tree = AnimationTree.new()
	tree.name = "AnimTree"
	model.add_child(tree)
	AnimLib.attach(tree)
	tree.root_node = NodePath("..")
	bt = AnimationNodeBlendTree.new()
	var loco = AnimationNodeBlendSpace1D.new()
	if loco_kind == "zombie":
		loco.add_blend_point(_clip("a2/Zombie_Idle"), 0.0, -1, &"idle")
		loco.add_blend_point(_clip("a2/Zombie_Walk_Fwd"), WALK_V, -1, &"walk")
		loco.add_blend_point(_clip("a1/Jog_Fwd"), JOG_V, -1, &"run")
	else:
		loco.add_blend_point(_clip(_idle_clip()), 0.0, -1, &"idle")
		loco.add_blend_point(_clip("a1/Walk"), WALK_V, -1, &"walk")
		loco.add_blend_point(_clip("a1/Jog_Fwd"), JOG_V, -1, &"jog")
		loco.add_blend_point(_clip("a1/Sprint"), SPRINT_V, -1, &"sprint")
	loco.min_space = -1.0
	loco.max_space = 8.0
	bt.add_node("loco", loco, Vector2(0, 0))
	var lts = AnimationNodeTimeScale.new()
	bt.add_node("loco_ts", lts, Vector2(200, 0))
	bt.connect_node("loco_ts", 0, "loco")
	var hold = _clip("a1/Idle")
	bt.add_node("hold", hold, Vector2(0, 200))
	var base = AnimationNodeTransition.new()
	base.input_count = 2
	base.set_input_name(0, "loco")
	base.set_input_name(1, "hold")
	base.xfade_time = 0.18
	bt.add_node("base", base, Vector2(400, 0))
	bt.connect_node("base", 0, "loco_ts")
	bt.connect_node("base", 1, "hold")
	var uhold = _clip("a1/Idle")
	bt.add_node("uhold", uhold, Vector2(400, 150))
	var ublend = AnimationNodeBlend2.new()
	ublend.filter_enabled = true
	for b in UPPER_BONES:
		ublend.set_filter_path(NodePath("%GeneralSkeleton:" + b), true)
	bt.add_node("ublend", ublend, Vector2(600, 0))
	bt.connect_node("ublend", 0, "base")
	bt.connect_node("ublend", 1, "uhold")
	var up_clip = _clip("a1/Hit_Chest")
	bt.add_node("up_clip", up_clip, Vector2(400, 300))
	var up_ts = AnimationNodeTimeScale.new()
	bt.add_node("up_ts", up_ts, Vector2(600, 300))
	bt.connect_node("up_ts", 0, "up_clip")
	var upshot = AnimationNodeOneShot.new()
	upshot.fadein_time = 0.06
	upshot.fadeout_time = 0.2
	upshot.filter_enabled = true
	for b in UPPER_BONES:
		upshot.set_filter_path(NodePath("%GeneralSkeleton:" + b), true)
	bt.add_node("upshot", upshot, Vector2(800, 0))
	bt.connect_node("upshot", 0, "ublend")
	bt.connect_node("upshot", 1, "up_ts")
	var full_clip = _clip("a1/Hit_Chest")
	bt.add_node("full_clip", full_clip, Vector2(800, 300))
	var full_ts = AnimationNodeTimeScale.new()
	bt.add_node("full_ts", full_ts, Vector2(1000, 300))
	bt.connect_node("full_ts", 0, "full_clip")
	var full = AnimationNodeOneShot.new()
	full.fadein_time = 0.07
	full.fadeout_time = 0.22
	bt.add_node("full", full, Vector2(1200, 0))
	bt.connect_node("full", 0, "upshot")
	bt.connect_node("full", 1, "full_ts")
	var ts = AnimationNodeTimeScale.new()
	bt.add_node("ts", ts, Vector2(1400, 0))
	bt.connect_node("ts", 0, "full")
	bt.connect_node("output", 0, "ts")
	tree.tree_root = bt
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	tree.set("parameters/loco_ts/scale", 1.0)
	tree.set("parameters/up_ts/scale", 1.0)
	tree.set("parameters/full_ts/scale", 1.0)
	tree.set("parameters/ts/scale", 1.0)
	tree.set("parameters/ublend/blend_amount", 0.0)
	tree.advance(randf() * 1.5)

func _idle_clip() -> String:
	return String(def.get("idle", "a1/Idle"))

# ---------------------------------------------------------------- анимация
func play_full(clip: String, spd := 1.0, fade_in := 0.07) -> float:
	if tree == null or not tree.active:
		return 0.5
	(bt.get_node("full_clip") as AnimationNodeAnimation).animation = StringName(clip)
	(bt.get_node("full") as AnimationNodeOneShot).fadein_time = fade_in
	tree.set("parameters/full_ts/scale", spd)
	tree.set("parameters/full/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	return AnimLib.length(clip) / maxf(0.05, spd)

func play_upper(clip: String, spd := 1.0) -> void:
	if tree == null or not tree.active:
		return
	(bt.get_node("up_clip") as AnimationNodeAnimation).animation = StringName(clip)
	tree.set("parameters/up_ts/scale", spd)
	tree.set("parameters/upshot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)

func stop_full() -> void:
	if tree and tree.active:
		tree.set("parameters/full/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)

var _uhold_on = false
var _uhold_k = 0.0
var _hold_clip = ""
func set_hold(clip: String, upper := false) -> void:
	if tree == null or not tree.active:
		return
	if clip == "":
		_uhold_on = false
		if _hold_clip != "":
			tree.set("parameters/base/transition_request", "loco")
		_hold_clip = ""
		return
	if upper:
		# поза только для корпуса — ноги продолжают шагать
		if _hold_clip != "":
			tree.set("parameters/base/transition_request", "loco")
			_hold_clip = ""
		(bt.get_node("uhold") as AnimationNodeAnimation).animation = StringName(clip)
		_uhold_on = true
		return
	_uhold_on = false
	_hold_clip = clip
	(bt.get_node("hold") as AnimationNodeAnimation).animation = StringName(clip)
	tree.set("parameters/base/transition_request", "hold")

func full_active() -> bool:
	return tree != null and tree.active and bool(tree.get("parameters/full/active"))

# ---------------------------------------------------------------- цикл
func _process(delta: float) -> void:
	if tree and tree.active:
		var tk = 1.0 if _uhold_on else 0.0
		if absf(_uhold_k - tk) > 0.001:
			_uhold_k = move_toward(_uhold_k, tk, delta * 6.0)
			tree.set("parameters/ublend/blend_amount", _uhold_k)
		var hs = 0.04 if hitstop_t > 0.0 else 1.0
		tree.advance(delta * local_ts * hs)
	if flash > 0.0:
		flash = maxf(0.0, flash - delta * 5.0)
	_push_shader()

func _push_shader() -> void:
	var f = snappedf(flash, 0.02)
	var b = snappedf(minf(blood, 0.55), 0.02)
	if _last_shader_push.get("f", -1.0) == f and _last_shader_push.get("b", -1.0) == b:
		return
	_last_shader_push["f"] = f; _last_shader_push["b"] = b
	for g in geo:
		if is_instance_valid(g):
			g.set_instance_shader_parameter("flash", f)
			g.set_instance_shader_parameter("blood", b)
			g.set_instance_shader_parameter("flash_color", Vector3(flash_col.r, flash_col.g, flash_col.b))

func set_shader_all(param: String, v: float) -> void:
	for g in geo:
		if is_instance_valid(g):
			g.set_instance_shader_parameter(param, v)

func _physics_process(delta: float) -> void:
	if dead:
		_dead_tick(delta)
		return
	var dt = delta * local_ts
	if hitstop_t > 0.0:
		hitstop_t -= delta
		dt *= 0.04
	state_t += dt
	attack_cd -= dt
	hit_flinch_cd -= dt
	invuln_t -= dt
	frenzy_t -= dt
	if slow_t > 0.0:
		slow_t -= dt
	if burn_t > 0.0:
		burn_t -= dt
		_burn_tick(dt)
	if regen > 0.0 and hp < max_hp:
		hp = minf(max_hp, hp + regen * dt)
	match state:
		S.ACTION:
			_action_tick(dt)
		S.STAGGER:
			if state_t > float(action.get("stun", 0.5)):
				state = S.IDLE
		S.KNOCKDOWN:
			if state_t > 1.6:
				state = S.IDLE
				set_hold("")
		S.BROKEN:
			broken_t -= dt
			if broken_t <= 0.0:
				var h = {"dmg": hp + 1.0, "dir": -face_dir, "kind": "bleed", "src": null}
				_die(h)
				return
	think(dt)
	_move(delta, dt)

func think(_dt: float) -> void:
	pass

func can_act() -> bool:
	return state == S.IDLE and not dead

func cur_speed() -> float:
	var s = speed * spd_mul
	if slow_t > 0.0:
		s *= 1.0 - slow_amt
	if frenzy_t > 0.0:
		s *= 1.3
	return s

func _move(delta: float, dt: float) -> void:
	var mv = move_vel
	if state == S.ACTION:
		mv = mv * float(action.get("move_mul", 0.0))
		var lunge: float = float(action.get("lunge", 0.0))
		if lunge > 0.0 and action_len > 0.0:
			var nt = action_t / action_len
			var t0: float = float(action.get("lunge_t0", 0.1)); var t1: float = float(action.get("t", 0.5))
			if nt > t0 and nt < t1:
				mv += face_dir * lunge
	elif state in [S.STAGGER, S.KNOCKDOWN, S.BROKEN, S.SPAWN]:
		mv = Vector3.ZERO
	var hor = mv + push_vel
	velocity.x = hor.x * local_ts
	velocity.z = hor.z * local_ts
	if is_on_floor():
		velocity.y = -1.0
	else:
		velocity.y -= 25.0 * delta
	move_and_slide()
	if global_position.y < -0.5:
		global_position.y = 0.0
	push_vel = push_vel.move_toward(Vector3.ZERO, 22.0 * delta)
	# поворот
	var fd = Vector3(face_dir.x, 0, face_dir.z)
	var hv0 = Vector3(mv.x, 0, mv.z)
	if not is_player and state == S.IDLE and hv0.length() > 1.0 and fd.length_squared() > 0.001:
		var ang = rad_to_deg(fd.angle_to(hv0))
		if ang > 60.0 and ang < 125.0:
			fd = hv0.normalized()
	if fd.length_squared() > 0.001 and state not in [S.KNOCKDOWN, S.BROKEN]:
		var target_y = atan2(fd.x, fd.z)
		var rs = 14.0 if state != S.ACTION else float(action.get("turn", 4.0))
		rotation.y = lerp_angle(rotation.y, target_y, clampf(rs * dt, 0.0, 1.0))
	# локомоция
	if tree and tree.active:
		var hv = Vector3(mv.x, 0, mv.z)
		var spd = hv.length()
		var fwd = Vector3(sin(rotation.y), 0, cos(rotation.y))
		var sign = 1.0 if hv.dot(fwd) >= -0.2 * spd else -1.0
		var bs: float = tree.get("parameters/loco/blend_position")
		tree.set("parameters/loco/blend_position", lerpf(bs, spd / maxf(0.5, scale_f), clampf(10.0 * dt, 0, 1)))
		var anim_spd = 1.0
		var vs = spd / maxf(0.5, scale_f)
		if loco_kind == "zombie":
			anim_spd = clampf(vs / WALK_V, 0.8, 2.6) if vs > 0.3 and vs < WALK_V * 1.8 else (clampf(vs / JOG_V, 0.8, 1.6) if vs >= WALK_V * 1.8 else 1.0)
		elif vs > SPRINT_V:
			anim_spd = clampf(vs / SPRINT_V, 1.0, 1.6)
		tree.set("parameters/loco_ts/scale", anim_spd * sign)

func face(dir: Vector3) -> void:
	dir.y = 0
	if dir.length_squared() > 0.0001:
		face_dir = dir.normalized()

func forward() -> Vector3:
	return Vector3(sin(rotation.y), 0, cos(rotation.y))

func flat_dist(p: Vector3) -> float:
	return Vector2(p.x - global_position.x, p.z - global_position.z).length()

func center() -> Vector3:
	return global_position + Vector3(0, 1.1 * scale_f, 0)

# ---------------------------------------------------------------- атака
func start_attack(a: Dictionary, spd_mul := 1.0) -> void:
	action = a
	action_t = 0.0
	action_hit = false
	hit_ids.clear()
	action_spd = float(a.get("speed", 1.0)) * spd_mul * aspd
	action_len = play_full(String(a["anim"]), action_spd, float(a.get("fade", 0.07)))
	state = S.ACTION
	state_t = 0.0
	if a.has("tele") and world:
		world.fx.telegraph(self, a)
	if a.has("swing_sfx"):
		Sfx.at(String(a["swing_sfx"]), global_position, -4.0)

func _action_tick(dt: float) -> void:
	action_t += dt
	var nt = action_t / maxf(0.01, action_len)
	if not action.has("_trail") and action.has("range") and not action.get("ranged", false) and not action.has("slam"):
		if nt >= float(action.get("t", 0.5)) - 0.11 / maxf(0.1, action_len):
			action["_trail"] = true
			on_swing(action)
	if not action_hit and nt >= float(action.get("t", 0.5)):
		action_hit = true
		on_action_event(action)
	if action.has("t2") and nt >= float(action["t2"]) and not action.get("_t2", false):
		action["_t2"] = true
		hit_ids.clear()
		on_action_event(action)
	if nt >= float(action.get("end", 0.9)):
		state = S.IDLE
		on_action_end(action)

func on_action_event(a: Dictionary) -> void:
	if a.get("ranged", false):
		fire_ranged(a)
	else:
		melee_hit(a)

func on_action_end(_a: Dictionary) -> void:
	pass

## Визуальный след удара (герой, элита и боссы).
func on_swing(a: Dictionary) -> void:
	if not (elite or is_boss) or world == null:
		return
	var r = float(a.get("range", 2.0)) * maxf(1.0, scale_f * 0.9) + 0.2
	world.fx.swing_arc(self, r, minf(float(a.get("arc", 90.0)), 300.0), Color(0.9, 0.25, 0.12), 0.16, randf() < 0.5, randf_range(-0.25, 0.25))

func fire_ranged(_a: Dictionary) -> void:
	pass

func hostile_team() -> int:
	return 1 - team

## Удар по дуге перед бойцом. Возвращает число попаданий.
func melee_hit(a: Dictionary, origin_override = null) -> int:
	if world == null:
		return 0
	var r: float = float(a.get("range", 2.0)) * maxf(1.0, scale_f * 0.9) + float(a.get("range_bonus", 0.0))
	var arc: float = float(a.get("arc", 90.0)) + float(a.get("arc_bonus", 0.0))
	var org: Vector3 = global_position if origin_override == null else origin_override
	var fwd = forward()
	var n = 0
	var heavy: bool = a.get("heavy", false)
	var aoe: float = float(a.get("aoe", 0.0))
	for e in world.units_of(hostile_team()):
		if e.dead or hit_ids.has(e.get_instance_id()):
			continue
		var to: Vector3 = e.global_position - org
		to.y = 0
		var d = to.length()
		if d > r + e.radius:
			continue
		var ok = d < 0.7 + e.radius
		if not ok:
			var ang = rad_to_deg(fwd.angle_to(to / maxf(0.001, d)))
			ok = ang <= arc * 0.5
		if aoe > 0.0:
			var c = org + fwd * r * 0.75
			ok = ok or Vector2(e.global_position.x - c.x, e.global_position.z - c.z).length() < aoe + e.radius
		if not ok:
			continue
		hit_ids[e.get_instance_id()] = true
		var h = make_hit(a, e)
		e.take_hit(h)
		n += 1
	if world.has_method("hit_props"):
		world.hit_props(org, fwd, r, arc, make_hit(a, null))
	if n > 0:
		hitstop_t = 0.11 if heavy else 0.065
		on_hit_landed(a, n)
	if aoe > 0.0 and heavy:
		world.fx.ground_slam(org + fwd * r * 0.75, aoe, team)
	return n

func on_hit_landed(_a: Dictionary, _n: int) -> void:
	pass

func make_hit(a: Dictionary, target) -> Dictionary:
	var d: float = dmg * float(a.get("dmg", 1.0)) * dmg_mul
	if frenzy_t > 0.0:
		d *= 1.35
	var dir = forward()
	var pt = center()
	if target != null:
		dir = (target.global_position - global_position)
		dir.y = 0
		dir = dir.normalized() if dir.length() > 0.01 else forward()
		pt = target.center() - dir * target.radius * 0.6
	return {"dmg": d, "src": self, "dir": dir, "point": pt, "knock": float(a.get("knock", 2.5)), "heavy": a.get("heavy", false),
		"kind": String(a.get("kind", "slash")), "crit": false, "stagger": float(a.get("stagger", d)), "fire": a.get("fire", false),
		"no_block": a.get("no_block", false), "team": team}

# ---------------------------------------------------------------- получение урона
func is_blocking(h: Dictionary) -> bool:
	var sh = float(def.get("shield", 0.0))
	if sh <= 0.0 or state in [S.STAGGER, S.KNOCKDOWN, S.BROKEN] or h.get("heavy", false) or h.get("no_block", false):
		return false
	if String(h.get("kind", "")) in ["explosion", "fire", "bleed", "holy_zone"]:
		return false
	var from: Vector3 = -Vector3(h["dir"])
	return forward().angle_to(from) < deg_to_rad(65.0)

func take_hit(h: Dictionary) -> void:
	if dead or invuln_t > 0.0:
		return
	var d: float = float(h["dmg"])
	var kind: String = String(h.get("kind", "slash"))
	var src = h.get("src")
	last_hit = h
	if is_blocking(h):
		d *= 1.0 - float(def.get("shield", 0.0))
		poise -= float(h.get("stagger", d)) * 1.6
		world.fx.spark(Vector3(h.get("point", center())), -Vector3(h["dir"]), 14)
		Sfx.at("block", global_position, 0.0)
		push_vel += Vector3(h["dir"]) * 1.5
		if src is Actor:
			(src as Actor).hitstop_t = 0.09
		if poise <= 0.0:
			guard_break()
		else:
			play_upper("a2/Sword_Block", 1.6)
		h["blocked"] = true
	if kind != "bleed" and kind != "fire" and kind != "holy_zone":
		var arm = armor
		if kind == "blunt" or kind == "explosion":
			arm *= 0.5
		d *= 1.0 - arm
	hp -= d
	h["final"] = d
	if world:
		world.on_damage(self, h)
	if not h.get("blocked", false) and kind not in ["fire", "bleed", "holy_zone"]:
		flash = 1.0
		flash_col = Color(1, 0.85, 0.8) if not h.get("crit", false) else Color(1, 0.3, 0.2)
		blood = minf(1.0, blood + d / max_hp * 0.9 + 0.06)
		if world:
			world.fx.blood_hit(Vector3(h.get("point", center())), Vector3(h["dir"]), d, self)
	var by_player = src is Player and team != 0
	if by_player and world and not h.get("blocked", false):
		_player_impact(h, d)
	if h.get("fire", false):
		ignite(3.0, 6.0)
	if src is Actor and src.has_method("perk_slow") and src.perk_slow():
		slow_t = 1.5; slow_amt = 0.3
	if hp <= 0.0:
		if by_player and world.has_method("hit_confirm"):
			world.hit_confirm(true, h.get("crit", false))
		_die(h)
		return
	if by_player and world.has_method("hit_confirm"):
		world.hit_confirm(false, h.get("crit", false))
	if h.get("blocked", false):
		return
	# реакции
	var kb: float = float(h.get("knock", 2.0))
	poise -= float(h.get("stagger", d))
	if is_boss:
		push_vel += Vector3(h["dir"]) * kb * 0.15
		return
	if poise <= 0.0 or (h.get("heavy", false) and poise_max < 120.0):
		poise = poise_max
		stagger(h)
	else:
		var pk = 0.95 if src is Player else 0.5
		push_vel += Vector3(h["dir"]) * kb * pk
		if hit_flinch_cd <= 0.0 and (state != S.ACTION or src is Player):
			play_upper(["a1/Hit_Chest", "a1/Hit_Head"][randi() % 2], 1.5)
			hit_flinch_cd = 0.14 if src is Player else 0.35
	check_broken()

## Отдача попадания героя: заморозка жертвы, вспышка, искры, звук плоти.
func _player_impact(h: Dictionary, d: float) -> void:
	var heavy = h.get("heavy", false) or h.get("crit", false)
	hitstop_t = maxf(hitstop_t, 0.1 if heavy else 0.055)
	flash = 1.0
	var kind = String(h.get("kind", "slash"))
	world.fx.impact(Vector3(h.get("point", center())), Vector3(h["dir"]), heavy, armor > 0.15 or def.has("shield"), kind)
	if kind != "explosion":
		Sfx.at("hit_heavy" if heavy else "hit_flesh", center(), 1.0 if heavy else -2.0)
	if h.get("crit", false):
		Sfx.at("sever", center(), -4.0)

func check_broken() -> void:
	if is_player or is_boss or undead or state == S.BROKEN or dead:
		return
	var thr = 0.22
	if world and world.has_method("break_threshold"):
		thr = world.break_threshold()
	if hp < max_hp * thr and randf() < 0.55:
		enter_broken()

func enter_broken() -> void:
	state = S.BROKEN
	state_t = 0.0
	broken_t = 7.0
	stop_full()
	set_hold("a1/Fixing_Kneeling")
	move_vel = Vector3.ZERO
	if world:
		world.on_broken(self)

func stagger(h: Dictionary) -> void:
	state = S.STAGGER
	state_t = 0.0
	action = {"stun": 0.75 if h.get("heavy", false) else 0.5}
	face(-Vector3(h["dir"]))
	rotation.y = atan2(face_dir.x, face_dir.z)
	push_vel += Vector3(h["dir"]) * float(h.get("knock", 3.0))
	play_full("a2/Hit_Knockback", 1.2 if not h.get("heavy", false) else 0.9)

func knockdown(dir: Vector3, force: float) -> void:
	if is_boss or dead:
		return
	state = S.KNOCKDOWN
	state_t = 0.0
	push_vel += dir * force
	play_full("a2/Hit_Knockback", 0.8)

func guard_break() -> void:
	poise = poise_max
	state = S.STAGGER
	state_t = 0.0
	action = {"stun": 1.1}
	play_full("a2/Idle_Shield_Break", 1.0)
	Sfx.at("guard_break", global_position, 2.0)

func ignite(t: float, dps: float) -> void:
	if undead and team == 0 and dps < 0:
		return
	burn_t = maxf(burn_t, t)
	burn_dps = maxf(burn_dps, dps)
	if world:
		world.fx.attach_burn(self, t)

func _burn_tick(dt: float) -> void:
	hp -= burn_dps * dt
	if hp <= 0.0:
		_die({"dmg": 1.0, "dir": forward(), "kind": "fire", "src": null})

func heal(v: float) -> void:
	if dead:
		return
	hp = minf(max_hp, hp + v)

# ---------------------------------------------------------------- смерть
func _die(h: Dictionary) -> void:
	if dead:
		return
	dead = true
	state = S.DEAD
	dead_t = 0.0
	collision_layer = 0
	collision_mask = 1
	move_vel = Vector3.ZERO
	died.emit(self, h)
	if world:
		world.on_death(self, h)
	var g = G.gore()
	var kind = String(h.get("kind", ""))
	var big: bool = h.get("crit", false) or float(h.get("final", h.get("dmg", 0.0))) > max_hp * 0.6 or kind == "explosion" or h.get("heavy", false)
	var by_pl = h.get("src") is Player
	if kind == "explosion" and g >= 1 and not is_boss and randf() < 0.95:
		gib(h)
		return
	if g >= 1 and not is_boss and (big or (by_pl and randf() < (0.7 if g >= 2 else 0.35)) or randf() < 0.2):
		world.fx.dismember(self, h)
		if g >= 2 and (big or randf() < 0.35):
			world.fx.dismember(self, h)
	if g >= 1 and world:
		world.fx.death_spray(self, h)
	if world and world.can_ragdoll() and absf(scale_f - 1.0) < 0.01:
		Ragdoll.start(self, h)
	else:
		_death_anim(h)

func _death_anim(h: Dictionary) -> void:
	face(-Vector3(h.get("dir", forward())))
	rotation.y = atan2(face_dir.x, face_dir.z)
	stop_full()
	set_hold("a1/Death01")
	push_vel = Vector3(h.get("dir", Vector3.ZERO)) * 2.0

func gib(h: Dictionary) -> void:
	gibbed = true
	raisable = false
	if world:
		world.fx.gib_explode(self, h)
	queue_free()

func _dead_tick(delta: float) -> void:
	dead_t += delta
	if push_vel.length() > 0.05 and not has_meta("ragdoll"):
		velocity = push_vel
		velocity.y = -1.0
		move_and_slide()
		push_vel = push_vel.move_toward(Vector3.ZERO, 8.0 * delta)
	if not corpse and dead_t > 2.6:
		corpse = true
		if has_meta("ragdoll"):
			Ragdoll.freeze(self)
		if tree:
			tree.active = false
		if world:
			world.on_corpse(self)

func corpse_pos() -> Vector3:
	if skel:
		var hb = skel.find_bone("Hips")
		if hb >= 0:
			var p = (skel.global_transform * skel.get_bone_global_pose(hb)).origin
			return Vector3(p.x, 0, p.z)
	return global_position
