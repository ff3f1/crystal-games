class_name MainMenu extends Control
## Главное меню: титул, выбор героя, миссии, склеп, настройки.

signal start_mission(m: Dictionary)
signal quit_game

var _bg: TextureRect
var _screen: Control
var _souls: Label
var _art = "menu_bg"
var _fog: ColorRect
var _flash: ColorRect
var _rain_snd: AudioStreamPlayer
var _bolt_t = 4.0
var _par = Vector2.ZERO

const MISSION_ART = {"graveyard": "menu_bg", "camp": "keyart_a", "crypt": "keyart_c", "cathedral": "keyart_b", "endless": "victory_bg"}
const HERO_ART = {"lich": "card_lich", "deathknight": "card_dk", "reaper": "card_reaper"}

func _ready() -> void:
	theme = UIK.theme()
	UIK.full(self)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_bg = UIK.art_bg("res://assets/img/menu_bg.png")
	add_child(_bg)
	# параллакс: фон чуть больше экрана
	_bg.offset_left = -50; _bg.offset_top = -30; _bg.offset_right = 50; _bg.offset_bottom = 30
	var fog = ColorRect.new()
	UIK.full(fog)
	fog.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fm = ShaderMaterial.new()
	fm.shader = load("res://assets/shaders/menu_fog.gdshader")
	fm.set_shader_parameter("noise_tex", load("res://assets/tex/noise.tres"))
	fog.material = fm
	add_child(fog)
	_fog = fog
	add_child(_rain())
	_flash = ColorRect.new()
	UIK.full(_flash)
	_flash.color = Color(0.8, 0.85, 1.0, 0.0)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_flash)
	_rain_snd = AudioStreamPlayer.new()
	_rain_snd.stream = load("res://assets/sfx/rain_loop.ogg")
	(_rain_snd.stream as AudioStreamOggVorbis).loop = true
	_rain_snd.bus = "SFX"
	_rain_snd.volume_db = -8.0
	add_child(_rain_snd)
	_rain_snd.play()
	_bolt_t = randf_range(3.0, 6.0)
	var shade = TextureRect.new()
	var gt = GradientTexture2D.new()
	var g = Gradient.new()
	g.set_color(0, Color(0, 0, 0, 0.88)); g.set_color(1, Color(0, 0, 0, 0.0))
	g.add_point(0.55, Color(0, 0, 0, 0.45))
	gt.gradient = g; gt.fill_to = Vector2(1, 0); gt.width = 256; gt.height = 4
	shade.texture = gt
	shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	shade.stretch_mode = TextureRect.STRETCH_SCALE
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	UIK.full(shade)
	shade.anchor_right = 0.75
	add_child(shade)
	add_child(_embers())
	_souls = UIK.label("", 28, UIK.NECRO, UIK.f_bold, HORIZONTAL_ALIGNMENT_RIGHT)
	UIK.shadowed(_souls, 2)
	UIK.pin(_souls, 1, 0, -420, 30)
	_souls.size = Vector2(390, 40)
	add_child(_souls)
	var ver = UIK.label("Crystal Games  ·  v%s" % G.VERSION, 18, UIK.DIM, UIK.f_body, HORIZONTAL_ALIGNMENT_RIGHT)
	UIK.pin(ver, 1, 1, -420, -44)
	ver.size = Vector2(390, 30)
	add_child(ver)
	G.save_changed.connect(_upd_souls)
	_upd_souls()
	show_title()
	Sfx.play_music("menu")

func _process(delta: float) -> void:
	# параллакс от мыши
	var vs = get_viewport_rect().size
	var m = get_viewport().get_mouse_position() / maxf(1.0, vs.x) - Vector2(0.5, 0.5)
	_par = _par.lerp(-m * Vector2(70, 40), clampf(delta * 3.0, 0, 1))
	_bg.position = Vector2(-50, -30) + _par
	# молнии
	_bolt_t -= delta
	if _bolt_t <= 0.0:
		_bolt_t = randf_range(7.0, 15.0)
		_lightning()

func _lightning() -> void:
	var tw = create_tween()
	tw.tween_property(_flash, "color:a", 0.42, 0.04)
	tw.tween_property(_flash, "color:a", 0.0, 0.08)
	tw.tween_property(_flash, "color:a", 0.3, 0.05)
	tw.tween_property(_flash, "color:a", 0.0, 0.35)
	var bm: ShaderMaterial = _bg.material
	var tw2 = create_tween()
	tw2.tween_method(func(v): bm.set_shader_parameter("darken", v), -0.5, 0.12, 0.6)
	get_tree().create_timer(randf_range(0.4, 1.2)).timeout.connect(func(): Sfx.ui("thunder", -2.0))

func _rain() -> GPUParticles2D:
	var p = GPUParticles2D.new()
	p.amount = 260
	p.lifetime = 0.9
	p.preprocess = 1.0
	p.position = Vector2(1000, -60)
	var m = ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = Vector3(1300, 10, 0)
	m.direction = Vector3(-0.25, 1, 0)
	m.spread = 2.0
	m.initial_velocity_min = 1300.0
	m.initial_velocity_max = 1700.0
	m.gravity = Vector3.ZERO
	m.particle_flag_align_y = true
	m.scale_min = 0.6
	m.scale_max = 1.0
	m.color = Color(0.75, 0.8, 0.9, 0.16)
	p.process_material = m
	var img = Image.create(2, 40, false, Image.FORMAT_RGBA8)
	for y in 40:
		for x in 2:
			img.set_pixel(x, y, Color(1, 1, 1, float(y) / 40.0))
	p.texture = ImageTexture.create_from_image(img)
	return p

func _upd_souls() -> void:
	_souls.text = "Души: %d" % int(G.save.souls)

func _embers() -> GPUParticles2D:
	var p = GPUParticles2D.new()
	p.amount = 70
	p.lifetime = 9.0
	p.preprocess = 9.0
	p.position = Vector2(1100, 1150)
	var m = ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = Vector3(1200, 20, 0)
	m.direction = Vector3(0.15, -1, 0)
	m.spread = 18.0
	m.initial_velocity_min = 40.0
	m.initial_velocity_max = 110.0
	m.gravity = Vector3(0, -6, 0)
	m.turbulence_enabled = true
	m.turbulence_noise_strength = 6.0
	m.turbulence_noise_scale = 3.0
	m.scale_min = 1.5
	m.scale_max = 4.5
	var cr = Gradient.new()
	cr.set_color(0, Color(1, 0.4, 0.1, 0.0))
	cr.add_point(0.15, Color(1, 0.35, 0.08, 0.9))
	cr.set_color(1, Color(0.8, 0.05, 0.02, 0.0))
	var ct = GradientTexture1D.new(); ct.gradient = cr
	m.color_ramp = ct
	p.process_material = m
	p.texture = _dot_tex()
	var mat = CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	p.material = mat
	return p

func _dot_tex() -> ImageTexture:
	var s = 16
	var img = Image.create(s, s, false, Image.FORMAT_RGBA8)
	for y in s:
		for x in s:
			var d = Vector2(x - 7.5, y - 7.5).length() / 7.5
			img.set_pixel(x, y, Color(1, 1, 1, clampf(1.0 - d, 0, 1) ** 1.5))
	return ImageTexture.create_from_image(img)

func _set_art(name: String) -> void:
	if name == _art:
		return
	_art = name
	var tw = create_tween()
	tw.tween_property(_bg, "modulate:a", 0.0, 0.18)
	tw.tween_callback(func(): _bg.texture = load("res://assets/img/%s.png" % name))
	tw.tween_property(_bg, "modulate:a", 1.0, 0.35)

func _swap(c: Control) -> void:
	if _screen:
		_screen.queue_free()
	_screen = c
	add_child(c)
	c.modulate.a = 0.0
	create_tween().tween_property(c, "modulate:a", 1.0, 0.25)

func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("pause") and _screen and _screen.get_meta("back", "") != "":
		get_viewport().set_input_as_handled()
		Sfx.ui("ui_back", -4.0)
		call(_screen.get_meta("back"))

# ---------------------------------------------------------------- титул
func show_title() -> void:
	_set_art("menu_bg")
	var root = Control.new()
	UIK.full(root)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var v = UIK.vbox(4)
	UIK.pin(v, 0, 0.5, 140, -380)
	root.add_child(v)
	var logo1 = UIK.label("КОСТЯНАЯ", 120, UIK.BONE, UIK.f_logo)
	UIK.shadowed(logo1, 6)
	v.add_child(logo1)
	var logo2 = UIK.label("ЖАТВА", 168, UIK.BLOOD, UIK.f_logo)
	UIK.shadowed(logo2, 7)
	logo2.position.y = -30
	v.add_child(logo2)
	var tag = UIK.label("Мёртвые встают. Орден падёт.", 30, UIK.ASH, UIK.f_serif)
	v.add_child(tag)
	v.add_child(UIK.spacer(46))
	v.add_child(UIK.menu_item("Играть", show_heroes))
	v.add_child(UIK.menu_item("Склеп", show_crypt, "Вечные улучшения за души"))
	v.add_child(UIK.menu_item("Настройки", show_settings))
	v.add_child(UIK.menu_item("Выход", func(): quit_game.emit()))
	_swap(root)

# ---------------------------------------------------------------- герои
func show_heroes() -> void:
	var root = Control.new()
	UIK.full(root)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.set_meta("back", "show_title")
	var v = UIK.vbox(18)
	UIK.full(v)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	root.add_child(v)
	var t = UIK.label("ВЫБЕРИ ВОПЛОЩЕНИЕ", 64, UIK.BONE, UIK.f_title, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(t, 4)
	v.add_child(t)
	var row = UIK.hbox(30)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(row)
	for id in ["lich", "deathknight", "reaper"]:
		row.add_child(_hero_card(id))
	var bh = UIK.hbox(16)
	bh.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(bh)
	bh.add_child(UIK.button("Назад", show_title, 220, 56))
	_swap(root)

func _hero_card(id: String) -> Control:
	var h: Dictionary = G.HEROES[id]
	var unlocked = G.save.unlocked.has(id)
	var sel = String(G.save.hero) == id
	var c = PanelContainer.new()
	c.custom_minimum_size = Vector2(440, 760)
	var border = UIK.BLOOD if sel else Color(0.3, 0.27, 0.25)
	c.add_theme_stylebox_override("panel", UIK.sb(Color(0.03, 0.025, 0.025, 0.94), border, 3 if sel else 1, 0, 0))
	var v = UIK.vbox(8)
	c.add_child(v)
	var art = TextureRect.new()
	art.texture = load("res://assets/img/%s.png" % HERO_ART[id])
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.custom_minimum_size = Vector2(440, 400)
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if not unlocked:
		art.modulate = Color(0.35, 0.33, 0.33)
	v.add_child(art)
	var inner = UIK.vbox(8)
	var mc = MarginContainer.new()
	for side in ["left", "right"]:
		mc.add_theme_constant_override("margin_" + side, 22)
	mc.add_child(inner)
	v.add_child(mc)
	var n = UIK.label(String(h.title).to_upper(), 40, UIK.BONE if unlocked else UIK.ASH, UIK.f_title)
	inner.add_child(n)
	var stats = UIK.label("Здоровье %d  ·  Мана %d  ·  Броня %d%%" % [h.hp, h.mana, int(h.armor * 100)], 19, UIK.GOLD, UIK.f_bold)
	inner.add_child(stats)
	var ab = UIK.label("ЛКМ: %s   ПКМ: %s" % [h.lmb, h.rmb], 19, UIK.NECRO, UIK.f_body)
	inner.add_child(ab)
	var d = UIK.label(String(h.desc), 20, UIK.ASH, UIK.f_body)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size = Vector2(396, 120)
	inner.add_child(d)
	if unlocked:
		inner.add_child(UIK.button("Выбрать" if not sel else "Выбран — дальше", func():
			G.save.hero = id; G.write_save(); show_missions(), 396, 56))
	else:
		var cost = int(h.cost)
		var b = UIK.button("Пробудить за %d душ" % cost, func():
			if int(G.save.souls) >= cost:
				G.save.souls = int(G.save.souls) - cost
				G.save.unlocked.append(id)
				G.save.hero = id
				G.write_save()
				Sfx.ui("coins", 0.0)
				show_heroes()
			else:
				Sfx.ui("ui_err", -2.0), 396, 56)
		b.disabled = int(G.save.souls) < cost
		inner.add_child(b)
	c.mouse_entered.connect(func(): if unlocked: Sfx.ui("ui_tick", -12.0))
	return c

# ---------------------------------------------------------------- миссии
func _mission_open(i: int) -> bool:
	if i == 0:
		return true
	return G.save.missions_done.has(G.MISSIONS[i - 1].id)

func show_missions() -> void:
	var root = Control.new()
	UIK.full(root)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.set_meta("back", "show_heroes")
	var v = UIK.vbox(14)
	UIK.pin(v, 0, 0.5, 120, -420)
	root.add_child(v)
	var t = UIK.label("КУДА ВЕСТИ МЁРТВЫХ", 60, UIK.BONE, UIK.f_title)
	UIK.shadowed(t, 4)
	v.add_child(t)
	var hero_l = UIK.label("Воплощение: %s" % G.HEROES[G.save.hero].title, 22, UIK.GOLD, UIK.f_bold)
	v.add_child(hero_l)
	v.add_child(UIK.spacer(8))
	var list = G.MISSIONS.duplicate()
	list.append(G.ENDLESS)
	var desc = UIK.label("", 24, UIK.ASH, UIK.f_serif)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(720, 100)
	for i in list.size():
		var m: Dictionary = list[i]
		var open = _mission_open(i) if i < G.MISSIONS.size() else G.save.missions_done.size() > 0
		var done = G.save.missions_done.has(m.id)
		var sub = ""
		if i < G.MISSIONS.size():
			sub = ("Пройдено  ·  " if done else "") + "Босс: %s  ·  до %d душ" % [G.UNITS.get(m.boss, {}).get("name", "?"), int(m.souls)]
		else:
			sub = "Рекорд: %d волн" % int(G.save.best_endless) if open else ""
		if not open:
			sub = "Закрыто — пройди предыдущую битву"
		var item = UIK.menu_item(("%d. " % (i + 1) if i < G.MISSIONS.size() else "∞  ") + String(m.title), func():
			if open:
				start_mission.emit(m)
			else:
				Sfx.ui("ui_err", -2.0), sub)
		if not open:
			item.modulate = Color(0.5, 0.5, 0.5)
		item.mouse_entered.connect(func():
			desc.text = String(m.desc)
			_set_art(MISSION_ART.get(m.id, "menu_bg")))
		v.add_child(item)
	v.add_child(UIK.spacer(6))
	v.add_child(UIK.rule(720, UIK.BLOOD_D))
	v.add_child(desc)
	desc.text = String(G.MISSIONS[0].desc)
	v.add_child(UIK.button("Назад", show_heroes, 220, 54))
	_swap(root)

# ---------------------------------------------------------------- склеп
func show_crypt() -> void:
	_set_art("keyart_c")
	var root = Control.new()
	UIK.full(root)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.set_meta("back", "show_title")
	var v = UIK.vbox(12)
	UIK.pin(v, 0, 0.5, 120, -430)
	root.add_child(v)
	var t = UIK.label("СКЛЕП", 72, UIK.BONE, UIK.f_title)
	UIK.shadowed(t, 4)
	v.add_child(t)
	v.add_child(UIK.label("Души павших питают вечную силу. Улучшения сохраняются навсегда.", 22, UIK.ASH, UIK.f_serif))
	v.add_child(UIK.spacer(10))
	for u in G.UPGRADES:
		var lv = G.upgrade_level(u.id)
		var maxed = lv >= int(u.max)
		var cost = G.upgrade_cost(u)
		var h = UIK.hbox(18)
		var info = UIK.vbox(0)
		info.custom_minimum_size.x = 560
		var n = UIK.label("%s   %s" % [String(u.name).to_upper(), "◆".repeat(lv) + "◇".repeat(int(u.max) - lv)], 26, UIK.BONE, UIK.f_bold)
		info.add_child(n)
		info.add_child(UIK.label(String(u.desc), 20, UIK.ASH, UIK.f_body))
		h.add_child(info)
		var b = UIK.button("Максимум" if maxed else "%d душ" % cost, func():
			if not maxed and int(G.save.souls) >= cost:
				G.save.souls = int(G.save.souls) - cost
				G.save.upgrades[u.id] = lv + 1
				G.write_save()
				Sfx.ui("coins", 0.0)
				show_crypt()
			else:
				Sfx.ui("ui_err", -2.0), 200, 52)
		b.disabled = maxed or int(G.save.souls) < cost
		h.add_child(b)
		v.add_child(h)
	v.add_child(UIK.spacer(10))
	var st = UIK.label("Всего убито: %d   ·   Пройдено битв: %d / %d" % [int(G.save.total_kills), G.save.missions_done.size(), G.MISSIONS.size()], 20, UIK.DIM, UIK.f_body)
	v.add_child(st)
	v.add_child(UIK.button("Назад", show_title, 220, 54))
	_swap(root)

# ---------------------------------------------------------------- настройки
func show_settings() -> void:
	var root = Control.new()
	UIK.full(root)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sp = SettingsPanel.new()
	UIK.pin(sp, 0, 0.5, 120, -380)
	root.add_child(sp)
	sp.closed.connect(show_title)
	_swap(root)
