class_name Results extends Control
## Итоги боя.

signal to_menu
signal retry

var victory = false
var reward = 0

func setup(v: bool, souls: int) -> void:
	victory = v
	reward = souls

func _ready() -> void:
	theme = UIK.theme()
	UIK.full(self)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg = UIK.art_bg("res://assets/img/%s.png" % ("victory_bg" if victory else "defeat_bg"))
	add_child(bg)
	var grad = TextureRect.new()
	var gt = GradientTexture2D.new()
	var g = Gradient.new()
	g.set_color(0, Color(0, 0, 0, 0.92)); g.set_color(1, Color(0, 0, 0, 0.0))
	gt.gradient = g; gt.fill_to = Vector2(1, 0); gt.width = 256; gt.height = 4
	grad.texture = gt
	grad.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	grad.stretch_mode = TextureRect.STRETCH_SCALE
	grad.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	grad.size.x = 1200
	grad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(grad)
	var v = UIK.vbox(10)
	UIK.pin(v, 0, 0.5, 150, -380)
	add_child(v)
	var t = UIK.label("ПОБЕДА" if victory else "ТЫ ПАЛ", 120, UIK.BLOOD if not victory else UIK.BONE, UIK.f_logo)
	UIK.shadowed(t, 6)
	v.add_child(t)
	var sub_txt = "Орден умылся кровью." if victory else "Кости рассыпались. Но смерть — лишь начало."
	if victory and String(G.mission.get("id", "")) == "cathedral":
		sub_txt = "Собор пал. Свет Рассвета погас навсегда."
	var sub = UIK.label(sub_txt, 30, UIK.ASH, UIK.f_serif)
	v.add_child(sub)
	v.add_child(UIK.rule(560, UIK.BLOOD))
	v.add_child(UIK.spacer(10))
	var r = G.run
	var t_s = int(r.get("time", 0.0))
	var rows = [["Убито", str(int(r.get("kills", 0)))], ["Время", "%02d:%02d" % [t_s / 60, t_s % 60]], ["Лучшая серия", "x%d" % int(r.get("max_combo", 0))],
		["Уровень", str(int(r.get("level", 1)))], ["Поднято мёртвых", str(int(r.get("raised", 0)))], ["Казней", str(int(r.get("executions", 0)))]]
	if String(G.mission.get("id", "")) == "endless":
		rows.insert(0, ["Волн пережито", str(int(r.get("wave", 0)))])
	for row in rows:
		var h = UIK.hbox(10)
		var a = UIK.label(row[0], 28, UIK.ASH, UIK.f_body)
		a.custom_minimum_size.x = 330
		h.add_child(a)
		var b = UIK.label(row[1], 30, UIK.BONE, UIK.f_bold)
		h.add_child(b)
		v.add_child(h)
	v.add_child(UIK.spacer(12))
	var sl = UIK.label("+%d душ" % reward, 52, UIK.NECRO, UIK.f_title)
	UIK.shadowed(sl, 3)
	v.add_child(sl)
	var tot = UIK.label("Всего душ: %d" % int(G.save.souls), 22, UIK.ASH, UIK.f_body)
	v.add_child(tot)
	v.add_child(UIK.spacer(26))
	var bh = UIK.hbox(16)
	v.add_child(bh)
	bh.add_child(UIK.button("В склеп", func(): to_menu.emit(), 280, 62))
	bh.add_child(UIK.button("Ещё раз" if not victory else "Повторить", func(): retry.emit(), 280, 62))
	modulate.a = 0.0
	create_tween().set_ignore_time_scale(true).tween_property(self, "modulate:a", 1.0, 0.8)
