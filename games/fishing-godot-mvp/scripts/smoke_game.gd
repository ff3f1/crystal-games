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
    game.fight_distance = 3.0
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
    print("FISHING_MVP_SMOKE_OK: menu / casting / landed trophy / journal / settings / pause")
    quit(0)

func _require(ok: bool, label: String) -> void:
    if not ok:
        push_error("FISHING_MVP_SMOKE_FAIL: " + label)
        quit(1)
