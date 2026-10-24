extends Node
## Корневой поток игры: меню → бой → итоги.

var ui: CanvasLayer
var menu: MainMenu
var world: World
var hud: HUD
var overlay: Control
var pause_menu: PauseMenu
var _pending_levels = 0
var _cur_mission: Dictionary
var _fade: ColorRect

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var flow = false
	for a in OS.get_cmdline_user_args():
		if a == "--test=flow":
			flow = true
		elif a.begins_with("--test="):
			var t: Node = load("res://scripts/tests/test_runner.gd").new()
			add_child(t)
			t.run(a.substr(7))
			return
	G.apply_settings()
	ui = CanvasLayer.new()
	ui.layer = 10
	add_child(ui)
	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 1)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	UIK.full(_fade)
	var fl = CanvasLayer.new()
	fl.layer = 50
	add_child(fl)
	fl.add_child(_fade)
	open_menu()
	_fade_in()
	if flow:
		_autotest()

func _autotest() -> void:
	var t = get_tree()
	await t.create_timer(1.0).timeout
	print("FLOW menu ok: ", menu != null)
	menu.show_heroes(); await t.process_frame
	menu.show_missions(); await t.process_frame
	menu.show_crypt(); await t.process_frame
	menu.show_settings(); await t.process_frame
	print("FLOW screens ok")
	start_game(G.MISSIONS[0])
	await t.create_timer(2.0).timeout
	world.player.bot = true
	print("FLOW in game: ", world != null, " hud ", hud != null)
	world.add_xp(200)
	await t.create_timer(0.5).timeout
	print("FLOW perk overlay: ", overlay)
	if overlay is PerkPick:
		overlay._pick(0)
	await t.create_timer(1.0).timeout
	if overlay is PerkPick:
		overlay._pick(0)
	await t.create_timer(1.0).timeout
	print("FLOW perks: ", G.run.get("perks"), " paused=", t.paused)
	_pause(); await t.create_timer(0.3).timeout
	print("FLOW paused: ", t.paused, " menu ", pause_menu != null)
	pause_menu._open_settings(); await t.process_frame
	_resume(); await t.create_timer(0.5).timeout
	print("FLOW resumed: ", not t.paused)
	await t.create_timer(4.0).timeout
	world.win()
	await t.create_timer(3.5, true, false, true).timeout
	print("FLOW results: ", overlay is Results, " souls=", G.save.souls, " done=", G.save.missions_done)
	(overlay as Results).to_menu.emit()
	await t.create_timer(1.5, true, false, true).timeout
	print("FLOW back to menu: ", menu != null, " world=", world)
	start_game(G.ENDLESS)
	await t.create_timer(2.0).timeout
	world.player.hp = 0; world.player.take_hit({"dmg": 9999.0, "dir": Vector3(1, 0, 0), "kind": "slash", "src": null})
	await t.create_timer(4.0, true, false, true).timeout
	print("FLOW died results: ", overlay is Results)
	print("FLOW DONE")
	t.quit()

func _fade_in(t := 0.6) -> void:
	_fade.color.a = 1.0
	create_tween().set_ignore_time_scale(true).tween_property(_fade, "color:a", 0.0, t)

func _fade_out(cb: Callable, t := 0.4) -> void:
	var tw = create_tween().set_ignore_time_scale(true)
	tw.tween_property(_fade, "color:a", 1.0, t)
	tw.tween_callback(cb)

func _clear() -> void:
	get_tree().paused = false
	Engine.time_scale = 1.0
	for c in ui.get_children():
		c.queue_free()
	menu = null; hud = null; overlay = null; pause_menu = null
	if world:
		world.queue_free()
		world = null
		G.world = null

func open_menu() -> void:
	_clear()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	menu = MainMenu.new()
	ui.add_child(menu)
	menu.start_mission.connect(func(m): _fade_out(start_game.bind(m)))
	menu.quit_game.connect(func(): _fade_out(func(): get_tree().quit()))
	_set_cursor(false)
	if _fade.color.a > 0.01:
		_fade_in(0.5)

func start_game(m: Dictionary) -> void:
	_clear()
	_cur_mission = m
	_pending_levels = 0
	G.start_run(m)
	world = World.new()
	world.setup(m, false)
	add_child(world)
	world.process_mode = Node.PROCESS_MODE_PAUSABLE
	hud = HUD.new()
	ui.add_child(hud)
	hud.setup(world)
	world.level_up.connect(_on_level_up)
	world.finished.connect(_on_finished)
	Input.mouse_mode = Input.MOUSE_MODE_CONFINED
	_set_cursor(true)
	_fade_in(0.8)

func _set_cursor(battle: bool) -> void:
	if battle:
		Input.set_custom_mouse_cursor(load("res://assets/ui/cursor_cross.png"), Input.CURSOR_ARROW, Vector2(32, 32))
	else:
		var arr = load("res://assets/ui/cursor_arrow.png")
		Input.set_custom_mouse_cursor(arr, Input.CURSOR_ARROW, Vector2(2, 2))
		Input.set_custom_mouse_cursor(arr, Input.CURSOR_POINTING_HAND, Vector2(2, 2))

var _cross_tex: ImageTexture
func _crosshair() -> ImageTexture:
	if _cross_tex:
		return _cross_tex
	var s = 48
	var img = Image.create(s, s, false, Image.FORMAT_RGBA8)
	var c = Vector2(23.5, 23.5)
	for y in s:
		for x in s:
			var d = Vector2(x, y).distance_to(c)
			var a = 0.0
			if absf(d - 13.0) < 1.6:
				a = 1.0
			var ang = atan2(y - c.y, x - c.x)
			if absf(d - 13.0) < 1.6 and fmod(absf(ang) + 0.4, PI * 0.5) < 0.8:
				a = 0.0
			if d < 2.2:
				a = 1.0
			if a > 0.0:
				img.set_pixel(x, y, Color(0.95, 0.12, 0.08, a))
			elif absf(d - 13.0) < 3.0 or d < 3.6:
				img.set_pixel(x, y, Color(0, 0, 0, 0.6))
	_cross_tex = ImageTexture.create_from_image(img)
	return _cross_tex

func _input(e: InputEvent) -> void:
	if world == null or overlay != null:
		return
	if e.is_action_pressed("pause") and not world.game_over:
		get_viewport().set_input_as_handled()
		if pause_menu:
			_resume()
		else:
			_pause()

func _pause() -> void:
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_set_cursor(false)
	pause_menu = PauseMenu.new()
	ui.add_child(pause_menu)
	pause_menu.resume.connect(_resume)
	pause_menu.quit_run.connect(func():
		_resume()
		_finish_run(false, true))
	Sfx.ui("ui_back", -6.0)

func _resume() -> void:
	if pause_menu:
		pause_menu.queue_free()
		pause_menu = null
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CONFINED
	_set_cursor(true)

func _on_level_up() -> void:
	_pending_levels += 1
	if overlay == null:
		_show_perks.call_deferred()

func _show_perks() -> void:
	if _pending_levels <= 0 or world == null or world.game_over:
		return
	if G.available_perks().is_empty():
		_pending_levels = 0
		return
	_pending_levels -= 1
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_set_cursor(false)
	var pp = PerkPick.new()
	overlay = pp
	ui.add_child(pp)
	pp.picked.connect(func(id):
		world.apply_perk(id)
		overlay = null
		if _pending_levels > 0:
			_show_perks()
		else:
			get_tree().paused = false
			Input.mouse_mode = Input.MOUSE_MODE_CONFINED
			_set_cursor(true))

func _on_finished(victory: bool) -> void:
	_finish_run(victory, false)

func _finish_run(victory: bool, gave_up: bool) -> void:
	if overlay is Results:
		return
	var m = _cur_mission
	var souls = float(G.run.get("souls", 0))
	if victory:
		souls += float(m.get("souls", 0)) * (0.5 if G.save.missions_done.has(m.id) else 1.0)
		if not G.save.missions_done.has(m.id) and m.id != "endless":
			G.save.missions_done.append(m.id)
	elif gave_up:
		souls *= 0.5
	if m.id == "endless" and world and world.director:
		G.run["wave"] = world.director.wave
		G.save.best_endless = maxi(int(G.save.best_endless), int(world.director.wave))
	var reward = int(round(souls))
	G.save.souls = int(G.save.souls) + reward
	G.run["max_combo"] = maxi(int(G.run.get("max_combo", 0)), world.combo if world else 0)
	G.write_save()
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_set_cursor(false)
	if hud:
		hud.visible = false
	var r = Results.new()
	r.setup(victory, reward)
	overlay = r
	ui.add_child(r)
	Sfx.play_music("victory" if victory else "defeat")
	r.to_menu.connect(func(): _fade_out(open_menu))
	r.retry.connect(func(): _fade_out(start_game.bind(m)))

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and world and overlay == null and pause_menu == null and not world.game_over:
		_pause()
