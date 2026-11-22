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
    var vegetation: Node = game.shore_art.get_node_or_null("SculptedVegetation3D")
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
    # The far bank must be actual rendered geometry, not a background photo.
    var bank: Node = game.shore_art.get_node_or_null("PhysicalFarShore3D")
    if bank == null:
        push_error("START_SCENE_FAIL: no physical 3D far shore")
        quit(1)
        return
    for mesh_name in ["PhysicalFarShoreTerrain", "InstancedVolumetricConifers", "FarShoreRocks3D"]:
        var shape: Node = bank.get_node_or_null(mesh_name)
        if shape == null:
            push_error("START_SCENE_FAIL: missing 3D far-bank object " + mesh_name)
            quit(1)
            return
        if shape is MeshInstance3D and (shape as MeshInstance3D).mesh == null:
            push_error("START_SCENE_FAIL: empty far-bank terrain")
            quit(1)
            return
        if shape is MultiMeshInstance3D and (shape as MultiMeshInstance3D).multimesh == null:
            push_error("START_SCENE_FAIL: empty far-bank multi-mesh")
            quit(1)
            return
    print("START_TRACE: physical far shore and 3D tree meshes validated")
    if game.reel_crank == null or game.reel_crank.name != "AnimatedReelHandle3D" or game.reel_crank.get_child_count() < 2:
        push_error("START_SCENE_FAIL: missing animated reel handle")
        quit(1)
        return
    print("START_TRACE: animated reel handle and attached grip validated")
    var model: Node3D = game.rod_root.get_node_or_null("AuthoredPBRFishingRod") as Node3D
    var hold: Node3D = game.hands.get_node_or_null("RightAnatomicalGrip3D") as Node3D
    if model == null or hold == null:
        push_error("START_SCENE_FAIL: authentic rod or hand rig missing")
        quit(1)
        return
    var sleeve: MeshInstance3D = hold.get_node_or_null("RightTailoredSleeve3D") as MeshInstance3D
    if sleeve == null or not sleeve.visible:
        push_error("START_SCENE_FAIL: first-person glove is severed from the sleeve")
        quit(1)
        return
    # Spatial contact, not just presence of meshes: the imported PBR rod
    # cork must actually rest in the sculpted glove at camera distance.
    var cork_position: Vector3 = model.to_global(Vector3(-0.948, 0.0, 0.0))
    var glove_position: Vector3 = hold.to_global(Vector3(-0.059, 0.115, -0.188))
    var grip_gap := cork_position.distance_to(glove_position)
    if grip_gap > 0.24:
        push_error("START_SCENE_FAIL: disconnected first-person rod grip, gap=" + str(grip_gap))
        quit(1)
        return
    print("START_TRACE: external rod and glove connected in 3D, gap=%.3f m" % grip_gap)

    var right_glove: Node = game.hands.get_node_or_null("RightAnatomicalGrip3D")
    var left_glove: Node = game.hands.get_node_or_null("LeftReelSupport3D")
    if right_glove == null or left_glove == null:
        push_error("START_SCENE_FAIL: the two articulated 3D hands are not loaded")
        quit(1)
        return
    if right_glove.get_child_count() < 8 or left_glove.get_child_count() < 8:
        push_error("START_SCENE_FAIL: anatomical gloves missing finger geometry")
        quit(1)
        return
    if vegetation.get_node_or_null("RootedLilyStems3D") == null:
        push_error("START_SCENE_FAIL: lily pads have no stems in lakebed")
        quit(1)
        return
    var right_asset: Node = right_glove.get_node_or_null("AuthoredLeatherGloveRight")
    var left_asset: Node = left_glove.get_node_or_null("AuthoredLeatherGloveLeft")
    if right_asset == null or left_asset == null:
        push_error("START_SCENE_FAIL: procedural fingers were not replaced with authored CC0 glove GLBs")
        quit(1)
        return
    if right_asset.get_child_count() == 0 or left_asset.get_child_count() == 0:
        push_error("START_SCENE_FAIL: authored gloves missing sculpted mesh geometry")
        quit(1)
        return
    var rod_asset: Node = game.rod_root.get_node_or_null("AuthoredPBRFishingRod")
    if rod_asset == null or rod_asset.get_child_count() == 0:
        push_error("START_SCENE_FAIL: old primitive spinning rod still active")
        quit(1)
        return
    if bank.get_node_or_null("AuthoredNorwaySpruceForest") == null:
        push_error("START_SCENE_FAIL: PBR conifer vegetation missing from distant forest")
        quit(1)
        return
    var near_tree_count := 0
    for tree_child in game.shore_art.get_children():
        if str(tree_child.name).begins_with("AuthoredNearTree"):
            near_tree_count += 1
    if near_tree_count < 30:
        push_error("START_SCENE_FAIL: near-bank procedural forest wasn't replaced")
        quit(1)
        return
    print("START_TRACE: authored PBR rod, leather gloves, pine and spruce meshes loaded")
    print("START_TRACE: entering fishing session")
    game.start_game()
    for i in range(8):
        await process_frame
    if game.action_button == null or game.action_button.name != "ActionCircle":
        push_error("START_SCENE_FAIL: mobile HUD primary round action missing")
        quit(1)
        return
    if game.action_button.size.x > 118.0 or game.action_button.size.y > 118.0:
        push_error("START_SCENE_FAIL: oversized control tile returned")
        quit(1)
        return
    if game.minimap.size.x > 192.0 or game.minimap.size.y > 192.0:
        push_error("START_SCENE_FAIL: radar is covering too much gameplay")
        quit(1)
        return
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
