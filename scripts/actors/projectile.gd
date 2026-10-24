class_name Projectile
extends Node3D
## Снаряды: костяные копья, черепа, болты, святые сферы, бомбы.

var world: Node
var kind = "bonespear"
var team = 0
var dir = Vector3.FORWARD
var vel = Vector3.ZERO
var speed = 30.0
var dmg = 20.0
var life = 2.0
var radius = 0.35
var pierce = 0
var src: Actor
var hit_ids = {}
var homing = 0.0
var target_pos = Vector3.ZERO
var arc = false
var gravity = 0.0
var aoe = 0.0
var knock = 3.0
var visual: Node3D
var _prev = Vector3.ZERO

func setup(w: Node, k: String, from: Vector3, d: Vector3, s: Actor, damage: float, extra := {}) -> void:
	world = w; kind = k; src = s; dmg = damage
	team = s.team if s else 0
	dir = d.normalized()
	position = from
	for key in extra:
		set(key, extra[key])
	match kind:
		"bonespear":
			speed = 34.0; radius = 0.45; life = 1.2; knock = 3.5
		"lance":
			speed = 40.0; radius = 0.6; life = 1.2; pierce += 3; knock = 8.0
		"skull":
			speed = 18.0; radius = 0.5; life = 1.6; homing = 3.5; aoe = 2.0; knock = 5.0
		"bolt":
			speed = 38.0; radius = 0.3; life = 1.2; knock = 4.0
		"bonebolt":
			speed = 32.0; radius = 0.3; life = 1.0
		"holy":
			speed = 15.0; radius = 0.45; life = 2.0; homing = 1.5
		"firebomb", "soulfire":
			arc = true; gravity = 22.0; aoe = 2.2; radius = 0.3; life = 3.0
	if arc:
		var to = target_pos - from
		var flat = Vector3(to.x, 0, to.z)
		var dist = flat.length()
		var t = clampf(dist / 14.0, 0.45, 1.0)
		vel = flat / t
		vel.y = (to.y + 0.5 * gravity * t * t) / t
	else:
		vel = dir * speed
	_make_visual()

func _ready() -> void:
	_prev = global_position

func _make_visual() -> void:
	visual = Node3D.new()
	add_child(visual)
	var mi = MeshInstance3D.new()
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	match kind:
		"bonespear", "lance", "bonebolt":
			var c = CapsuleMesh.new(); c.radius = 0.05 if kind != "lance" else 0.09; c.height = 0.9 if kind != "lance" else 1.4
			mi.mesh = c
			m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
			m.albedo_color = Color(0.92, 0.9, 0.82)
			m.emission_enabled = true; m.emission = Color(0.3, 1.0, 0.45); m.emission_energy_multiplier = 0.6
			mi.rotation_degrees.x = 90
			world.fx.green_trail(self)
		"skull":
			var s = SphereMesh.new(); s.radius = 0.2; s.height = 0.4
			mi.mesh = s
			m.albedo_color = Color(0.45, 1.0, 0.6)
			m.emission_enabled = true; m.emission = Color(0.3, 1.0, 0.45); m.emission_energy_multiplier = 3.0
			world.fx.green_trail(self)
			var l = OmniLight3D.new(); l.light_color = Color(0.3, 1, 0.45); l.light_energy = 1.5; l.omni_range = 3.5; add_child(l)
		"bolt":
			var c2 = CylinderMesh.new(); c2.top_radius = 0.015; c2.bottom_radius = 0.02; c2.height = 0.55
			mi.mesh = c2
			m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
			m.albedo_color = Color(0.2, 0.18, 0.16)
			mi.rotation_degrees.x = 90
		"holy":
			var s2 = SphereMesh.new(); s2.radius = 0.22; s2.height = 0.44
			mi.mesh = s2
			m.albedo_color = Color(1.0, 0.8, 0.35)
			m.emission_enabled = true; m.emission = Color(1.0, 0.75, 0.3); m.emission_energy_multiplier = 3.0
			var l2 = OmniLight3D.new(); l2.light_color = Color(1, 0.78, 0.35); l2.light_energy = 1.5; l2.omni_range = 3.5; add_child(l2)
		"firebomb", "soulfire":
			var s3 = SphereMesh.new(); s3.radius = 0.12; s3.height = 0.24
			mi.mesh = s3
			m.albedo_color = Color(1.0, 0.5, 0.15) if kind == "firebomb" else Color(0.4, 1.0, 0.5)
			m.emission_enabled = true; m.emission = m.albedo_color; m.emission_energy_multiplier = 2.0
			var tf: Node3D = world.fx.torch_fire()
			add_child(tf)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	visual.add_child(mi)

func _physics_process(delta: float) -> void:
	life -= delta
	if life <= 0.0:
		_end(global_position, false)
		return
	if homing > 0.0:
		var t = _nearest_enemy(9.0)
		if t:
			var want = (t.center() - global_position).normalized()
			var d = vel.normalized().slerp(want, clampf(homing * delta, 0, 1))
			vel = d * vel.length()
	if arc:
		vel.y -= gravity * delta
	_prev = global_position
	global_position += vel * delta
	if vel.length_squared() > 0.01:
		var f = vel.normalized()
		var up = Vector3.UP if absf(f.y) < 0.95 else Vector3.RIGHT
		visual.global_basis = Basis.looking_at(f, up)
	# стены
	var space = get_world_3d().direct_space_state
	var q = PhysicsRayQueryParameters3D.create(_prev, global_position, 1)
	var r = space.intersect_ray(q)
	if not r.is_empty():
		_end(r.position, true)
		return
	if arc:
		if global_position.y <= 0.05:
			_end(Vector3(global_position.x, 0.0, global_position.z), true)
		return
	for e in world.units_of(1 - team):
		if e.dead or hit_ids.has(e.get_instance_id()):
			continue
		var c: Vector3 = e.center()
		var seg = Geometry3D.get_closest_point_to_segment(c, _prev, global_position)
		var rr = radius + e.radius
		if seg.distance_squared_to(c) < rr * rr or Vector2(seg.x - c.x, seg.z - c.z).length() < rr and absf(seg.y - c.y) < 1.1 * e.scale_f:
			hit_ids[e.get_instance_id()] = true
			_hit(e)
			if aoe > 0.0:
				_end(global_position, true)
				return
			if pierce <= 0:
				_end(global_position, false)
				return
			pierce -= 1

func _nearest_enemy(r: float) -> Actor:
	var best: Actor = null
	var bd = r
	for e in world.units_of(1 - team):
		if e.dead:
			continue
		var d = global_position.distance_to(e.center())
		if d < bd and vel.normalized().dot((e.center() - global_position).normalized()) > 0.2:
			bd = d; best = e
	return best

func _hit(e: Actor) -> void:
	var d = Vector3(vel.x, 0, vel.z).normalized()
	var kd = "pierce"
	if kind == "holy": kd = "holy"
	var h = {"dmg": dmg, "src": src, "dir": d, "point": e.center() - d * e.radius * 0.5, "knock": knock, "heavy": kind == "lance",
		"kind": kd, "stagger": dmg * (1.6 if kind == "lance" else 0.8), "team": team}
	if src and src.has_method("roll_crit"):
		src.roll_crit(h)
	e.take_hit(h)
	if kind == "holy" and e.undead:
		e.ignite(2.0, 8.0)
	Sfx.at("hit_pierce" if kind != "holy" else "holy_hit", e.center(), -2.0)

func _end(p: Vector3, impact: bool) -> void:
	if aoe > 0.0 and impact or aoe > 0.0 and kind in ["skull", "firebomb", "soulfire"]:
		_explode(p)
	elif impact:
		if kind in ["bonespear", "lance", "bonebolt", "bolt"]:
			world.fx.spark(p, -vel.normalized(), 6)
			Sfx.at("hit_wall", p, -6.0)
	queue_free()

func _explode(p: Vector3) -> void:
	match kind:
		"skull":
			world.fx.necro_burst(p, 0.8)
			world.area_damage(p, aoe, dmg, src, {"kind": "explosion", "knock": knock, "team": team})
			Sfx.at("skull_boom", p, 0.0)
		"firebomb":
			world.fx.fire_patch(Vector3(p.x, 0, p.z), aoe, 5.0)
			world.add_zone(Vector3(p.x, 0, p.z), aoe, 5.0, 12.0, team, "fire")
			world.area_damage(p, aoe, dmg, src, {"kind": "fire", "fire": true, "knock": 2.0, "team": team})
			Sfx.at("firebomb", p, 2.0)
		"soulfire":
			world.fx.fire_patch(Vector3(p.x, 0, p.z), aoe * 0.8, 3.5, true)
			world.add_zone(Vector3(p.x, 0, p.z), aoe * 0.8, 3.5, 14.0, team, "soulfire")
			Sfx.at("skull_boom", p, -4.0)
