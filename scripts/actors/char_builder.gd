class_name CharBuilder
## Собирает модель персонажа: одежда Quaternius + голова + перекраска + предметы на костях.

const BASES := {
	"ranger_m": "res://assets/chars/outfits/Male_Ranger.gltf",
	"peasant_m": "res://assets/chars/outfits/Male_Peasant.gltf",
	"ranger_f": "res://assets/chars/outfits/Female_Ranger.gltf",
	"peasant_f": "res://assets/chars/outfits/Female_Peasant.gltf",
	"bare_m": "res://assets/chars/src/Superhero_Male_FullBody.gltf",
	"bare_f": "res://assets/chars/src/Superhero_Female_FullBody.gltf",
}
const SHADER := preload("res://assets/shaders/char.gdshader")
const PROP_SHADER := preload("res://assets/shaders/prop.gdshader")

static var _scenes: Dictionary = {}
static var _mat_cache: Dictionary = {}
static var _item_cache: Dictionary = {}
static var noise: Texture2D
static var mail: Texture2D
static var tabard_tex: Texture2D

static func _scene(path: String) -> PackedScene:
	if not _scenes.has(path):
		_scenes[path] = load(path)
	return _scenes[path]

static func _init_tex() -> void:
	if noise == null:
		noise = load("res://assets/tex/noise.tres")
	if mail == null:
		var p = "res://assets/tex/acg_chainmail.jpg"
		mail = load(p) if ResourceLoader.exists(p) else noise

## look: словарь из G.LOOKS. key: уникальный ключ кэша материалов (обычно id облика + вариант).
static func build(look: Dictionary, key: String) -> Node3D:
	_init_tex()
	var base: String = look.get("base", "ranger_m")
	var root: Node3D = _scene(BASES[base]).instantiate()
	root.name = "Model"
	var sk: Skeleton3D = root.find_children("*", "Skeleton3D", true, false)[0]
	var hide: Array = look.get("hide", [])
	for mi: MeshInstance3D in sk.find_children("*", "MeshInstance3D", false, false):
		var nm = String(mi.name)
		var hidden = false
		for h in hide:
			if nm.findn(h) >= 0:
				hidden = true
		if hidden:
			mi.queue_free()
			continue
		_apply_mats(mi, look, key)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	# голова для одежды (у bare_* она своя)
	if not base.begins_with("bare") and look.get("head", true):
		var g = "f" if base.ends_with("_f") else "m"
		for part in ["superhero_" + ("female" if g == "f" else "male"), "eyes", "eyebrows"]:
			if part == "eyebrows" and look.get("undead", 0.0) > 0.0:
				continue
			var mi = MeshInstance3D.new()
			mi.name = "Head_" + part
			mi.mesh = load("res://assets/chars/heads/%s_%s.res" % [g, part])
			mi.skin = load("res://assets/chars/heads/%s_%s_skin.res" % [g, part])
			sk.add_child(mi)
			mi.skeleton = NodePath("..")
			_apply_mats(mi, look, key)
	# дополнительные части одежды из других комплектов
	for extra in look.get("extra", []):
		var src: Node = _scene(BASES[extra[0]]).instantiate()
		for mi: MeshInstance3D in src.find_children("*", "MeshInstance3D", true, false):
			if String(mi.name).findn(extra[1]) >= 0:
				var n = MeshInstance3D.new()
				n.name = "X_" + String(mi.name)
				n.mesh = mi.mesh; n.skin = mi.skin
				sk.add_child(n)
				n.skeleton = NodePath("..")
				_apply_mats(n, look, key)
		src.free()
	if look.has("tabard"):
		_add_tabard(sk, look, key)
	for it in look.get("items", []):
		attach_item(sk, it, look)
	var sc: float = look.get("scale", 1.0)
	root.scale = Vector3.ONE * sc
	return root

static func _apply_mats(mi: MeshInstance3D, look: Dictionary, key: String) -> void:
	if mi.mesh == null:
		return
	for s in mi.mesh.get_surface_count():
		var src = mi.get_active_material(s)
		var ck = "%s|%s|%d" % [key, str(src.get_instance_id()) if src else "none", s]
		if not _mat_cache.has(ck):
			_mat_cache[ck] = _make_mat(src, look, String(mi.name))
		mi.set_surface_override_material(s, _mat_cache[ck])

static func _make_mat(src: Material, look: Dictionary, mesh_name: String) -> Material:
	var m = ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("noise_tex", noise)
	m.set_shader_parameter("mail_tex", mail)
	var is_eye = mesh_name.findn("eyes") >= 0
	var is_skin = false
	if src is BaseMaterial3D:
		var b: BaseMaterial3D = src
		m.set_shader_parameter("albedo_tex", b.albedo_texture)
		m.set_shader_parameter("tint", b.albedo_color)
		if b.normal_enabled and b.normal_texture:
			m.set_shader_parameter("normal_tex", b.normal_texture)
			m.set_shader_parameter("normal_strength", b.normal_scale)
		if b is ORMMaterial3D and (b as ORMMaterial3D).orm_texture:
			m.set_shader_parameter("orm_tex", (b as ORMMaterial3D).orm_texture)
			m.set_shader_parameter("orm_mode", 1)
		elif b.roughness_texture:
			m.set_shader_parameter("orm_tex", b.roughness_texture)
			m.set_shader_parameter("orm_mode", 2)
		var mn = String(b.resource_name)
		is_skin = mn.findn("Superhero") >= 0 or mn.findn("Regular") >= 0 or mesh_name.begins_with("Head_superhero") or mn.findn("Eyebrow") >= 0 or mn.findn("Hair") >= 0
	m.set_shader_parameter("is_skin", is_skin or is_eye)
	var cl: Color = look.get("cloth", Color(0.5, 0.5, 0.5, 0.0))
	m.set_shader_parameter("cloth_color", cl)
	m.set_shader_parameter("leather_color", look.get("leather", Color(0.3, 0.2, 0.15, 0.0)))
	m.set_shader_parameter("metal_color", look.get("metal", Color(0.6, 0.6, 0.62, 0.0)))
	m.set_shader_parameter("mail_amount", look.get("mail", 0.0))
	m.set_shader_parameter("desat", look.get("desat", 0.0))
	m.set_shader_parameter("value_mul", look.get("value", 1.0))
	m.set_shader_parameter("skin_tint", look.get("skin", Color(1, 1, 1)))
	m.set_shader_parameter("undead", look.get("undead", 0.0))
	m.set_shader_parameter("stone", look.get("stone", 0.0))
	if is_eye:
		var ec: Color = look.get("eyes", Color(0, 0, 0, 0))
		m.set_shader_parameter("emission_color", ec)
	return m

static func _add_tabard(sk: Skeleton3D, look: Dictionary, key: String) -> void:
	# сюрко: полотнище спереди и сзади, привязано к груди/тазу
	var chest = sk.find_bone("Chest")
	var hips = sk.find_bone("Hips")
	var ub = sk.find_bone("UpperChest")
	var ll = sk.find_bone("LeftUpperLeg")
	var rl = sk.find_bone("RightUpperLeg")
	if chest < 0 or hips < 0:
		return
	var pc = sk.get_bone_global_rest(ub if ub >= 0 else chest).origin
	var ph = sk.get_bone_global_rest(hips).origin
	var top = pc.y + 0.12
	var bot = ph.y - 0.42
	var st = SurfaceTool.new()
	st.set_skin_weight_count(SurfaceTool.SKIN_4_WEIGHTS)
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rows = 6
	for side: float in [1.0, -1.0]:
		var z = 0.135 * side
		var base_i = 0
		var verts = []
		for r in rows + 1:
			var t = float(r) / rows
			var y = lerpf(top, bot, t)
			var hw = lerpf(0.19, 0.17, t)
			var zz = z + (0.02 * side if t > 0.55 else 0.0) + (0.03 * side if t < 0.25 else 0.0)
			for c in 2:
				var x = -hw if c == 0 else hw
				var bones = PackedInt32Array([chest, hips, 0, 0])
				var w = PackedFloat32Array([1.0, 0.0, 0.0, 0.0])
				if y < ph.y + 0.05:
					var leg = ll if x * side > 0.0 else rl
					var k = clampf((ph.y + 0.05 - y) / 0.4, 0.0, 1.0)
					bones = PackedInt32Array([hips, leg if leg >= 0 else hips, 0, 0])
					w = PackedFloat32Array([1.0 - k * 0.7, k * 0.7, 0, 0])
				elif y < pc.y - 0.1:
					var k2 = clampf((pc.y - 0.1 - y) / 0.3, 0.0, 1.0)
					w = PackedFloat32Array([1.0 - k2, k2, 0, 0])
				st.set_bones(bones); st.set_weights(w)
				st.set_uv(Vector2(float(c), t))
				st.set_normal(Vector3(0, 0, side))
				st.add_vertex(Vector3(x * side, y, zz))
		pass
	for side_i in 2:
		var o = side_i * (rows + 1) * 2
		for r in rows:
			var a = o + r * 2
			st.add_index(a); st.add_index(a + 1); st.add_index(a + 2)
			st.add_index(a + 1); st.add_index(a + 3); st.add_index(a + 2)
	st.generate_tangents()
	var mesh = st.commit()
	var mi = MeshInstance3D.new()
	mi.name = "Tabard"
	mi.mesh = mesh
	mi.skin = sk.create_skin_from_rest_transforms()
	sk.add_child(mi)
	mi.skeleton = NodePath("..")
	var ck = key + "|tabard"
	if not _mat_cache.has(ck):
		var m = ShaderMaterial.new()
		m.shader = load("res://assets/shaders/tabard.gdshader")
		m.set_shader_parameter("noise_tex", noise)
		m.set_shader_parameter("cloth", look.get("tabard_cloth", Color(0.82, 0.8, 0.74)))
		m.set_shader_parameter("cross", look["tabard"])
		m.set_shader_parameter("undead", look.get("undead", 0.0))
		var lt = "res://assets/tex/linen.jpg"
		if ResourceLoader.exists(lt):
			m.set_shader_parameter("cloth_tex", load(lt))
		_mat_cache[ck] = m
	mi.material_override = _mat_cache[ck]

## Предмет на кости. it: [id] или {"id":..., "bone":...}
static func attach_item(sk: Skeleton3D, it, look: Dictionary) -> Node3D:
	var id: String = it if it is String else it["id"]
	var d: Dictionary = G.ITEMS.get(id, {})
	if d.is_empty():
		return null
	var ba = BoneAttachment3D.new()
	ba.name = "I_" + id
	ba.bone_name = d.get("bone", "RightHand")
	sk.add_child(ba)
	var holder = Node3D.new()
	holder.name = "Item"
	ba.add_child(holder)
	var node = item_mesh(id)
	holder.add_child(node)
	holder.position = d.get("pos", Vector3.ZERO)
	holder.rotation_degrees = d.get("rot", Vector3.ZERO)
	holder.scale = Vector3.ONE * float(d.get("scale", 1.0))
	ba.set_meta("item", id)
	return ba

static var _proc_mats = {}
static func _pmat(kind: String, tint: Color) -> ShaderMaterial:
	var k = kind + str(tint)
	if not _proc_mats.has(k):
		var m = prop_material(null, kind)
		m.set_shader_parameter("tint", tint)
		m.set_shader_parameter("world_triplanar", 0.0)
		_proc_mats[k] = m
	return _proc_mats[k]

static func _cyl(r0: float, r1: float, h: float, y: float, mat: Material, seg := 8) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var c = CylinderMesh.new(); c.top_radius = r1; c.bottom_radius = r0; c.height = h; c.radial_segments = seg; c.rings = 1
	mi.mesh = c
	mi.material_override = mat
	mi.position.y = y + h * 0.5
	return mi

static func _box(sz: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var b = BoxMesh.new(); b.size = sz
	mi.mesh = b
	mi.material_override = mat
	mi.position = pos
	return mi

## Простое, но чистое оружие из примитивов (ось +Y, хват в нуле).
static func proc_item(kind: String) -> Node3D:
	var n = Node3D.new()
	var wood = _pmat("wood", Color(0.36, 0.26, 0.18))
	var dark = _pmat("wood", Color(0.18, 0.14, 0.11))
	var iron = _pmat("metal", Color(0.55, 0.55, 0.56))
	var bone = _pmat("bone", Color(0.86, 0.82, 0.72))
	match kind:
		"staff":
			n.add_child(_cyl(0.022, 0.028, 1.75, -0.55, dark))
			for y in [0.35, 0.75]:
				n.add_child(_cyl(0.034, 0.034, 0.05, y, iron))
			var sk = load("res://assets/gore/skull.glb") if ResourceLoader.exists("res://assets/gore/skull.glb") else null
			if sk:
				var s = (sk as PackedScene).instantiate()
				s.scale = Vector3.ONE * 0.75
				s.position = Vector3(0, 1.22, 0)
				n.add_child(s)
				for mi in s.find_children("*", "MeshInstance3D", true, false):
					(mi as MeshInstance3D).material_override = prop_material((mi as MeshInstance3D).get_active_material(0), "bone")
			var gem = MeshInstance3D.new()
			var sp = SphereMesh.new(); sp.radius = 0.045; sp.height = 0.09
			gem.mesh = sp
			var gm = StandardMaterial3D.new(); gm.albedo_color = Color(0.3, 1.0, 0.5); gm.emission_enabled = true; gm.emission = Color(0.3, 1.0, 0.5); gm.emission_energy_multiplier = 4.0
			gem.material_override = gm
			gem.position = Vector3(0, 1.36, 0.02)
			n.add_child(gem)
			var l = OmniLight3D.new(); l.light_color = Color(0.35, 1.0, 0.5); l.light_energy = 0.8; l.omni_range = 2.5; l.position = Vector3(0, 1.36, 0)
			n.add_child(l)
		"pitchfork":
			n.add_child(_cyl(0.02, 0.022, 1.55, -0.5, wood))
			n.add_child(_box(Vector3(0.2, 0.03, 0.03), Vector3(0, 1.06, 0), iron))
			for x in [-0.09, 0.0, 0.09]:
				n.add_child(_cyl(0.008, 0.004, 0.3, 1.07, iron, 6))
				n.get_child(n.get_child_count() - 1).position.x = x
		"spear":
			n.add_child(_cyl(0.02, 0.022, 1.8, -0.55, wood))
			var tip = MeshInstance3D.new()
			var c = CylinderMesh.new(); c.top_radius = 0.0; c.bottom_radius = 0.045; c.height = 0.32; c.radial_segments = 4
			tip.mesh = c; tip.material_override = iron; tip.position.y = 1.25 + 0.16
			n.add_child(tip)
		"torch":
			n.add_child(_cyl(0.022, 0.026, 0.62, -0.12, wood))
			n.add_child(_cyl(0.045, 0.05, 0.14, 0.44, _pmat("cloth", Color(0.25, 0.2, 0.15))))
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return n

static func item_mesh(id: String) -> Node3D:
	var d: Dictionary = G.ITEMS[id]
	if d.has("proc"):
		var pn = proc_item(String(d["proc"]))
		pn.position = d.get("mesh_pos", Vector3.ZERO)
		return pn
	var path: String = d["mesh"]
	var res = _item_cache.get(path)
	if res == null:
		res = load(path)
		_item_cache[path] = res
	var n: Node3D
	if res is PackedScene:
		n = (res as PackedScene).instantiate()
	else:
		var mi = MeshInstance3D.new()
		mi.mesh = res
		n = mi
	n.position = d.get("mesh_pos", Vector3.ZERO)
	n.rotation_degrees = d.get("mesh_rot", Vector3.ZERO)
	n.scale = Vector3.ONE * float(d.get("mesh_scale", 1.0))
	var mk = "item|" + id
	for mi: MeshInstance3D in ([n] if n is MeshInstance3D else []) + n.find_children("*", "MeshInstance3D", true, false):
		for s in mi.mesh.get_surface_count():
			var src = mi.get_active_material(s)
			var ck = mk + "|" + str(s) + "|" + str(src.get_instance_id() if src else 0)
			if not _mat_cache.has(ck):
				_mat_cache[ck] = prop_material(src, d.get("mat", "metal"))
			mi.set_surface_override_material(s, _mat_cache[ck])
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return n

## Материал для пропсов/оружия: запечённый альбедо + детальная трипланарная фактура по типу.
static func prop_material(src: Material, kind: String) -> ShaderMaterial:
	_init_tex()
	var m = ShaderMaterial.new()
	m.shader = PROP_SHADER
	m.set_shader_parameter("noise_tex", noise)
	var col = Color(1, 1, 1)
	if src is BaseMaterial3D:
		var b: BaseMaterial3D = src
		if b.albedo_texture:
			m.set_shader_parameter("albedo_tex", b.albedo_texture)
			m.set_shader_parameter("has_albedo", true)
		col = b.albedo_color
	m.set_shader_parameter("tint", col)
	var kinds: Dictionary = G.MATERIALS.get(kind, G.MATERIALS["stone"])
	var dt: String = kinds.get("tex", "")
	if dt != "" and ResourceLoader.exists("res://assets/tex/%s.jpg" % dt):
		m.set_shader_parameter("detail_tex", load("res://assets/tex/%s.jpg" % dt))
		if ResourceLoader.exists("res://assets/tex/%s_n.jpg" % dt):
			m.set_shader_parameter("detail_n", load("res://assets/tex/%s_n.jpg" % dt))
		m.set_shader_parameter("detail_amount", kinds.get("detail", 0.5))
	m.set_shader_parameter("rough", kinds.get("rough", 0.8))
	m.set_shader_parameter("metal", kinds.get("metal", 0.0))
	m.set_shader_parameter("detail_scale", kinds.get("scale", 1.0))
	m.set_shader_parameter("color_mul", kinds.get("color", Color(1, 1, 1)))
	return m
