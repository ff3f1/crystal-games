extends Node3D
## Actual 3D fish in landing animation and trophy preview.
## Species are kept consistent: pike is built with its own long-jawed anatomy,
## not a trout model mislabeled "Щука".

func configure(species: String) -> void:
    for old in get_children():
        remove_child(old)
        old.queue_free()
    if species == "Щука":
        _pike()
    else:
        var model_name := "carp" if species == "Карась" else "perch"
        var model_scene := load("res://assets/models/%s.glb" % model_name) as PackedScene
        if model_scene != null:
            var model := model_scene.instantiate() as Node3D
            add_child(model)
            model.rotation_degrees = Vector3(0, 90, 0)
            model.scale = Vector3.ONE * 0.75
        else:
            _pike()

func _pike() -> void:
    # Continuous skinned body mesh, rather than stacked spheres / disconnected fins.
    # Z axis: blunt elongated snout (-2) -> narrow tail stalk (+1.4).
    var sections: Array[Vector4] = [
        Vector4(-2.06, 0.083, 0.058, -0.102),
        Vector4(-1.89, 0.15, 0.091, -0.108),
        Vector4(-1.67, 0.19, 0.124, -0.073),
        Vector4(-1.48, 0.244, 0.183, -0.040),
        Vector4(-1.21, 0.305, 0.228, -0.013),
        Vector4(-0.82, 0.365, 0.285, 0.0),
        Vector4(-0.31, 0.385, 0.295, -0.005),
        Vector4(0.22, 0.331, 0.257, -0.012),
        Vector4(0.70, 0.218, 0.193, -0.010),
        Vector4(1.09, 0.115, 0.102, -0.012),
        Vector4(1.37, 0.072, 0.067, -0.013)
    ]
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color.WHITE
    mat.vertex_color_use_as_albedo = true
    mat.roughness = 0.64
    mat.metallic = 0.08
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var sides := 24
    for i in range(sections.size() - 1):
        var first: Vector4 = sections[i]
        var second: Vector4 = sections[i + 1]
        for j in range(sides):
            var angle_a := TAU * float(j) / float(sides)
            var angle_b := TAU * float(j + 1) / float(sides)
            var a := _fish_ring_point(first, angle_a)
            var b := _fish_ring_point(second, angle_a)
            var c := _fish_ring_point(first, angle_b)
            var d := _fish_ring_point(second, angle_b)
            var col_a := _pike_skin(angle_a, first.x)
            var col_b := _pike_skin(angle_b, first.x)
            var col_c := _pike_skin(angle_a, second.x)
            var col_d := _pike_skin(angle_b, second.x)
            _triangle(st, a, b, c, col_a, col_c, col_b)
            _triangle(st, b, d, c, col_c, col_d, col_b)
    st.generate_normals()
    var body := MeshInstance3D.new()
    body.mesh = st.commit()
    body.material_override = mat
    add_child(body)

    var fin_mat := _mat(Color(0.21, 0.30, 0.17), 0.73)
    fin_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    var fin_lighter := _mat(Color(0.30, 0.38, 0.19), 0.77)
    fin_lighter.cull_mode = BaseMaterial3D.CULL_DISABLED

    # Forked tail in the fish's vertical plane.
    _fin([Vector3(0, 0.0, 1.31), Vector3(0, 0.46, 1.84), Vector3(0, 0.05, 1.59)], fin_mat)
    _fin([Vector3(0, 0.0, 1.31), Vector3(0, -0.46, 1.84), Vector3(0, -0.05, 1.59)], fin_mat)
    _fin([Vector3(0, 0.13, 0.68), Vector3(0, 0.53, 0.75), Vector3(0, 0.18, 1.10)], fin_lighter)
    _fin([Vector3(0, -0.13, 0.72), Vector3(0, -0.39, 0.84), Vector3(0, -0.13, 1.12)], fin_lighter)
    for side in [-1.0, 1.0]:
        _fin([
            Vector3(side * 0.28, -0.12, -0.92),
            Vector3(side * 0.55, -0.28, -0.42),
            Vector3(side * 0.31, -0.21, -0.25)
        ], fin_mat)
    var eye_gold := _mat(Color(0.72, 0.58, 0.21), 0.34)
    var eye_black := _mat(Color(0.015, 0.024, 0.017), 0.15)
    for side in [-1.0, 1.0]:
        _sphere(Vector3(side * 0.235, 0.045, -1.48), Vector3(0.035, 0.035, 0.038), eye_gold)
        _sphere(Vector3(side * 0.259, 0.046, -1.493), Vector3(0.022, 0.023, 0.023), eye_black)
        _sphere(Vector3(side * 0.133, -0.053, -1.98), Vector3(0.020, 0.014, 0.014), eye_black)

    # Tiny cream-colored body markings, clamped to the side surface.
    var rng := RandomNumberGenerator.new()
    rng.seed = 762134
    var flecks := _mat(Color(0.79, 0.83, 0.51), 0.67)
    for i in range(85):
        var z := rng.randf_range(-0.80, 0.91)
        var side := -1.0 if i % 2 == 0 else 1.0
        var rel_y := rng.randf_range(-0.28, 0.68)
        var local_rx := 0.31 if z > 0.25 else 0.375
        var local_ry := 0.25 if z > 0.25 else 0.29
        var y := rel_y * local_ry
        var ratio := clampf(rel_y, -0.95, 0.95)
        var x := local_rx * sqrt(1.0 - ratio * ratio) + 0.002
        _sphere(Vector3(side * x, y, z), Vector3(0.010, 0.015, rng.randf_range(0.022, 0.041)), flecks)

func _fish_ring_point(section: Vector4, angle: float) -> Vector3:
    return Vector3(sin(angle) * section.y, cos(angle) * section.z + section.w, section.x)

func _pike_skin(angle: float, z: float) -> Color:
    var value := cos(angle)
    var pattern := sin(z * 21.0 + sin(angle * 4.0) * 2.4) * 0.017
    if value > 0.45:
        return Color(0.19 + pattern, 0.29 + pattern, 0.13 + pattern)
    if value < -0.48:
        return Color(0.77, 0.77, 0.56)
    return Color(0.31 + pattern, 0.43 + pattern, 0.20 + pattern)

func _triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, ac: Color, bc: Color, cc: Color) -> void:
    st.set_color(ac)
    st.add_vertex(a)
    st.set_color(bc)
    st.add_vertex(b)
    st.set_color(cc)
    st.add_vertex(c)

func _fin(points: Array[Vector3], mat: Material) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for i in range(1, points.size() - 1):
        st.add_vertex(points[0])
        st.add_vertex(points[i])
        st.add_vertex(points[i + 1])
    st.generate_normals()
    var fin := MeshInstance3D.new()
    fin.mesh = st.commit()
    fin.material_override = mat
    add_child(fin)

func _mat(color: Color, rough: float) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = color
    m.roughness = rough
    return m

func _sphere(p: Vector3, scale_factor: Vector3, mat: Material) -> void:
    _mesh(SphereMesh.new(), p, scale_factor, mat)

func _mesh(shape: Mesh, p: Vector3, size: Vector3, mat: Material) -> MeshInstance3D:
    var m := MeshInstance3D.new()
    m.mesh = shape
    m.position = p
    m.scale = size
    m.material_override = mat
    add_child(m)
    return m
