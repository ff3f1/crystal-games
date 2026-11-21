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
    var back := _mat(Color(0.18, 0.27, 0.13), 0.55)
    var flank := _mat(Color(0.30, 0.42, 0.19), 0.56)
    var belly := _mat(Color(0.70, 0.74, 0.54), 0.56)
    var fin := _mat(Color(0.25, 0.31, 0.13), 0.62)
    var eye_dark := _mat(Color(0.026, 0.026, 0.024), 0.13)
    var iris := _mat(Color(0.78, 0.61, 0.24), 0.25)
    var pale := _mat(Color(0.76, 0.82, 0.59), 0.64)
    var gill := _mat(Color(0.085, 0.19, 0.10), 0.84)

    # Pike silhouette faces negative Z (head at -Z, forked caudal fin +Z).
    _sphere(Vector3(0, 0, 0.0), Vector3(0.34, 0.31, 1.17), flank)
    _sphere(Vector3(0, -0.14, -0.09), Vector3(0.27, 0.19, 1.01), belly)
    _sphere(Vector3(0, 0.16, -0.06), Vector3(0.31, 0.17, 0.93), back)
    _sphere(Vector3(0, -0.05, -1.08), Vector3(0.245, 0.20, 0.47), flank)
    _sphere(Vector3(0, -0.13, -1.42), Vector3(0.30, 0.075, 0.49), flank)
    _sphere(Vector3(0, -0.21, -1.45), Vector3(0.30, 0.045, 0.44), belly)
    _sphere(Vector3(0, 0.0, 1.09), Vector3(0.10, 0.10, 0.31), flank)

    var caudal := PrismMesh.new()
    caudal.size = Vector3(0.59, 0.66, 0.15)
    var tail_node := _mesh(caudal, Vector3(0, 0, 1.38), Vector3.ONE, fin)
    tail_node.rotation.y = PI * 0.5

    # Dorsal and anal fins near the tail are characteristic of northern pike.
    for side in [-1.0, 1.0]:
        var side_fin := PrismMesh.new()
        side_fin.size = Vector3(0.33, 0.14, 0.47)
        var f := _mesh(side_fin, Vector3(side * 0.32, -0.13, -0.38), Vector3.ONE, fin)
        f.rotation.y = side * 0.55
        f.rotation.z = side * 0.26
    var dorsal := PrismMesh.new()
    dorsal.size = Vector3(0.25, 0.44, 0.51)
    _mesh(dorsal, Vector3(0, 0.36, 0.63), Vector3.ONE, fin)
    var anal := PrismMesh.new()
    anal.size = Vector3(0.20, 0.30, 0.35)
    var anal_node := _mesh(anal, Vector3(0, -0.32, 0.73), Vector3.ONE, fin)
    anal_node.rotation.z = PI

    for side in [-1.0, 1.0]:
        _sphere(Vector3(side * 0.230, 0.09, -1.10), Vector3(0.075, 0.075, 0.037), iris)
        _sphere(Vector3(side * 0.254, 0.095, -1.128), Vector3(0.040, 0.043, 0.025), eye_dark)
        _sphere(Vector3(side * 0.275, -0.026, -0.62), Vector3(0.014, 0.205, 0.018), gill)
        _sphere(Vector3(side * 0.17, -0.14, -1.76), Vector3(0.044, 0.019, 0.035), gill)

    # Fine, pale scales scattered along the olive body.
    var rng := RandomNumberGenerator.new()
    rng.seed = 41378
    for i in range(61):
        var along := rng.randf_range(-0.62, 0.92)
        var angle := rng.randf_range(-1.28, 1.28)
        var body_radius := 0.30 * sqrt(maxf(0.0, 1.0 - pow(along / 1.30, 2.0)))
        var x := body_radius * cos(angle)
        var y := body_radius * sin(angle) * 0.7
        _sphere(Vector3(x, y, along), Vector3(0.015, 0.019, rng.randf_range(0.027, 0.063)), pale)

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
