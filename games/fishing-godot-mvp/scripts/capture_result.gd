extends SceneTree
# Generate a real in-game frame of the 3D trophy scene for visual quality inspection.
func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var scene := load("res://scenes/main.tscn") as PackedScene
    var game := scene.instantiate()
    root.add_child(game)
    current_scene = game
    await process_frame
    game.start_game()
    game.fish_name = "Щука"
    game.fish_weight = 3.24
    game._set_fish_model("Щука")
    game._finish("Трофей: Щука, 3.24 кг!", true)
    for i in range(25):
        await process_frame
    await create_timer(0.7).timeout
    var img: Image = root.get_texture().get_image()
    var err := img.save_png("res://build/trophy-preview.png")
    print("Trophy preview exported: ", img.get_width(), "x", img.get_height(), " status=", err)
    quit(0 if err == OK else 1)
