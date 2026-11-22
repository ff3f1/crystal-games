extends Node3D
## First-person tackle grip built from continuous tapered volumes rather than
## round spheres and detached pipes. All glove shapes occupy actual camera 3D.
## The right glove holds the rod; the left pivots toward the reel when winding.

var left_wrist: Node3D
var right_wrist: Node3D
var winding := false
var time_passed := 0.0
var retrieve_blend := 0.0
var casting_blend := 0.0
var reel_speed := 0.0
var casting := false
var cast_lift := 0.0
var line_load := 0.0

func set_casting(value: bool) -> void:
    casting = value

func set_line_load(value: float) -> void:
    line_load = clampf(value, 0.0, 1.0)

func _ready() -> void:
    _build_hands()
    _install_sculpted_gloves()

func _install_sculpted_gloves() -> void:
    # Authored PBR glove meshes are split out of the CC0 two-glove asset by
    # tools/split_authored_gloves.py during CI. The original procedural palms
    # and separate tube fingers are hidden. The only remaining construction
    # is the long fabric sleeve and wrist cuff behind each glove.
    var placements: Array[Dictionary] = [
        {
            "name": "AuthoredLeatherGloveLeft",
            "path": "res://assets/models/glove_left.glb",
            "wrist": left_wrist,
            "position": Vector3(0.036, 0.11, -0.196),
            "rotation": Vector3(-1.43, 0.18, -0.24),
            "scale": 1.06
        },
        {
            "name": "AuthoredLeatherGloveRight",
            "path": "res://assets/models/glove_right.glb",
            "wrist": right_wrist,
            "position": Vector3(-0.059, 0.115, -0.188),
            "rotation": Vector3(-1.49, -0.22, 0.25),
            "scale": 1.04
        }
    ]
    for definition in placements:
        var wrist: Node3D = definition["wrist"]
        var scene: PackedScene = load(str(definition["path"])) as PackedScene
        if scene == null:
            push_error("Missing external CC0 leather glove model: " + str(definition["path"]))
            continue
        # Retain only sleeves and cuffs behind the imported glove mesh.
        for original in wrist.get_children():
            if original is MeshInstance3D:
                var label := str(original.name)
                if not (label.contains("TailoredSleeve") or label.contains("SleeveCuff")):
                    original.visible = false
        var glove: Node3D = scene.instantiate() as Node3D
        glove.name = str(definition["name"])
        glove.position = definition["position"]
        glove.rotation = definition["rotation"]
        glove.scale = Vector3.ONE * float(definition["scale"])
        wrist.add_child(glove)
    print("ART_AUDIT: real CC0 leather glove meshes replace generated finger spheres")

func set_winding(value: bool) -> void:
    winding = value

func _process(delta: float) -> void:
    time_passed += delta
    var goal := 1.0 if winding else 0.0
    retrieve_blend = move_toward(retrieve_blend, goal, delta * 6.0)
    cast_lift = move_toward(cast_lift, 1.0 if casting else 0.0, delta * 4.5)
    if left_wrist != null:
        # Small elliptical motion around the real reel axis, not a detached
        # floating ball spinning independently of the rod.
        var crank := time_passed * 13.2
        left_wrist.position = Vector3(
            0.28 + sin(crank) * 0.025 * retrieve_blend,
            -0.70 + cos(crank) * 0.038 * retrieve_blend - (1.0 - retrieve_blend) * 0.09
                + cast_lift * 0.035 - line_load * 0.018,
            -1.17
        )
        left_wrist.rotation.z = sin(crank) * 0.16 * retrieve_blend
        left_wrist.rotation.x = -0.09 + cos(crank) * 0.095 * retrieve_blend
    if right_wrist != null:
        right_wrist.position.y = -0.57 + cast_lift * 0.044 + line_load * 0.023
        right_wrist.rotation.z = sin(time_passed * 1.2) * 0.006 + line_load * 0.029
        right_wrist.rotation.x = sin(time_passed * 1.6) * 0.005 - cast_lift * 0.10 - line_load * 0.025

func _mat(color: Color, roughness: float) -> StandardMaterial3D:
    var material := StandardMaterial3D.new()
    material.albedo_color = color
    material.roughness = roughness
    return material

func _loft(parent: Node3D, points: Array[Vector3], widths: Array[float], depths: Array[float], material: Material, label: String, ring_sides: int = 14) -> MeshInstance3D:
    # A single uninterrupted volume with variable elliptical cross-section.
    var st := SurfaceTool.new()
    st.begin(Mesh.PRIMITIVE_TRIANGLES)
    for segment in range(points.size() - 1):
        for edge in range(ring_sides):
            var angle_a := float(edge) * TAU / float(ring_sides)
            var angle_b := float(edge + 1) * TAU / float(ring_sides)
            var a := _point_on_ring(points, widths, depths, segment, angle_a)
            var b := _point_on_ring(points, widths, depths, segment, angle_b)
            var c := _point_on_ring(points, widths, depths, segment + 1, angle_a)
            var d := _point_on_ring(points, widths, depths, segment + 1, angle_b)
            _tri(st, a, c, b)
            _tri(st, b, c, d)
    # Close both ends to remove the hollow cylinder appearance.
    for edge in range(ring_sides):
        var angle_a := float(edge) * TAU / float(ring_sides)
        var angle_b := float(edge + 1) * TAU / float(ring_sides)
        _tri(st, points[0], _point_on_ring(points, widths, depths, 0, angle_b), _point_on_ring(points, widths, depths, 0, angle_a))
        var last := points.size() - 1
        _tri(st, points[last], _point_on_ring(points, widths, depths, last, angle_a), _point_on_ring(points, widths, depths, last, angle_b))
    st.generate_normals()
    var part := MeshInstance3D.new()
    part.name = label
    part.mesh = st.commit()
    part.material_override = material
    part.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    parent.add_child(part)
    return part

func _point_on_ring(points: Array[Vector3], widths: Array[float], depths: Array[float], index: int, angle: float) -> Vector3:
    var a := points[maxi(0, index - 1)]
    var b := points[mini(index + 1, points.size() - 1)]
    var tangent := (b - a).normalized()
    var cross_axis := tangent.cross(Vector3.UP).normalized()
    if cross_axis.length_squared() < 0.01:
        cross_axis = Vector3.RIGHT
    var other_axis := cross_axis.cross(tangent).normalized()
    return points[index] + cross_axis * cos(angle) * widths[index] + other_axis * sin(angle) * depths[index]

func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
    st.add_vertex(a)
    st.add_vertex(b)
    st.add_vertex(c)

func _finger(parent: Node3D, root: Vector3, destination: Vector3, thickness: float, material: Material, label: String, curvature: Vector3 = Vector3.ZERO) -> void:
    # Four curved cross sections form a continuous finger (no spherical joints).
    var path: Array[Vector3] = [
        root,
        root.lerp(destination, 0.35) + curvature * 0.72,
        root.lerp(destination, 0.72) + curvature,
        destination
    ]
    var radii: Array[float] = [thickness, thickness * 0.96, thickness * 0.78, thickness * 0.38]
    var deep: Array[float] = [thickness * 0.84, thickness * 0.76, thickness * 0.66, thickness * 0.30]
    _loft(parent, path, radii, deep, material, label, 10)

func _build_hands() -> void:
    var jacket := _mat(Color(0.20, 0.24, 0.25), 0.96)
    var jacket_dark := _mat(Color(0.17, 0.21, 0.23), 0.97)
    var suede := _mat(Color(0.25, 0.285, 0.245), 0.96)
    var suede_side := _mat(Color(0.18, 0.22, 0.20), 0.97)
    var knuckles := _mat(Color(0.29, 0.335, 0.29), 0.95)
    var reinforced := _mat(Color(0.23, 0.28, 0.26), 0.97)

    right_wrist = Node3D.new()
    right_wrist.name = "RightAnatomicalGrip3D"
    right_wrist.position = Vector3(0.66, -0.57, -1.12)
    add_child(right_wrist)
    var right_arm: Array[Vector3] = [
        Vector3(0.52, -0.56, 0.76),
        Vector3(0.39, -0.38, 0.54),
        Vector3(0.20, -0.19, 0.28),
        Vector3(0.095, -0.075, 0.075)
    ]
    _loft(right_wrist, right_arm, [0.218, 0.196, 0.144, 0.109], [0.173, 0.17, 0.123, 0.098], jacket, "RightTailoredSleeve3D")
    var right_cuff: Array[Vector3] = [
        Vector3(0.102, -0.086, 0.103),
        Vector3(0.083, -0.031, 0.004),
        Vector3(0.066, 0.004, -0.048)
    ]
    _loft(right_wrist, right_cuff, [0.120, 0.118, 0.108], [0.100, 0.097, 0.092], jacket_dark, "RightSleeveCuff3D")
    # Palm is a long, angled shape hugging the rod handle, not a sphere.
    var right_palm: Array[Vector3] = [
        Vector3(0.073, 0.003, -0.052),
        Vector3(0.016, 0.072, -0.157),
        Vector3(-0.033, 0.097, -0.266),
        Vector3(-0.073, 0.087, -0.309)
    ]
    _loft(right_wrist, right_palm, [0.107, 0.138, 0.116, 0.087], [0.081, 0.072, 0.065, 0.051], suede, "RightPalmAndKnuckles3D")
    # Fingers wrap down around the real carbon rod and cork handle.
    for index in range(4):
        var offset := (float(index) - 1.5) * 0.061
        var fingertip := Vector3(-0.162 + index * 0.015, -0.035, -0.336 + absf(offset) * 0.15)
        _finger(right_wrist,
            Vector3(-0.030 + offset, 0.115, -0.273),
            fingertip, 0.033, suede_side,
            "RightFinger%d3D" % index, Vector3(0.008, -0.030, -0.017))
    _finger(right_wrist, Vector3(0.137, 0.018, -0.152), Vector3(0.036, -0.014, -0.325), 0.053, suede, "RightOpposingThumb3D", Vector3(0.032, 0.047, -0.012))
    for i in range(3):
        _finger(right_wrist,
            Vector3(-0.077 + float(i) * 0.066, 0.137, -0.239),
            Vector3(-0.087 + float(i) * 0.066, 0.139, -0.265),
            0.017, knuckles, "RightKnucklePanel%d3D" % i)

    left_wrist = Node3D.new()
    left_wrist.name = "LeftReelSupport3D"
    left_wrist.position = Vector3(0.28, -0.79, -1.17)
    add_child(left_wrist)
    var left_arm: Array[Vector3] = [
        Vector3(-0.59, -0.52, 0.72),
        Vector3(-0.43, -0.34, 0.50),
        Vector3(-0.22, -0.20, 0.25),
        Vector3(-0.083, -0.067, 0.091)
    ]
    _loft(left_wrist, left_arm, [0.19, 0.166, 0.129, 0.097], [0.159, 0.146, 0.107, 0.084], jacket, "LeftTailoredSleeve3D")
    var left_cuff: Array[Vector3] = [
        Vector3(-0.097, -0.080, 0.116),
        Vector3(-0.055, -0.019, 0.016),
        Vector3(-0.006, 0.018, -0.043)
    ]
    _loft(left_wrist, left_cuff, [0.106, 0.115, 0.107], [0.090, 0.088, 0.087], jacket_dark, "LeftSleeveCuff3D")
    var left_palm: Array[Vector3] = [
        Vector3(-0.006, 0.018, -0.048),
        Vector3(0.067, 0.071, -0.122),
        Vector3(0.104, 0.072, -0.228),
        Vector3(0.126, 0.058, -0.268)
    ]
    _loft(left_wrist, left_palm, [0.098, 0.126, 0.110, 0.074], [0.08, 0.075, 0.065, 0.05], suede, "LeftPalmAndKnuckles3D")
    for index in range(4):
        var offset := (float(index) - 1.5) * 0.060
        _finger(left_wrist,
            Vector3(0.084 + offset, 0.084, -0.213),
            Vector3(0.156 + offset * 0.5, -0.008, -0.308),
            0.032, suede_side, "LeftFinger%d3D" % index, Vector3(0.025, 0.005, -0.016))
    _finger(left_wrist, Vector3(-0.028, 0.072, -0.128), Vector3(0.099, 0.003, -0.315), 0.051, suede, "LeftThumb3D", Vector3(0.038, 0.052, 0.002))
    # A short patch makes the palm readable at ordinary mobile sizes.
    var left_patch: Array[Vector3] = [
        Vector3(0.050, 0.133, -0.174),
        Vector3(0.092, 0.136, -0.224),
        Vector3(0.108, 0.117, -0.265)
    ]
    _loft(left_wrist, left_patch, [0.074, 0.081, 0.055], [0.015, 0.018, 0.011], reinforced, "LeftGripReinforcement3D", 12)
