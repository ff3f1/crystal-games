class_name UIK
## Мрачная тема интерфейса и фабрика элементов.

const BONE := Color(0.9, 0.87, 0.8)
const ASH := Color(0.58, 0.55, 0.52)
const DIM := Color(0.36, 0.34, 0.33)
const BLOOD := Color(0.8, 0.06, 0.05)
const BLOOD_D := Color(0.42, 0.02, 0.02)
const NECRO := Color(0.38, 1.0, 0.55)
const GOLD := Color(0.95, 0.74, 0.32)
const PANEL := Color(0.04, 0.035, 0.035, 0.9)

static var f_logo: Font
static var f_title: Font
static var f_body: Font
static var f_bold: Font
static var f_serif: Font
static var _theme: Theme

static func fonts() -> void:
	if f_body:
		return
	f_logo = load("res://assets/fonts/RubikWetPaint-Regular.ttf")
	f_title = load("res://assets/fonts/RubikDirt-Regular.ttf")
	var osw: FontFile = load("res://assets/fonts/Oswald[wght].ttf")
	var fv = FontVariation.new(); fv.base_font = osw; fv.variation_opentype = {"wght": 400}
	f_body = fv
	var fb = FontVariation.new(); fb.base_font = osw; fb.variation_opentype = {"wght": 650}
	f_bold = fb
	var cg: FontFile = load("res://assets/fonts/CormorantGaramond[wght].ttf")
	var fs = FontVariation.new(); fs.base_font = cg; fs.variation_opentype = {"wght": 600}
	f_serif = fs

static func theme() -> Theme:
	fonts()
	if _theme:
		return _theme
	var t = Theme.new()
	t.default_font = f_body
	t.default_font_size = 24
	t.set_color("font_color", "Label", BONE)
	t.set_color("font_color", "Button", BONE)
	t.set_color("font_hover_color", "Button", Color(1, 1, 1))
	t.set_color("font_pressed_color", "Button", BLOOD)
	t.set_color("font_disabled_color", "Button", DIM)
	t.set_font("font", "Button", f_bold)
	t.set_font_size("font_size", "Button", 26)
	var n = sb(Color(0.06, 0.05, 0.05, 0.92), Color(0.32, 0.29, 0.27), 1)
	var h = sb(Color(0.12, 0.03, 0.03, 0.95), BLOOD, 2)
	var p = sb(Color(0.2, 0.02, 0.02, 0.95), BLOOD, 2)
	var d = sb(Color(0.05, 0.05, 0.05, 0.6), Color(0.18, 0.17, 0.16), 1)
	for st in [["normal", n], ["hover", h], ["pressed", p], ["disabled", d], ["focus", StyleBoxEmpty.new()]]:
		t.set_stylebox(st[0], "Button", st[1])
	t.set_stylebox("panel", "PanelContainer", sb(PANEL, Color(0.25, 0.22, 0.2), 1, 0, 18))
	# ползунки
	var gr = sb(Color(0.12, 0.11, 0.1), Color(0.25, 0.22, 0.2), 1, 2, 0)
	gr.content_margin_top = 4; gr.content_margin_bottom = 4
	t.set_stylebox("slider", "HSlider", gr)
	var ga = sb(BLOOD_D, BLOOD, 1, 2, 0)
	ga.content_margin_top = 4; ga.content_margin_bottom = 4
	t.set_stylebox("grabber_area", "HSlider", ga)
	t.set_stylebox("grabber_area_highlight", "HSlider", ga)
	t.set_icon("grabber", "HSlider", _dot(18, BONE))
	t.set_icon("grabber_highlight", "HSlider", _dot(20, Color(1, 0.4, 0.35)))
	t.set_color("font_color", "CheckBox", BONE)
	t.set_color("font_hover_color", "CheckBox", Color(1, 1, 1))
	t.set_font("font", "CheckBox", f_body)
	t.set_font_size("font_size", "CheckBox", 22)
	for s in ["normal", "hover", "pressed", "hover_pressed", "focus"]:
		t.set_stylebox(s, "CheckBox", StyleBoxEmpty.new())
	t.set_icon("checked", "CheckBox", _box(24, true))
	t.set_icon("unchecked", "CheckBox", _box(24, false))
	t.set_stylebox("normal", "OptionButton", n)
	t.set_stylebox("hover", "OptionButton", h)
	t.set_stylebox("pressed", "OptionButton", p)
	t.set_stylebox("focus", "OptionButton", StyleBoxEmpty.new())
	t.set_font("font", "OptionButton", f_body)
	t.set_font_size("font_size", "OptionButton", 22)
	t.set_stylebox("panel", "PopupMenu", sb(Color(0.05, 0.045, 0.045, 0.98), Color(0.3, 0.27, 0.25), 1, 0, 6))
	t.set_stylebox("hover", "PopupMenu", sb(Color(0.25, 0.03, 0.03, 1), BLOOD, 0))
	t.set_font("font", "PopupMenu", f_body)
	t.set_font_size("font_size", "PopupMenu", 22)
	t.set_color("font_color", "PopupMenu", BONE)
	t.set_stylebox("panel", "TooltipPanel", sb(Color(0.03, 0.03, 0.03, 0.96), BLOOD, 1, 0, 10))
	t.set_color("font_color", "TooltipLabel", BONE)
	var vs = StyleBoxFlat.new(); vs.bg_color = Color(0.3, 0.28, 0.27, 0.6); vs.content_margin_left = 6
	t.set_stylebox("grabber", "VScrollBar", vs)
	t.set_stylebox("scroll", "VScrollBar", StyleBoxEmpty.new())
	_theme = t
	return t

static func _dot(s: int, c: Color) -> ImageTexture:
	var img = Image.create(s, s, false, Image.FORMAT_RGBA8)
	for y in s:
		for x in s:
			var d = Vector2(x - s * 0.5 + 0.5, y - s * 0.5 + 0.5).length()
			img.set_pixel(x, y, Color(c, clampf(s * 0.5 - d, 0, 1)))
	return ImageTexture.create_from_image(img)

static func _box(s: int, on: bool) -> ImageTexture:
	var img = Image.create(s, s, false, Image.FORMAT_RGBA8)
	for y in s:
		for x in s:
			var edge = x < 2 or y < 2 or x >= s - 2 or y >= s - 2
			var inner = x > 5 and y > 5 and x < s - 6 and y < s - 6
			var c = Color(0, 0, 0, 0)
			if edge:
				c = Color(0.6, 0.56, 0.52)
			elif inner and on:
				c = BLOOD
			elif not edge:
				c = Color(0.06, 0.05, 0.05, 0.9)
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)

static func sb(bg: Color, border: Color, bw := 1, radius := 0, margin := 14) -> StyleBoxFlat:
	var s = StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_corner_radius_all(radius)
	s.content_margin_left = margin; s.content_margin_right = margin
	s.content_margin_top = margin * 0.55; s.content_margin_bottom = margin * 0.55
	s.anti_aliasing = true
	return s

static func label(text: String, size := 24, color := BONE, font: Font = null, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	fonts()
	var l = Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_font_override("font", font if font else f_body)
	l.horizontal_alignment = align
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

static func shadowed(l: Label, off := 3, col := Color(0, 0, 0, 0.85)) -> Label:
	l.add_theme_color_override("font_shadow_color", col)
	l.add_theme_constant_override("shadow_offset_x", off)
	l.add_theme_constant_override("shadow_offset_y", off)
	l.add_theme_constant_override("shadow_outline_size", off * 2)
	return l

static func vbox(sep := 8) -> VBoxContainer:
	var v = VBoxContainer.new(); v.add_theme_constant_override("separation", sep); return v

static func hbox(sep := 8) -> HBoxContainer:
	var h = HBoxContainer.new(); h.add_theme_constant_override("separation", sep); return h

static func spacer(h: float) -> Control:
	var c = Control.new(); c.custom_minimum_size = Vector2(0, h); c.mouse_filter = Control.MOUSE_FILTER_IGNORE; return c

## Привязка к точке экрана с явными отступами (не зависит от текущего размера родителя).
static func pin(c: Control, ax: float, ay: float, ox: float, oy: float) -> Control:
	var sz = c.size
	c.anchor_left = ax; c.anchor_right = ax; c.anchor_top = ay; c.anchor_bottom = ay
	c.offset_left = ox; c.offset_top = oy
	c.offset_right = ox + sz.x; c.offset_bottom = oy + sz.y
	return c

static func full(c: Control) -> Control:
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.offset_left = 0; c.offset_top = 0; c.offset_right = 0; c.offset_bottom = 0
	return c

static func button(text: String, cb: Callable, w := 300.0, h := 58.0) -> Button:
	var b = Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, h)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func(): Sfx.ui("ui_click", -6.0); cb.call())
	b.mouse_entered.connect(func(): Sfx.ui("ui_tick", -14.0))
	return b

## Пункт главного меню: крупный текст с кровавой чертой при наведении.
static func menu_item(text: String, cb: Callable, sub := "") -> Control:
	fonts()
	var root = Control.new()
	root.custom_minimum_size = Vector2(560, 74 if sub != "" else 62)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	var slash = ColorRect.new()
	slash.color = BLOOD
	slash.position = Vector2(-14, 10)
	slash.size = Vector2(6, 40)
	slash.modulate.a = 0.0
	root.add_child(slash)
	var l = label(text.to_upper(), 44, BONE, f_bold)
	shadowed(l, 3)
	l.position = Vector2(8, 0)
	root.add_child(l)
	if sub != "":
		var s = label(sub, 18, ASH, f_body)
		s.position = Vector2(10, 52)
		root.add_child(s)
	root.mouse_entered.connect(func():
		Sfx.ui("ui_tick", -12.0)
		var tw = root.create_tween().set_parallel(true)
		tw.tween_property(l, "position:x", 26.0, 0.12)
		tw.tween_property(slash, "modulate:a", 1.0, 0.12)
		l.add_theme_color_override("font_color", Color(1, 0.25, 0.2)))
	root.mouse_exited.connect(func():
		var tw = root.create_tween().set_parallel(true)
		tw.tween_property(l, "position:x", 8.0, 0.15)
		tw.tween_property(slash, "modulate:a", 0.0, 0.15)
		l.add_theme_color_override("font_color", BONE))
	root.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			Sfx.ui("ui_ok", -4.0)
			cb.call())
	return root

static func panel() -> PanelContainer:
	var p = PanelContainer.new()
	p.theme = theme()
	return p

static func dim(a := 0.6) -> ColorRect:
	var c = ColorRect.new()
	c.color = Color(0, 0, 0, a)
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	full(c)
	return c

static func art_bg(path: String, zoom := true) -> TextureRect:
	var tr = TextureRect.new()
	tr.texture = load(path)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	full(tr)
	var m = ShaderMaterial.new()
	m.shader = load("res://assets/shaders/menu_bg.gdshader")
	tr.material = m
	return tr

static func icon(name: String, size := 64.0) -> TextureRect:
	var tr = TextureRect.new()
	var p = "res://assets/img/%s.png" % name
	if ResourceLoader.exists(p):
		tr.texture = load(p)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	tr.custom_minimum_size = Vector2(size, size)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr

static func rule(w := 420.0, c := BLOOD) -> ColorRect:
	var r = ColorRect.new()
	r.color = c
	r.custom_minimum_size = Vector2(w, 2)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r
