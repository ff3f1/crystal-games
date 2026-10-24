class_name LevelBuilder
## Строит арену под биом: земля, границы, препятствия, свет, погода, навигация.

const H := 26.0

# каталог объектов: сгенерированная модель -> запасной вариант из набора
const PROPS := {
	"grave_a": {"gen": "grave_a", "mat": "granite", "col": [0.45, 0.25], "box": true, "h": 1.1, "fb": "box:0.7,1.05,0.2"},
	"grave_b": {"gen": "grave_b", "mat": "granite", "col": [0.45, 0.25], "box": true, "h": 1.4, "fb": "box:0.65,1.4,0.22"},
	"grave_c": {"gen": "grave_c", "mat": "granite", "col": [0.45, 0.25], "box": true, "h": 0.9, "fb": "box:0.7,0.8,0.2"},
	"slab": {"gen": "tombstone_slab", "mat": "granite", "col": [0.6, 1.1], "box": true, "h": 0.5, "fb": "box:1.0,0.35,2.0"},
	"celtic_cross": {"gen": "celtic_cross", "mat": "granite", "col": 0.45, "h": 2.2, "fb": "box:0.35,2.2,0.3"},
	"angel": {"gen": "angel_statue", "mat": "marble", "col": 0.8, "h": 2.6, "fb": "cyl:0.6,2.6"},
	"obelisk": {"gen": "obelisk", "mat": "granite", "col": 0.7, "h": 2.8, "fb": "box:0.9,2.8,0.9"},
	"coffin": {"gen": "coffin_open", "mat": "wood", "col": [0.45, 1.0], "box": true, "h": 0.7, "fb": "box:0.8,0.5,2.0", "hp": 60},
	"tree_a": {"gen": "dead_tree_a", "mat": "bark", "col": 0.45, "h": 5.5, "fb": "cyl:0.35,5.0"},
	"tree_b": {"gen": "dead_tree_b", "mat": "bark", "col": 0.5, "h": 5.0, "fb": "cyl:0.4,4.5"},
	"mausoleum": {"gen": "mausoleum", "mat": "stone", "col": [2.2, 2.2], "box": true, "h": 4.0, "fb": "box:4.2,4.0,4.2"},
	"fence": {"kit": "Prop_MetalFence_Ornament", "mat": "metal", "col": [1.1, 0.1], "box": true},
	"fence_wood": {"kit": "Prop_WoodenFence_Single", "mat": "wood", "col": [1.0, 0.15], "box": true},
	"tent": {"gen": "tent", "mat": "cloth", "col": [1.6, 1.6], "box": true, "h": 3.2, "fb": "box:3.0,2.6,3.0"},
	"wagon": {"kit": "Prop_Wagon", "gen": "wagon", "mat": "wood", "col": [1.0, 1.8], "box": true, "h": 2.0},
	"barricade": {"gen": "barricade", "mat": "wood", "col": [1.4, 0.5], "box": true, "h": 1.4, "fb": "box:2.6,1.0,0.6", "hp": 90},
	"weapon_rack": {"kit": "WeaponStand", "gen": "weapon_rack", "mat": "wood", "col": [0.7, 0.3], "box": true, "h": 1.8, "hp": 50},
	"barrel": {"kit": "Barrel", "gen": "barrel", "mat": "wood", "col": 0.4, "h": 1.0, "hp": 30},
	"barrel_x": {"kit": "Barrel", "gen": "barrel", "mat": "wood", "col": 0.4, "h": 1.0, "hp": 20, "explosive": true},
	"crate": {"kit": "Crate_Wooden", "gen": "crate", "mat": "wood", "col": [0.45, 0.45], "box": true, "h": 0.8, "hp": 30},
	"campfire": {"gen": "campfire", "mat": "wood", "col": 0.6, "h": 0.6, "fb": "cyl:0.6,0.3", "fire": 0.8},
	"banner": {"gen": "banner", "kit": "Banner_1", "mat": "cloth", "col": 0.2, "h": 4.0},
	"gallows": {"gen": "gallows", "mat": "wood", "col": [1.2, 0.6], "box": true, "h": 4.2, "fb": "box:2.4,4.0,0.4"},
	"pyre": {"gen": "pyre", "mat": "wood", "col": 1.1, "h": 3.0, "fb": "cyl:1.1,1.0", "fire": 1.2},
	"cage": {"gen": "cage", "kit": "Cage_Small", "mat": "rust", "col": [0.9, 0.9], "box": true, "h": 2.2},
	"hay": {"gen": "hay", "mat": "hay", "col": [0.8, 0.6], "box": true, "h": 1.3, "fb": "box:1.6,1.2,1.2", "hp": 40},
	"pillar_ruin": {"gen": "pillar_ruin", "mat": "stone", "col": 0.7, "h": 3.0, "fb": "cyl:0.6,3.0"},
	"sarcophagus": {"gen": "sarcophagus", "mat": "granite", "col": [0.6, 1.2], "box": true, "h": 1.0, "fb": "box:1.1,0.9,2.3"},
	"skull_pile": {"gen": "skull_pile", "mat": "bone", "col": 0.5, "h": 0.8, "fb": "cyl:0.5,0.4", "hp": 25},
	"bone_pile": {"gen": "bone_pile", "mat": "bone", "col": 0.0, "h": 0.5, "fb": "none"},
	"rack": {"gen": "rack", "mat": "wood", "col": [0.7, 1.2], "box": true, "h": 1.2, "fb": "box:1.2,1.0,2.2", "hp": 70},
	"iron_maiden": {"gen": "iron_maiden", "mat": "rust", "col": 0.6, "h": 2.1, "fb": "box:0.9,2.1,0.7"},
	"brazier": {"gen": "brazier", "mat": "metal", "col": 0.4, "h": 1.2, "fb": "cyl:0.4,1.0", "fire": 0.45, "fire_y": 1.05},
	"candelabra": {"gen": "candelabra", "kit": "CandleStick_Stand", "mat": "metal", "col": 0.2, "h": 1.8, "candle": true},
	"altar_stone": {"gen": "altar_stone", "mat": "granite", "col": [0.8, 0.5], "box": true, "h": 1.0, "fb": "box:1.8,1.0,1.0"},
	"wheel": {"gen": "wheel", "mat": "wood", "col": 0.3, "h": 3.0, "fb": "cyl:0.15,3.0"},
	"gothic_pillar": {"gen": "gothic_pillar", "mat": "stone", "col": 0.85, "h": 6.0, "fb": "cyl:0.8,7.0"},
	"pew": {"gen": "pew", "kit": "Bench", "mat": "wood", "col": [1.4, 0.35], "box": true, "h": 1.1, "hp": 45},
	"altar": {"gen": "altar", "mat": "marble", "col": [2.0, 0.8], "box": true, "h": 2.5, "fb": "box:4.0,1.4,1.6"},
	"saint": {"gen": "saint_statue", "mat": "granite", "col": 0.8, "h": 3.2, "fb": "cyl:0.7,3.2"},
	"bell": {"gen": "bell", "mat": "bronze", "col": 0.6, "h": 1.4, "fb": "cyl:0.6,1.3"},
	"lectern": {"gen": "lectern", "kit": "BookStand", "mat": "wood", "col": 0.35, "h": 1.4, "hp": 30},
	"candles": {"gen": "candles", "kit": "CandleStick_Triple", "mat": "metal", "col": 0.0, "h": 0.5, "candle": true},
	"lantern_post": {"kit": "Torch_Metal", "mat": "metal", "col": 0.15, "fire": 0.25, "fire_y": 1.6, "h": 1.8},
	"wall_brick": {"kit": "Wall_UnevenBrick_Straight", "mat": "stone", "col": [1.0, 0.2], "box": true},
}

static var _cache = {}

static func build(world: Node, biome: String) -> Node3D:
	var root = Node3D.new()
	root.name = "Level"
	var nav = NavigationRegion3D.new()
	nav.name = "Nav"
	var nm = NavigationMesh.new()
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.geometry_collision_mask = 1
	nm.agent_radius = 0.5
	nm.agent_height = 1.8
	nm.agent_max_climb = 0.25
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	nm.filter_baking_aabb = AABB(Vector3(-H - 2, -1, -H - 2), Vector3(H * 2 + 4, 6, H * 2 + 4))
	nav.navigation_mesh = nm
	root.add_child(nav)
	var rng = RandomNumberGenerator.new()
	rng.seed = hash(biome) + randi() % 3
	var ctx = {"world": world, "root": root, "nav": nav, "rng": rng, "biome": biome, "blocked": []}
	_env(ctx)
	_ground(ctx)
	_bounds(ctx)
	match biome:
		"graveyard": _graveyard(ctx)
		"camp": _camp(ctx)
		"crypt": _crypt(ctx)
		"cathedral": _cathedral(ctx)
	_weather(ctx)
	world.spawn_points = ctx.get("spawns", [Vector3(0, 0, -H + 2), Vector3(0, 0, H - 2), Vector3(-H + 2, 0, 0), Vector3(H - 2, 0, 0)])
	return root

static func apply_quality(e: Environment) -> void:
	var s: Dictionary = G.settings
	e.ssao_enabled = bool(s.ssao)
	e.ssil_enabled = bool(s.ssil)
	e.glow_enabled = bool(s.glow)
	e.volumetric_fog_enabled = bool(s.volumetric) and e.has_meta("vol")

# ---------------------------------------------------------------- окружение
const BIOMES := {
	"graveyard": {"sun_rot": Vector3(-42, -35, 0), "sun_col": Color(0.7, 0.78, 0.95), "sun_e": 1.05, "amb": Color(0.4, 0.44, 0.55), "amb_e": 0.55,
		"fog": Color(0.16, 0.18, 0.24), "fog_d": 0.012, "vol": 0.025, "ground": ["acg_forest", "acg_mud"], "gscale": [0.33, 0.3], "wet": 0.6, "snow": 0.0, "weather": "rain", "gvalue": 0.78},
	"camp": {"sun_rot": Vector3(-42, 25, 0), "sun_col": Color(0.86, 0.9, 1.0), "sun_e": 0.95, "amb": Color(0.5, 0.54, 0.62), "amb_e": 0.6,
		"fog": Color(0.42, 0.45, 0.5), "fog_d": 0.012, "vol": 0.02, "ground": ["acg_snow", "acg_mud"], "gscale": [0.2, 0.18], "wet": 0.1, "snow": 0.0, "weather": "snow", "gvalue": 0.78, "gbias": -0.1},
	"crypt": {"sun_rot": Vector3(-65, 20, 0), "sun_col": Color(0.62, 0.64, 0.7), "sun_e": 0.6, "amb": Color(0.34, 0.35, 0.4), "amb_e": 0.85,
		"fog": Color(0.12, 0.12, 0.15), "fog_d": 0.007, "vol": 0.02, "expo": 1.4, "ground": ["acg_castlefloor", "acg_rockfloor"], "gscale": [0.22, 0.3], "wet": 0.3, "snow": 0.0, "weather": "dust"},
	"cathedral": {"sun_rot": Vector3(-50, -60, 0), "sun_col": Color(1.0, 0.94, 0.86), "sun_e": 1.15, "amb": Color(0.44, 0.46, 0.52), "amb_e": 0.6,
		"fog": Color(0.22, 0.23, 0.27), "fog_d": 0.008, "vol": 0.035, "ground": ["acg_castlefloor", "acg_marble"], "gscale": [0.2, 0.15], "wet": 0.0, "snow": 0.0, "weather": "embers", "gvalue": 0.8, "gbias": -0.12},
}

static func _env(ctx: Dictionary) -> void:
	var b: Dictionary = BIOMES[ctx.biome]
	var we = WorldEnvironment.new()
	var e = Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.02, 0.02, 0.025)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = b.amb
	e.ambient_light_energy = b.amb_e
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.tonemap_exposure = float(b.get("expo", 1.15))
	e.tonemap_white = 6.0
	e.glow_enabled = true
	e.glow_intensity = 0.7
	e.glow_bloom = 0.06
	e.glow_hdr_threshold = 1.1
	e.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	e.ssao_enabled = true
	e.ssao_radius = 1.6
	e.ssao_intensity = 2.6
	e.ssao_power = 1.6
	e.fog_enabled = true
	e.fog_light_color = b.fog
	e.fog_density = b.fog_d
	e.fog_sky_affect = 0.0
	e.fog_height = 1.5
	e.fog_height_density = 0.05
	e.volumetric_fog_enabled = true
	e.volumetric_fog_density = b.vol
	e.volumetric_fog_albedo = b.fog.lightened(0.3)
	e.volumetric_fog_length = 80.0
	e.volumetric_fog_ambient_inject = 0.15
	e.volumetric_fog_anisotropy = 0.5
	e.set_meta("vol", true)
	e.adjustment_enabled = true
	e.adjustment_contrast = 1.05
	we.environment = e
	ctx.root.add_child(we)
	ctx.world.env = we
	apply_quality(e)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = b.sun_rot
	sun.light_color = b.sun_col
	sun.light_energy = b.sun_e
	sun.shadow_enabled = true
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.2
	sun.shadow_blur = 1.0
	sun.light_angular_distance = 1.2
	sun.directional_shadow_max_distance = 48.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_blend_splits = true
	sun.light_volumetric_fog_energy = 1.6
	sun.light_volumetric_fog_energy = 1.5
	ctx.root.add_child(sun)

static func _ground(ctx: Dictionary) -> void:
	var b: Dictionary = BIOMES[ctx.biome]
	var mi = MeshInstance3D.new()
	var pm = PlaneMesh.new()
	pm.size = Vector2(150, 150)
	pm.subdivide_depth = 2; pm.subdivide_width = 2
	mi.mesh = pm
	var m = ShaderMaterial.new()
	m.shader = load("res://assets/shaders/ground.gdshader")
	var ta: String = b.ground[0]; var tb: String = b.ground[1]
	m.set_shader_parameter("tex_a", _tex(ta)); m.set_shader_parameter("tex_a_n", _tex(ta + "_n"))
	m.set_shader_parameter("tex_b", _tex(tb)); m.set_shader_parameter("tex_b_n", _tex(tb + "_n"))
	m.set_shader_parameter("noise_tex", load("res://assets/tex/noise.tres"))
	m.set_shader_parameter("wet", b.wet)
	m.set_shader_parameter("snow", b.snow)
	m.set_shader_parameter("scale_a", b.gscale[0]); m.set_shader_parameter("scale_b", b.gscale[1])
	m.set_shader_parameter("value", float(b.get("gvalue", 1.0)))
	if b.has("gbias"):
		m.set_shader_parameter("mix_bias", float(b.gbias))
	if ResourceLoader.exists("res://assets/tex/%s_r.jpg" % ta):
		pass
	if ctx.biome == "cathedral":
		m.set_shader_parameter("rough_b", 0.3)
	mi.material_override = m
	ctx.root.add_child(mi)
	var sb = StaticBody3D.new()
	sb.collision_layer = 1
	var cs = CollisionShape3D.new()
	var bs = BoxShape3D.new(); bs.size = Vector3(150, 1, 150)
	cs.shape = bs
	cs.position.y = -0.5
	sb.add_child(cs)
	ctx.nav.add_child(sb)

static func _tex(n: String) -> Texture2D:
	var p = "res://assets/tex/%s.jpg" % n
	if ResourceLoader.exists(p):
		return load(p)
	if n.ends_with("_n"):
		return null
	var p2 = "res://assets/tex/fallback_%s.tres" % n
	if ResourceLoader.exists(p2):
		return load(p2)
	var nt = NoiseTexture2D.new()
	var fn = FastNoiseLite.new(); fn.frequency = 0.05
	nt.noise = fn; nt.seamless = true; nt.width = 256; nt.height = 256
	var gr = Gradient.new()
	var c = {"gravedirt": Color(0.22, 0.2, 0.17), "mud": Color(0.17, 0.14, 0.11), "snow": Color(0.8, 0.82, 0.86), "flagstone": Color(0.35, 0.33, 0.3), "marble": Color(0.75, 0.74, 0.72), "cobble": Color(0.4, 0.38, 0.35)}.get(n, Color(0.3, 0.3, 0.3))
	gr.set_color(0, c * 0.7); gr.set_color(1, c * 1.2)
	nt.color_ramp = gr
	return nt

static func _bounds(ctx: Dictionary) -> void:
	# невидимые стены по краю арены
	for i in 4:
		var sb = StaticBody3D.new()
		sb.collision_layer = 1
		var cs = CollisionShape3D.new()
		var bs = BoxShape3D.new()
		bs.size = Vector3(H * 2 + 6, 6, 1) if i < 2 else Vector3(1, 6, H * 2 + 6)
		cs.shape = bs
		sb.add_child(cs)
		sb.position = [Vector3(0, 3, -H - 1.0), Vector3(0, 3, H + 1.0), Vector3(-H - 1.0, 3, 0), Vector3(H + 1.0, 3, 0)][i]
		ctx.root.add_child(sb)

# ---------------------------------------------------------------- размещение
static func place(ctx: Dictionary, id: String, pos: Vector3, rot_y := 0.0, scale := 1.0, solid := true) -> Node3D:
	var d: Dictionary = PROPS.get(id, {})
	var model = _model(id, d)
	if model == null:
		return null
	var n: Node3D
	var hp = float(d.get("hp", -1.0))
	if solid and (d.get("col", 0.0) is Array or float(d.get("col", 0.0)) > 0.0):
		var pr = Prop.new()
		pr.world = ctx.world
		pr.hp = hp
		pr.mat_kind = String(d.get("mat", "wood"))
		pr.explosive = d.get("explosive", false)
		pr.collision_layer = 1
		pr.model = model
		pr.add_child(model)
		var cs = CollisionShape3D.new()
		var c = d["col"]
		var hh: float = float(d.get("h", 2.0)) * scale
		if d.get("box", false):
			var bs = BoxShape3D.new()
			bs.size = Vector3(float(c[0]) * 2.0, hh, float(c[1]) * 2.0) * Vector3(scale, 1, scale)
			cs.shape = bs
		else:
			var cyl = CylinderShape3D.new()
			cyl.radius = float(c) * scale
			cyl.height = hh
			cs.shape = cyl
		cs.position.y = hh * 0.5
		pr.add_child(cs)
		n = pr
		if hp > 0.0:
			ctx.world.props.append(pr)
			ctx.root.add_child(pr)
		else:
			ctx.nav.add_child(pr)
	else:
		n = Node3D.new()
		n.add_child(model)
		ctx.root.add_child(n)
	n.position = pos
	n.rotation.y = rot_y
	model.scale = Vector3.ONE * scale
	if d.has("fire"):
		_fire(ctx, n, float(d["fire"]), float(d.get("fire_y", 0.25)) * scale)
	if d.get("candle", false):
		var l = OmniLight3D.new()
		l.light_color = Color(1.0, 0.65, 0.3); l.light_energy = 1.2; l.omni_range = 4.0
		l.set_script(load("res://scripts/fx/flicker.gd"))
		n.add_child(l); l.position.y = float(d.get("h", 1.0)) * scale + 0.1
	ctx.blocked.append([Vector2(pos.x, pos.z), (float(d["col"][0]) if d.get("col", 0.0) is Array else float(d.get("col", 0.4))) * scale + 0.6])
	return n

static func _fire(ctx: Dictionary, n: Node3D, size: float, y: float) -> void:
	var fx: FX = ctx.world.fx
	var f = fx.torch_fire()
	n.add_child(f)
	f.position.y = y
	f.scale = Vector3.ONE * (size / 0.25)
	var l: OmniLight3D = f.get_child(1)
	l.omni_range = 4.0 + size * 6.0
	l.light_energy = 1.4 + size
	l.shadow_enabled = size > 0.5

static var _axes_d = null
static func _axes() -> Dictionary:
	if _axes_d == null:
		_axes_d = {}
		var f = FileAccess.open("res://assets/props/axes.json", FileAccess.READ)
		if f:
			var j = JSON.parse_string(f.get_as_text())
			if j is Dictionary:
				_axes_d = j
	return _axes_d

static func _model(id: String, d: Dictionary) -> Node3D:
	var gen = "res://assets/props/%s.glb" % String(d.get("gen", "_none"))
	var kit = "res://assets/kit/%s.gltf" % String(d.get("kit", "_none"))
	var mat = String(d.get("mat", "stone"))
	var src = ""
	if d.has("gen") and ResourceLoader.exists(gen):
		src = gen
	elif d.has("kit") and ResourceLoader.exists(kit):
		src = kit
	var root = Node3D.new()
	if src != "":
		if not _cache.has(src):
			_cache[src] = load(src)
		var inst: Node3D = (_cache[src] as PackedScene).instantiate()
		root.add_child(inst)
		var mk = "lvl|" + src
		for mi: MeshInstance3D in inst.find_children("*", "MeshInstance3D", true, false):
			for s in mi.mesh.get_surface_count():
				var ck = mk + "|" + str(s)
				if not _cache.has(ck):
					var pmat = CharBuilder.prop_material(mi.get_active_material(s), mat)
					if src == gen:
						var ax = _axes().get(String(d.get("gen", "")), [2, 1])
						var av = Vector3.ZERO
						av[int(ax[0])] = 1.0
						pmat.set_shader_parameter("proj_axis", av)
						pmat.set_shader_parameter("side_fix", 0.85)
						pmat.set_shader_parameter("detail_amount", 0.35)
					_cache[ck] = pmat
				mi.set_surface_override_material(s, _cache[ck])
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		return root
	var fb = String(d.get("fb", "none"))
	if fb == "none":
		return null
	var mi2 = MeshInstance3D.new()
	var parts = fb.split(":")
	var nums = parts[1].split(",")
	if parts[0] == "box":
		var bm = BoxMesh.new(); bm.size = Vector3(float(nums[0]), float(nums[1]), float(nums[2]))
		mi2.mesh = bm
		mi2.position.y = float(nums[1]) * 0.5
	else:
		var cm = CylinderMesh.new(); cm.top_radius = float(nums[0]) * 0.8; cm.bottom_radius = float(nums[0]); cm.height = float(nums[1])
		mi2.mesh = cm
		mi2.position.y = float(nums[1]) * 0.5
	var ck2 = "fb|" + mat
	if not _cache.has(ck2):
		var pm = CharBuilder.prop_material(null, mat)
		pm.set_shader_parameter("world_triplanar", 1.0)
		_cache[ck2] = pm
	mi2.material_override = _cache[ck2]
	root.add_child(mi2)
	return root

static func free_spot(ctx: Dictionary, r: float, tries := 30, area := H - 3.0, keep_center := 6.0) -> Vector3:
	var rng: RandomNumberGenerator = ctx.rng
	for i in tries:
		var p = Vector2(rng.randf_range(-area, area), rng.randf_range(-area, area))
		if p.length() < keep_center:
			continue
		var ok = true
		for b in ctx.blocked:
			if p.distance_to(b[0]) < float(b[1]) + r:
				ok = false
				break
		if ok:
			return Vector3(p.x, 0, p.y)
	return Vector3.INF

static func wall(ctx: Dictionary, from: Vector3, to: Vector3, height: float, thick: float, tex: String, solid := true) -> void:
	var len = from.distance_to(to)
	var mi = MeshInstance3D.new()
	var bm = BoxMesh.new(); bm.size = Vector3(thick, height, len)
	mi.mesh = bm
	var ck = "wall|" + tex
	if not _cache.has(ck):
		var m = CharBuilder.prop_material(null, "stone")
		m.set_shader_parameter("world_triplanar", 1.0)
		if ResourceLoader.exists("res://assets/tex/%s.jpg" % tex):
			m.set_shader_parameter("detail_tex", load("res://assets/tex/%s.jpg" % tex))
			if ResourceLoader.exists("res://assets/tex/%s_n.jpg" % tex):
				m.set_shader_parameter("detail_n", load("res://assets/tex/%s_n.jpg" % tex))
		m.set_shader_parameter("detail_amount", 1.0)
		m.set_shader_parameter("detail_scale", 0.3)
		m.set_shader_parameter("desat", 0.3)
		_cache[ck] = m
	mi.material_override = _cache[ck]
	var sb = StaticBody3D.new()
	sb.collision_layer = 1
	sb.add_child(mi)
	if solid:
		var cs = CollisionShape3D.new()
		var bs = BoxShape3D.new(); bs.size = bm.size
		cs.shape = bs
		sb.add_child(cs)
	sb.position = (from + to) * 0.5 + Vector3.UP * height * 0.5
	sb.look_at_from_position(sb.position, to + Vector3.UP * height * 0.5, Vector3.UP)
	ctx.nav.add_child(sb)

# ---------------------------------------------------------------- биомы
static func _scatter(ctx: Dictionary, ids: Array, n: int, area := H - 3.0, keep_center := 7.0, scale_rng := Vector2(0.9, 1.15)) -> void:
	var rng: RandomNumberGenerator = ctx.rng
	for i in n:
		var id: String = ids[rng.randi() % ids.size()]
		var d: Dictionary = PROPS[id]
		var r: float = float(d["col"][0]) if d.get("col", 0.0) is Array else float(d.get("col", 0.5))
		var p = free_spot(ctx, r + 0.8, 30, area, keep_center)
		if p == Vector3.INF:
			continue
		place(ctx, id, p, rng.randf() * TAU, rng.randf_range(scale_rng.x, scale_rng.y))

static func _edge_ring(ctx: Dictionary, id: String, step: float, gaps: Array, inset := 0.5) -> void:
	var e = H + inset
	var n = int(H * 2 / step)
	for side in 4:
		for i in n:
			var t = -H + step * 0.5 + i * step
			var skip = false
			for g in gaps:
				if g[0] == side and absf(t - float(g[1])) < float(g[2]):
					skip = true
			if skip:
				continue
			var p: Vector3
			var rot = 0.0
			match side:
				0: p = Vector3(t, 0, -e); rot = 0.0
				1: p = Vector3(t, 0, e); rot = PI
				2: p = Vector3(-e, 0, t); rot = PI * 0.5
				3: p = Vector3(e, 0, t); rot = -PI * 0.5
			place(ctx, id, p, rot, 1.0)

static func _gate_spawns(ctx: Dictionary, gaps: Array) -> void:
	var sp = []
	for g in gaps:
		var t: float = g[1]
		match int(g[0]):
			0: sp.append(Vector3(t, 0, -H + 1.5))
			1: sp.append(Vector3(t, 0, H - 1.5))
			2: sp.append(Vector3(-H + 1.5, 0, t))
			3: sp.append(Vector3(H - 1.5, 0, t))
	ctx["spawns"] = sp

static func _graveyard(ctx: Dictionary) -> void:
	var gaps = [[0, 0.0, 3.0], [1, -8.0, 3.0], [2, 6.0, 3.0], [3, -6.0, 3.0], [1, 12.0, 2.5]]
	_edge_ring(ctx, "fence", 2.25, gaps)
	_gate_spawns(ctx, gaps)
	var rng: RandomNumberGenerator = ctx.rng
	# склеп на севере, деревья по периметру
	place(ctx, "mausoleum", Vector3(-12, 0, -H - 4.5), 0.0, 1.0)
	for i in 14:
		var a = rng.randf() * TAU
		var r = H + rng.randf_range(3.0, 9.0)
		place(ctx, ["tree_a", "tree_b"][i % 2], Vector3(cos(a) * r, 0, sin(a) * r), rng.randf() * TAU, rng.randf_range(0.8, 1.2), false)
	# ряды могил
	for row in range(-3, 4):
		var z = row * 6.5 + rng.randf_range(-1, 1)
		var x = -H + 4.0
		while x < H - 4.0:
			x += rng.randf_range(2.0, 3.6)
			if absf(x) < 5.0 and absf(z) < 6.0:
				continue
			if rng.randf() < 0.35:
				continue
			var p = Vector3(x, 0, z + rng.randf_range(-0.6, 0.6))
			var id: String = ["grave_a", "grave_b", "grave_c", "grave_a", "slab", "celtic_cross"][rng.randi() % 6]
			var ok = true
			for b in ctx.blocked:
				if Vector2(p.x, p.z).distance_to(b[0]) < float(b[1]) + 0.5:
					ok = false
			if ok:
				place(ctx, id, p, rng.randf_range(-0.25, 0.25) + (PI if rng.randf() < 0.1 else 0.0), rng.randf_range(0.9, 1.15))
	place(ctx, "angel", Vector3(9, 0, -9), 0.6, 1.0)
	place(ctx, "obelisk", Vector3(-9, 0, 10), 0.0, 1.0)
	_scatter(ctx, ["coffin", "bone_pile"], 6)
	for p in [Vector3(-6, 0, -6), Vector3(7, 0, 7), Vector3(-15, 0, 4), Vector3(15, 0, -3), Vector3(2, 0, 16), Vector3(-3, 0, -17)]:
		place(ctx, "lantern_post", p, 0.0, 1.0)

static func _camp(ctx: Dictionary) -> void:
	var gaps = [[0, 0.0, 3.5], [1, 0.0, 3.5], [2, 0.0, 3.0], [3, 0.0, 3.0]]
	_edge_ring(ctx, "fence_wood", 2.0, gaps)
	_gate_spawns(ctx, gaps)
	var rng: RandomNumberGenerator = ctx.rng
	for i in 10:
		var a = float(i) / 10.0 * TAU + 0.3
		var p = Vector3(cos(a) * (H - 5.0), 0, sin(a) * (H - 5.0))
		if absf(p.x) < 5 or absf(p.z) < 5:
			continue
		place(ctx, "tent", p, -a + PI * 0.5, rng.randf_range(0.95, 1.1))
	for p in [Vector3(-8, 0, -8), Vector3(9, 0, 6), Vector3(-6, 0, 11), Vector3(12, 0, -10)]:
		place(ctx, "campfire", p, 0.0, 1.0)
	place(ctx, "gallows", Vector3(0, 0, -14), 0.0, 1.0)
	place(ctx, "pyre", Vector3(14, 0, 14), 0.0, 1.0)
	place(ctx, "banner", Vector3(-3, 0, -11), 0.0, 1.0)
	place(ctx, "banner", Vector3(3, 0, -11), 0.0, 1.0)
	_scatter(ctx, ["barricade", "barrel", "barrel_x", "crate", "wagon", "hay", "weapon_rack", "cage"], 26)

static func _crypt(ctx: Dictionary) -> void:
	var h = 5.0
	for i in 4:
		var a = [Vector3(-H - 1, 0, -H - 1), Vector3(H + 1, 0, -H - 1), Vector3(H + 1, 0, H + 1), Vector3(-H - 1, 0, H + 1)][i]
		var b = [Vector3(H + 1, 0, -H - 1), Vector3(H + 1, 0, H + 1), Vector3(-H - 1, 0, H + 1), Vector3(-H - 1, 0, -H - 1)][i]
		wall(ctx, a, b, h, 1.5, "ossuary" if i % 2 == 0 else "stonewall")
	ctx["spawns"] = [Vector3(-H + 2, 0, -12), Vector3(H - 2, 0, 12), Vector3(0, 0, -H + 2), Vector3(0, 0, H - 2), Vector3(-H + 2, 0, 14), Vector3(H - 2, 0, -14)]
	# колонны сеткой
	for ix in range(-2, 3):
		for iz in range(-2, 3):
			if ix == 0 and iz == 0:
				continue
			if (ix + iz) % 2 != 0:
				continue
			place(ctx, "pillar_ruin" if ctx.rng.randf() < 0.4 else "gothic_pillar", Vector3(ix * 10.0, 0, iz * 10.0), ctx.rng.randf() * TAU, 0.75)
	for p in [Vector3(-5, 0, -5), Vector3(5, 0, 5), Vector3(-5, 0, 5), Vector3(5, 0, -5), Vector3(-15, 0, 0), Vector3(15, 0, 0), Vector3(0, 0, 15), Vector3(0, 0, -15)]:
		place(ctx, "brazier", p, 0.0, 1.0)
	_scatter(ctx, ["sarcophagus", "rack", "iron_maiden", "cage", "skull_pile", "bone_pile", "wheel", "altar_stone", "barrel"], 24)

static func _cathedral(ctx: Dictionary) -> void:
	var h = 7.0
	for i in 4:
		var a = [Vector3(-H - 1, 0, -H - 1), Vector3(H + 1, 0, -H - 1), Vector3(H + 1, 0, H + 1), Vector3(-H - 1, 0, H + 1)][i]
		var b = [Vector3(H + 1, 0, -H - 1), Vector3(H + 1, 0, H + 1), Vector3(-H - 1, 0, H + 1), Vector3(-H - 1, 0, -H - 1)][i]
		wall(ctx, a, b, h, 1.5, "stonewall")
	ctx["spawns"] = [Vector3(0, 0, H - 2), Vector3(-10, 0, H - 2), Vector3(10, 0, H - 2), Vector3(-H + 2, 0, 8), Vector3(H - 2, 0, 8)]
	for iz in range(-2, 3):
		for side in [-1, 1]:
			place(ctx, "gothic_pillar", Vector3(side * 11.0, 0, iz * 9.0), 0.0, 1.0)
	place(ctx, "altar", Vector3(0, 0, -H + 3.5), 0.0, 1.0)
	place(ctx, "saint", Vector3(-6, 0, -H + 3), 0.3, 1.0)
	place(ctx, "saint", Vector3(6, 0, -H + 3), -0.3, 1.0)
	for row in range(0, 5):
		for side in [-1, 1]:
			var z = -6.0 + row * 4.0
			place(ctx, "pew", Vector3(side * 5.0, 0, z), 0.0, 1.0)
	for p in [Vector3(-2.5, 0, -H + 5), Vector3(2.5, 0, -H + 5), Vector3(-18, 0, -18), Vector3(18, 0, -18), Vector3(-18, 0, 12), Vector3(18, 0, 12)]:
		place(ctx, "candelabra", p, 0.0, 1.0)
	_scatter(ctx, ["candles", "lectern", "bell"], 8, H - 4.0, 9.0)
	# лучи сквозь витражи
	for i in 4:
		var sl = SpotLight3D.new()
		sl.light_color = [Color(1.0, 0.25, 0.15), Color(1.0, 0.75, 0.35)][i % 2]
		sl.light_energy = 6.0
		sl.spot_range = 30.0
		sl.spot_angle = 14.0
		sl.light_volumetric_fog_energy = 3.0
		sl.shadow_enabled = false
		ctx.root.add_child(sl)
		var sp = Vector3(-H + 1 if i < 2 else H - 1, 9.0, -8.0 + (i % 2) * 14.0)
		sl.transform = Transform3D(Basis.looking_at(Vector3(sp.x * 0.2, 0, sp.z + 2.0) - sp, Vector3.UP), sp)

static func _weather(ctx: Dictionary) -> void:
	var kind: String = BIOMES[ctx.biome].weather
	var p = GPUParticles3D.new()
	var pm = ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(30, 1, 30)
	var mesh = QuadMesh.new()
	var mat = StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.vertex_color_use_as_albedo = true
	match kind:
		"rain":
			pm.direction = Vector3(0.15, -1, 0.05); pm.spread = 3; pm.initial_velocity_min = 22; pm.initial_velocity_max = 28; pm.gravity = Vector3.ZERO
			pm.particle_flag_align_y = true
			mesh.size = Vector2(0.012, 0.55)
			mat.albedo_color = Color(0.75, 0.8, 0.9, 0.18)
			p.amount = 1400; p.lifetime = 0.9
		"snow":
			pm.direction = Vector3(0.2, -1, 0); pm.spread = 15; pm.initial_velocity_min = 1.5; pm.initial_velocity_max = 3.0; pm.gravity = Vector3(0, -0.5, 0)
			pm.turbulence_enabled = true; pm.turbulence_noise_strength = 1.2
			mesh.size = Vector2(0.07, 0.07)
			mat.albedo_texture = load("res://assets/fx/soft.png")
			mat.albedo_color = Color(0.95, 0.95, 1.0, 0.85)
			p.amount = 1600; p.lifetime = 7.0
		"dust":
			pm.direction = Vector3(0, 0.1, 0); pm.spread = 180; pm.initial_velocity_min = 0.05; pm.initial_velocity_max = 0.2; pm.gravity = Vector3.ZERO
			pm.emission_box_extents = Vector3(30, 4, 30)
			mesh.size = Vector2(0.03, 0.03)
			mat.albedo_texture = load("res://assets/fx/soft.png")
			mat.albedo_color = Color(1.0, 0.9, 0.75, 0.5)
			p.amount = 500; p.lifetime = 10.0
		"embers":
			pm.direction = Vector3(0, 1, 0); pm.spread = 30; pm.initial_velocity_min = 0.4; pm.initial_velocity_max = 1.2; pm.gravity = Vector3(0, 0.2, 0)
			pm.emission_box_extents = Vector3(30, 0.5, 30)
			pm.turbulence_enabled = true; pm.turbulence_noise_strength = 0.8
			mesh.size = Vector2(0.05, 0.05)
			mat.albedo_texture = load("res://assets/fx/soft.png")
			mat.albedo_color = Color(1.0, 0.45, 0.1, 0.9)
			mat.emission_enabled = true; mat.emission = Color(1.0, 0.4, 0.1); mat.emission_energy_multiplier = 3.0
			p.amount = 400; p.lifetime = 9.0
	mesh.material = mat
	p.process_material = pm
	p.draw_pass_1 = mesh
	p.visibility_aabb = AABB(Vector3(-35, -25, -35), Vector3(70, 40, 70))
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.preprocess = 3.0
	ctx.root.add_child(p)
	p.position = Vector3(0, 14.0 if kind in ["rain", "snow"] else 0.5, 0)
