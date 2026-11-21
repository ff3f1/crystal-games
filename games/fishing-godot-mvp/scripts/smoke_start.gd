extends SceneTree
## Explicitly clean a loaded 3D scene before quitting, avoiding the engine's
## --quit-after renderer teardown warning which isn't a gameplay failure.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var scene := load("res://scenes/main.tscn") as PackedScene
    var game := scene.instantiate()
    root.add_child(game)
    current_scene = game
    for i in range(8):
        await process_frame
    if not game.menu_open or game.overlay.screen_name != "home":
        push_error("START_SCENE_FAIL: home menu did not initialize")
        quit(1)
        return
    game.start_game()
    for i in range(8):
        await process_frame
    if game.minimap == null or not game.hud_layer.visible:
        push_error("START_SCENE_FAIL: minimap or fishing HUD missing")
        quit(1)
        return
    game.exit_to_menu()
    current_scene = null
    root.remove_child(game)
    game.queue_free()
    for i in range(4):
        await process_frame
    print("FISHING_START_OK: scene loaded, minimap shown and game closed cleanly")
    quit(0)
