extends Control
## Live underwater lure camera. Renders the exact same lake World3D in a
## low-resolution inset; the fish in this image are genuine simulated agents.
## Throttles updates to 8 FPS to protect Android battery and GPU memory.

var camera: Camera3D
var viewport: SubViewport
var image: TextureRect
var caption: Label
var clock := 0.0
var last_position := Vector3.ZERO

func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    var background := Panel.new()
    background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    background.mouse_filter = Control.MOUSE_FILTER_IGNORE
    var frame := StyleBoxFlat.new()
    frame.bg_color = Color(0.025, 0.083, 0.087, 0.87)
    frame.border_color = Color(0.43, 0.69, 0.67, 0.50)
    frame.set_border_width_all(2)
    frame.set_corner_radius_all(9)
    background.add_theme_stylebox_override("panel", frame)
    add_child(background)

    viewport = SubViewport.new()
    viewport.size = Vector2i(320, 180)
    viewport.world_3d = get_viewport().world_3d
    viewport.render_target_clear_mode = SubViewport.CLEAR_MODE_ALWAYS
    viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
    viewport.handle_input_locally = false
    add_child(viewport)

    camera = Camera3D.new()
    camera.fov = 68.0
    camera.near = 0.05
    camera.far = 22.0
    viewport.add_child(camera)
    camera.current = true

    image = TextureRect.new()
    image.texture = viewport.get_texture()
    image.mouse_filter = Control.MOUSE_FILTER_IGNORE
    image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
    image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    image.offset_left = 3.0
    image.offset_right = -3.0
    image.offset_top = 24.0
    image.offset_bottom = -3.0
    add_child(image)

    caption = Label.new()
    caption.text = "ПОД ВОДОЙ  •  ЖИВАЯ ПРИМАНКА"
    caption.add_theme_font_size_override("font_size", 15)
    caption.add_theme_color_override("font_color", Color(0.83, 0.94, 0.87))
    caption.position = Vector2(9, 2)
    add_child(caption)
    visible = false

func update_bait_view(delta: float, active: bool, bait: Vector3, player: Vector3) -> void:
    if not active:
        visible = false
        if viewport != null:
            viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
        return
    visible = true
    clock += minf(delta, 0.25)
    if clock < 0.125 and bait.distance_to(last_position) < 1.7:
        return
    clock = 0.0
    last_position = bait
    var target := Vector3(bait.x, minf(-0.42, bait.y), bait.z)
    # Film from a realistic observation distance beside the rig, pointed at
    # the real underwater hook. The player's rod is not in this camera.
    var dir := player - target
    dir.y = 0.0
    if dir.length() < 0.1:
        dir = Vector3(0.0, 0.0, 1.0)
    dir = dir.normalized()
    camera.position = target + dir * 2.4 + Vector3(1.15, -0.15, 0.0)
    camera.look_at(target + Vector3(0, -0.10, 0), Vector3.UP)
    viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
