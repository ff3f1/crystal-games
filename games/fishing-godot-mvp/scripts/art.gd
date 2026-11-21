extends Node3D
## Art-enabled lakeshore. Downloads CC0 scenes/textures in tools/fetch_assets.py.

var random := RandomNumberGenerator.new()
var reeds: Array[Node3D] = []
var floating_leaves: Array[Node3D] = []
var local_breeze := 0.28
var wave_clock := 0.0

func _process(delta: float) -> void:
    wave_clock += delta
    for i in range(reeds.size()):
        var reed := reeds[i]
        reed.rotation.z = sin(wave_clock * 0.85 + float(i) * 1.73) * (0.025 + local_breeze * 0.055)
        reed.rotation.x = cos(wave_clock * 0.61 + float(i) * 1.38) * (0.014 + local_breeze * 0.028)
    for i in range(floating_leaves.size()):
        var pad := floating_leaves[i]
        pad.position.y = 0.015 + sin(wave_clock * 1.13 + float(i) * 0.67) * 0.018
        pad.rotation.z = sin(wave_clock * 0.48 + float(i)) * 0.015

func set_wind(value: float) -> void:
    local_breeze = clampf(value, 0.0, 1.0)

func populate() -> void:
    random.seed = 14390221
    _make_water()
    _make_land()
    _make_forest()
    _make_fishing_spot()
    _make_habitat_details()

func shore_edge(x: float) -> float:
    return 3.7 + sin(x * 0.12) * 0.85 + sin(x * 0.033) * 1.2

func ground_height(x: float, z: float) -> float:
    return 0.08 + minf(maxf(z - shore_edge(x), 0.0), 11.0) * 0.023 + sin(x * 0.21 + z * 0.17) * 0.035

func _make_water() -> void:
    var plane := PlaneMesh.new()
    plane.size = Vector2(260, 240)
    plane.subdivide_width = 120
    plane.subdivide_depth = 100
    var shader := ShaderMaterial.new()
    shader.shader = load("res://shaders/water.gdshader")
    _mesh(self, plane, Vector3(0, -0.02, -110), Vector3.ONE, shader)

func _make_land() -> void:
    _shore_surface(false)
    _shore_surface(true)

func _shore_surface(far_bank: bool) -> void:
    var builder := SurfaceTool.new()
    builder.begin(Mesh.PRIMITIVE_TRIANGLES)
    var mat := StandardMaterial3D.new()
    var tex_name := "forest" if far_bank else "shore"
    mat.albedo_texture = load("res://assets/textures/%s_diffuse.jpg" % tex_name)
    mat.normal_enabled = true
    mat.normal_texture = load("res://assets/textures/%s_normal.jpg" % tex_name)
    mat.normal_scale = 0.55
    mat.roughness = 0.94
    if far_bank:
        mat.albedo_color = Color(0.59, 0.70, 0.57)
    else:
        mat.albedo_color = Color(0.77, 0.77, 0.72)

    for xi in range(40):
        var x1 := float(xi) * 5.0 - 100.0
        var x2 := x1 + 5.0
        for zi in range(18):
            var z1 := float(zi) * 3.8
            var z2 := z1 + 3.8
            var v11: Vector3
            var v12: Vector3
            var v21: Vector3
            var v22: Vector3
            if far_bank:
                v11 = Vector3(x1, 0.03 + z1 * 0.014, -91.0 - z1)
                v12 = Vector3(x1, 0.03 + z2 * 0.014, -91.0 - z2)
                v21 = Vector3(x2, 0.03 + z1 * 0.014, -91.0 - z1)
                v22 = Vector3(x2, 0.03 + z2 * 0.014, -91.0 - z2)
            else:
                v11 = Vector3(x1, ground_height(x1, shore_edge(x1) + z1), shore_edge(x1) + z1)
                v12 = Vector3(x1, ground_height(x1, shore_edge(x1) + z2), shore_edge(x1) + z2)
                v21 = Vector3(x2, ground_height(x2, shore_edge(x2) + z1), shore_edge(x2) + z1)
                v22 = Vector3(x2, ground_height(x2, shore_edge(x2) + z2), shore_edge(x2) + z2)
            _ground_triangle(builder, v11, v12, v21)
            _ground_triangle(builder, v12, v22, v21)
    var mesh := builder.commit()
    var instance := MeshInstance3D.new()
    instance.mesh = mesh
    instance.material_override = mat
    add_child(instance)

    # Sandy strip: close to water, blend earth toward shore.
    if not far_bank:
        var shore_mat := StandardMaterial3D.new()
        shore_mat.albedo_texture = load("res://assets/textures/shore_diffuse.jpg")
        shore_mat.albedo_color = Color(0.91, 0.83, 0.69)
        shore_mat.roughness = 0.98
        var sand_strip := SurfaceTool.new()
        sand_strip.begin(Mesh.PRIMITIVE_TRIANGLES)
        for ix in range(70):
            var xa := float(ix) * 2.8 - 98.0
            var xb := xa + 2.8
            var a0 := Vector3(xa, 0.085, shore_edge(xa) - 0.35)
            var a1 := Vector3(xa, ground_height(xa, shore_edge(xa) + 2.2) + 0.02, shore_edge(xa) + 2.2)
            var b0 := Vector3(xb, 0.085, shore_edge(xb) - 0.35)
            var b1 := Vector3(xb, ground_height(xb, shore_edge(xb) + 2.2) + 0.02, shore_edge(xb) + 2.2)
            _ground_triangle(sand_strip, a0, a1, b0)
            _ground_triangle(sand_strip, a1, b1, b0)
        var shore_mesh := MeshInstance3D.new()
        shore_mesh.mesh = sand_strip.commit()
        shore_mesh.material_override = shore_mat
        add_child(shore_mesh)

func _ground_triangle(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
    var normal := (b - a).cross(c - a).normalized()
    # Double-sided ground material avoids face loss on terrain triangles.
    for vertex in [a, b, c]:
        surface.set_normal(normal)
        surface.set_uv(Vector2(vertex.x / 7.5, vertex.z / 7.5))
        surface.add_vertex(vertex)

func _make_forest() -> void:
    var tree_kinds := [
        "tree-oak", "tree-oak-dark", "tree-detailed", "tree-default",
        "tree-pinetalla-detailed", "tree-pinetallb-detailed",
        "tree-pinerounda", "tree-pineroundd",
    ]
    var rock_kinds := ["rock-largea", "rock-largee", "rock-smallb", "rock-smallh"]
    var bush_kinds := ["plant-bushdetailed", "plant-bushlarge"]

    for i in range(110):
        var px := random.randf_range(-100, 100)
        var pz := random.randf_range(12.0, 75.0)
        if absf(px) < 6.0 and pz < 23.0:
            continue
        if absf(px - 15.0) < 5.0 and pz < 17.0:
            continue
        var tree: String = tree_kinds[random.randi_range(0, tree_kinds.size() - 1)]
        _place_asset(tree, Vector3(px, ground_height(px, pz), pz), random.randf_range(3.5, 6.3), random.randf_range(-PI, PI))

    # The photographic panorama already contains a natural distant forest.
    # Avoid toy-like GLB trees at the horizon: 3D vegetation should live near
    # the player, where parallax and motion make a difference.

    for i in range(90):
        var px := random.randf_range(-93, 93)
        var pz := random.randf_range(5.2, 59)
        if absf(px) < 3.3 and pz < 13:
            continue
        var kind: String = rock_kinds[random.randi_range(0, rock_kinds.size() - 1)]
        var scale_factor := random.randf_range(1.2, 2.9)
        _place_asset(kind, Vector3(px, ground_height(px, pz) - 0.10, pz), scale_factor, random.randf_range(0, TAU))

    # Photoscanned boulders and shrubs close to camera, while lightweight
    # nature-kit assets populate the horizon on mobile hardware.
    for i in range(23):
        var side := -1.0 if i % 2 == 0 else 1.0
        var px := side * random.randf_range(3.2, 28.0)
        var pz := shore_edge(px) + random.randf_range(0.8, 13.0)
        var kind: String = ["rock_07", "rock_moss_set_01", "stone_01"][i % 3]
        _place_asset(kind, Vector3(px, ground_height(px, pz) - 0.13, pz), random.randf_range(0.36, 0.84), random.randf_range(0, TAU))

    for i in range(38):
        var side := -1.0 if i % 2 == 0 else 1.0
        var px := side * random.randf_range(3.5, 31.0)
        var pz := shore_edge(px) + random.randf_range(2.1, 24.0)
        var kind: String = "shrub_02" if i % 2 == 0 else "shrub_03"
        _place_asset(kind, Vector3(px, ground_height(px, pz), pz), random.randf_range(0.5, 1.0), random.randf_range(0, TAU))

    for i in range(155):
        var px := random.randf_range(-95, 95)
        var pz := random.randf_range(7.1, 69)
        if absf(px) < 2.3 and pz < 14:
            continue
        var kind: String = bush_kinds[random.randi_range(0, bush_kinds.size() - 1)]
        _place_asset(kind, Vector3(px, ground_height(px, pz), pz), random.randf_range(1.4, 2.9), random.randf_range(0, TAU))

    for i in range(185):
        var side := -1.0 if i % 2 == 0 else 1.0
        var px := side * random.randf_range(1.5, 55.0)
        var pz := shore_edge(px) + random.randf_range(0.2, 5.5)
        _place_asset("grass-leafs" if i % 3 == 0 else "grass-large", Vector3(px, ground_height(px, pz), pz), random.randf_range(1.5, 3.2), random.randf_range(0, TAU))

    for i in range(48):
        var side := -1.0 if i % 2 == 0 else 1.0
        var px := side * random.randf_range(4.5, 48.0)
        var pz := shore_edge(px) + random.randf_range(-1.5, 0.8)
        _place_asset("cattails", Vector3(px, -0.04, pz), random.randf_range(0.7, 1.4), random.randf_range(0, TAU))

    for i in range(25):
        var px := random.randf_range(-45, 45)
        var pz := random.randf_range(-12, 0)
        if absf(px) < 2.0:
            continue
        _place_asset("lilies", Vector3(px, 0.01, pz), random.randf_range(0.8, 1.4), random.randf_range(0, TAU))

func _make_fishing_spot() -> void:
    # A small timber pier at the right side; walk there to inspect the equipment.
    for i in range(4):
        _place_asset("dock", Vector3(15.5, 0.04, 3.5 - i * 2.35), 1.0, 0.0)
    _place_asset("boat", Vector3(20.0, -0.10, -5.9), 1.0, 0.28)
    _place_asset("chair", Vector3(7.5, ground_height(7.5, 9.1), 9.1), 1.0, -0.42)
    _place_asset("tackle", Vector3(7.0, ground_height(7.0, 9.3), 9.3), 0.95, 0.22)
    _place_asset("cooler", Vector3(8.1, ground_height(8.1, 10.1), 10.1), 0.95, 0.1)
    _place_asset("sign", Vector3(10.0, ground_height(10, 6.5), 6.5), 1.0, -1.1)
    _place_asset("rock_moss_set_01", Vector3(-4.2, 0.15, 5.6), 0.65, 0.7)
    _place_asset("log", Vector3(-7.0, ground_height(-7, 9.2), 9.2), 2.6, 0.4)
    _place_asset("stump-rounddetailed", Vector3(-3.8, ground_height(-3.8, 10.0), 10.0), 2.6, 0.4)

func _make_habitat_details() -> void:
    # The same physical landmarks the fish ecology understands:
    # reed-fringed crucian bay (left), outcrop for perch (right),
    # submerged fall and deep drop where the pike hunts.
    for i in range(25):
        var x := -11.3 + random.randf_range(-5.0, 5.0)
        var z := -15.7 + random.randf_range(-3.6, 4.8)
        var pad := _place_asset("lilies", Vector3(x, 0.012, z), random.randf_range(0.52, 1.15), random.randf_range(0, TAU))
        if pad != null:
            floating_leaves.append(pad)
    for i in range(24):
        var x := -13.0 + random.randf_range(-5.5, 8.0)
        var z := shore_edge(x) + random.randf_range(-1.1, 0.35)
        var reed := _place_asset("cattails", Vector3(x, 0.0, z), random.randf_range(0.55, 1.35), random.randf_range(0, TAU))
        if reed != null:
            reeds.append(reed)
    for i in range(11):
        var x := 10.0 + random.randf_range(-6.5, 6.5)
        var z := -17.0 + random.randf_range(-5.3, 6.1)
        var rock := _place_asset("rock_07" if i % 2 == 0 else "stone_01", Vector3(x, -0.12, z), random.randf_range(0.22, 0.43), random.randf_range(0, TAU))
        if rock != null:
            rock.rotation.x = random.randf_range(-0.22, 0.22)
    _place_asset("log", Vector3(-3.7, -0.17, -24.5), 1.8, -0.60)
    _place_asset("rock_moss_set_01", Vector3(3.0, -0.24, -26.5), 0.33, 1.2)

func _place_asset(name: String, location: Vector3, factor: float = 1.0, facing: float = 0.0) -> Node3D:
    var path := "res://assets/models/%s.glb" % name
    var packed := load(path) as PackedScene
    if packed == null:
        push_warning("Missing CC0 model: " + path)
        return null
    var prop := packed.instantiate() as Node3D
    add_child(prop)
    prop.position = location
    prop.scale = Vector3.ONE * factor
    prop.rotation.y = facing
    if name.begins_with("tree-") or name.begins_with("plant-") or name.begins_with("grass-"):
        _correct_nature_colors(prop, name)
    return prop

func _correct_nature_colors(node: Node, asset_name: String) -> void:
    # Kenney glTF source uses a blue-cyan foliage palette. Preserve the original
    # meshes, bark material and normals, but remap foliage colors to forest green.
    # Imported meshes are shared, so surface overrides must be per-instance.
    if node is MeshInstance3D:
        var mesh_node := node as MeshInstance3D
        if mesh_node.mesh != null:
            for surface in range(mesh_node.mesh.get_surface_count()):
                var original := mesh_node.mesh.surface_get_material(surface)
                if original is StandardMaterial3D:
                    var mat := original.duplicate() as StandardMaterial3D
                    var base := mat.albedo_color
                    var is_cyan := base.b > base.r * 1.04 and base.g > base.r * 1.08
                    if is_cyan:
                        var value := clampf(base.get_luminance(), 0.10, 0.95)
                        var variation := 0.91 + absf(sin(mesh_node.global_position.x * 0.7)) * 0.18
                        var green := Color(
                            (0.105 + value * 0.16) * variation,
                            (0.19 + value * 0.26) * variation,
                            (0.085 + value * 0.10) * variation,
                            base.a
                        )
                        if asset_name.begins_with("grass-"):
                            green = Color(0.23, 0.31, 0.15, base.a)
                        mat.albedo_color = green
                        mesh_node.set_surface_override_material(surface, mat)
    for child in node.get_children():
        _correct_nature_colors(child, asset_name)

func _mesh(parent: Node3D, shape: Mesh, location: Vector3, scale_factor: Vector3, material: Material) -> MeshInstance3D:
    var mesh := MeshInstance3D.new()
    mesh.mesh = shape
    mesh.position = location
    mesh.scale = scale_factor
    mesh.material_override = material
    parent.add_child(mesh)
    return mesh
