extends SceneTree
## QA only: render the actual populated underwater scene with real fish meshes.
## This is not an illustrative mock-up; it uses the same lake and agents as APK.
func _initialize() -> void:
    call_deferred("_render")

func _render() -> void:
    var packed := load("res://scenes/main.tscn") as PackedScene
    var game := packed.instantiate()
    root.add_child(game)
    current_scene = game
    for i in range(8):
        await process_frame
    game.start_game()
    # A view from the actual near shore, toward the vegetated carp bed.
    game.camera.position = Vector3(-8.0, 1.72, 4.85)
    game.camera.look_at(Vector3(-8.0, -0.72, -17.0), Vector3.UP)
    for i in range(15):
        await process_frame
    _save("fish-from-shore-preview.png")
    # Physically move the inspection camera into the lake for fish QA.
    # It shows whether the fish and lakebed actually exist under the surface.
    game.camera.position = Vector3(-8.3, -1.04, -11.9)
    game.camera.look_at(Vector3(-8.1, -1.01, -18.0), Vector3.UP)
    for i in range(18):
        await process_frame
    _save("real-underwater-fish-preview.png")
    print("FISH_SCENE_CAPTURE_OK: real rendered fish and lakebed")
    quit(0)

func _save(name: String) -> void:
    var img: Image = root.get_texture().get_image()
    var error := img.save_png("res://build/" + name)
    if error != OK:
        push_error("Failed fish QA screenshot: " + name)
    else:
        print("Captured physical fish QA: ", name, " (", img.get_width(), "x", img.get_height(), ")")
