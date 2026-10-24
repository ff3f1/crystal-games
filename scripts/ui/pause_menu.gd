class_name PauseMenu extends Control

signal resume
signal quit_run

var _main: Control
var _settings: SettingsPanel

func _ready() -> void:
	theme = UIK.theme()
	UIK.full(self)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(UIK.dim(0.7))
	_main = UIK.vbox(8)
	UIK.pin(_main, 0, 0.5, 160, -260)
	add_child(_main)
	var t = UIK.label("ПАУЗА", 96, UIK.BLOOD, UIK.f_logo)
	UIK.shadowed(t, 5)
	_main.add_child(t)
	var m = G.mission
	var sub = UIK.label("%s  ·  волна %d  ·  %d убито" % [String(m.get("title", "")), maxi(1, int(G.world.director.wave + 1) if G.world and G.world.director else 1), int(G.run.get("kills", 0))], 22, UIK.ASH, UIK.f_body)
	_main.add_child(sub)
	_main.add_child(UIK.spacer(24))
	_main.add_child(UIK.menu_item("Продолжить", func(): resume.emit()))
	_main.add_child(UIK.menu_item("Настройки", _open_settings))
	_main.add_child(UIK.menu_item("Сдаться", func(): quit_run.emit(), "Души за этот бой сохранятся наполовину"))
	_main.add_child(UIK.spacer(30))
	# дары
	var perks: Dictionary = G.run.get("perks", {})
	if perks.size() > 0:
		var pl = UIK.label("ДАРЫ", 22, UIK.GOLD, UIK.f_bold)
		_main.add_child(pl)
		var flow = HFlowContainer.new()
		flow.custom_minimum_size.x = 640
		flow.add_theme_constant_override("h_separation", 8)
		_main.add_child(flow)
		for p in G.PERKS:
			if perks.has(p.id):
				var ic = UIK.icon(String(p.icon), 52)
				ic.tooltip_text = "%s (%d)\n%s" % [p.name, perks[p.id], p.desc]
				ic.mouse_filter = Control.MOUSE_FILTER_PASS
				flow.add_child(ic)

func _open_settings() -> void:
	_main.visible = false
	_settings = SettingsPanel.new()
	_settings.set_anchors_preset(Control.PRESET_CENTER)
	add_child(_settings)
	UIK.pin(_settings, 0.5, 0.5, -450, -370)
	_settings.closed.connect(func(): _settings.queue_free(); _settings = null; _main.visible = true)

func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("pause") and _settings == null:
		get_viewport().set_input_as_handled()
		resume.emit()
