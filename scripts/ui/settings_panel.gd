class_name SettingsPanel extends PanelContainer
## Настройки: графика, звук, игра, управление.

signal closed

var _body: VBoxContainer
var _tabs: HBoxContainer
var _tab = "gfx"
var _preset_btn: OptionButton

func _ready() -> void:
	theme = UIK.theme()
	custom_minimum_size = Vector2(900, 720)
	var v = UIK.vbox(14)
	add_child(v)
	var head = UIK.hbox(20)
	v.add_child(head)
	var t = UIK.label("НАСТРОЙКИ", 46, UIK.BONE, UIK.f_title)
	UIK.shadowed(t, 3)
	head.add_child(t)
	v.add_child(UIK.rule(860, UIK.BLOOD_D))
	_tabs = UIK.hbox(8)
	v.add_child(_tabs)
	for tb in [["gfx", "Графика"], ["snd", "Звук"], ["game", "Игра"], ["keys", "Управление"]]:
		var b = UIK.button(tb[1], _set_tab.bind(tb[0]), 200, 48)
		b.set_meta("tab", tb[0])
		_tabs.add_child(b)
	var sc = ScrollContainer.new()
	sc.custom_minimum_size = Vector2(860, 480)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(sc)
	_body = UIK.vbox(10)
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(_body)
	var foot = UIK.hbox(12)
	foot.alignment = BoxContainer.ALIGNMENT_END
	v.add_child(foot)
	foot.add_child(UIK.button("Готово", _close, 240, 54))
	_set_tab("gfx")

func _close() -> void:
	G.write_settings()
	closed.emit()

func _unhandled_input(e: InputEvent) -> void:
	if visible and e.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		_close()

func _set_tab(id: String) -> void:
	_tab = id
	for b in _tabs.get_children():
		var on = b.get_meta("tab") == id
		b.add_theme_color_override("font_color", UIK.BLOOD if on else UIK.BONE)
	for c in _body.get_children():
		c.queue_free()
	match id:
		"gfx":
			_preset_btn = _option("Качество графики", ["Низкое", "Среднее", "Высокое", "Ультра"], ["low", "medium", "high", "ultra"].find(String(G.settings.preset)), func(i):
				G.apply_preset(["low", "medium", "high", "ultra"][i]); G.apply_settings(); _set_tab.call_deferred("gfx"))
			_check("Полный экран", "fullscreen")
			_check("Вертикальная синхронизация", "vsync")
			_option("Ограничение FPS", ["Нет", "60", "120", "144"], [0, 60, 120, 144].find(int(G.settings.fps_cap)), func(i): _setv("fps_cap", [0, 60, 120, 144][i]))
			_slider("Масштаб рендера", "render_scale", 0.5, 1.0, 0.05, true)
			_check("FSR 2 (апскейл)", "fsr", true)
			_option("Тени", ["Низкие", "Средние", "Высокие", "Ультра"], int(G.settings.shadows), func(i): _setv("shadows", i, true))
			_option("Сглаживание MSAA", ["Выкл", "2x", "4x"], [0, 2, 4].find(int(G.settings.msaa)), func(i): _setv("msaa", [0, 2, 4][i], true))
			_check("FXAA", "fxaa", true)
			_check("Затенение SSAO", "ssao", true)
			_check("Непрямой свет SSIL", "ssil", true)
			_check("Объёмный туман", "volumetric", true)
			_check("Свечение", "glow", true)
		"snd":
			_slider("Общая громкость", "vol_master", 0, 1, 0.01)
			_slider("Музыка", "vol_music", 0, 1, 0.01)
			_slider("Эффекты", "vol_sfx", 0, 1, 0.01)
			var n = UIK.label("Свою музыку можно положить в папку «music» рядом с игрой (mp3 / ogg) — она заиграет в бою.", 19, UIK.ASH, UIK.f_body)
			n.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			n.custom_minimum_size.x = 820
			_body.add_child(n)
		"game":
			_option("Жестокость", ["Сдержанно", "Кровь", "Мясо"], int(G.settings.gore), func(i): _setv("gore", i))
			_slider("Тряска камеры", "shake", 0, 1.5, 0.05)
			_slider("Яркость", "brightness", 0.6, 1.6, 0.05)
			_check("Плёночное зерно", "grain")
			_check("Числа урона", "dmg_numbers")
		"keys":
			for row in [["WASD", "Движение"], ["ЛКМ", "Основная атака (держать)"], ["ПКМ", "Особый удар"], ["Пробел / Shift", "Рывок (неуязвимость)"],
				["Q", "Поднять мёртвых рядом"], ["E", "Взорвать труп под курсором"], ["F", "Казнь сломленного врага"], ["R", "Жатва — ярость армии и героя"],
				["C / колесо", "Армия: атаковать точку / ко мне"], ["Колесо", "Приблизить / отдалить"], ["Esc", "Пауза"]]:
				var h = UIK.hbox(20)
				var k = UIK.label(row[0], 22, UIK.GOLD, UIK.f_bold)
				k.custom_minimum_size.x = 240
				h.add_child(k)
				h.add_child(UIK.label(row[1], 22, UIK.BONE, UIK.f_body))
				_body.add_child(h)

func _row(title: String) -> HBoxContainer:
	var h = UIK.hbox(16)
	var l = UIK.label(title, 22, UIK.BONE, UIK.f_body)
	l.custom_minimum_size.x = 420
	h.add_child(l)
	_body.add_child(h)
	return h

func _setv(k: String, v, custom := false) -> void:
	G.settings[k] = v
	if custom:
		G.settings.preset = "custom"
	G.apply_settings()

func _check(title: String, key: String, custom := false) -> void:
	var h = _row(title)
	var c = CheckBox.new()
	c.button_pressed = bool(G.settings[key])
	c.focus_mode = Control.FOCUS_NONE
	c.toggled.connect(func(on): Sfx.ui("ui_click", -8.0); _setv(key, on, custom))
	h.add_child(c)

func _slider(title: String, key: String, mn: float, mx: float, st: float, custom := false) -> void:
	var h = _row(title)
	var s = HSlider.new()
	s.min_value = mn; s.max_value = mx; s.step = st
	s.value = float(G.settings[key])
	s.custom_minimum_size = Vector2(300, 30)
	s.focus_mode = Control.FOCUS_NONE
	h.add_child(s)
	var vl = UIK.label("%d%%" % roundi(s.value * 100), 20, UIK.ASH, UIK.f_body)
	vl.custom_minimum_size.x = 70
	h.add_child(vl)
	s.value_changed.connect(func(v):
		vl.text = "%d%%" % roundi(v * 100)
		G.settings[key] = v
		if custom:
			G.settings.preset = "custom"
		if key.begins_with("vol_"):
			G._apply_volumes()
		elif key == "render_scale":
			G.apply_settings()
		else:
			G.settings_changed.emit())
	s.drag_ended.connect(func(_c): if key == "vol_sfx": Sfx.ui("ui_ok", 0.0))

func _option(title: String, items: Array, sel: int, cb: Callable) -> OptionButton:
	var h = _row(title)
	var o = OptionButton.new()
	o.focus_mode = Control.FOCUS_NONE
	o.custom_minimum_size = Vector2(300, 44)
	for i in items.size():
		o.add_item(items[i], i)
	o.selected = sel
	o.item_selected.connect(func(i): Sfx.ui("ui_click", -6.0); cb.call(i))
	h.add_child(o)
	return o
