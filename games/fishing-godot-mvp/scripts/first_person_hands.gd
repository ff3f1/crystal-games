extends Node3D
## CC0 WRAD articulated hand meshes, replacing all old spheres/cylinders.
## Rig source https://github.com/wwwriks/wrad-arms (CC0), downloaded at build time.
## This node is purely visual: game rod/line/fish physics remain authoritative.

var arms: Node3D
var elapsed := 0.0
var winding := false
var idle_position := Vector3.ZERO

func _ready() -> void:
    var packed := load("res://assets/models/fps_arms.glb") as PackedScene
    if packed == null:
        push_error("Required CC0 first-person rig is missing")
        return
    arms = packed.instantiate() as Node3D
    add_child(arms)

    # The source model is rigged for first-person viewing. Keep its bone hierarchy
    # and actual finger meshes, but adapt it to our camera viewport automatically.
    # The extents are derived from imported local meshes, not made-up spheres.
    var bounds := _mesh_bounds(arms)
    var max_span := maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
    var model_scale := clampf(1.48 / maxf(max_span, 0.01), 0.10, 3.1)
    arms.scale = Vector3.ONE * model_scale
    var centre := bounds.position + bounds.size * 0.5
    arms.position = Vector3(0.18, -0.24, -1.05) - centre * model_scale
    print("FPS_ARMS_ASSET: source bounds=", bounds, ", fit=", model_scale, ", local offset=", arms.position)
    idle_position = arms.position
    arms.rotation_degrees = Vector3(-6.0, -10.0, 5.0)

    var glove_texture := load("res://assets/textures/fps_arm_albedo.png") as Texture2D
    var cloth_texture := load("res://assets/textures/glove_weave.png") as Texture2D
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color(0.60, 0.68, 0.73)
    mat.albedo_texture = glove_texture if glove_texture != null else cloth_texture
    mat.roughness = 0.87
    mat.metallic = 0.0
    mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    _override_meshes(arms, mat)

func set_winding(value: bool) -> void:
    winding = value

func _process(delta: float) -> void:
    elapsed += delta
    if arms != null:
        var reel_factor := 1.0 if winding else 0.0
        var target := idle_position
        target.y += sin(elapsed * 13.0) * reel_factor * 0.035
        target.x += cos(elapsed * 13.0) * reel_factor * 0.019
        arms.position = arms.position.lerp(target, minf(1.0, delta * 9.0))
        arms.rotation.z = deg_to_rad(5.0) + sin(elapsed * 13.0) * reel_factor * 0.028
        arms.rotation.x = deg_to_rad(-6.0) + sin(elapsed * 1.5) * 0.005

func _mesh_bounds(root: Node3D) -> AABB:
    var parts: Array[MeshInstance3D] = []
    _collect(root, parts)
    if parts.is_empty():
        push_error("FPS arms glTF contained no MeshInstance3D geometry")
        return AABB(Vector3(-0.5, -0.5, -0.5), Vector3.ONE)
    var to_root := root.global_transform.affine_inverse()
    var low := Vector3(INF, INF, INF)
    var high := Vector3(-INF, -INF, -INF)
    for part in parts:
        if part.mesh == null:
            continue
        var box := part.mesh.get_aabb()
        var t := to_root * part.global_transform
        for xi in range(2):
            for yi in range(2):
                for zi in range(2):
                    var corner := box.position + Vector3(
                        box.size.x * float(xi),
                        box.size.y * float(yi),
                        box.size.z * float(zi)
                    )
                    var point := t * corner
                    low = low.min(point)
                    high = high.max(point)
    return AABB(low, high - low)

func _collect(node: Node, parts: Array[MeshInstance3D]) -> void:
    if node is MeshInstance3D:
        parts.append(node as MeshInstance3D)
    for child in node.get_children():
        _collect(child, parts)

func _override_meshes(node: Node, material: Material) -> void:
    if node is MeshInstance3D:
        var part := node as MeshInstance3D
        part.material_override = material
        part.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    for child in node.get_children():
        _override_meshes(child, material)
