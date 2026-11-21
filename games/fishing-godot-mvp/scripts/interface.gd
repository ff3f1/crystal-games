extends CanvasLayer
## Responsive in-game menu, settings, help, trophy showcase and journal.
## All controls are native Godot Controls, usable with touch or a mouse.

var game: Node3D
var root: Control
var preview_rig: Node3D
var screen_name := ""
var settings_return := "home"
var ink := Color(0.91, 0.95, 0.91)
var muted := Color(0.67, 0.75, 0.73)
var amber := Color(0.91, 0.60, 0.29)
var teal := Color(0.13, 0.34, 0.36)
var char := Color(0.025, 0.065, 0.074)

func _ready() -> void:
    layer = 10
    root = Control.new()
    root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    root.mouse_filter = Control.MOUSE_FILTER_STOP
    add_child(root)
    visible = false
    set_process(true)

func _process(delta: float) -> void:
    if preview_rig != null and is_instance_valid(preview_rig) and visible:
        preview_rig.rotate_y(delta * 0.53)

func _clear() -> void:
    preview_rig = null
    for child in root.get_children():
        root.remove_child(child)
        child.queue_free()

func _page(name: String, wide: bool = false) -> Panel:
    screen_name = name
    # Hide gameplay HUD while a menu page is open. The background game scene
    # remains visible, but joystick/topbar must not bleed through the menu.
    game.hud_layer.visible = false
    _clear()
    visible = true
    var veil := ColorRect.new()
    veil.color = Color(0.008, 0.025, 0.033, 0.71)
    _rect(veil, root, 0, 0, 1, 1)
    var line := ColorRect.new()
    line.color = amber
    line.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _rect(line, root, 0.03, 0.045, 0.045, 0.95)
    _label(root, "ТИХОЕ ОЗЕРО", 48, 0.065, 0.055, 0.48, 0.15, ink)
    _label(root, "РЫБАЛКА • ПЕРВЫЙ ЗАБРОС", 21, 0.069, 0.165, 0.49, 0.24, amber)
    _label(root, "Свободный берег. Настоящий улов.\nТвой следующий заброс может стать рекордным.", 22, 0.07, 0.30, 0.47, 0.48, muted)
    _label(root, "GODOT 4  ·  MVP 0.4", 17, 0.07, 0.88, 0.49, 0.96, muted)
    var panel := Panel.new()
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0.035, 0.09, 0.10, 0.98)
    style.border_color = Color(0.31, 0.46, 0.45, 0.68)
    style.set_border_width_all(1)
    style.set_corner_radius_all(23)
    panel.add_theme_stylebox_override("panel", style)
    _rect(panel, root, 0.52 if not wide else 0.44, 0.08, 0.94, 0.93)
    var topbar := ColorRect.new()
    topbar.color = amber
    topbar.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _rect(topbar, panel, 0.07, 0.064, 0.93, 0.070)
    return panel

func show_home() -> void:
    game.menu_open = true
    game.hud_layer.visible = false
    var panel := _page("home")
    _label(panel, "ДОБРО ПОЖАЛОВАТЬ", 32, 0.08, 0.10, 0.94, 0.23, ink)
    _label(panel, "Лесное озеро  /  Раннее утро", 20, 0.08, 0.23, 0.94, 0.31, muted)
    _button(panel, "НАЧАТЬ РЫБАЛКУ", 0.08, 0.35, 0.92, 0.47, amber, func(): game.start_game())
    _button(panel, "ЖУРНАЛ УЛОВОВ", 0.08, 0.50, 0.92, 0.61, teal, show_journal)
    _button(panel, "НАСТРОЙКИ", 0.08, 0.65, 0.92, 0.76, teal, func(): show_settings("home"))
    _button(panel, "КАК ИГРАТЬ", 0.08, 0.80, 0.92, 0.91, teal, func(): show_help("home"))

func show_pause() -> void:
    game.menu_open = true
    game.is_reeling = false
    game.is_bracing = false
    var panel := _page("pause")
    _label(panel, "ПАУЗА", 39, 0.08, 0.13, 0.92, 0.26, ink)
    _button(panel, "ПРОДОЛЖИТЬ", 0.08, 0.30, 0.92, 0.43, amber, func(): game.resume_game())
    _button(panel, "НАСТРОЙКИ", 0.08, 0.47, 0.92, 0.59, teal, func(): show_settings("pause"))
    _button(panel, "ЖУРНАЛ УЛОВОВ", 0.08, 0.63, 0.92, 0.75, teal, show_journal)
    _button(panel, "В ГЛАВНОЕ МЕНЮ", 0.08, 0.79, 0.92, 0.91, Color(0.29, 0.34, 0.35), func(): game.exit_to_menu())

func show_settings(from_page: String = "home") -> void:
    settings_return = from_page
    game.menu_open = true
    var panel := _page("settings")
    _label(panel, "НАСТРОЙКИ", 32, 0.08, 0.09, 0.92, 0.18, ink)
    _setting_slider(panel, "Звук", "volume", 0.0, 1.0, 0.05, 0.22, 0.335)
    _setting_slider(panel, "Чувствительность обзора", "sensitivity", 0.45, 2.0, 0.05, 0.355, 0.475)
    _setting_slider(panel, "Поле зрения", "fov", 60.0, 85.0, 1.0, 0.49, 0.61)
    _label(panel, "Качество теней", 20, 0.08, 0.635, 0.92, 0.705, ink)
    var options := OptionButton.new()
    _rect(options, panel, 0.08, 0.705, 0.92, 0.785)
    options.add_theme_font_size_override("font_size", 21)
    options.add_item("Бережный режим", 0)
    options.add_item("Высокое качество", 1)
    options.select(1 if bool(game.profile.get("shadows", true)) else 0)
    options.item_selected.connect(func(index: int): game.set_graphics_quality(index == 1))
    _button(panel, "НАЗАД", 0.08, 0.825, 0.92, 0.925, amber, _back_from_settings)

func _setting_slider(panel: Control, label_text: String, key: String, min_val: float, max_val: float, step: float, top: float, bottom: float) -> void:
    var label := _label(panel, label_text, 20, 0.08, top, 0.90, top + 0.055, ink)
    var slider := HSlider.new()
    _rect(slider, panel, 0.08, top + 0.062, 0.92, bottom)
    slider.min_value = min_val
    slider.max_value = max_val
    slider.step = step
    slider.value = float(game.profile.get(key, (min_val + max_val) * 0.5))
    slider.value_changed.connect(func(v: float):
        game.set_preference(key, v)
        label.text = label_text + (": %d%%" % int(v * 100.0) if key == "volume" else ": %.1f" % v)
    )

func _back_from_settings() -> void:
    if settings_return == "pause":
        show_pause()
    else:
        show_home()

func show_help(from_page: String = "home") -> void:
    settings_return = from_page
    var panel := _page("help")
    _label(panel, "КАК ИГРАТЬ", 31, 0.08, 0.10, 0.92, 0.19, ink)
    _label(panel, "1  Левый джойстик — иди по берегу.\n2  Свайп по экрану — смотри вокруг.\n3  Повернись к воде, выбери наживку и забрось.\n4  Когда клюёт, нажми ПОДСЕЧЬ.\n5  Удерживай МОТАТЬ. При красной шкале — отпускай.\n6  Подведи рыбу к берегу, чтобы увидеть трофей.", 20, 0.08, 0.23, 0.93, 0.78, ink)
    _button(panel, "ПОНЯТНО", 0.08, 0.82, 0.92, 0.92, amber, _back_from_settings)

func show_journal() -> void:
    settings_return = "pause" if game.session_started else "home"
    var panel := _page("journal")
    _label(panel, "ЖУРНАЛ УЛОВОВ", 31, 0.08, 0.09, 0.92, 0.19, ink)
    var all_catches: Array = game.catches
    _label(panel, "Поймано: %d   •   Рекорд: %.2f кг" % [all_catches.size(), game.best_weight], 20, 0.08, 0.20, 0.92, 0.29, amber)
    if all_catches.is_empty():
        _label(panel, "Здесь появятся твои трофеи.\nПоймай первую рыбу — и она навсегда останется в журнале.", 20, 0.08, 0.32, 0.92, 0.67, muted)
    else:
        var scroll := ScrollContainer.new()
        _rect(scroll, panel, 0.08, 0.31, 0.92, 0.79)
        var list := VBoxContainer.new()
        list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        list.add_theme_constant_override("separation", 11)
        scroll.add_child(list)
        for i in range(all_catches.size() - 1, maxi(-1, all_catches.size() - 12), -1):
            var entry: Dictionary = all_catches[i]
            var line := Label.new()
            line.text = "•  %s   —   %.2f кг   /   %s" % [str(entry.get("species", "Рыба")), float(entry.get("weight", 0.0)), str(entry.get("date", "Сегодня"))]
            line.add_theme_font_size_override("font_size", 19)
            line.add_theme_color_override("font_color", ink)
            list.add_child(line)
    _button(panel, "НАЗАД", 0.08, 0.83, 0.92, 0.93, amber, _back_from_settings)

func show_result(success: bool, species: String, weight: float, reason: String) -> void:
    game.menu_open = true
    game.hud_layer.visible = false
    var panel := _page("result", true)
    _label(panel, "ТРОФЕЙ В РУКАХ!" if success else "РЫБА УШЛА", 32, 0.06, 0.085, 0.94, 0.185, amber if success else ink)
    if success:
        _label(panel, "%s   •   %.2f кг" % [species, weight], 27, 0.06, 0.18, 0.94, 0.26, ink)
        _fish_preview(panel, species)
        _label(panel, "Трофей сохранён в журнале.", 19, 0.08, 0.67, 0.92, 0.745, muted)
    else:
        _label(panel, reason, 22, 0.08, 0.30, 0.92, 0.66, ink)
        _label(panel, "Подсекай вовремя. При опасном натяжении отпусти подмотку.", 19, 0.08, 0.65, 0.92, 0.75, muted)
    _button(panel, "НОВЫЙ ЗАБРОС", 0.08, 0.79, 0.92, 0.91, amber, func(): game.retry_cast())

func _fish_preview(panel: Control, species: String) -> void:
    var holder := SubViewportContainer.new()
    holder.stretch = true
    holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _rect(holder, panel, 0.07, 0.28, 0.93, 0.66)
    var viewport := SubViewport.new()
    viewport.size = Vector2i(680, 310)
    viewport.own_world_3d = true
    viewport.transparent_bg = false
    viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    holder.add_child(viewport)

    var env_node := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_COLOR
    env.background_color = Color(0.085, 0.18, 0.19)
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.75, 0.81, 0.76)
    env.ambient_light_energy = 0.67
    env_node.environment = env
    viewport.add_child(env_node)

    var cam := Camera3D.new()
    viewport.add_child(cam)
    cam.position = Vector3(0, 0.06, 3.65)
    cam.fov = 45.0
    cam.look_at(Vector3.ZERO)
    cam.current = true

    var light := DirectionalLight3D.new()
    viewport.add_child(light)
    light.rotation_degrees = Vector3(-39, -28, 10)
    light.light_energy = 1.28

    preview_rig = Node3D.new()
    viewport.add_child(preview_rig)
    var model: Node3D = game.make_fish_visual(species)
    preview_rig.add_child(model)
    var side_angle := _fit_model(model)
    preview_rig.rotation_degrees = Vector3(-4, side_angle, 2)

func _fit_model(model: Node3D) -> float:
    var meshes: Array[MeshInstance3D] = []
    _collect_mesh(model, meshes)
    if meshes.is_empty():
        return 90.0
    var lo := Vector3(INF, INF, INF)
    var hi := Vector3(-INF, -INF, -INF)
    for m in meshes:
        var b := m.get_aabb()
        var transform_in_model := model.global_transform.affine_inverse() * m.global_transform
        for xi in range(2):
            for yi in range(2):
                for zi in range(2):
                    var corner := b.position + Vector3(b.size.x * float(xi), b.size.y * float(yi), b.size.z * float(zi))
                    var p := transform_in_model * corner
                    lo = lo.min(p)
                    hi = hi.max(p)
    var span := hi - lo
    var widest := maxf(span.x, maxf(span.y, span.z))
    var factor := 6.85 / maxf(widest, 0.1)
    var wrapper := Node3D.new()
    model.get_parent().add_child(wrapper)
    model.reparent(wrapper, false)
    model.scale = Vector3.ONE * factor
    model.position = -(lo + hi) * 0.5 * factor
    # Face the camera with the flank, not the fish's snout.
    return 88.0 if span.z > span.x else 0.0

func _collect_mesh(node: Node, out: Array[MeshInstance3D]) -> void:
    if node is MeshInstance3D:
        out.append(node as MeshInstance3D)
    for child in node.get_children():
        _collect_mesh(child, out)

func hide_overlay() -> void:
    visible = false
    game.menu_open = false
    game.hud_layer.visible = true
    preview_rig = null

func _label(parent: Control, message: String, font_size: int, l: float, t: float, r: float, b: float, color: Color) -> Label:
    var label := Label.new()
    label.text = message
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_color", color)
    label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    label.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _rect(label, parent, l, t, r, b)
    return label

func _button(parent: Control, label_text: String, l: float, t: float, r: float, b: float, fill: Color, callback: Callable) -> Button:
    var bnode := Button.new()
    bnode.text = label_text
    bnode.add_theme_font_size_override("font_size", 23)
    bnode.add_theme_color_override("font_color", Color(0.98, 0.99, 0.97))
    bnode.add_theme_color_override("font_hover_color", Color(1, 1, 1))
    var box := StyleBoxFlat.new()
    box.bg_color = fill
    box.set_corner_radius_all(11)
    bnode.add_theme_stylebox_override("normal", box)
    var hover := box.duplicate() as StyleBoxFlat
    hover.bg_color = fill.lightened(0.13)
    bnode.add_theme_stylebox_override("hover", hover)
    var pressed := box.duplicate() as StyleBoxFlat
    pressed.bg_color = fill.darkened(0.17)
    bnode.add_theme_stylebox_override("pressed", pressed)
    bnode.pressed.connect(callback)
    _rect(bnode, parent, l, t, r, b)
    return bnode

func _rect(node: Control, parent: Control, l: float, t: float, r: float, b: float) -> void:
    node.anchor_left = l
    node.anchor_top = t
    node.anchor_right = r
    node.anchor_bottom = b
    node.offset_left = 0
    node.offset_top = 0
    node.offset_right = 0
    node.offset_bottom = 0
    parent.add_child(node)
