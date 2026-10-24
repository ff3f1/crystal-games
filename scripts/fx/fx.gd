class_name FX
extends Node3D
## Кровь, декали, искры, огонь, телеграфы, расчленение, гибы.

var world: Node
var decals: Array = []
const MAX_DECALS := 420
var blood_tex: Array = []
var pool_tex: Texture2D
var crack_tex: Texture2D
var sigil_tex: Texture2D
var noise: Texture2D
var drop_pm: ParticleProcessMaterial
var drop_pm_dark: ParticleProcessMaterial
var drop_mesh: QuadMesh
var mist_pm: ParticleProcessMaterial
var soft_mesh: QuadMesh
var spark_pm: ParticleProcessMaterial
var spark_mesh: QuadMesh
var fire_mesh: QuadMesh
var fire_pm: ParticleProcessMaterial
var smoke_mesh: QuadMesh
var green_fire_mesh: QuadMesh
var gib_meshes: Array = []
var bone_meshes: Array = []
var gib_mat: Material
var bone_mat: Material
var gibs: Array = []
const MAX_GIBS := 90
static var limb_cache: Dictionary = {}

func _ready() -> void:
	noise = load("res://assets/tex/noise.tres")
	for i in 4:
		blood_tex.append(_tex("res://assets/decal/blood_%d.png" % i, "res://assets/fx/blood_%d.png" % i))
	for i in [4, 5]:
		if ResourceLoader.exists("res://assets/decal/blood_%d.png" % i):
			blood_tex.append(load("res://assets/decal/blood_%d.png" % i))
	pool_tex = _tex("res://assets/decal/blood_pool.png", "res://assets/fx/blood_pool.png")
	crack_tex = _tex("res://assets/decal/crack.png", "res://assets/fx/crack.png")
	sigil_tex = load("res://assets/fx/sigil.png")
	_build_particles()
	_build_gibs()

func _tex(a: String, b: String) -> Texture2D:
	return load(a) if ResourceLoader.exists(a) else load(b)

func _soft_material(tex: Texture2D, blend_add := false) -> ShaderMaterial:
	var m = ShaderMaterial.new()
	if blend_add:
		var s = Shader.new()
		s.code = "shader_type spatial;\nrender_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;\nuniform sampler2D tex : hint_default_white;\nvoid vertex(){MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]); MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz),0.,0.,0.),vec4(0.,length(MODEL_MATRIX[1].xyz),0.,0.),vec4(0.,0.,length(MODEL_MATRIX[2].xyz),0.),vec4(0.,0.,0.,1.));}\nvoid fragment(){ vec4 t = texture(tex, UV); ALBEDO = COLOR.rgb * t.a * COLOR.a * 3.0; ALPHA = 1.0; }"
		m.shader = s
	else:
		m.shader = load("res://assets/shaders/particle_soft.gdshader")
	m.set_shader_parameter("tex", tex)
	return m

func _build_particles() -> void:
	# капли крови: вытянутые по скорости
	drop_pm = ParticleProcessMaterial.new()
	drop_pm.direction = Vector3(0, 0, 1)
	drop_pm.spread = 28.0
	drop_pm.initial_velocity_min = 3.0
	drop_pm.initial_velocity_max = 9.0
	drop_pm.gravity = Vector3(0, -19.0, 0)
	drop_pm.scale_min = 0.5
	drop_pm.scale_max = 1.4
	drop_pm.particle_flag_align_y = true
	drop_pm.damping_min = 0.5
	drop_pm.damping_max = 2.0
	drop_pm.collision_mode = ParticleProcessMaterial.COLLISION_HIDE_ON_CONTACT
	var cr = Gradient.new()
	cr.set_color(0, Color(0.75, 0.03, 0.02, 1.0)); cr.set_color(1, Color(0.45, 0.0, 0.0, 0.95))
	var gt = GradientTexture1D.new(); gt.gradient = cr
	drop_pm.color_ramp = gt
	drop_pm_dark = drop_pm.duplicate()
	var crd = Gradient.new()
	crd.set_color(0, Color(0.12, 0.1, 0.06, 1.0)); crd.set_color(1, Color(0.05, 0.05, 0.03, 0.9))
	var gtd = GradientTexture1D.new(); gtd.gradient = crd
	drop_pm_dark.color_ramp = gtd
	drop_mesh = QuadMesh.new()
	drop_mesh.size = Vector2(0.045, 0.16)
	var dm = StandardMaterial3D.new()
	dm.albedo_texture = load("res://assets/fx/drop.png")
	dm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dm.vertex_color_use_as_albedo = true
	dm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	dm.billboard_keep_scale = true
	dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.roughness = 0.2
	drop_mesh.material = dm
	# туман крови
	mist_pm = ParticleProcessMaterial.new()
	mist_pm.direction = Vector3(0, 0.3, 1)
	mist_pm.spread = 50.0
	mist_pm.initial_velocity_min = 0.6
	mist_pm.initial_velocity_max = 2.4
	mist_pm.gravity = Vector3(0, -1.0, 0)
	mist_pm.damping_min = 2.0; mist_pm.damping_max = 4.0
	mist_pm.scale_min = 0.6; mist_pm.scale_max = 1.5
	var sc = Curve.new(); sc.add_point(Vector2(0, 0.4)); sc.add_point(Vector2(1, 1.3))
	var sct = CurveTexture.new(); sct.curve = sc
	mist_pm.scale_curve = sct
	var mg = Gradient.new(); mg.set_color(0, Color(0.5, 0.03, 0.03, 0.55)); mg.set_color(1, Color(0.3, 0.0, 0.0, 0.0))
	var mgt = GradientTexture1D.new(); mgt.gradient = mg
	mist_pm.color_ramp = mgt
	soft_mesh = QuadMesh.new()
	soft_mesh.size = Vector2(0.55, 0.55)
	soft_mesh.material = _soft_material(load("res://assets/fx/soft.png"))
	# искры
	spark_pm = ParticleProcessMaterial.new()
	spark_pm.direction = Vector3(0, 0, 1)
	spark_pm.spread = 55.0
	spark_pm.initial_velocity_min = 4.0; spark_pm.initial_velocity_max = 11.0
	spark_pm.gravity = Vector3(0, -12, 0)
	spark_pm.particle_flag_align_y = true
	spark_pm.scale_min = 0.4; spark_pm.scale_max = 1.0
	var sg = Gradient.new(); sg.set_color(0, Color(1.0, 0.9, 0.6, 1)); sg.set_color(1, Color(1.0, 0.4, 0.1, 0))
	var sgt = GradientTexture1D.new(); sgt.gradient = sg
	spark_pm.color_ramp = sgt
	spark_mesh = QuadMesh.new()
	spark_mesh.size = Vector2(0.025, 0.2)
	spark_mesh.material = _soft_material(load("res://assets/fx/spark.png"), true)
	# огонь
	fire_pm = ParticleProcessMaterial.new()
	fire_pm.direction = Vector3(0, 1, 0)
	fire_pm.spread = 12.0
	fire_pm.initial_velocity_min = 0.6; fire_pm.initial_velocity_max = 1.6
	fire_pm.gravity = Vector3(0, 1.2, 0)
	fire_pm.scale_min = 0.6; fire_pm.scale_max = 1.2
	var fc = Curve.new(); fc.add_point(Vector2(0, 0.6)); fc.add_point(Vector2(0.4, 1.0)); fc.add_point(Vector2(1, 0.2))
	var fct = CurveTexture.new(); fct.curve = fc
	fire_pm.scale_curve = fct
	fire_pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	fire_pm.emission_sphere_radius = 0.08
	fire_mesh = QuadMesh.new()
	fire_mesh.size = Vector2(0.45, 0.6)
	var fm = ShaderMaterial.new(); fm.shader = load("res://assets/shaders/fire.gdshader"); fm.set_shader_parameter("noise_tex", noise)
	fire_mesh.material = fm
	green_fire_mesh = QuadMesh.new()
	green_fire_mesh.size = Vector2(0.5, 0.7)
	var gm = ShaderMaterial.new(); gm.shader = load("res://assets/shaders/fire.gdshader"); gm.set_shader_parameter("noise_tex", noise)
	gm.set_shader_parameter("c_hot", Color(0.75, 1.0, 0.8)); gm.set_shader_parameter("c_cool", Color(0.1, 0.9, 0.35)); gm.set_shader_parameter("intensity", 2.4)
	green_fire_mesh.material = gm
	smoke_mesh = QuadMesh.new()
	smoke_mesh.size = Vector2(1.2, 1.2)
	smoke_mesh.material = _soft_material(load("res://assets/fx/soft.png"))

var _gib_mats = {}
func _build_gibs() -> void:
	gib_mat = CharBuilder.prop_material(null, "flesh")
	(gib_mat as ShaderMaterial).set_shader_parameter("tint", Color(0.55, 0.06, 0.05))
	(gib_mat as ShaderMaterial).set_shader_parameter("desat", 0.0)
	bone_mat = CharBuilder.prop_material(null, "bone")
	(bone_mat as ShaderMaterial).set_shader_parameter("tint", Color(0.85, 0.8, 0.7))
	for n in ["meat_a", "meat_b"]:
		var p = "res://assets/gore/%s.glb" % n
		if ResourceLoader.exists(p):
			gib_meshes.append(load(p))
	for n in ["femur", "skull", "ribcage"]:
		var p = "res://assets/gore/%s.glb" % n
		if ResourceLoader.exists(p):
			bone_meshes.append(load(p))
	if gib_meshes.is_empty():
		for i in 3:
			var s = SphereMesh.new()
			s.radius = 0.09 + i * 0.03; s.height = s.radius * (1.2 + i * 0.3)
			s.radial_segments = 8; s.rings = 5
			gib_meshes.append(s)
	if bone_meshes.is_empty():
		var c = CapsuleMesh.new(); c.radius = 0.025; c.height = 0.38; c.radial_segments = 6
		bone_meshes.append(c)

# ---------------------------------------------------------------- частицы
func _emit(pos: Vector3, dir: Vector3, pm: ParticleProcessMaterial, mesh: Mesh, amount: int, life: float, explosive := 0.95) -> GPUParticles3D:
	var p = GPUParticles3D.new()
	p.process_material = pm
	p.draw_pass_1 = mesh
	p.amount = maxi(1, amount)
	p.lifetime = life
	p.one_shot = true
	p.explosiveness = explosive
	p.fixed_fps = 0
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-6, -3, -6), Vector3(12, 8, 12))
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(p)
	p.global_position = pos
	if dir.length_squared() > 0.001:
		var d = dir.normalized()
		var up = Vector3.UP if absf(d.dot(Vector3.UP)) < 0.95 else Vector3.RIGHT
		p.global_basis = Basis.looking_at(-d, up)
	p.emitting = true
	get_tree().create_timer(life + 0.3, false).timeout.connect(p.queue_free)
	return p

func gore_mul() -> float:
	return [0.0, 0.6, 1.0][clampi(G.gore(), 0, 2)]

func blood_hit(pos: Vector3, dir: Vector3, dmg_amount: float, a: Actor) -> void:
	var gm = gore_mul()
	if gm <= 0.0:
		spark(pos, -dir, 6)
		return
	var undead_blood = a != null and a.undead
	var n = int(clampf(dmg_amount * 1.8, 18, 110) * gm)
	var d = (dir + Vector3.UP * 0.35).normalized()
	_emit(pos, d, drop_pm_dark if undead_blood else drop_pm, drop_mesh, n, 0.95)
	_emit(pos, d, mist_pm, soft_mesh, int(5 + dmg_amount * 0.12), 0.7, 0.9)
	# пятна на земле по траектории
	var k = int(clampf(2.0 + dmg_amount / 10.0, 2, 9) * gm)
	for i in k:
		var dist = randf_range(0.4, 1.4 + dmg_amount * 0.03)
		var lp = pos + Vector3(dir.x, 0, dir.z).normalized() * dist + Vector3(randf_range(-0.5, 0.5), 0, randf_range(-0.5, 0.5))
		var sz = randf_range(0.45, 1.0) + dmg_amount * 0.01
		var c = Color(0.25, 0.22, 0.15) if undead_blood else Color(1, 1, 1)
		get_tree().create_timer(dist * 0.12 + 0.05, false).timeout.connect(blood_decal.bind(lp, sz, c))

func blood_decal(pos: Vector3, size: float, modc := Color(1, 1, 1), tex: Texture2D = null) -> Decal:
	var dc = Decal.new()
	dc.texture_albedo = tex if tex else blood_tex[randi() % blood_tex.size()]
	dc.size = Vector3(size, 1.2, size)
	dc.modulate = modc
	dc.albedo_mix = 1.0
	dc.upper_fade = 0.05
	dc.lower_fade = 0.6
	dc.normal_fade = 0.3
	dc.cull_mask = 1
	add_child(dc)
	dc.global_position = Vector3(pos.x, maxf(0.0, pos.y) + 0.3, pos.z)
	dc.rotation.y = randf() * TAU
	decals.append(dc)
	if decals.size() > MAX_DECALS:
		var old = decals.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	return dc

func blood_pool(pos: Vector3, max_size := 2.0) -> void:
	if gore_mul() <= 0.0:
		return
	var dc = blood_decal(pos, 0.3, Color(1, 1, 1), pool_tex)
	var tw = dc.create_tween()
	tw.tween_property(dc, "size", Vector3(max_size, 1.2, max_size), 7.0).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)

func spark(pos: Vector3, dir: Vector3, n := 12) -> void:
	_emit(pos, dir, spark_pm, spark_mesh, n, 0.45)
	var l = OmniLight3D.new()
	l.light_color = Color(1, 0.8, 0.5); l.light_energy = 3.0; l.omni_range = 3.0
	add_child(l); l.global_position = pos
	var tw = l.create_tween(); tw.tween_property(l, "light_energy", 0.0, 0.12); tw.tween_callback(l.queue_free)

func dust(pos: Vector3, radius := 1.5, n := 14) -> void:
	var pm = mist_pm.duplicate() as ParticleProcessMaterial
	var g = Gradient.new(); g.set_color(0, Color(0.5, 0.48, 0.45, 0.45)); g.set_color(1, Color(0.3, 0.3, 0.3, 0.0))
	var gt = GradientTexture1D.new(); gt.gradient = g
	pm.color_ramp = gt
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
	pm.emission_ring_axis = Vector3(0, 1, 0)
	pm.emission_ring_radius = radius * 0.6
	pm.emission_ring_inner_radius = radius * 0.3
	pm.emission_ring_height = 0.1
	pm.direction = Vector3(0, 0.2, 0)
	pm.spread = 180
	pm.initial_velocity_min = 2.0; pm.initial_velocity_max = 4.0
	_emit(pos + Vector3.UP * 0.2, Vector3.ZERO, pm, smoke_mesh, n, 1.1)

# ---------------------------------------------------------------- огонь
func torch_fire() -> Node3D:
	var n = Node3D.new()
	var p = GPUParticles3D.new()
	p.process_material = fire_pm
	p.draw_pass_1 = fire_mesh
	p.amount = 26
	p.lifetime = 0.6
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	n.add_child(p)
	var l = OmniLight3D.new()
	l.light_color = Color(1.0, 0.55, 0.2)
	l.light_energy = 1.6
	l.omni_range = 5.5
	l.shadow_enabled = false
	l.set_script(load("res://scripts/fx/flicker.gd"))
	n.add_child(l)
	l.position.y = 0.25
	return n

func fire_patch(pos: Vector3, radius: float, life: float, color_green := false) -> Node3D:
	var n = Node3D.new()
	add_child(n)
	n.global_position = pos
	var p = GPUParticles3D.new()
	var pm = fire_pm.duplicate() as ParticleProcessMaterial
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = radius * 0.8
	pm.scale_min = 1.0; pm.scale_max = 2.0
	p.process_material = pm
	p.draw_pass_1 = green_fire_mesh if color_green else fire_mesh
	p.amount = int(18 + radius * 14)
	p.lifetime = 0.8
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visibility_aabb = AABB(Vector3(-radius - 1, -1, -radius - 1), Vector3(radius * 2 + 2, 4, radius * 2 + 2))
	n.add_child(p)
	var l = OmniLight3D.new()
	l.light_color = Color(0.3, 1.0, 0.45) if color_green else Color(1.0, 0.5, 0.15)
	l.light_energy = 2.5
	l.omni_range = radius * 2.5 + 2.0
	l.set_script(load("res://scripts/fx/flicker.gd"))
	n.add_child(l)
	l.position.y = 0.6
	if not color_green:
		blood_decal(pos, radius * 2.2, Color(0.12, 0.1, 0.09), crack_tex)
	if life > 0:
		get_tree().create_timer(life, false).timeout.connect(func():
			if is_instance_valid(p): p.emitting = false
			if is_instance_valid(l):
				var tw = l.create_tween(); tw.tween_property(l, "light_energy", 0.0, 0.8)
			get_tree().create_timer(1.2, false).timeout.connect(n.queue_free))
	return n

func attach_burn(a: Actor, t: float) -> void:
	if not is_instance_valid(a) or a.skel == null:
		return
	if a.has_meta("burn_fx") and is_instance_valid(a.get_meta("burn_fx")):
		return
	var ba = BoneAttachment3D.new()
	ba.bone_name = "Chest"
	a.skel.add_child(ba)
	var p = GPUParticles3D.new()
	var pm = fire_pm.duplicate() as ParticleProcessMaterial
	pm.emission_sphere_radius = 0.3
	p.process_material = pm
	p.draw_pass_1 = fire_mesh
	p.amount = 20
	p.lifetime = 0.6
	p.local_coords = false
	ba.add_child(p)
	var l = OmniLight3D.new(); l.light_color = Color(1, 0.5, 0.15); l.light_energy = 1.5; l.omni_range = 4.0
	ba.add_child(l)
	a.set_meta("burn_fx", ba)
	a.set_shader_all("burn", 0.3)
	get_tree().create_timer(t, false).timeout.connect(func():
		if is_instance_valid(ba):
			ba.queue_free())

# ---------------------------------------------------------------- некромантия
func sigil(pos: Vector3, radius: float, life: float, color := Color(0.3, 1.0, 0.45), energy := 2.0) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var pm = PlaneMesh.new(); pm.size = Vector2(radius * 2, radius * 2)
	mi.mesh = pm
	var m = ShaderMaterial.new(); m.shader = load("res://assets/shaders/sigil.gdshader")
	m.set_shader_parameter("tex", sigil_tex); m.set_shader_parameter("color", color); m.set_shader_parameter("energy", energy)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos + Vector3.UP * 0.04
	mi.scale = Vector3(0.2, 1, 0.2)
	var tw = mi.create_tween()
	tw.tween_property(mi, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if life > 0:
		tw.tween_interval(life)
		tw.tween_method(func(v): mi.set_instance_shader_parameter("fade", v), 1.0, 0.0, 0.5)
		tw.tween_callback(mi.queue_free)
	return mi

func necro_burst(pos: Vector3, scale_k := 1.0) -> void:
	var pm = fire_pm.duplicate() as ParticleProcessMaterial
	pm.emission_sphere_radius = 0.5 * scale_k
	pm.initial_velocity_min = 2.0; pm.initial_velocity_max = 5.0
	pm.spread = 25.0
	_emit(pos, Vector3.UP, pm, green_fire_mesh, int(26 * scale_k), 0.9, 0.7)
	var l = OmniLight3D.new(); l.light_color = Color(0.3, 1.0, 0.45); l.light_energy = 5.0; l.omni_range = 6.0 * scale_k
	add_child(l); l.global_position = pos + Vector3.UP
	var tw = l.create_tween(); tw.tween_property(l, "light_energy", 0.0, 0.7); tw.tween_callback(l.queue_free)

func green_trail(parent: Node3D) -> GPUParticles3D:
	var p = GPUParticles3D.new()
	var pm = fire_pm.duplicate() as ParticleProcessMaterial
	pm.gravity = Vector3.ZERO
	pm.initial_velocity_min = 0.1; pm.initial_velocity_max = 0.4
	pm.emission_sphere_radius = 0.06
	p.process_material = pm
	p.draw_pass_1 = green_fire_mesh
	p.amount = 18
	p.lifetime = 0.35
	p.local_coords = false
	parent.add_child(p)
	return p

# ---------------------------------------------------------------- телеграфы
func _tele_mesh(color: Color, shape: int, arc: float) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var pm = PlaneMesh.new(); pm.size = Vector2(2, 2)
	mi.mesh = pm
	var m = ShaderMaterial.new(); m.shader = load("res://assets/shaders/telegraph.gdshader")
	m.set_shader_parameter("color", color); m.set_shader_parameter("shape", shape); m.set_shader_parameter("arc", arc)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi

func telegraph(a: Actor, act: Dictionary) -> void:
	var r: float = float(act.get("range", 2.5)) * maxf(1.0, a.scale_f * 0.9)
	var aoe: float = float(act.get("aoe", 0.0))
	var t: float = float(act.get("t", 0.5)) * a.action_len
	var mi: MeshInstance3D
	if aoe > 0.0:
		mi = _tele_mesh(Color(1, 0.06, 0.03), 0, 360.0)
		mi.global_position = a.global_position + a.forward() * r * 0.75 + Vector3.UP * 0.05
		mi.scale = Vector3(aoe, 1, aoe)
	else:
		mi = _tele_mesh(Color(1, 0.06, 0.03), 0, float(act.get("arc", 90)))
		mi.global_position = a.global_position + Vector3.UP * 0.05
		mi.scale = Vector3(r, 1, r)
		mi.global_rotation.y = a.rotation.y + PI
	_run_tele(mi, t)

func telegraph_circle(pos: Vector3, radius: float, t: float, color := Color(1, 0.06, 0.03)) -> MeshInstance3D:
	var mi = _tele_mesh(color, 0, 360.0)
	mi.global_position = pos + Vector3.UP * 0.05
	mi.scale = Vector3(radius, 1, radius)
	_run_tele(mi, t)
	return mi

func telegraph_line(from: Vector3, dir: Vector3, length: float, width: float, t: float, color := Color(1, 0.06, 0.03)) -> MeshInstance3D:
	var mi = _tele_mesh(color, 1, 0.0)
	var d = Vector3(dir.x, 0, dir.z).normalized()
	mi.global_position = from + d * length * 0.5 + Vector3.UP * 0.05
	mi.global_rotation.y = atan2(d.x, d.z)
	mi.scale = Vector3(width * 0.5, 1, length * 0.5)
	_run_tele(mi, t)
	return mi

func _run_tele(mi: MeshInstance3D, t: float) -> void:
	var m: ShaderMaterial = mi.material_override
	var tw = mi.create_tween()
	tw.tween_method(func(v): m.set_shader_parameter("progress", v), 0.0, 1.0, maxf(0.05, t))
	tw.tween_callback(mi.queue_free)

# ---------------------------------------------------------------- удары по земле
func ground_slam(pos: Vector3, radius: float, _team: int) -> void:
	dust(pos, radius, 18)
	blood_decal(pos, radius * 1.8, Color(0.2, 0.18, 0.16), crack_tex)
	shake(0.5)

func shockwave(pos: Vector3, radius: float, color := Color(0.3, 1.0, 0.45)) -> void:
	var mi = MeshInstance3D.new()
	var tm = TorusMesh.new(); tm.inner_radius = 0.92; tm.outer_radius = 1.0; tm.rings = 32; tm.ring_segments = 6
	mi.mesh = tm
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = color
	m.emission_enabled = true; m.emission = color; m.emission_energy_multiplier = 3.0
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos + Vector3.UP * 0.3
	mi.scale = Vector3(0.3, 0.5, 0.3)
	var tw = mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3(radius, 0.3, radius), 0.35).set_ease(Tween.EASE_OUT)
	tw.tween_property(m, "albedo_color:a", 0.0, 0.35)
	tw.chain().tween_callback(mi.queue_free)

func flash_light(pos: Vector3, color: Color, energy: float, rng: float, t := 0.25) -> void:
	var l = OmniLight3D.new(); l.light_color = color; l.light_energy = energy; l.omni_range = rng
	add_child(l); l.global_position = pos
	var tw = l.create_tween(); tw.tween_property(l, "light_energy", 0.0, t); tw.tween_callback(l.queue_free)

func shake(v: float) -> void:
	if world and world.cam:
		world.cam.add_trauma(v * float(G.settings.shake))

# ---------------------------------------------------------------- отдача ударов
var _flash_mesh: QuadMesh
var _flash_tex: Texture2D
var _arc_meshes = {}
var _impact_budget = 0

func _flash_mat(col: Color) -> ShaderMaterial:
	var m = ShaderMaterial.new()
	m.shader = load("res://assets/shaders/flash_add.gdshader")
	if _flash_tex == null:
		_flash_tex = load("res://assets/fx/spark.png")
	m.set_shader_parameter("tex", _flash_tex)
	m.set_shader_parameter("color", col)
	return m

## Вспышка в точке попадания + искры по броне.
func impact(pos: Vector3, dir: Vector3, heavy: bool, metal: bool, kind: String) -> void:
	if _flash_mesh == null:
		_flash_mesh = QuadMesh.new(); _flash_mesh.size = Vector2(1, 1)
	var mi = MeshInstance3D.new()
	mi.mesh = _flash_mesh
	var col = Color(1.0, 0.92, 0.78) if kind != "pierce" else Color(0.85, 1.0, 0.9)
	var m = _flash_mat(col)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos - dir * 0.15
	var sz = 1.3 if heavy else 0.8
	mi.scale = Vector3.ONE * sz * 0.5
	m.set_shader_parameter("stretch", 1.8)
	var tw = mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3.ONE * sz, 0.07)
	tw.tween_method(func(v): m.set_shader_parameter("alpha", v), 1.0, 0.0, 0.11)
	tw.chain().tween_callback(mi.queue_free)
	if metal:
		spark(pos, -dir + Vector3.UP * 0.3, 14 if heavy else 8)
		Sfx.at("block", pos, -10.0)
	if heavy and _impact_budget < 4:
		_impact_budget += 1
		flash_light(pos + Vector3.UP * 0.3, Color(1, 0.6, 0.4), 2.5, 4.5, 0.12)
		get_tree().create_timer(0.12, false).timeout.connect(func(): _impact_budget -= 1)

func muzzle(pos: Vector3, col: Color, size := 0.7) -> void:
	if _flash_mesh == null:
		_flash_mesh = QuadMesh.new(); _flash_mesh.size = Vector2(1, 1)
	var mi = MeshInstance3D.new()
	mi.mesh = _flash_mesh
	var m = _flash_mat(col)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos
	mi.scale = Vector3.ONE * size
	var tw = mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3.ONE * size * 1.6, 0.1)
	tw.tween_method(func(v): m.set_shader_parameter("alpha", v), 1.0, 0.0, 0.12)
	tw.chain().tween_callback(mi.queue_free)

func _arc_mesh(radius: float, arc: float) -> ArrayMesh:
	var key = "%.2f|%.0f" % [radius, arc]
	if _arc_meshes.has(key):
		return _arc_meshes[key]
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var seg = 28
	var r0 = radius * 0.3
	for i in seg:
		var f0 = float(i) / seg; var f1 = float(i + 1) / seg
		var a0 = deg_to_rad(-arc * 0.5 + arc * f0); var a1 = deg_to_rad(-arc * 0.5 + arc * f1)
		var p00 = Vector3(sin(a0), 0, cos(a0)) * r0; var p01 = Vector3(sin(a0), 0, cos(a0)) * radius
		var p10 = Vector3(sin(a1), 0, cos(a1)) * r0; var p11 = Vector3(sin(a1), 0, cos(a1)) * radius
		for q in [[p00, Vector2(f0, 0)], [p01, Vector2(f0, 1)], [p11, Vector2(f1, 1)], [p00, Vector2(f0, 0)], [p11, Vector2(f1, 1)], [p10, Vector2(f1, 0)]]:
			st.set_uv(q[1]); st.add_vertex(q[0])
	var mesh = st.commit()
	_arc_meshes[key] = mesh
	return mesh

## След взмаха оружия: светящийся серп, «прорисовывается» за доли секунды.
func swing_arc(a: Actor, radius: float, arc: float, col: Color, dur := 0.16, reverse := false, tilt := 0.0, y := 1.05) -> void:
	var mi = MeshInstance3D.new()
	mi.mesh = _arc_mesh(radius, minf(arc, 359.0))
	var m = ShaderMaterial.new()
	m.shader = load("res://assets/shaders/swing.gdshader")
	m.set_shader_parameter("color", col)
	m.set_shader_parameter("noise_tex", noise)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = a.global_position + Vector3.UP * y * a.scale_f
	mi.rotation = Vector3(0, a.rotation.y, tilt)
	if reverse:
		mi.scale = Vector3(-1, 1, 1)
	var tw = mi.create_tween()
	tw.tween_method(func(v): m.set_shader_parameter("progress", v), 0.0, 1.15, dur)
	tw.tween_method(func(v): m.set_shader_parameter("fade", v), 0.0, 1.0, 0.14)
	tw.tween_callback(mi.queue_free)

# ---------------------------------------------------------------- умения
var _ghost_shader: Shader
## Призрачная копия позы героя (рывок).
func afterimage(a: Actor, col: Color, life := 0.38) -> void:
	if a.model == null or not is_instance_valid(a.model):
		return
	if _ghost_shader == null:
		_ghost_shader = load("res://assets/shaders/ghost.gdshader")
	var g: Node3D = a.model.duplicate(0)
	for c in g.find_children("*", "", true, false):
		if c is AnimationTree or c is AnimationPlayer or c is Light3D or c is GPUParticles3D:
			c.queue_free()
	var m = ShaderMaterial.new()
	m.shader = _ghost_shader
	m.set_shader_parameter("color", col)
	for gi in g.find_children("*", "GeometryInstance3D", true, false):
		(gi as GeometryInstance3D).material_override = m
		(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(g)
	g.global_transform = a.model.global_transform
	var tw = g.create_tween()
	tw.tween_method(func(v): m.set_shader_parameter("alpha", v), 0.9, 0.0, life)
	tw.tween_callback(g.queue_free)

var _beam_mesh: CylinderMesh
## Столб света (подъём мёртвых, призыв).
func beam(pos: Vector3, col: Color, height := 5.0, radius := 0.55, life := 0.9) -> void:
	if _beam_mesh == null:
		_beam_mesh = CylinderMesh.new(); _beam_mesh.top_radius = 1.0; _beam_mesh.bottom_radius = 1.0; _beam_mesh.height = 1.0
		_beam_mesh.radial_segments = 16; _beam_mesh.rings = 1; _beam_mesh.cap_top = false; _beam_mesh.cap_bottom = false
	var mi = MeshInstance3D.new()
	mi.mesh = _beam_mesh
	var m = ShaderMaterial.new()
	m.shader = load("res://assets/shaders/beam.gdshader")
	m.set_shader_parameter("color", col)
	m.set_shader_parameter("noise_tex", noise)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos + Vector3.UP * height * 0.5
	mi.scale = Vector3(radius * 0.3, height, radius * 0.3)
	var tw = mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3(radius, height, radius), 0.15).set_ease(Tween.EASE_OUT)
	tw.tween_method(func(v): m.set_shader_parameter("alpha", v), 1.0, 0.0, life).set_delay(0.1)
	tw.chain().tween_callback(mi.queue_free)

## Летящая душа-искра от a к b (визуал заклинания).
func wisp(from: Vector3, to: Vector3, col: Color, t := 0.35) -> void:
	var n = Node3D.new()
	add_child(n)
	n.global_position = from
	green_trail(n)
	var mi = MeshInstance3D.new()
	var sp = SphereMesh.new(); sp.radius = 0.1; sp.height = 0.2
	mi.mesh = sp
	var m = StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = col
	m.emission_enabled = true; m.emission = col; m.emission_energy_multiplier = 4.0
	mi.material_override = m
	n.add_child(mi)
	var mid = (from + to) * 0.5 + Vector3.UP * (2.0 + from.distance_to(to) * 0.15)
	var tw = n.create_tween()
	tw.tween_method(func(k):
		var a = from.lerp(mid, k); var b = mid.lerp(to, k)
		n.global_position = a.lerp(b, k), 0.0, 1.0, t)
	tw.tween_callback(n.queue_free)

func smoke(pos: Vector3, radius := 2.0, n := 10) -> void:
	var pm = mist_pm.duplicate() as ParticleProcessMaterial
	pm.spread = 180.0
	pm.initial_velocity_min = 0.8; pm.initial_velocity_max = 2.5 * radius
	pm.gravity = Vector3(0, 0.6, 0)
	var g = Gradient.new(); g.set_color(0, Color(0.16, 0.15, 0.14, 0.55)); g.set_color(1, Color(0.1, 0.1, 0.1, 0.0))
	var gt = GradientTexture1D.new(); gt.gradient = g
	pm.color_ramp = gt
	pm.scale_min = 1.5; pm.scale_max = 3.0
	_emit(pos, Vector3.UP, pm, smoke_mesh, n, 1.6, 0.9)

## Фонтан и лужа при смерти: несколько струй, брызги по кругу.
func death_spray(a: Actor, h: Dictionary) -> void:
	var gm = gore_mul()
	if gm <= 0.0 or a.undead:
		return
	var c = a.center()
	var dir: Vector3 = Vector3(h.get("dir", Vector3.FORWARD))
	for i in 3:
		var dd = (dir + Vector3(randf_range(-0.6, 0.6), randf_range(0.6, 1.4), randf_range(-0.6, 0.6))).normalized()
		_emit(c + Vector3.UP * randf_range(-0.2, 0.3), dd, drop_pm, drop_mesh, int(40 * gm), 1.0)
	for i in int(5 * gm) + 2:
		var lp = a.global_position + dir * randf_range(0.3, 2.8) + Vector3(randf_range(-1.2, 1.2), 0, randf_range(-1.2, 1.2))
		var sz = randf_range(0.6, 1.5)
		get_tree().create_timer(randf_range(0.1, 0.5), false).timeout.connect(blood_decal.bind(lp, sz))

# ---------------------------------------------------------------- расчленение
const LIMBS := {"head": "Head", "arm_l": "LeftUpperArm", "arm_r": "RightUpperArm", "forearm_l": "LeftLowerArm", "forearm_r": "RightLowerArm",
	"leg_l": "LeftUpperLeg", "leg_r": "RightUpperLeg", "shin_l": "LeftLowerLeg", "shin_r": "RightLowerLeg"}

func dismember(a: Actor, h: Dictionary) -> void:
	if a.skel == null:
		return
	var pt: Vector3 = Vector3(h.get("point", a.center()))
	var local = a.global_transform.affine_inverse() * pt
	var hgt = local.y / maxf(0.5, a.scale_f)
	var side = "l" if local.x > 0.0 else "r"
	var opts = []
	if hgt > 1.35:
		opts = ["head", "head", "arm_" + side]
	elif hgt > 0.95:
		opts = ["arm_" + side, "forearm_" + side, "head"]
	else:
		opts = ["leg_" + side, "shin_" + side]
	if h.get("kind", "") in ["blunt"] and randf() < 0.5:
		opts = ["head"]
	var limb: String = opts[randi() % opts.size()]
	if G.gore() >= 2 and randf() < 0.35:
		sever(a, "head" if limb != "head" else "arm_" + side, h)
	sever(a, limb, h)

func sever(a: Actor, limb: String, h: Dictionary) -> void:
	var bn: String = LIMBS[limb]
	var sk = a.skel
	var bi = sk.find_bone(bn)
	if bi < 0 or a.severed.has(bn):
		return
	a.severed[bn] = true
	a.raisable = limb != "head" and a.raisable
	var bone_global = sk.global_transform * sk.get_bone_global_pose(bi)
	# отделённая часть
	var part = limb_node(a, bn)
	if part:
		var rb = RigidBody3D.new()
		rb.collision_layer = 4
		rb.collision_mask = 1
		rb.mass = 3.0
		var cs = CollisionShape3D.new()
		var sph = SphereShape3D.new(); sph.radius = 0.12
		cs.shape = sph
		rb.add_child(cs)
		add_child(rb)
		rb.global_transform = bone_global
		part.transform = Transform3D()
		rb.add_child(part)
		var dir: Vector3 = Vector3(h.get("dir", a.forward()))
		rb.linear_velocity = (dir * randf_range(3.0, 7.0) + Vector3.UP * randf_range(3.0, 6.0))
		rb.angular_velocity = Vector3(randf_range(-12, 12), randf_range(-12, 12), randf_range(-12, 12))
		_register_gib(rb)
		var tr = _emit(rb.global_position, Vector3.UP, drop_pm, drop_mesh, 30, 1.6, 0.0)
		tr.reparent(rb)
	sk.set_bone_pose_scale(bi, Vector3.ONE * 0.001)
	# фонтан из обрубка
	var ba = BoneAttachment3D.new()
	ba.bone_name = sk.get_bone_name(sk.get_bone_parent(bi))
	sk.add_child(ba)
	var off: Vector3 = sk.get_bone_rest(bi).origin
	var p = GPUParticles3D.new()
	p.process_material = drop_pm
	p.draw_pass_1 = drop_mesh
	p.amount = 60
	p.lifetime = 0.9
	p.local_coords = false
	p.explosiveness = 0.0
	ba.add_child(p)
	p.position = off
	p.look_at(p.global_position - (bone_global.basis.y if bone_global.basis.y.length() > 0.1 else Vector3.UP), Vector3.FORWARD if absf(bone_global.basis.y.normalized().y) > 0.9 else Vector3.UP)
	p.emitting = true
	get_tree().create_timer(2.2, false).timeout.connect(func():
		if is_instance_valid(p): p.emitting = false)
	blood_hit(bone_global.origin, Vector3(h.get("dir", Vector3.FORWARD)), 40.0, a)
	Sfx.at("sever", bone_global.origin, 2.0)
	G.run["gibs"] = int(G.run.get("gibs", 0)) + 1

## Статичная копия части тела (меши в пространстве кости).
func limb_node(a: Actor, root_bone: String) -> Node3D:
	var key = a.look_key + "|" + root_bone
	var sk = a.skel
	var root_i = sk.find_bone(root_bone)
	if not limb_cache.has(key):
		var meshes = []
		for g in a.geo:
			if not is_instance_valid(g) or not (g is MeshInstance3D) or (g as MeshInstance3D).skin == null:
				continue
			var mi: MeshInstance3D = g
			var m = _extract_limb(mi, sk, root_i)
			if m:
				meshes.append(m)
		limb_cache[key] = meshes
	var arr: Array = limb_cache[key]
	if arr.is_empty():
		return null
	var n = Node3D.new()
	for pair in arr:
		var mi2 = MeshInstance3D.new()
		mi2.mesh = pair[0]
		for s in mi2.mesh.get_surface_count():
			mi2.set_surface_override_material(s, pair[1][s])
		n.add_child(mi2)
	# шлем/предметы на голове
	if root_bone == "Head":
		for k in a.item_nodes:
			var ba: BoneAttachment3D = a.item_nodes[k]
			if ba.bone_name == "Head":
				var cp: Node3D = ba.get_child(0).duplicate()
				n.add_child(cp)
				ba.visible = false
	return n

func _subtree(sk: Skeleton3D, root_i: int) -> Dictionary:
	var s = {root_i: true}
	for i in sk.get_bone_count():
		var b = i
		while b >= 0:
			if b == root_i:
				s[i] = true
				break
			b = sk.get_bone_parent(b)
	return s

func _extract_limb(mi: MeshInstance3D, sk: Skeleton3D, root_i: int) -> Array:
	var skin: Skin = mi.skin
	var sub = _subtree(sk, root_i)
	var bind_bone = {}
	var root_bind = -1
	for b in skin.get_bind_count():
		var nm = skin.get_bind_name(b)
		var bi = sk.find_bone(nm) if nm != StringName() else skin.get_bind_bone(b)
		bind_bone[b] = bi
		if bi == root_i:
			root_bind = b
	var to_local: Transform3D
	if root_bind >= 0:
		to_local = skin.get_bind_pose(root_bind)
	else:
		to_local = sk.get_bone_global_rest(root_i).affine_inverse()
	var out = ArrayMesh.new()
	var mats = []
	var mesh: Mesh = mi.mesh
	for s in mesh.get_surface_count():
		var arr: Array = mesh.surface_get_arrays(s)
		var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
		var weights: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		if verts.is_empty() or bones.is_empty():
			continue
		var bpv = bones.size() / verts.size()
		var ok = PackedByteArray(); ok.resize(verts.size())
		for v in verts.size():
			var best = 0; var bw = -1.0
			for k in bpv:
				var w = weights[v * bpv + k]
				if w > bw:
					bw = w; best = bones[v * bpv + k]
			ok[v] = 1 if sub.has(bind_bone.get(best, -1)) else 0
		var remap = {}
		var nv = PackedVector3Array(); var nn = PackedVector3Array(); var nuv = PackedVector2Array()
		var src_n: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
		var src_uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV]
		var ni = PackedInt32Array()
		for t in range(0, idx.size(), 3):
			if ok[idx[t]] and ok[idx[t + 1]] and ok[idx[t + 2]]:
				for j in 3:
					var o = idx[t + j]
					if not remap.has(o):
						remap[o] = nv.size()
						nv.append(to_local * verts[o])
						nn.append((to_local.basis * src_n[o]).normalized() if src_n.size() > o else Vector3.UP)
						nuv.append(src_uv[o] if src_uv.size() > o else Vector2.ZERO)
					ni.append(remap[o])
		if ni.size() < 3:
			continue
		var na = []; na.resize(Mesh.ARRAY_MAX)
		na[Mesh.ARRAY_VERTEX] = nv; na[Mesh.ARRAY_NORMAL] = nn; na[Mesh.ARRAY_TEX_UV] = nuv; na[Mesh.ARRAY_INDEX] = ni
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, na)
		mats.append(mi.get_active_material(s))
	if out.get_surface_count() == 0:
		return []
	return [out, mats]

func _register_gib(rb: RigidBody3D) -> void:
	gibs.append(rb)
	rb.sleeping_state_changed.connect(func():
		if is_instance_valid(rb) and rb.sleeping:
			rb.freeze = true)
	if gibs.size() > MAX_GIBS:
		var old = gibs.pop_front()
		if is_instance_valid(old):
			old.queue_free()

func gib_chunk(pos: Vector3, vel: Vector3, bone := false) -> RigidBody3D:
	var rb = RigidBody3D.new()
	rb.collision_layer = 4
	rb.collision_mask = 1
	rb.mass = 1.0
	rb.continuous_cd = false
	var mi = MeshInstance3D.new()
	var src = (bone_meshes if bone else gib_meshes)[randi() % (bone_meshes if bone else gib_meshes).size()]
	if src is PackedScene:
		var inst: Node3D = src.instantiate()
		for m: MeshInstance3D in inst.find_children("*", "MeshInstance3D", true, false):
			var ck = "gib|" + str(src.get_instance_id())
			if not _gib_mats.has(ck):
				var gm = CharBuilder.prop_material(m.get_active_material(0), "bone" if bone else "flesh")
				gm.set_shader_parameter("desat", 0.0)
				gm.set_shader_parameter("detail_amount", 0.2)
				_gib_mats[ck] = gm
			m.material_override = _gib_mats[ck]
		rb.add_child(inst)
		inst.scale = Vector3.ONE * randf_range(0.7, 1.2)
	else:
		mi.mesh = src
		mi.material_override = bone_mat if bone else gib_mat
		rb.add_child(mi)
		mi.scale = Vector3.ONE * randf_range(0.7, 1.3)
	var cs = CollisionShape3D.new()
	var sph = SphereShape3D.new(); sph.radius = 0.08
	cs.shape = sph
	rb.add_child(cs)
	add_child(rb)
	rb.global_position = pos
	rb.linear_velocity = vel
	rb.angular_velocity = Vector3(randf_range(-15, 15), randf_range(-15, 15), randf_range(-15, 15))
	_register_gib(rb)
	return rb

func gib_explode(a: Actor, h: Dictionary) -> void:
	var c = a.center()
	var dir: Vector3 = Vector3(h.get("dir", Vector3.ZERO))
	var gm = gore_mul()
	var n = int(10 * gm) + 2
	for i in n:
		var v = (dir * randf_range(1.0, 5.0) + Vector3(randf_range(-4, 4), randf_range(4, 10), randf_range(-4, 4)))
		gib_chunk(c + Vector3(randf_range(-0.3, 0.3), randf_range(-0.6, 0.5), randf_range(-0.3, 0.3)), v, i % 3 == 0)
	# голова целиком
	var head = limb_node(a, "Head")
	if head:
		var rb = RigidBody3D.new()
		rb.collision_layer = 4; rb.collision_mask = 1; rb.mass = 4.0
		var cs = CollisionShape3D.new(); var sph = SphereShape3D.new(); sph.radius = 0.12; cs.shape = sph; rb.add_child(cs)
		add_child(rb)
		var hb = a.skel.find_bone("Head")
		rb.global_transform = a.skel.global_transform * a.skel.get_bone_global_pose(hb)
		rb.add_child(head)
		rb.linear_velocity = dir * 4.0 + Vector3(randf_range(-3, 3), randf_range(7, 11), randf_range(-3, 3))
		rb.angular_velocity = Vector3(randf_range(-10, 10), randf_range(-10, 10), randf_range(-10, 10))
		_register_gib(rb)
	_emit(c, Vector3.UP, drop_pm, drop_mesh, int(120 * gm), 1.2)
	var pm = mist_pm.duplicate() as ParticleProcessMaterial
	pm.spread = 180; pm.initial_velocity_max = 5.0
	_emit(c, Vector3.UP, pm, soft_mesh, int(14 * gm) + 1, 1.0)
	for i in int(6 * gm) + 1:
		blood_decal(a.global_position + Vector3(randf_range(-2.4, 2.4), 0, randf_range(-2.4, 2.4)), randf_range(0.8, 2.0))
	blood_pool(a.global_position, 2.4)
	Sfx.at("gib", c, 3.0)
	G.run["gibs"] = int(G.run.get("gibs", 0)) + 1
