extends Node3D
## Mesh-based vegetation for the lake. Every reed is a tapered solid,
## every lily has top/underside geometry, and underwater weeds have stems.
## Batches geometry into three meshes to stay affordable on Android.

var random := RandomNumberGenerator.new()
var reed_material: ShaderMaterial

func populate(shore: Node) -> void:
    random.seed = 779126
    _make_reeds(shore)
    _make_lilies()
    _make_submerged_plants(shore)

func set_wind(strength: float) -> void:
    if reed_material != null:
        reed_material.set_shader_parameter("breeze", clampf(strength, 0.0, 1.0))

func _triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, color: Color) -> void:
    st.set_color(color)
    st.add_vertex(a)
    st.set_color(color)
    st.add_vertex(b)
    st.set_color(color)
    st.add_vertex(c)

func _tube(st: SurfaceTool, centers: Array[Vector3], radii: Array[float], color: Color, sides: int = 6) -> void:
    for segment in range(centers.size() - 1):
        var lower: Vector3 = centers[segment]
        var upper: Vector3 = centers[segment + 1]
        for side in range(sides):
            var a0 := TAU * float(side) / float(sides)
            var a1 := TAU * float(side + 1) / float(sides)
            var bottom_a := lower + Vector3(cos(a0), 0, sin(a0)) * radii[segment]
            var bottom_b := lower + Vector3(cos(a1), 0, sin(a1)) * radii[segment]
            var top_a := upper + Vector3(cos(a0), 0, sin(a0)) * radii[segment + 1]
            var top_b := upper + Vector3(cos(a1), 0, sin(a1)) * radii[segment + 1]
            _triangle(st, bottom_a, top_a, bottom_b, color)
            _triangle(st, bottom_b, top_a, top_b, color)

func _blade(st: SurfaceTool, origin: Vector3, direction: Vector3, length: float, width: float, tint: Color) -> void:
    # Two subtly curved skins, separated by a raised central rib. The leaf is
    # not a single camera-facing quad and has a measurable 3D thickness.
    var sideways := Vector3(-direction.z, 0.0, direction.x).normalized()
    var forward := direction.normalized()
    for segment in range(5):
        var t0 := float(segment) / 5.0
        var t1 := float(segment + 1) / 5.0
        var centre0 := origin + forward * (length * t0) + Vector3.UP * (length * (0.11 * sin(t0 * PI) + 0.17 * t0))
        var centre1 := origin + forward * (length * t1) + Vector3.UP * (length * (0.11 * sin(t1 * PI) + 0.17 * t1))
        var w0 := width * sin(PI * (0.04 + 0.92 * t0))
        var w1 := width * sin(PI * (0.04 + 0.92 * t1))
        var left0 := centre0 - sideways * w0
        var right0 := centre0 + sideways * w0
        var left1 := centre1 - sideways * w1
        var right1 := centre1 + sideways * w1
        var ridge0 := centre0 + Vector3.UP * 0.015
        var ridge1 := centre1 + Vector3.UP * 0.015
        _triangle(st, left0, ridge1, ridge0, tint)
        _triangle(st, left0, left1, ridge1, tint)
        _triangle(st, ridge0, ridge1, right0, tint.lightened(0.065))
        _triangle(st, right0, ridge1, right1, tint.lightened(0.065))
        var below := Vector3.DOWN * 0.008
        _triangle(st, left0 + below, right0 + below, left1 + below, tint.darkened(0.17))
        _triangle(st, right0 + below, right1 + below, left1 + below, tint.darkened(0.17))

func _mesh_from(st: SurfaceTool, name: String, material: Material, shadows: bool = false) -> void:
    st.generate_normals()
    var node := MeshInstance3D.new()
    node.name = name
    node.mesh = st.commit()
    node.material_override = material
    node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(node)

func _make_reeds(shore: Node) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for index in range(205):
        var x := random.randf_range(-48.0, 47.0)
        if absf(x) < 5.5:
            continue
        var z: float = float(shore.call("shore_edge", x)) + random.randf_range(-0.5, 0.92)
        var base := Vector3(x, -0.17, z)
        var tall := random.randf_range(0.92, 1.93)
        var tilt := Vector3(random.randf_range(-0.07, 0.07), 0, random.randf_range(-0.06, 0.06))
        var green := Color(0.21 + random.randf_range(-0.035, 0.055), 0.32 + random.randf_range(-0.04, 0.06), 0.15 + random.randf_range(0.0, 0.05))
        var shaft: Array[Vector3] = [base, base + Vector3.UP * tall * 0.32 + tilt * 0.19, base + Vector3.UP * tall * 0.69 + tilt * 0.65, base + Vector3.UP * tall + tilt]
        var thickness: Array[float] = [0.014, 0.012, 0.008, 0.002]
        _tube(st, shaft, thickness, green, 6)
        for leaf_index in range(3):
            var angle := float(leaf_index) * TAU / 3.0 + random.randf_range(-0.26, 0.26)
            var direction := Vector3(cos(angle), 0.0, sin(angle))
            var foot := base + Vector3.UP * tall * random.randf_range(0.18, 0.41)
            _blade(st, foot, direction, random.randf_range(0.36, 0.68), random.randf_range(0.035, 0.063), green.lightened(0.05))
        if index % 4 == 0:
            var seed_base := shaft[3] - Vector3.UP * 0.22
            var seed_top := shaft[3] - Vector3.UP * 0.04
            var sepia := Color(0.28, 0.23, 0.15)
            var seed_centres: Array[Vector3] = [seed_base, seed_base.lerp(seed_top, 0.5), seed_top]
            var seed_radii: Array[float] = [0.018, 0.024, 0.007]
            _tube(st, seed_centres, seed_radii, sepia, 8)
    reed_material = ShaderMaterial.new()
    reed_material.shader = load("res://shaders/vegetation_3d.gdshader")
    _mesh_from(st, "SolidReeds3D", reed_material)

func _make_lilies() -> void:
    var pads := SurfaceTool.new()
    pads.begin(Mesh.PRIMITIVE_TRIANGLES)
    var blooms := SurfaceTool.new()
    blooms.begin(Mesh.PRIMITIVE_TRIANGLES)
    for index in range(39):
        var x := -12.4 + random.randf_range(-7.0, 8.0)
        var z := -13.6 + random.randf_range(-6.9, 7.8)
        var center := Vector3(x, 0.025 + random.randf_range(0, 0.018), z)
        var radius := random.randf_range(0.26, 0.46)
        var olive := Color(0.12 + random.randf_range(0, 0.07), 0.24 + random.randf_range(0, 0.08), 0.105)
        var underside := olive.darkened(0.23)
        var points := 16
        # A small missing radial sector creates the natural lily notch.
        for side in range(1, points):
            var a0 := float(side) / float(points) * TAU
            var a1 := float(side + 1) / float(points) * TAU
            var r0 := radius * (0.91 + sin(a0 * 5.0 + float(index)) * 0.043)
            var r1 := radius * (0.91 + sin(a1 * 5.0 + float(index)) * 0.043)
            var p0 := center + Vector3(cos(a0) * r0, -0.011 + 0.013 * sin(a0 * 3.0), sin(a0) * r0 * 0.84)
            var p1 := center + Vector3(cos(a1) * r1, -0.011 + 0.013 * sin(a1 * 3.0), sin(a1) * r1 * 0.84)
            var inner0 := center.lerp(p0, 0.30) + Vector3.UP * 0.015
            var inner1 := center.lerp(p1, 0.30) + Vector3.UP * 0.015
            _triangle(pads, center, inner0, inner1, olive.lightened(0.13))
            _triangle(pads, inner0, p0, p1, olive)
            _triangle(pads, inner0, p1, inner1, olive)
            var underside_center := center + Vector3.DOWN * 0.017
            _triangle(pads, underside_center, p1 + Vector3.DOWN * 0.012, p0 + Vector3.DOWN * 0.012, underside)
            _triangle(pads, p0, p0 + Vector3.DOWN * 0.012, p1, underside)
            _triangle(pads, p1, p0 + Vector3.DOWN * 0.012, p1 + Vector3.DOWN * 0.012, underside)
        if index % 7 == 0:
            var bloom_base := center + Vector3.UP * 0.047
            for petal in range(8):
                var angle := float(petal) * TAU / 8.0
                var outward := Vector3(cos(angle), 0, sin(angle))
                var side_axis := Vector3(-outward.z, 0, outward.x)
                var tip := bloom_base + outward * 0.115 + Vector3.UP * 0.108
                _triangle(blooms, bloom_base - side_axis * 0.035, tip, bloom_base + side_axis * 0.035, Color(0.90, 0.90, 0.76))
                _triangle(blooms, bloom_base - side_axis * 0.026 + Vector3.DOWN * 0.008, bloom_base + side_axis * 0.026 + Vector3.DOWN * 0.008, tip, Color(0.73, 0.76, 0.58))
            var gold := Color(0.85, 0.69, 0.23)
            for spike in range(6):
                var a := float(spike) * TAU / 6.0
                var root := bloom_base + Vector3(cos(a) * 0.012, 0.013, sin(a) * 0.012)
                _triangle(blooms, root + Vector3(-0.006, 0, 0), root + Vector3.UP * 0.063, root + Vector3(0.006, 0, 0), gold)
    var material := StandardMaterial3D.new()
    material.vertex_color_use_as_albedo = true
    material.roughness = 0.83
    material.cull_mode = BaseMaterial3D.CULL_DISABLED
    _mesh_from(pads, "ThickLilyPads3D", material)
    _mesh_from(blooms, "WaterLilyFlowers3D", material)

func _make_submerged_plants(shore: Node) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for patch in range(92):
        var is_bay := patch < 65
        var x := (-8.0 + random.randf_range(-10.0, 10.0)) if is_bay else (11.0 + random.randf_range(-7.0, 7.0))
        var z := (-18.0 + random.randf_range(-8.0, 8.0)) if is_bay else (-23.0 + random.randf_range(-6.0, 6.0))
        var base_y: float = float(shore.call("lake_floor_height", z)) + 0.06
        var base := Vector3(x, base_y, z)
        for frond in range(4):
            var height := random.randf_range(0.39, 0.99) if is_bay else random.randf_range(0.25, 0.65)
            var direction := Vector3(random.randf_range(-0.24, 0.24), 0, random.randf_range(-0.24, 0.24))
            var path: Array[Vector3] = [
                base + direction * 0.15,
                base + Vector3.UP * height * 0.34 + direction * 0.4,
                base + Vector3.UP * height * 0.72 + direction * 0.8,
                base + Vector3.UP * height + direction
            ]
            var radii: Array[float] = [0.018, 0.015, 0.009, 0.001]
            var green := Color(0.09 + random.randf_range(0, 0.045), 0.21 + random.randf_range(0, 0.07), 0.10 + random.randf_range(0, 0.035))
            _tube(st, path, radii, green, 5)
            var heading := Vector3(cos(float(frond) * PI * 0.5), 0, sin(float(frond) * PI * 0.5))
            _blade(st, base + Vector3.UP * height * 0.31, heading, height * 0.47, 0.055, green.lightened(0.06))
    var material := StandardMaterial3D.new()
    material.vertex_color_use_as_albedo = true
    material.cull_mode = BaseMaterial3D.CULL_DISABLED
    material.roughness = 0.93
    _mesh_from(st, "SubmergedStems3D", material)
