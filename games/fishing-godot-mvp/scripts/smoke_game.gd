extends SceneTree
## Headless functional smoke test: menu -> fishing -> landing -> trophy -> journal.
func _initialize() -> void:
    call_deferred("_run_test")

func _run_test() -> void:
    var scene := load("res://scenes/main.tscn") as PackedScene
    var game := scene.instantiate()
    root.add_child(game)
    current_scene = game
    await process_frame
    _require(game.menu_open, "Main menu should be visible on first launch")
    _require(game.overlay.screen_name == "home", "First page must be home")
    game.start_game()
    _require(not game.menu_open and game.session_started, "Start should enter game")
    _require(game.hud_layer.visible, "Fishing HUD should be visible")
    game._choose_fish()
    game.fish_name = "Щука"
    game.fish_weight = 2.45
    game._set_fish_model("Щука")
    game.phase = 4  # FIGHT
    game.fight_sim.begin("Щука", 2.45, 16.0)
    game.fight_sim.distance = 2.45
    game.fight_distance = 2.45
    game.tension = 23.0
    game.is_reeling = true
    game._update_fight(0.15)
    _require(game.phase == 5, "Fish close to shore should start landing")
    game._process(1.60)
    _require(game.phase == 6, "Landing should complete with RESULT")
    _require(game.menu_open, "Trophy view should pause the world")
    _require(game.overlay.screen_name == "result", "Trophy page should be visible")
    _require(game.catches.size() > 0, "Caught fish must be in the journal")
    game.retry_cast()
    _require(not game.menu_open, "Retry should resume gameplay")
    # Drive a real cast into the vegetated bay. The strike is produced by
    # the fish ecology, never the old fixed timer.
    game.lure_sim.destination = Vector3(-8.0, 0.075, -18.0)
    game.ecology.rng.seed = 71352
    game._process(1.35)
    _require(game.phase == 2, "Cast should reach WAITING")
    _require(game.minimap != null, "Sonar minimap should be available during fishing")
    _require(game.lure_sim.is_landed, "Lure physical landing must be reflected in sonar")
    var saw_nibble := false
    for i in range(1500):
        game._process(0.1)
        if game.bite_sign_age < 0.12:
            saw_nibble = true
        if game.phase == 3:
            break
    _require(saw_nibble, "Real nibble must precede the hookable strike")
    _require(game.phase == 3, "Well-placed bait should eventually cause an ecological strike")
    _require(game.fish_name == "Карась" or game.fish_name == "Окунь", "Fish must respect bait diet")
    game._main_action()
    _require(game.phase == 4, "Hook action should start the fight")
    _require(game.fight_sim.distance >= 15.0, "Fish fight should begin at a grounded distance")
    _require(game.fight_sim.drag_level == 1, "Default drag should be balanced")
    for tick in range(850):
        game.is_reeling = game.tension < 73.0
        game.is_bracing = false
        game._update_fight(0.10)
        if game.phase == 5:
            break
    _require(game.phase == 5, "A sensible reel/release rhythm should land a fish")
    game._process(1.6)
    _require(game.phase == 6, "Natural catch should show the result screen")
    _require(game.catches.size() >= 2, "Natural catch should save another fish")
    game.retry_cast()
    game.open_pause()
    _require(game.overlay.screen_name == "pause", "Pause menu should open")
    game.overlay.show_settings("pause")
    _require(game.overlay.screen_name == "settings", "Settings should open")
    game.set_preference("sensitivity", 1.45)
    _require(is_equal_approx(float(game.profile["sensitivity"]), 1.45), "Sensitivity should update")
    game.overlay.show_journal()
    _require(game.overlay.screen_name == "journal", "Journal should open")
    game.exit_to_menu()
    _require(game.overlay.screen_name == "home", "Return to main menu should work")
    current_scene = null
    root.remove_child(game)
    game.queue_free()
    for i in range(4):
        await process_frame
    print("FISHING_MVP_SMOKE_OK: menu / real cast / reel-and-release / landed trophy / journal / settings / pause")
    quit(0)

func _require(ok: bool, label: String) -> void:
    if not ok:
        push_error("FISHING_MVP_SMOKE_FAIL: " + label)
        quit(1)
