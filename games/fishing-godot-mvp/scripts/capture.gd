extends SceneTree
# Captures a real Godot frame on the CI software renderer, not a mock-up.
func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var scene := load("res://scenes/main.tscn") as PackedScene
    var instance := scene.instantiate()
    root.add_child(instance)
    current_scene = instance
    # Allow resources, particles, sky and water shader to render.
    for i in range(15):
        await process_frame
    await create_timer(0.8).timeout
    var img: Image = root.get_texture().get_image()
    img.save_png("res://build/scene-preview.png")
    print("Preview captured: ", img.get_width(), "x", img.get_height())
    quit()
