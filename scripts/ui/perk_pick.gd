class_name PerkPick extends Control
## Выбор дара при повышении уровня.

signal picked(id: String)

var choices: Array = []
var _cards: Array = []
var _done = false

func _ready() -> void:
	theme = UIK.theme()
	UIK.full(self)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(UIK.dim(0.62))
	var pool = G.available_perks()
	pool.shuffle()
	choices = pool.slice(0, 3)
	var v = UIK.vbox(26)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	UIK.full(v)
	add_child(v)
	var t = UIK.label("УРОВЕНЬ %d" % int(G.run.get("level", 1)), 30, UIK.GOLD, UIK.f_bold, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(t, 2)
	v.add_child(t)
	var t2 = UIK.label("ВЫБЕРИ ДАР ТЬМЫ", 64, UIK.BONE, UIK.f_title, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(t2, 4)
	v.add_child(t2)
	var row = UIK.hbox(34)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(row)
	for i in choices.size():
		row.add_child(_card(choices[i], i))
	var hint = UIK.label("Клавиши 1 — %d или клик" % choices.size(), 20, UIK.ASH, UIK.f_body, HORIZONTAL_ALIGNMENT_CENTER)
	v.add_child(hint)
	modulate.a = 0.0
	create_tween().set_ignore_time_scale(true).tween_property(self, "modulate:a", 1.0, 0.18)
	Sfx.ui("levelup", -2.0)

func _card(p: Dictionary, i: int) -> Control:
	var c = PanelContainer.new()
	c.custom_minimum_size = Vector2(340, 470)
	c.add_theme_stylebox_override("panel", UIK.sb(Color(0.05, 0.04, 0.04, 0.95), Color(0.35, 0.3, 0.28), 2, 0, 22))
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UIK.vbox(14)
	v.alignment = BoxContainer.ALIGNMENT_BEGIN
	c.add_child(v)
	var key = UIK.label(str(i + 1), 22, UIK.DIM, UIK.f_bold)
	v.add_child(key)
	var ic = UIK.icon(String(p.get("icon", "ab_curse")), 170)
	ic.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(ic)
	var n = UIK.label(String(p.name).to_upper(), 30, UIK.BONE, UIK.f_bold, HORIZONTAL_ALIGNMENT_CENTER)
	n.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	n.custom_minimum_size.x = 296
	v.add_child(n)
	var lvl = G.perk_level(p.id)
	var pips = UIK.label("◆".repeat(lvl + 1) + "◇".repeat(maxi(0, int(p.max) - lvl - 1)), 18, UIK.BLOOD, UIK.f_body, HORIZONTAL_ALIGNMENT_CENTER)
	v.add_child(pips)
	var d = UIK.label(String(p.desc), 22, UIK.ASH, UIK.f_body, HORIZONTAL_ALIGNMENT_CENTER)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size.x = 296
	v.add_child(d)
	c.mouse_entered.connect(func():
		Sfx.ui("ui_tick", -10.0)
		c.add_theme_stylebox_override("panel", UIK.sb(Color(0.14, 0.02, 0.02, 0.97), UIK.BLOOD, 3, 0, 22))
		c.create_tween().set_ignore_time_scale(true).tween_property(c, "position:y", -10.0, 0.1).as_relative())
	c.mouse_exited.connect(func():
		c.add_theme_stylebox_override("panel", UIK.sb(Color(0.05, 0.04, 0.04, 0.95), Color(0.35, 0.3, 0.28), 2, 0, 22))
		c.create_tween().set_ignore_time_scale(true).tween_property(c, "position:y", 10.0, 0.1).as_relative())
	c.gui_input.connect(func(e):
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			_pick(i))
	_cards.append(c)
	return c

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		var k = e.physical_keycode
		if k >= KEY_1 and k <= KEY_3:
			var i = k - KEY_1
			if i < choices.size():
				get_viewport().set_input_as_handled()
				_pick(i)

func _pick(i: int) -> void:
	if _done:
		return
	_done = true
	Sfx.ui("ui_ok", 0.0)
	var id = String(choices[i].id)
	var tw = create_tween().set_ignore_time_scale(true)
	tw.tween_property(self, "modulate:a", 0.0, 0.15)
	tw.tween_callback(func(): picked.emit(id); queue_free())
