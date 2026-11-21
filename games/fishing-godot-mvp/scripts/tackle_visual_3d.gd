extends RefCounted
## True curved, closed meshes for the lure and segmented worm.
## Shape is authored in 3D and remains visible from the underwater camera.

func make_spoon_mesh() -> ArrayMesh:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    # A dished elliptical spoon: double surface, real convex curvature and rim.
    var longitudinal := 20
    var lateral := 10
    for row in range(longitudinal):
        for column in range(lateral):
            var u0 := float(row) / longitudinal
            var u1 := float(row + 1) / longitudinal
            var v0 := float(column) / lateral
            var v1 := float(column + 1) / lateral
            var a := _spoon_point(u0, v0, true)
            var b := _spoon_point(u1, v0, true)
            var c := _spoon_point(u0, v1, true)
            var d := _spoon_point(u1, v1, true)
            _tri(st, a, b, c)
            _tri(st, c, b, d)
            var back_a := _spoon_point(u0, v0, false)
            var back_b := _spoon_point(u1, v0, false)
            var back_c := _spoon_point(u0, v1, false)
            var back_d := _spoon_point(u1, v1, false)
            _tri(st, back_a, back_c, back_b)
            _tri(st, back_c, back_d, back_b)
        # Raised rim joins the upper and lower shells on both long edges.
        for side in [0.0, 1.0]:
            var p0 := _spoon_point(float(row) / longitudinal, side, true)
            var p1 := _spoon_point(float(row + 1) / longitudinal, side, true)
            var q0 := _spoon_point(float(row) / longitudinal, side, false)
            var q1 := _spoon_point(float(row + 1) / longitudinal, side, false)
            _tri(st, p0, q0, p1)
            _tri(st, p1, q0, q1)
    st.generate_normals()
    return st.commit()

func _spoon_point(u: float, v: float, front: bool) -> Vector3:
    var t := u * 2.0 - 1.0
    var width := 0.083 * sqrt(maxf(0.002, 1.0 - t * t))
    var across := v * 2.0 - 1.0
    var x := across * width
    var z := t * 0.215
    var hollow := 0.017 * (1.0 - across * across) * (1.0 - t * t)
    var bend := 0.028 * t * t + 0.011 * sin(u * PI)
    return Vector3(x, hollow + bend + (0.005 if front else -0.005), z)

func make_worm_mesh() -> ArrayMesh:
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    # Curved segmented tubular bait instead of a stretched spherical placeholder.
    var rings := 18
    var sides := 10
    for ring in range(rings):
        var t0 := float(ring) / rings
        var t1 := float(ring + 1) / rings
        for side in range(sides):
            var a0 := float(side) / sides * TAU
            var a1 := float(side + 1) / sides * TAU
            var a := _worm_point(t0, a0)
            var b := _worm_point(t1, a0)
            var c := _worm_point(t0, a1)
            var d := _worm_point(t1, a1)
            _tri(st, a, c, b)
            _tri(st, c, d, b)
    st.generate_normals()
    return st.commit()

func _worm_point(t: float, angle: float) -> Vector3:
    var taper := 0.35 + 0.65 * sin(PI * (0.07 + 0.87 * t))
    var ring_mark := 0.91 + 0.09 * cos(t * 30.0 * PI)
    var radius := 0.035 * taper * ring_mark
    var x := sin(t * PI * 2.6) * 0.048
    var y := 0.036 * cos(t * PI * 1.85) + t * 0.03
    return Vector3(x + cos(angle) * radius, y + sin(angle) * radius, (t - 0.5) * 0.36)

func add_spoon_hardware(root: Node3D) -> void:
    var silver := _material(Color(0.58, 0.67, 0.68), 0.22, 0.84)
    var dark := _material(Color(0.12, 0.14, 0.14), 0.25, 0.79)
    _ring(root, Vector3(0.0, 0.040, -0.230), 0.027, silver)
    _ring(root, Vector3(0.0, 0.035, 0.229), 0.027, silver)
    _hook(root, Vector3(0.0, 0.005, 0.248), 0.122, dark)
    # Side eye for a realistic spinner connector, not another free-floating orb.
    _rod(root, Vector3(0, 0.022, -0.228), Vector3(0, 0.04, -0.20), 0.007, silver)

func add_worm_hook(root: Node3D) -> void:
    var steel := _material(Color(0.47, 0.51, 0.52), 0.28, 0.79)
    _hook(root, Vector3(0.012, -0.012, 0.080), 0.097, steel)

func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
    st.add_vertex(a)
    st.add_vertex(b)
    st.add_vertex(c)

func _material(tint: Color, rough: float, metal: float) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = tint
    m.roughness = rough
    m.metallic = metal
    return m

func _rod(root: Node3D, a: Vector3, b: Vector3, radius: float, material: Material) -> void:
    var cylinder := CylinderMesh.new()
    cylinder.top_radius = radius
    cylinder.bottom_radius = radius
    cylinder.height = a.distance_to(b)
    cylinder.radial_segments = 8
    var part := MeshInstance3D.new()
    part.mesh = cylinder
    part.position = (a + b) * 0.5
    part.quaternion = Quaternion(Vector3.UP, (b - a).normalized())
    part.material_override = material
    root.add_child(part)

func _ring(root: Node3D, position: Vector3, radius: float, material: Material) -> void:
    var mesh := TorusMesh.new()
    mesh.inner_radius = radius - 0.006
    mesh.outer_radius = radius
    var object := MeshInstance3D.new()
    object.mesh = mesh
    object.position = position
    object.rotation.x = PI * 0.5
    object.material_override = material
    root.add_child(object)

func _hook(root: Node3D, origin: Vector3, length: float, material: Material) -> void:
    # Curved single hook with a visible pointed barb.
    var previous := origin
    for index in range(1, 12):
        var t := float(index) / 11.0
        var angle := PI * 0.12 + t * PI * 1.32
        var current := origin + Vector3(sin(angle) * length * 0.45, -t * length * 0.56 - cos(angle) * length * 0.16, t * length * 0.33)
        _rod(root, previous, current, 0.005 if index < 9 else 0.003, material)
        previous = current
