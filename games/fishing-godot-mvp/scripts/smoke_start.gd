extends SceneTree
## Explicitly clean a loaded 3D scene before quitting, avoiding the engine's
## --quit-after renderer teardown warning which isn't a gameplay failure.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    print("START_TRACE: loading scene")
    var scene := load("res://scenes/main.tscn") as PackedScene
    print("START_TRACE: instantiating scene")
    var game := scene.instantiate()
    print("START_TRACE: adding Godot game to tree")
    root.add_child(game)
    print("START_TRACE: first scene tree ready")
    current_scene = game
    for i in range(8):
        await process_frame
    if not game.menu_open or game.overlay.screen_name != "home":
        push_error("START_SCENE_FAIL: home menu did not initialize")
        quit(1)
        return
    # Guard against regressions to flat cards and sphere-only bait:
    # these nodes must be real Godot 3D mesh surfaces in the rendered world.
    var vegetation := game.shore_art.get_node_or_null("SculptedVegetation3D")
    if vegetation == null:
        push_error("START_SCENE_FAIL: sculpted 3D lake vegetation missing")
        quit(1)
        return
    for mesh_name in ["SolidReeds3D", "ThickLilyPads3D", "WaterLilyFlowers3D", "SubmergedStems3D"]:
        var plant := vegetation.get_node_or_null(mesh_name) as MeshInstance3D
        if plant == null or plant.mesh == null or plant.mesh.get_surface_count() == 0:
            push_error("START_SCENE_FAIL: missing native 3D mesh " + mesh_name)
            quit(1)
            return
    if game.bait_underwater == null or game.bait_underwater.name != "SculptedSpoon3D" or game.bait_underwater.get_child_count() < 3:
        push_error("START_SCENE_FAIL: imported game must have a curved spoon and metal hooks")
        quit(1)
        return
    if game.worm_hook == null or game.worm_hook.name != "SculptedWorm3D" or game.worm_hook.get_child_count() < 5:
        push_error("START_SCENE_FAIL: curved worm and real hook mesh missing")
        quit(1)
        return
    print("START_TRACE: validated batched 3D vegetation and modeled tackle")
    print("START_TRACE: entering fishing session")
    game.start_game()
    for i in range(8):
        await process_frame
    if game.minimap == null or not game.hud_layer.visible:
        push_error("START_SCENE_FAIL: minimap or fishing HUD missing")
        quit(1)
        return
    print("START_TRACE: returning to home and cleaning")
    game.exit_to_menu()
    current_scene = null
    root.remove_child(game)
    game.queue_free()
    for i in range(4):
        await process_frame
    print("FISHING_START_OK: scene loaded, minimap shown and game closed cleanly")
    quit(0)
