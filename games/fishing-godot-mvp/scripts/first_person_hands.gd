extends Node3D
## First-person visual-only arms and gloves. This rig is parented to Camera3D.
## Mesh parts are kept separate so the reel hand can animate without affecting fishing physics.

var left_wrist: Node3D
var right_wrist: Node3D
var play_time := 0.0
var winding := false

func _ready() -> void:
    _build_arms()

func set_winding(value: bool) -> void:
    winding = value

func _process(delta: float) -> void:
    play_time += delta
    if left_wrist != null:
        var reel_motion := 1.0 if winding else 0.0
        left_wrist.rotation.z = lerpf(left_wrist.rotation.z, sin(play_time * 15.0) * 0.12 * reel_motion, minf(1.0, delta * 12.0))
        left_wrist.position.y = -0.92 + sin(play_time * 15.0) * 0.024 * reel_motion
    if right_wrist != null:
        right_wrist.rotation.z = sin(play_time * 1.6) * 0.004
        right_wrist.rotation.x = sin(play_time * 1.1) * 0.005

func _mat(color: Color, rough: float, metal: float = 0.0) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = color
    m.roughness = rough
    m.metallic = metal
    return m

func _ellipsoid(parent: Node3D, center: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
    var sphere := SphereMesh.new()
    sphere.radial_segments = 24
    sphere.rings = 14
    var mesh := MeshInstance3D.new()
    mesh.mesh = sphere
    mesh.position = center
    mesh.scale = size
    mesh.material_override = material
    mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    parent.add_child(mesh)
    return mesh

func _segment(parent: Node3D, a: Vector3, b: Vector3, bottom: float, top: float, material: Material, segments: int = 12) -> MeshInstance3D:
    var cylinder := CylinderMesh.new()
    cylinder.top_radius = top
    cylinder.bottom_radius = bottom
    cylinder.height = maxf(0.005, a.distance_to(b))
    cylinder.radial_segments = maxi(segments, 14)
    var mesh := MeshInstance3D.new()
    mesh.mesh = cylinder
    mesh.position = (a + b) * 0.5
    mesh.quaternion = Quaternion(Vector3.UP, (b - a).normalized())
    mesh.material_override = material
    mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    parent.add_child(mesh)
    return mesh

func _build_arms() -> void:
    var sleeve := _mat(Color(0.16, 0.20, 0.24), 0.94)
    var sleeve_shadow := _mat(Color(0.105, 0.14, 0.175), 0.96)
    var fabric := _mat(Color(0.195, 0.211, 0.203), 0.97)
    var fabric_light := _mat(Color(0.265, 0.278, 0.254), 0.96)
    var grip := _mat(Color(0.125, 0.137, 0.129), 0.94)
    var seam := _mat(Color(0.35, 0.37, 0.32), 0.97)
    var cuff := _mat(Color(0.033, 0.051, 0.070), 0.95)

    # Right hand fixes the rod blank. It comes in from lower-right,
    # with the fist hugging the base of the carbon rod.
    right_wrist = Node3D.new()
    right_wrist.position = Vector3(0.66, -0.81, -0.95)
    right_wrist.scale = Vector3.ONE * 0.92
    add_child(right_wrist)
    _segment(right_wrist, Vector3(0.48, -0.30, 0.49), Vector3(0.12, 0.12, -0.04), 0.25, 0.155, sleeve)
    _segment(right_wrist, Vector3(0.11, 0.04, -0.08), Vector3(-0.02, 0.13, -0.10), 0.17, 0.156, sleeve_shadow)
    _segment(right_wrist, Vector3(-0.025, 0.09, -0.115), Vector3(-0.055, 0.18, -0.14), 0.136, 0.123, cuff)
    _ellipsoid(right_wrist, Vector3(-0.067, 0.23, -0.20), Vector3(0.143, 0.17, 0.18), fabric)
    _ellipsoid(right_wrist, Vector3(-0.07, 0.23, -0.306), Vector3(0.147, 0.086, 0.07), fabric_light)
    for i in range(4):
        var offset := (float(i) - 1.5) * 0.067
        _segment(right_wrist, Vector3(-0.11 + offset, 0.21, -0.24), Vector3(-0.07 + offset, 0.25, -0.39), 0.043, 0.038, grip, 8)
        _ellipsoid(right_wrist, Vector3(-0.07 + offset, 0.254, -0.39), Vector3(0.040, 0.035, 0.05), fabric)
    _segment(right_wrist, Vector3(0.005, 0.17, -0.11), Vector3(0.052, 0.29, -0.27), 0.072, 0.060, fabric)
    _ellipsoid(right_wrist, Vector3(0.042, 0.294, -0.27), Vector3(0.054, 0.043, 0.055), grip)
    _segment(right_wrist, Vector3(-0.17, 0.205, -0.27), Vector3(0.05, 0.21, -0.27), 0.0045, 0.0045, seam, 7)

    # Left hand reaches across the reel and turns the winding handle.
    left_wrist = Node3D.new()
    left_wrist.position = Vector3(0.14, -0.92, -0.99)
    left_wrist.scale = Vector3.ONE * 0.91
    add_child(left_wrist)
    _segment(left_wrist, Vector3(-0.57, -0.30, 0.49), Vector3(-0.17, 0.02, -0.07), 0.23, 0.137, sleeve)
    _segment(left_wrist, Vector3(-0.20, -0.02, -0.052), Vector3(-0.13, 0.10, -0.105), 0.137, 0.124, cuff)
    _ellipsoid(left_wrist, Vector3(-0.065, 0.19, -0.17), Vector3(0.155, 0.15, 0.13), fabric)
    _ellipsoid(left_wrist, Vector3(-0.029, 0.245, -0.23), Vector3(0.135, 0.088, 0.086), fabric_light)
    for i in range(4):
        var offset := (float(i) - 1.5) * 0.060
        _segment(left_wrist, Vector3(-0.11 + offset, 0.245, -0.18), Vector3(-0.042 + offset, 0.24, -0.31), 0.040, 0.033, grip, 8)
    _segment(left_wrist, Vector3(0.044, 0.09, -0.17), Vector3(0.14, 0.20, -0.29), 0.066, 0.048, fabric)
    _ellipsoid(left_wrist, Vector3(0.14, 0.21, -0.29), Vector3(0.060, 0.052, 0.044), grip)
    _segment(left_wrist, Vector3(-0.16, 0.21, -0.20), Vector3(0.06, 0.21, -0.20), 0.0045, 0.0045, seam, 7)

    # Fine fabric stripes on the sleeve, avoiding a toy-like uninterrupted tube.
    for hand in [left_wrist, right_wrist]:
        for i in range(3):
            var z := 0.06 + float(i) * 0.082
            _segment(hand, Vector3(-0.105, -0.015, z), Vector3(0.075, -0.004, z + 0.015), 0.004, 0.004, sleeve_shadow, 7)
