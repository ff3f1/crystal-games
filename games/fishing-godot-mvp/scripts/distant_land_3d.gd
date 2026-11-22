extends Node3D
## Real far-shore terrain, pine forest and ridge relief.
## The horizon is now world-space geometry. No lake photograph or billboard.
## Terrain and trees are deterministic. Multimesh preserves mobile performance.

const SHORE_Z := -77.0
const FAR_Z := -291.0
const HALF_WIDTH := 185.0

var rng := RandomNumberGenerator.new()

func populate() -> void:
    rng.seed = 9377104
    _build_terrain()
    _build_conifer_forest()
    _build_shore_rocks()

func height_at(x: float, z: float) -> float:
    var d := clampf((-z + SHORE_Z) / (SHORE_Z - FAR_Z), 0.0, 1.0)
    var sweeping_ridge := 5.8 * sin(x * 0.015) + 3.1 * sin(x * 0.039 + 1.72)
    var landform := 6.0 * pow(d, 0.58) + 45.0 * pow(d, 1.72)
    var relief := sweeping_ridge * pow(d, 0.9)
    var erosion := (sin(x * 0.078 + z * 0.061) * 1.35
        + sin(x * 0.171 - z * 0.053) * 0.46) * pow(d, 0.65)
    return -0.36 + landform + relief + erosion

func _ground_tint(x: float, z: float) -> Color:
    var d := clampf((-z + SHORE_Z) / (SHORE_Z - FAR_Z), 0.0, 1.0)
    var noise := 0.045 * sin(x * 0.12 + z * 0.18)
    var silt := Color(0.73, 0.72, 0.58)
    var scrub := Color(0.50 + noise, 0.61 + noise, 0.43 + noise * 0.5)
    var forest := Color(0.35 + noise, 0.47 + noise, 0.38 + noise * 0.5)
    return silt.lerp(scrub, smoothstep(0.005, 0.13, d)).lerp(forest, smoothstep(0.21, 0.83, d))

func _terrain_triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
    for vertex in [a, b, c]:
        st.set_color(_ground_tint(vertex.x, vertex.z))
        st.set_uv(Vector2(vertex.x * 0.067, vertex.z * 0.067))
        st.add_vertex(vertex)

func _build_terrain() -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var columns := 98
    var rows := 50
    var step_x := (HALF_WIDTH * 2.0) / float(columns)
    var step_z := (SHORE_Z - FAR_Z) / float(rows)
    for ix in range(columns):
        var x0 := -HALF_WIDTH + ix * step_x
        var x1 := x0 + step_x
        for iz in range(rows):
            var z0 := SHORE_Z - iz * step_z
            var z1 := z0 - step_z
            var a := Vector3(x0, height_at(x0, z0), z0)
            var b := Vector3(x1, height_at(x1, z0), z0)
            var c := Vector3(x0, height_at(x0, z1), z1)
            var d := Vector3(x1, height_at(x1, z1), z1)
            _terrain_triangle(st, a, c, b)
            _terrain_triangle(st, b, c, d)
    st.generate_normals()
    var material := StandardMaterial3D.new()
    material.albedo_texture = load("res://assets/textures/forest_diffuse.jpg")
    material.normal_enabled = true
    material.normal_texture = load("res://assets/textures/forest_normal.jpg")
    material.normal_scale = 0.28
    material.albedo_color = Color(0.89, 0.94, 0.89)
    material.vertex_color_use_as_albedo = true
    material.roughness = 0.96
    material.cull_mode = BaseMaterial3D.CULL_DISABLED
    var terrain := MeshInstance3D.new()
    terrain.name = "PhysicalFarShoreTerrain"
    terrain.mesh = st.commit()
    terrain.material_override = material
    terrain.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(terrain)

func _triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, tint: Color) -> void:
    st.set_color(tint)
    st.add_vertex(a)
    st.set_color(tint)
    st.add_vertex(b)
    st.set_color(tint)
    st.add_vertex(c)

func _pine_mesh() -> ArrayMesh:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var segments := 9
    var trunk_color := Color(0.33, 0.255, 0.19)
    var trunk_top := Color(0.28, 0.24, 0.20)
    for i in range(segments):
        var angle_a := TAU * float(i) / segments
        var angle_b := TAU * float(i + 1) / segments
        var lower_a := Vector3(cos(angle_a) * 0.12, 0.0, sin(angle_a) * 0.12)
        var lower_b := Vector3(cos(angle_b) * 0.12, 0.0, sin(angle_b) * 0.12)
        var upper_a := Vector3(cos(angle_a) * 0.065, 4.8, sin(angle_a) * 0.065)
        var upper_b := Vector3(cos(angle_b) * 0.065, 4.8, sin(angle_b) * 0.065)
        _triangle(st, lower_a, upper_a, lower_b, trunk_color)
        _triangle(st, lower_b, upper_a, upper_b, trunk_top)
    # The foliage is a volumetric ringed mesh rather than crossed 2D cards.
    # Radial ledges produce distinctive conifer branch tiers.
    var levels: Array[float] = [0.97, 1.17, 1.51, 1.72, 1.94, 2.18, 2.41, 2.65, 2.89, 3.13, 3.39, 3.64, 3.87, 4.12, 4.37, 4.62, 4.86]
    var radii: Array[float] = [1.31, 1.08, 0.68, 1.20, 0.70, 1.10, 0.66, 0.97, 0.55, 0.82, 0.47, 0.68, 0.38, 0.53, 0.29, 0.36, 0.015]
    for layer in range(levels.size() - 1):
        for side in range(segments):
            var a0 := TAU * float(side) / float(segments)
            var a1 := TAU * float(side + 1) / float(segments)
            var scallop0 := 0.91 + 0.09 * sin(float(side) * 7.3 + float(layer) * 0.6)
            var scallop1 := 0.91 + 0.09 * sin(float(side + 1) * 7.3 + float(layer) * 0.6)
            var r0 := radii[layer]
            var r1 := radii[layer + 1]
            var p0 := Vector3(cos(a0) * r0 * scallop0, levels[layer], sin(a0) * r0 * scallop0)
            var p1 := Vector3(cos(a1) * r0 * scallop1, levels[layer], sin(a1) * r0 * scallop1)
            var q0 := Vector3(cos(a0) * r1 * scallop0, levels[layer + 1], sin(a0) * r1 * scallop0)
            var q1 := Vector3(cos(a1) * r1 * scallop1, levels[layer + 1], sin(a1) * r1 * scallop1)
            var palette := 0.05 * sin(float(side) * 1.6 + float(layer) * 2.3)
            var green := Color(0.13 + palette, 0.26 + palette * 0.58, 0.20 + palette * 0.32)
            _triangle(st, p0, q0, p1, green)
            _triangle(st, p1, q0, q1, green.lightened(0.07))
    st.generate_normals()
    return st.commit()

func _build_conifer_forest() -> void:
    var forest := MultiMeshInstance3D.new()
    forest.name = "InstancedVolumetricConifers"
    var multiple := MultiMesh.new()
    multiple.transform_format = MultiMesh.TRANSFORM_3D
    multiple.mesh = _pine_mesh()
    multiple.instance_count = 470
    for index in range(multiple.instance_count):
        var x := rng.randf_range(-174.0, 174.0)
        var z := rng.randf_range(-87.0, -274.0)
        # Irregular height / distribution creates breaks and distant sight lines.
        var scale_tree := rng.randf_range(0.82, 1.87)
        if z < -180.0:
            scale_tree *= 1.12
        var ground := height_at(x, z)
        var basis := Basis(Vector3.UP, rng.randf_range(-PI, PI)).scaled(Vector3.ONE * scale_tree)
        multiple.set_instance_transform(index, Transform3D(basis, Vector3(x, ground - 0.055, z)))
    var mat := StandardMaterial3D.new()
    mat.vertex_color_use_as_albedo = true
    mat.roughness = 0.96
    mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    forest.material_override = mat
    forest.multimesh = multiple
    forest.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(forest)

func _build_shore_rocks() -> void:
    var rock := SphereMesh.new()
    rock.radius = 1.0
    rock.height = 2.0
    rock.radial_segments = 8
    rock.rings = 5
    var stones := MultiMeshInstance3D.new()
    stones.name = "FarShoreRocks3D"
    var multiple := MultiMesh.new()
    multiple.transform_format = MultiMesh.TRANSFORM_3D
    multiple.mesh = rock
    multiple.instance_count = 64
    for index in range(multiple.instance_count):
        var x := rng.randf_range(-164.0, 164.0)
        var z := rng.randf_range(-85.0, -213.0)
        var scale_value := rng.randf_range(0.45, 2.35)
        var basis := Basis(Vector3.UP, rng.randf_range(-PI, PI)).scaled(Vector3(scale_value, scale_value * 0.36, scale_value * 0.83))
        multiple.set_instance_transform(index, Transform3D(basis, Vector3(x, height_at(x, z) - scale_value * 0.11, z)))
    var material := StandardMaterial3D.new()
    material.albedo_color = Color(0.39, 0.43, 0.41)
    material.roughness = 0.98
    stones.material_override = material
    stones.multimesh = multiple
    stones.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    add_child(stones)
