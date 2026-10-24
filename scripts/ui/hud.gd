class_name HUD extends Control
## Боевой интерфейс.

var world: World
var player: Player
var hp_bar: UIBar
var mana_bar: UIBar
var xp_bar: UIBar
var boss_bar: UIBar
var boss_box: Control
var boss_name: Label
var lvl_label: Label
var souls_label: Label
var kills_label: Label
var time_label: Label
var wave_label: Label
var wave_sub: Label
var army_label: Label
var combo_label: Label
var combo_rank: Label
var combo_box: Control
var toast_label: Label
var toast_sub: Label
var exec_prompt: Label
var slots = {}
var portrait: TextureRect
var _combo_shown = 0
var _combo_pulse = 0.0
var _toast_tw: Tween

const RANKS = [[5, "Кровопускание"], [10, "Резня"], [20, "Бойня"], [35, "Мясорубка"], [60, "Жатва душ"], [100, "АПОКАЛИПСИС"]]

func setup(w: World) -> void:
	world = w
	player = w.player
	theme = UIK.theme()
	UIK.full(self)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	w.toast.connect(show_toast)
	w.wave_started.connect(_on_wave)
	w.boss_spawned.connect(_on_boss)
	w.hit_marker.connect(_on_hit_marker)

func _build() -> void:
	# --- низ-лево: портрет, здоровье, мана
	var bl = Control.new()
	UIK.pin(bl, 0, 1, 28, -174)
	bl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bl)
	var frame = ColorRect.new()
	frame.color = Color(0, 0, 0, 0.85)
	frame.size = Vector2(146, 146)
	frame.position = Vector2(0, 0)
	bl.add_child(frame)
	portrait = TextureRect.new()
	var hp_img = {"lich": "port_lich", "deathknight": "port_dk", "reaper": "port_reaper"}.get(player.hero, "port_lich")
	portrait.texture = load("res://assets/img/%s.png" % hp_img)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.position = Vector2(3, 3)
	portrait.size = Vector2(140, 140)
	bl.add_child(portrait)
	var pb = ReferenceRect.new()
	pb.border_color = Color(0.5, 0.45, 0.4)
	pb.editor_only = false
	pb.border_width = 2
	pb.size = Vector2(146, 146)
	bl.add_child(pb)
	var name_l = UIK.label(String(player.hdef.title).to_upper(), 22, UIK.BONE, UIK.f_title)
	UIK.shadowed(name_l, 2)
	name_l.position = Vector2(162, 0)
	bl.add_child(name_l)
	hp_bar = UIBar.new()
	hp_bar.position = Vector2(162, 38)
	hp_bar.size = Vector2(460, 30)
	hp_bar.col = Color(0.78, 0.06, 0.05)
	hp_bar.col2 = Color(0.42, 0.02, 0.02)
	hp_bar.font_size = 18
	bl.add_child(hp_bar)
	mana_bar = UIBar.new()
	mana_bar.position = Vector2(162, 74)
	mana_bar.size = Vector2(400, 18)
	mana_bar.col = Color(0.3, 0.9, 0.5)
	mana_bar.col2 = Color(0.1, 0.45, 0.22)
	mana_bar.trail_col = Color(0.7, 1, 0.8, 0.6)
	mana_bar.font_size = 14
	bl.add_child(mana_bar)
	army_label = UIK.label("", 22, UIK.NECRO, UIK.f_bold)
	UIK.shadowed(army_label, 2)
	army_label.position = Vector2(162, 100)
	bl.add_child(army_label)

	# --- низ-центр: способности
	var row = UIK.hbox(10)
	row.grow_horizontal = Control.GROW_DIRECTION_BOTH
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(row)
	var h = player.hero
	var prim = {"lich": "ab_bonebolt", "deathknight": "ab_slam", "reaper": "ab_whirl"}[h]
	var spec = {"lich": "ab_skullfan", "deathknight": "ab_slam", "reaper": "ab_whirl"}[h]
	if h == "deathknight":
		prim = "ab_curse"
	if h == "reaper":
		prim = "ab_execute"
	var defs = [["lmb", "ЛКМ", prim, 0], ["rmb", "ПКМ", spec, 30 if h != "deathknight" else 35], ["dash", "SPACE", "ab_dash", 0],
		["raise", "Q", "ab_raise", 12], ["explode", "E", "ab_explode", 20], ["execute", "F", "ab_execute", 0], ["ult", "R", "ab_harvest", 0], ["command", "C", "ab_command", 0]]
	for d in defs:
		var s = UISlot.new()
		s.tex = load("res://assets/img/%s.png" % d[2])
		s.key = d[1]
		s.cost = d[3]
		s.custom_minimum_size = Vector2(76, 76) if d[0] != "ult" else Vector2(92, 92)
		s.size_flags_vertical = Control.SIZE_SHRINK_END
		row.add_child(s)
		slots[d[0]] = s
	var rs = row.get_combined_minimum_size()
	row.size = rs
	UIK.pin(row, 0.5, 1, -rs.x * 0.5, -124)

	# --- верх-лево: уровень, опыт, души
	var tl = UIK.vbox(4)
	tl.position = Vector2(28, 22)
	tl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(tl)
	lvl_label = UIK.label("", 26, UIK.GOLD, UIK.f_bold)
	UIK.shadowed(lvl_label, 2)
	tl.add_child(lvl_label)
	xp_bar = UIBar.new()
	xp_bar.custom_minimum_size = Vector2(300, 10)
	xp_bar.col = Color(0.95, 0.72, 0.3)
	xp_bar.col2 = Color(0.6, 0.4, 0.12)
	xp_bar.trail_col = Color(1, 1, 0.9, 0.5)
	tl.add_child(xp_bar)
	souls_label = UIK.label("", 22, UIK.BONE, UIK.f_body)
	UIK.shadowed(souls_label, 2)
	tl.add_child(souls_label)

	# --- верх-право: убийства, время
	var tr = UIK.vbox(0)
	tr.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	UIK.pin(tr, 1, 0, -28, 22)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(tr)
	kills_label = UIK.label("", 30, UIK.BONE, UIK.f_bold, HORIZONTAL_ALIGNMENT_RIGHT)
	UIK.shadowed(kills_label, 2)
	tr.add_child(kills_label)
	time_label = UIK.label("", 20, UIK.ASH, UIK.f_body, HORIZONTAL_ALIGNMENT_RIGHT)
	UIK.shadowed(time_label, 2)
	tr.add_child(time_label)

	# --- верх-центр: волна и босс
	var tc = UIK.vbox(2)
	tc.grow_horizontal = Control.GROW_DIRECTION_BOTH
	tc.alignment = BoxContainer.ALIGNMENT_BEGIN
	tc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(tc)
	wave_label = UIK.label("", 30, UIK.BONE, UIK.f_title, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(wave_label, 3)
	wave_label.custom_minimum_size.x = 700
	tc.add_child(wave_label)
	wave_sub = UIK.label("", 19, UIK.ASH, UIK.f_body, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(wave_sub, 2)
	tc.add_child(wave_sub)
	boss_box = UIK.vbox(4)
	boss_box.visible = false
	tc.add_child(boss_box)
	boss_name = UIK.label("", 32, Color(1, 0.3, 0.25), UIK.f_title, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(boss_name, 3)
	boss_box.add_child(boss_name)
	boss_bar = UIBar.new()
	boss_bar.custom_minimum_size = Vector2(760, 22)
	boss_bar.col = Color(0.85, 0.08, 0.05)
	boss_bar.col2 = Color(0.38, 0.0, 0.0)
	boss_bar.ticks = 4
	boss_bar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	boss_box.add_child(boss_bar)
	UIK.pin(tc, 0.5, 0, 0, 18)

	# --- справа: комбо
	combo_box = Control.new()
	UIK.pin(combo_box, 1, 0.5, -340, -150)
	combo_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(combo_box)
	combo_label = UIK.label("", 86, Color(0.9, 0.08, 0.05), UIK.f_logo, HORIZONTAL_ALIGNMENT_RIGHT)
	UIK.shadowed(combo_label, 4)
	combo_label.size = Vector2(300, 100)
	combo_label.pivot_offset = Vector2(300, 60)
	combo_box.add_child(combo_label)
	combo_rank = UIK.label("", 24, UIK.BONE, UIK.f_bold, HORIZONTAL_ALIGNMENT_RIGHT)
	UIK.shadowed(combo_rank, 2)
	combo_rank.size = Vector2(300, 30)
	combo_rank.position = Vector2(0, 100)
	combo_box.add_child(combo_rank)

	# --- центр: тосты
	toast_label = UIK.label("", 64, UIK.BONE, UIK.f_title, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(toast_label, 4)
	toast_label.grow_horizontal = Control.GROW_DIRECTION_BOTH
	toast_label.size = Vector2(1400, 80)
	UIK.pin(toast_label, 0.5, 0, -700, 190)
	toast_label.pivot_offset = Vector2(700, 40)
	toast_label.modulate.a = 0.0
	add_child(toast_label)
	toast_sub = UIK.label("", 24, UIK.ASH, UIK.f_serif, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(toast_sub, 2)
	toast_sub.size = Vector2(1400, 40)
	UIK.pin(toast_sub, 0.5, 0, -700, 272)
	toast_sub.modulate.a = 0.0
	add_child(toast_sub)

	exec_prompt = UIK.label("F — КАЗНЬ", 26, Color(1, 0.25, 0.2), UIK.f_bold, HORIZONTAL_ALIGNMENT_CENTER)
	UIK.shadowed(exec_prompt, 3)
	exec_prompt.size = Vector2(240, 34)
	exec_prompt.visible = false
	add_child(exec_prompt)

var _last_mark = 0
func _on_hit_marker(kill: bool, crit: bool) -> void:
	var now = Time.get_ticks_msec()
	if not kill and now - _last_mark < 45:
		return
	_last_mark = now
	var m = HitMarker.new()
	m.kill = kill
	m.crit = crit
	add_child(m)
	m.position = get_local_mouse_position() - m.size * 0.5

func _on_wave(n: int, total: int) -> void:
	if world.director and world.director.boss_wave:
		return
	if total > 0:
		show_toast("ВОЛНА %d" % n, UIK.BONE, "из %d" % total)
	else:
		show_toast("ВОЛНА %d" % n, UIK.BONE, "")

func _on_boss(b: Actor) -> void:
	boss_box.visible = true
	boss_name.text = String(b.def.get("name", "Босс")).to_upper()
	show_toast(String(b.def.get("name", "Босс")).to_upper(), Color(1, 0.2, 0.15), String(b.def.get("epithet", "")))

func show_toast(text: String, color := UIK.BONE, sub := "") -> void:
	if text == "":
		return
	if _toast_tw and _toast_tw.is_valid():
		_toast_tw.kill()
	var small = text.length() > 18 or color == UIK.NECRO or color == G.C_NECRO or color == G.C_ASH
	toast_label.add_theme_font_size_override("font_size", 40 if small else 72)
	toast_label.text = text
	toast_label.add_theme_color_override("font_color", color)
	toast_sub.text = sub
	toast_label.scale = Vector2(1.25, 1.25)
	toast_label.modulate.a = 0.0
	toast_sub.modulate.a = 0.0
	_toast_tw = create_tween().set_ignore_time_scale(true)
	_toast_tw.set_parallel(true)
	_toast_tw.tween_property(toast_label, "modulate:a", 1.0, 0.12)
	_toast_tw.tween_property(toast_label, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_toast_tw.tween_property(toast_sub, "modulate:a", 1.0, 0.3).set_delay(0.15)
	_toast_tw.chain().tween_interval(1.4 if small else 2.0)
	_toast_tw.chain().set_parallel(true)
	_toast_tw.tween_property(toast_label, "modulate:a", 0.0, 0.5)
	_toast_tw.tween_property(toast_sub, "modulate:a", 0.0, 0.5)

var _dbg = 0
func _process(delta: float) -> void:
	if not is_instance_valid(player):
		return
	var p = player
	hp_bar.set_value(p.hp / maxf(1.0, p.max_hp))
	hp_bar.text = "%d / %d" % [ceili(maxf(0.0, p.hp)), int(p.max_hp)]
	mana_bar.set_value(p.mana / maxf(1.0, p.max_mana))
	mana_bar.text = "%d" % int(p.mana)
	var lv = int(G.run.get("level", 1))
	lvl_label.text = "УРОВЕНЬ %d" % lv
	xp_bar.set_value(float(G.run.get("xp", 0)) / float(G.xp_for_level(lv)))
	souls_label.text = "Души: %d" % int(G.run.get("souls", 0))
	kills_label.text = "%d убито" % int(G.run.get("kills", 0))
	var t = int(G.run.get("time", 0.0))
	time_label.text = "%02d:%02d" % [t / 60, t % 60]
	var arm = world.army().size()
	army_label.text = "Армия: %d / %d" % [arm, G.army_cap()]
	# волна
	var d = world.director
	if d:
		if d.boss_wave and is_instance_valid(world.boss) and not world.boss.dead:
			wave_label.text = ""
			wave_sub.text = ""
		elif d.endless:
			wave_label.text = "Волна %d" % (d.wave + 1)
			wave_sub.text = "Врагов: %d" % world.units_of(1).size()
		else:
			var tw = d.total_waves()
			if d.wave + 1 > tw:
				wave_label.text = "Финальная битва"
			else:
				wave_label.text = "Волна %d / %d" % [maxi(1, d.wave + 1), tw]
			wave_sub.text = "Врагов: %d" % (world.units_of(1).size() + d.queue.size())
	if is_instance_valid(world.boss) and not world.boss.dead:
		boss_box.visible = true
		boss_bar.set_value(world.boss.hp / world.boss.max_hp)
	elif boss_box.visible:
		boss_box.visible = false
	# комбо
	var c = world.combo
	if c != _combo_shown:
		if c > _combo_shown:
			_combo_pulse = 1.0
		_combo_shown = c
	_combo_pulse = maxf(0.0, _combo_pulse - delta * 4.0)
	if c >= 3:
		combo_label.text = "x%d" % c
		combo_label.scale = Vector2.ONE * (1.0 + 0.35 * _combo_pulse)
		combo_box.modulate.a = clampf(world.combo_t / 0.6, 0.0, 1.0)
		var rank = ""
		for r in RANKS:
			if c >= r[0]:
				rank = r[1]
		combo_rank.text = rank.to_upper()
	else:
		combo_box.modulate.a = 0.0
	# способности
	var s = slots
	s["rmb"].usable = p.mana >= s["rmb"].cost
	s["rmb"].cd = clampf(p.special_cd / 1.0, 0, 1)
	s["raise"].cost = int(world.raise_cost())
	s["raise"].usable = p.mana >= s["raise"].cost
	s["raise"].cd = clampf(p.raise_cd / 0.8, 0, 1)
	s["explode"].usable = p.mana >= 20
	s["explode"].cd = clampf(p.explode_cd / 0.35, 0, 1)
	s["dash"].charges = p.dash_charges
	s["dash"].charges_max = p.dash_max
	s["dash"].usable = p.dash_charges > 0
	s["dash"].cd = clampf(p.dash_cd / p.dash_cd_max, 0, 1) if p.dash_charges == 0 else 0.0
	s["ult"].fill = 1.0 if p.harvest >= 1.0 else p.harvest
	s["ult"].active = 1.0 if p.harvest_t > 0.0 else 0.0
	if p.harvest_t > 0.0:
		s["ult"].fill = p.harvest_t / 10.0
	s["execute"].usable = is_instance_valid(p.execute_target)
	# казнь
	if is_instance_valid(p.execute_target) and not p.dead:
		var cam: Camera3D = world.cam.cam
		var wp = p.execute_target.global_position + Vector3.UP * 2.4
		if not cam.is_position_behind(wp):
			var sp = cam.unproject_position(wp) / get_viewport_rect().size * size
			exec_prompt.position = sp - Vector2(120, 17)
			exec_prompt.visible = true
			exec_prompt.modulate.a = 0.75 + 0.25 * sin(Time.get_ticks_msec() * 0.012)
	else:
		exec_prompt.visible = false
