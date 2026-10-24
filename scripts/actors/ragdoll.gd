class_name Ragdoll
## Рэгдолл из физических костей, создаётся в момент смерти.

# кость, дочерняя кость (для длины), радиус, тип сустава (0 нет, 1 конус, 2 шарнир)
const BONES := [
	["Hips", "Spine", 0.14, 0],
	["Spine", "Chest", 0.13, 1],
	["Chest", "UpperChest", 0.14, 1],
	["UpperChest", "Neck", 0.15, 1],
	["Head", "", 0.11, 1],
	["LeftUpperArm", "LeftLowerArm", 0.055, 1],
	["LeftLowerArm", "LeftHand", 0.045, 2],
	["RightUpperArm", "RightLowerArm", 0.055, 1],
	["RightLowerArm", "RightHand", 0.045, 2],
	["LeftUpperLeg", "LeftLowerLeg", 0.075, 1],
	["LeftLowerLeg", "LeftFoot", 0.06, 2],
	["RightUpperLeg", "RightLowerLeg", 0.075, 1],
	["RightLowerLeg", "RightFoot", 0.06, 2],
]
const MASS := {"Hips": 12.0, "Spine": 8.0, "Chest": 8.0, "UpperChest": 8.0, "Head": 5.0, "LeftUpperArm": 2.5, "RightUpperArm": 2.5,
	"LeftLowerArm": 1.6, "RightLowerArm": 1.6, "LeftUpperLeg": 7.0, "RightUpperLeg": 7.0, "LeftLowerLeg": 3.5, "RightLowerLeg": 3.5}

static var active_count = 0

static func _skip(a: Actor, bname: String) -> bool:
	for s in a.severed:
		var sk = a.skel
		var sb = sk.find_bone(s)
		var b = sk.find_bone(bname)
		while b >= 0:
			if b == sb:
				return true
			b = sk.get_bone_parent(b)
	return false

static func start(a: Actor, h: Dictionary) -> void:
	var sk = a.skel
	if sk == null:
		return
	# сначала берём текущую позу из дерева, потом выключаем его
	if a.tree:
		a.tree.active = false
	var sim = PhysicalBoneSimulator3D.new()
	sim.name = "Ragdoll"
	sk.add_child(sim)
	var bodies = {}
	for row in BONES:
		var bn: String = row[0]
		var bi = sk.find_bone(bn)
		if bi < 0 or _skip(a, bn):
			continue
		var child_name: String = row[1]
		var ci = sk.find_bone(child_name) if child_name != "" else -1
		var length = 0.22
		var child_rest = Vector3(0, length, 0)
		if ci >= 0:
			child_rest = sk.get_bone_global_rest(ci).origin - sk.get_bone_global_rest(bi).origin
			child_rest = sk.get_bone_global_rest(bi).basis.inverse() * child_rest
			length = child_rest.length()
		var half = maxf(0.05, length * 0.5)
		var pb = PhysicalBone3D.new()
		pb.name = "PB_" + bn
		pb.bone_name = bn
		var cs = CollisionShape3D.new()
		var cap = CapsuleShape3D.new()
		var rad: float = row[2]
		cap.radius = rad
		cap.height = maxf(rad * 2.05, half * 2.0 + rad * 0.6)
		cs.shape = cap
		var ct = Transform3D()
		ct.basis = Basis(Vector3(1, 0, 0), Vector3(0, 0, -1), Vector3(0, 1, 0))
		cs.transform = ct
		pb.add_child(cs)
		var up = Vector3(0, 1, 0)
		if up.cross(child_rest).is_zero_approx():
			up = Vector3(0, 0, 1)
		var body_t = Transform3D()
		body_t.basis = Basis.looking_at(child_rest, up)
		body_t.origin = body_t.basis * Vector3(0, 0, -half)
		pb.body_offset = body_t
		var joint_t = Transform3D()
		joint_t.origin = Vector3(0, 0, half)
		pb.joint_offset = joint_t
		pb.mass = MASS.get(bn, 3.0)
		pb.friction = 0.9
		pb.bounce = 0.0
		pb.linear_damp = 0.4
		pb.angular_damp = 2.5
		pb.collision_layer = 8
		pb.collision_mask = 1 | 8
		var jt: int = row[3]
		if jt == 1:
			pb.joint_type = PhysicalBone3D.JOINT_TYPE_CONE
			pb.set("joint_constraints/swing_span", 40.0 if bn.find("Arm") < 0 and bn.find("Leg") < 0 else 70.0)
			pb.set("joint_constraints/twist_span", 25.0)
			pb.set("joint_constraints/softness", 0.8)
			pb.set("joint_constraints/relaxation", 1.0)
		elif jt == 2:
			pb.joint_type = PhysicalBone3D.JOINT_TYPE_HINGE
			pb.set("joint_constraints/angular_limit_enabled", true)
			pb.set("joint_constraints/angular_limit_upper", 120.0)
			pb.set("joint_constraints/angular_limit_lower", -5.0)
		else:
			pb.joint_type = PhysicalBone3D.JOINT_TYPE_NONE
		sim.add_child(pb)
		bodies[bn] = pb
	a.set_meta("ragdoll", sim)
	a.set_meta("ragdoll_bodies", bodies)
	sim.physical_bones_start_simulation()
	active_count += 1
	var dir: Vector3 = Vector3(h.get("dir", a.forward()))
	var force: float = clampf(float(h.get("knock", 3.0)) * 1.4 + float(h.get("final", 10.0)) * 0.05, 2.0, 22.0)
	if h.get("kind", "") == "explosion":
		force *= 1.6
	var up_k = 0.35 if not h.get("heavy", false) else 0.7
	var imp = (dir + Vector3.UP * up_k).normalized() * force
	var hit_pt: Vector3 = Vector3(h.get("point", a.center()))
	var best: PhysicalBone3D = null
	var bd = 1e9
	for k in bodies:
		var pb: PhysicalBone3D = bodies[k]
		var dd = pb.global_position.distance_to(hit_pt)
		if dd < bd:
			bd = dd; best = pb
	for k in bodies:
		var pb: PhysicalBone3D = bodies[k]
		pb.linear_velocity = imp * (0.55 if pb != best else 1.4) + a.push_vel * 0.5
	if best:
		best.apply_central_impulse(imp * best.mass * 0.6)

static func freeze(a: Actor) -> void:
	if not a.has_meta("ragdoll"):
		return
	var sim: PhysicalBoneSimulator3D = a.get_meta("ragdoll")
	var bodies: Dictionary = a.get_meta("ragdoll_bodies")
	var sk = a.skel
	var inv = sk.global_transform.affine_inverse()
	var globals = {}
	for bn in bodies:
		var pb: PhysicalBone3D = bodies[bn]
		globals[sk.find_bone(bn)] = inv * pb.global_transform * pb.body_offset.affine_inverse()
	# локальные позы: от родителей к детям
	var order = globals.keys()
	order.sort()
	var cur_global = {}
	for i in sk.get_bone_count():
		var parent = sk.get_bone_parent(i)
		var pg: Transform3D = cur_global.get(parent, Transform3D()) if parent >= 0 else Transform3D()
		if globals.has(i):
			var gt: Transform3D = globals[i]
			var lt = pg.affine_inverse() * gt
			sk.set_bone_pose_position(i, lt.origin)
			sk.set_bone_pose_rotation(i, lt.basis.get_rotation_quaternion())
			cur_global[i] = gt
		else:
			cur_global[i] = pg * sk.get_bone_pose(i)
	sim.physical_bones_stop_simulation()
	sim.queue_free()
	a.remove_meta("ragdoll")
	a.remove_meta("ragdoll_bodies")
	active_count = maxi(0, active_count - 1)
	# корневое положение для подъёма
	var hips = sk.find_bone("Hips")
	if hips >= 0:
		var hp: Vector3 = (sk.global_transform * Transform3D(Basis(), cur_global[hips].origin)).origin
		a.set_meta("corpse_at", Vector3(hp.x, 0, hp.z))
