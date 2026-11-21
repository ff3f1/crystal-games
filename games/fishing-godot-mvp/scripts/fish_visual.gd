extends Node3D
## Three dedicated species meshes: anatomical profiles, fin placement,
## tangent-space PBR fish scales and actual moving tail pivots.

var species_name := "Окунь"
var tail_joint: Node3D
var fin_clock := 0.0
var motion_intensity := 0.52
var skin_material: ShaderMaterial

func configure(species: String) -> void:
    species_name = species
    for old in get_children():
        remove_child(old)
        old.queue_free()
    if species == "Карась":
        _make_crucian()
    elif species == "Щука":
        _make_pike()
    else:
        _make_perch()

func _process(delta: float) -> void:
    if tail_joint != null:
        fin_clock += delta
        tail_joint.rotation.y = sin(fin_clock * 6.7) * 0.19 * motion_intensity
        tail_joint.rotation.z = sin(fin_clock * 4.0 + 1.4) * 0.03 * motion_intensity

func set_wiggle(amount: float) -> void:
    motion_intensity = clampf(amount, 0.0, 2.0)
    if skin_material != null:
        skin_material.set_shader_parameter("swim_power", motion_intensity)

func _make_crucian() -> void:
    # Deep round-bodied golden crucian, short snout and prominent dorsal fin.
    var sections: Array[Vector4] = [
        Vector4(-1.35, 0.05, 0.09, -0.07),
        Vector4(-1.23, 0.15, 0.17, -0.03),
        Vector4(-1.09, 0.23, 0.27, 0.01),
        Vector4(-0.84, 0.29, 0.40, 0.03),
        Vector4(-0.45, 0.33, 0.55, 0.02),
        Vector4(-0.05, 0.35, 0.59, -0.025),
        Vector4(0.35, 0.33, 0.52, -0.042),
        Vector4(0.73, 0.23, 0.33, -0.029),
        Vector4(1.01, 0.12, 0.17, -0.015),
        Vector4(1.19, 0.07, 0.09, -0.015)
    ]
    _body_mesh(sections, "crucian")
    var fin := _finmat(Color(0.49, 0.30, 0.18))
    var fin_light := _finmat(Color(0.57, 0.40, 0.25))
    _fin([Vector3(0, 0.48, -0.78), Vector3(0, 1.01, -0.34), Vector3(0, 0.63, 0.61), Vector3(0, 0.28, 0.83)], fin)
    _dorsal_rays(-0.77, 0.59, 0.50, 0.14, 12, fin_light)
    _fin([Vector3(0, -0.44, 0.50), Vector3(0, -0.84, 0.81), Vector3(0, -0.16, 1.01)], fin)
    _paired_fins(-0.74, -0.21, 0.29, fin_light)
    _paired_fins(-0.15, -0.48, 0.22, fin_light)
    _tail(1.18, fin, 0.40, 0.35)
    _eyes(0.218, 0.098, -1.075, 0.070)
    _mouth(-1.35, -0.075, 0.073)
    _gill_lines(-0.93, 0.20, 0.33)

func _make_perch() -> void:
    # Spiny perch: olive back, vertical dark bands in the PBR map, orange fins.
    var sections: Array[Vector4] = [
        Vector4(-1.63, 0.06, 0.07, -0.055),
        Vector4(-1.46, 0.14, 0.13, -0.042),
        Vector4(-1.24, 0.23, 0.20, -0.019),
        Vector4(-1.04, 0.28, 0.30, 0.011),
        Vector4(-0.69, 0.30, 0.40, 0.018),
        Vector4(-0.20, 0.31, 0.43, 0.005),
        Vector4(0.22, 0.30, 0.37, -0.020),
        Vector4(0.64, 0.23, 0.25, -0.021),
        Vector4(1.06, 0.09, 0.13, -0.02),
        Vector4(1.23, 0.055, 0.07, -0.015)
    ]
    _body_mesh(sections, "perch")
    var spines := _finmat(Color(0.34, 0.38, 0.21))
    var light_fin := _finmat(Color(0.57, 0.52, 0.28))
    var orange := _finmat(Color(0.82, 0.28, 0.14))
    _fin([Vector3(0, 0.26, -0.85), Vector3(0, 0.84, -0.68), Vector3(0, 0.76, -0.08), Vector3(0, 0.36, 0.18)], spines)
    _dorsal_rays(-0.81, 0.02, 0.57, 0.34, 10, light_fin)
    _fin([Vector3(0, 0.31, 0.10), Vector3(0, 0.67, 0.41), Vector3(0, 0.27, 0.68)], light_fin)
    _paired_fins(-0.95, -0.21, 0.27, orange)
    _paired_fins(-0.37, -0.34, 0.29, orange)
    _fin([Vector3(0, -0.26, 0.58), Vector3(0, -0.61, 0.68), Vector3(0, -0.15, 0.97)], orange)
    _tail(1.22, orange, 0.47, 0.44)
    _eyes(0.22, 0.077, -1.32, 0.076)
    _mouth(-1.62, -0.09, 0.084)
    _gill_lines(-1.10, 0.19, 0.27)

func _make_pike() -> void:
    # Long torpedo predator, rearward dorsal/anal fins, extended duckbill jaw.
    var sections: Array[Vector4] = [
        Vector4(-2.10, 0.07, 0.048, -0.093),
        Vector4(-1.91, 0.15, 0.087, -0.085),
        Vector4(-1.69, 0.20, 0.132, -0.065),
        Vector4(-1.45, 0.25, 0.196, -0.027),
        Vector4(-1.19, 0.31, 0.241, 0.0),
        Vector4(-0.78, 0.36, 0.289, 0.004),
        Vector4(-0.28, 0.38, 0.300, -0.004),
        Vector4(0.22, 0.33, 0.268, -0.009),
        Vector4(0.70, 0.23, 0.196, -0.018),
        Vector4(1.10, 0.12, 0.101, -0.009),
        Vector4(1.34, 0.07, 0.068, -0.009)
    ]
    _body_mesh(sections, "pike")
    var bronze := _finmat(Color(0.43, 0.36, 0.20))
    var olive := _finmat(Color(0.30, 0.38, 0.21))
    _fin([Vector3(0, 0.14, 0.58), Vector3(0, 0.51, 0.84), Vector3(0, 0.17, 1.12)], bronze)
    _fin([Vector3(0, -0.12, 0.71), Vector3(0, -0.42, 0.86), Vector3(0, -0.12, 1.10)], bronze)
    _paired_fins(-1.06, -0.12, 0.32, olive)
    _paired_fins(0.33, -0.24, 0.26, bronze)
    _tail(1.34, bronze, 0.53, 0.53)
    _eyes(0.212, 0.050, -1.57, 0.070)
    _mouth(-1.97, -0.11, 0.18)
    _gill_lines(-1.24, 0.26, 0.21)
    # Lateral pike spots are part of the PBR albedo; no floating scale spheres.

func _body_mesh(sections: Array[Vector4], fish: String) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    var sides := 32
    for i in range(sections.size() - 1):
        var first: Vector4 = sections[i]
        var second: Vector4 = sections[i + 1]
        for j in range(sides):
            var v0 := float(j) / float(sides)
            var v1 := float(j + 1) / float(sides)
            var u0 := float(i) / float(sections.size() - 1)
            var u1 := float(i + 1) / float(sections.size() - 1)
            var a := _ring_point(first, v0 * TAU)
            var b := _ring_point(second, v0 * TAU)
            var c := _ring_point(first, v1 * TAU)
            var d := _ring_point(second, v1 * TAU)
            _vertex_triangle(st, a, b, c, Vector2(u0, v0), Vector2(u1, v0), Vector2(u0, v1))
            _vertex_triangle(st, b, d, c, Vector2(u1, v0), Vector2(u1, v1), Vector2(u0, v1))
    st.generate_normals()
    st.generate_tangents()
    var mesh := MeshInstance3D.new()
    mesh.mesh = st.commit()
    var mat := ShaderMaterial.new()
    mat.shader = load("res://shaders/fish_skin.gdshader")
    mat.set_shader_parameter("fish_albedo", load("res://assets/textures/fish_%s_albedo.png" % fish))
    mat.set_shader_parameter("fish_normal", load("res://assets/textures/fish_%s_normal.png" % fish))
    mat.set_shader_parameter("wetness", 0.78)
    mat.set_shader_parameter("swim_power", motion_intensity)
    skin_material = mat
    mesh.material_override = mat
    mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
    add_child(mesh)

func _ring_point(v: Vector4, angle: float) -> Vector3:
    return Vector3(sin(angle) * v.y, cos(angle) * v.z + v.w, v.x)

func _vertex_triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, uv_a: Vector2, uv_b: Vector2, uv_c: Vector2) -> void:
    st.set_color(Color.WHITE)
    st.set_uv(uv_a)
    st.add_vertex(a)
    st.set_uv(uv_b)
    st.add_vertex(b)
    st.set_uv(uv_c)
    st.add_vertex(c)

func _tail(z: float, material: StandardMaterial3D, length: float, height: float) -> void:
    tail_joint = Node3D.new()
    tail_joint.position = Vector3(0, 0, z)
    add_child(tail_joint)
    _fin([Vector3(0, 0, -0.03), Vector3(0, height, length), Vector3(0, 0.06, length * 0.72)], material, tail_joint)
    _fin([Vector3(0, 0, -0.03), Vector3(0, -height, length), Vector3(0, -0.06, length * 0.72)], material, tail_joint)

func _paired_fins(z: float, y: float, reach: float, material: StandardMaterial3D) -> void:
    for side in [-1.0, 1.0]:
        var sign: float = side
        _fin([
            Vector3(sign * 0.19, y, z),
            Vector3(sign * (0.19 + reach), y - reach * 0.57, z + reach * 0.32),
            Vector3(sign * 0.20, y - 0.11, z + reach * 0.72)
        ], material)

func _dorsal_rays(start_z: float, end_z: float, top_y: float, bottom_y: float, count: int, material: StandardMaterial3D) -> void:
    var ray_color := _mat(Color(0.54, 0.49, 0.34), 0.52)
    for i in range(count):
        var t := float(i) / float(maxi(1, count - 1))
        var z := lerpf(start_z, end_z, t)
        var top := top_y * (1.0 - t * 0.17)
        _small_rod(Vector3(0, bottom_y + 0.06, z), Vector3(0, top, z - 0.05), 0.010, ray_color)

func _eyes(x: float, y: float, z: float, radius: float) -> void:
    var gold := _mat(Color(0.78, 0.61, 0.27), 0.32)
    var pupil := _mat(Color(0.015, 0.019, 0.021), 0.13)
    var highlight := _mat(Color(0.96, 0.97, 0.92), 0.12)
    for side in [-1.0, 1.0]:
        var sign: float = side
        _sphere(Vector3(sign * x, y, z), Vector3(radius, radius, radius * 0.48), gold)
        _sphere(Vector3(sign * (x + radius * 0.19), y + 0.003, z - radius * 0.12), Vector3(radius * 0.61, radius * 0.65, radius * 0.36), pupil)
        _sphere(Vector3(sign * (x + radius * 0.42), y + radius * 0.28, z - radius * 0.22), Vector3(radius * 0.17, radius * 0.16, radius * 0.13), highlight)

func _mouth(z: float, y: float, width: float) -> void:
    var lip := _mat(Color(0.41, 0.34, 0.25), 0.65)
    var interior := _mat(Color(0.29, 0.16, 0.15), 0.80)
    _sphere(Vector3(0, y - 0.023, z), Vector3(width, 0.016, 0.06), interior)
    _sphere(Vector3(0, y - 0.01, z - 0.017), Vector3(width * 0.85, 0.025, 0.027), lip)

func _gill_lines(z: float, x: float, height: float) -> void:
    var edge := _mat(Color(0.13, 0.18, 0.12), 0.76)
    for side in [-1.0, 1.0]:
        var sign: float = side
        var from := Vector3(sign * x, height * 0.54, z)
        var to := Vector3(sign * (x + 0.003), -height * 0.52, z + 0.02)
        _small_rod(from, to, 0.009, edge)

func _fin(points: Array, material: Material, parent: Node3D = null) -> void:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for i in range(1, points.size() - 1):
        st.set_uv(Vector2(0.0, 0.0))
        st.add_vertex(points[0])
        st.set_uv(Vector2(1.0, 0.0))
        st.add_vertex(points[i])
        st.set_uv(Vector2(0.4, 1.0))
        st.add_vertex(points[i + 1])
    st.generate_normals()
    var fin := MeshInstance3D.new()
    fin.mesh = st.commit()
    fin.material_override = material
    (parent if parent != null else self).add_child(fin)

func _finmat(color: Color) -> StandardMaterial3D:
    var mat := _mat(color, 0.54)
    mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    return mat

func _mat(color: Color, rough: float) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = color
    m.roughness = rough
    return m

func _small_rod(a: Vector3, b: Vector3, radius: float, mat: Material) -> void:
    var shape := CylinderMesh.new()
    shape.top_radius = radius * 0.76
    shape.bottom_radius = radius
    shape.height = a.distance_to(b)
    shape.radial_segments = 6
    var m := _mesh(shape, (a + b) * 0.5, Vector3.ONE, mat)
    m.quaternion = Quaternion(Vector3.UP, (b - a).normalized())

func _sphere(p: Vector3, factor: Vector3, mat: Material) -> void:
    _mesh(SphereMesh.new(), p, factor, mat)

func _mesh(shape: Mesh, p: Vector3, factor: Vector3, mat: Material) -> MeshInstance3D:
    var m := MeshInstance3D.new()
    m.mesh = shape
    m.position = p
    m.scale = factor
    m.material_override = mat
    add_child(m)
    return m
