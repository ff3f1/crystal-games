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

func _pine_mesh(variety: int) -> ArrayMesh:
    var local_rng := RandomNumberGenerator.new()
    local_rng.seed = 843119 + variety * 2057
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var segments := 11
    var trunk_color := Color(0.31, 0.25, 0.18)
    for i in range(segments):
        var angle_a := TAU * float(i) / float(segments)
        var angle_b := TAU * float(i + 1) / float(segments)
        var lower_a := Vector3(cos(angle_a) * 0.13, 0.0, sin(angle_a) * 0.13)
        var lower_b := Vector3(cos(angle_b) * 0.13, 0.0, sin(angle_b) * 0.13)
        var upper_a := Vector3(cos(angle_a) * 0.055, 4.9, sin(angle_a) * 0.055)
        var upper_b := Vector3(cos(angle_b) * 0.055, 4.9, sin(angle_b) * 0.055)
        _triangle(st, lower_a, upper_a, lower_b, trunk_color)
        _triangle(st, lower_b, upper_a, upper_b, trunk_color.darkened(0.09))
    # Continuous, slightly lopsided volume instead of stacked pancake
    # triangles. The earlier striped "Christmas tree" crown was artificial.
    var rings := 22
    for band in range(rings):
        var h0 := 0.91 + float(band) / float(rings) * 4.02
        var h1 := 0.91 + float(band + 1) / float(rings) * 4.02
        var r0 := 1.36 * pow(clampf((4.94 - h0) / 4.02, 0.0, 1.0), 0.94)
        var r1 := 1.36 * pow(clampf((4.94 - h1) / 4.02, 0.0, 1.0), 0.94)
        for side in range(segments):
            var a0 := TAU * float(side) / float(segments)
            var a1 := TAU * float(side + 1) / float(segments)
            var sway0 := 1.0 + 0.065 * sin(a0 * 3.7 + float(variety)) + 0.035 * sin(h0 * 4.2 + a0)
            var sway1 := 1.0 + 0.065 * sin(a1 * 3.7 + float(variety)) + 0.035 * sin(h0 * 4.2 + a1)
            var next_sway0 := 1.0 + 0.065 * sin(a0 * 3.7 + float(variety)) + 0.035 * sin(h1 * 4.2 + a0)
            var next_sway1 := 1.0 + 0.065 * sin(a1 * 3.7 + float(variety)) + 0.035 * sin(h1 * 4.2 + a1)
            var p0 := Vector3(cos(a0) * r0 * sway0, h0, sin(a0) * r0 * sway0)
            var p1 := Vector3(cos(a1) * r0 * sway1, h0, sin(a1) * r0 * sway1)
            var q0 := Vector3(cos(a0) * r1 * next_sway0, h1, sin(a0) * r1 * next_sway0)
            var q1 := Vector3(cos(a1) * r1 * next_sway1, h1, sin(a1) * r1 * next_sway1)
            var noise := sin(float(side) * 2.37 + float(band) * 0.97 + float(variety)) * 0.018
            var green := Color(0.19 + noise, 0.32 + noise * 0.6, 0.22 + noise * 0.45)
            _triangle(st, p0, q0, p1, green)
            _triangle(st, p1, q0, q1, green.lightened(0.035))
    # Branch clusters are *3D* wedge volumes with bark-free needle bodies.
    # Uneven heights, outward angles and crown sizes break repetition.
    for needle in range(125):
        var y := local_rng.randf_range(1.05, 4.75)
        var angle := local_rng.randf_range(-PI, PI)
        var radial := Vector3(cos(angle), 0.0, sin(angle))
        var side_axis := Vector3(-radial.z, 0.0, radial.x)
        var crown_radius := 1.36 * pow(clampf((4.94 - y) / 4.02, 0.0, 1.0), 0.94)
        var root := Vector3(0.0, y, 0.0) + radial * crown_radius * 0.82
        var extension := local_rng.randf_range(0.12, 0.47) * clampf(crown_radius, 0.18, 1.0)
        var tip := root + radial * extension + Vector3.UP * local_rng.randf_range(-0.15, 0.09)
        var width := local_rng.randf_range(0.065, 0.18) * clampf(crown_radius, 0.25, 1.0)
        var left := root - side_axis * width
        var right := root + side_axis * width
        var upper := root + Vector3.UP * (width * 1.35)
        var under := root - Vector3.UP * (width * 0.38)
        var shade := local_rng.randf_range(-0.025, 0.025)
        var needles := Color(0.16 + shade, 0.29 + shade, 0.19 + shade * 0.7)
        _triangle(st, left, tip, upper, needles)
        _triangle(st, upper, tip, right, needles.lightened(0.08))
        _triangle(st, right, tip, under, needles.darkened(0.09))
        _triangle(st, under, tip, left, needles.darkened(0.13))
    st.generate_normals()
    return st.commit()

func _build_conifer_forest() -> void:
    # The previous 570 angular procedural pine cones are no longer rendered.
    # Instancing actual artist-authored Scots pine and Norway spruce GLB
    # surfaces preserves bark, needle materials and asymmetrical 3D branches.
    var sources: Array[String] = [
        "res://assets/models/scots_pine_lod2.glb",
        "res://assets/models/norway_spruce_lod2.glb"
    ]
    var labels: Array[String] = ["InstancedVolumetricConifers", "AuthoredNorwaySpruceForest"]
    var total := 0
    for kind in range(sources.size()):
        var scene: PackedScene = load(sources[kind]) as PackedScene
        if scene == null:
            push_error("Missing CC0 authored forest model: " + sources[kind])
            continue
        var template: Node3D = scene.instantiate() as Node3D
        if template == null:
            push_error("Invalid 3D forest model " + sources[kind])
            continue
        var mesh_parts: Array[Dictionary] = []
        _collect_external_meshes(template, Transform3D.IDENTITY, mesh_parts)
        template.free()
        if mesh_parts.is_empty():
            push_error("GLB tree has no mesh surfaces: " + sources[kind])
            continue
        var placements: Array[Transform3D] = []
        var count := 175 if kind == 0 else 195
        for index in range(count):
            var x := rng.randf_range(-181.0, 181.0)
            var z := rng.randf_range(-274.0, -84.0)
            # Meters: real models are ~20 m tall, not hand-made 5 m cones.
            var size_scalar := rng.randf_range(0.38, 0.88)
            var width_variation := rng.randf_range(0.86, 1.09)
            var basis := Basis(Vector3.UP, rng.randf_range(-PI, PI)).scaled(
                Vector3(width_variation * size_scalar, size_scalar, width_variation * size_scalar))
            placements.append(Transform3D(basis, Vector3(x, height_at(x, z) - 0.08, z)))
        for part_index in range(mesh_parts.size()):
            var entry: Dictionary = mesh_parts[part_index]
            var part_mesh: Mesh = entry["mesh"]
            var part_transform: Transform3D = entry["transform"]
            var multiple := MultiMesh.new()
            multiple.transform_format = MultiMesh.TRANSFORM_3D
            multiple.mesh = part_mesh
            multiple.instance_count = placements.size()
            for index in range(placements.size()):
                multiple.set_instance_transform(index, placements[index] * part_transform)
            var forest := MultiMeshInstance3D.new()
            forest.name = labels[kind] if part_index == 0 else labels[kind] + "Mesh%d" % part_index
            forest.multimesh = multiple
            forest.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
            add_child(forest)
        total += count
    print("ART_AUDIT: imported authored CC0 forest (not procedural trees): ", total, " specimens")

func _collect_external_meshes(node: Node3D, cumulative: Transform3D, output: Array[Dictionary]) -> void:
    for child in node.get_children():
        if not child is Node3D:
            continue
        var part := child as Node3D
        var next: Transform3D = cumulative * part.transform
        if part is MeshInstance3D and (part as MeshInstance3D).mesh != null:
            output.append({
                "mesh": (part as MeshInstance3D).mesh,
                "transform": next
            })
        _collect_external_meshes(part, next, output)

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
