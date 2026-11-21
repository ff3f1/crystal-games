extends SceneTree
# Real frames rendered by Godot, for visual QA of menu, gameplay, settings.
func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var scene := load("res://scenes/main.tscn") as PackedScene
    var game := scene.instantiate()
    root.add_child(game)
    current_scene = game
    for i in range(22):
        await process_frame
    await create_timer(0.45).timeout
    _save("scene-preview.png")
    game.start_game()
    for i in range(12):
        await process_frame
    _save("gameplay-preview.png")
    game._cast()
    game._process(1.42)
    for i in range(15):
        await process_frame
    _save("lure-minimap-preview.png")
    game.open_pause()
    game.overlay.show_settings("pause")
    for i in range(12):
        await process_frame
    _save("settings-preview.png")
    game.overlay.show_journal()
    for i in range(12):
        await process_frame
    _save("journal-preview.png")
    quit()

func _save(name: String) -> void:
    var img := root.get_texture().get_image()
    var dest := "res://build/" + name
    var err := img.save_png(dest)
    print("Rendered QA frame: ", dest, " ", img.get_width(), "x", img.get_height(), " status=", err)
