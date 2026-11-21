extends Node3D
## Fishing: First Cast — an isolated, playable Godot 4 mobile prototype.
## Procedural art is intentional; the core loop is the test, not photoreal assets.

enum Phase { READY, CASTING, WAITING, BITE, FIGHT, RESULT }

var rng := RandomNumberGenerator.new()
var phase: Phase = Phase.READY
var elapsed := 0.0
var timer := 0.0
var bite_delay := 4.0
var cast_source := Vector3.ZERO
var cast_target := Vector3.ZERO
var tension := 23.0
var fight_distance := 25.0
var fish_strength := 1.0
var fish_weight := 0.0
var fish_name := ""
var lure_index := 0
var is_reeling := false
var is_bracing := false
var ripple_age := 99.0
var catch_count := 0
var best_weight := 0.0
var result_text := ""

var camera: Camera3D
var rod_root: Node3D
var rod_tip: Marker3D
var reel_spool: MeshInstance3D
var bobber: Node3D
var fish_body: Node3D
var ring: MeshInstance3D
var line_mesh: ImmediateMesh
var line_node: MeshInstance3D

var title_label: Label
var message_label: Label
var stats_label: Label
var catch_label: Label
var tension_bar: ProgressBar
var action_button: Button
var lure_button: Button
var reel_button: Button
var brace_button: Button

func _ready() -> void:
    rng.seed = 20261121
    _create_environment()
    _create_shore()
    _create_rod()
    _create_bobber_and_fish()
    _create_ui()
    _reset_to_ready()
    set_process(true)

func _process(delta: float) -> void:
    elapsed += delta
    ripple_age += delta
    if rod_root != null:
        rod_root.rotation.x = -0.04 + sin(elapsed * 1.2) * 0.008
        if phase == Phase.CASTING:
            rod_root.rotation.x -= sin(PI * clampf(timer / 1.25, 0.0, 1.0)) * 0.34
        if phase == Phase.FIGHT:
            rod_root.rotation.x -= clampf(tension / 400.0, 0.0, 0.26)
    if reel_spool != null and is_reeling and phase == Phase.FIGHT:
        reel_spool.rotate_z(delta * 17.0)

    match phase:
        Phase.CASTING:
            timer += delta
            var alpha := clampf(timer / 1.25, 0.0, 1.0)
            bobber.position = cast_source.lerp(cast_target, alpha)
            bobber.position.y += sin(alpha * PI) * 3.3
            if alpha >= 1.0:
                phase = Phase.WAITING
                timer = 0.0
                bite_delay = rng.randf_range(2.7, 6.0)
                _splash()
                _set_message("Поплавок на воде. Следи за поклёвкой.")
                _update_buttons()
        Phase.WAITING:
            timer += delta
            bobber.position.y = 0.09 + sin(elapsed * 2.8) * 0.045
            if timer >= bite_delay:
                phase = Phase.BITE
                timer = 0.0
                _choose_fish()
                _splash()
                _set_message("ПОКЛЁВКА! Подсекай, пока рыба не ушла!")
                _update_buttons()
        Phase.BITE:
            timer += delta
            bobber.position.y = -0.06 + absf(sin(elapsed * 12.0)) * 0.20
            if timer >= 1.75:
                _finish("Опоздал с подсечкой. Рыба ушла.")
        Phase.FIGHT:
            _update_fight(delta)
        _:
            if bobber.visible and phase == Phase.RESULT:
                bobber.position.y = 0.09 + sin(elapsed * 2.2) * 0.035

    if ring.visible:
        ring.scale = Vector3.ONE * (1.0 + minf(ripple_age, 2.0) * 2.0)
        if ripple_age > 1.25:
            ring.visible = false
    _draw_line()
    _update_stats()

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventScreenDrag:
        _look_drag(event.relative)
    elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
        _look_drag(event.relative)
    elif event is InputEventKey and not event.echo:
        if event.keycode == KEY_SPACE and event.pressed:
            _main_action()
        elif event.keycode == KEY_TAB and event.pressed:
            _toggle_lure()
        elif event.keycode == KEY_R:
            is_reeling = event.pressed
        elif event.keycode == KEY_SHIFT:
            is_bracing = event.pressed

func _look_drag(movement: Vector2) -> void:
    camera.rotation.y = clampf(camera.rotation.y - movement.x * 0.0035, -0.68, 0.68)
    camera.rotation.x = clampf(camera.rotation.x - movement.y * 0.002, -0.20, 0.11)

func _create_environment() -> void:
    camera = Camera3D.new()
    add_child(camera)
    camera.position = Vector3(0, 1.68, 9.2)
    camera.fov = 70.0
    camera.far = 230.0
    camera.look_at(Vector3(0, 0.3, -30.0), Vector3.UP)
    camera.current = true

    var light := DirectionalLight3D.new()
    add_child(light)
    light.rotation_degrees = Vector3(-38, -52, -8)
    light.light_color = Color(1.0, 0.88, 0.71)
    light.light_energy = 1.2
    light.shadow_enabled = true

    var world_env := WorldEnvironment.new()
    add_child(world_env)
    var env := Environment.new()
    env.background_mode = Environment.BG_SKY
    var sky := Sky.new()
    var sky_mat := ProceduralSkyMaterial.new()
    sky_mat.sky_top_color = Color(0.33, 0.50, 0.67)
    sky_mat.sky_horizon_color = Color(0.76, 0.77, 0.68)
    sky_mat.ground_horizon_color = Color(0.48, 0.59, 0.55)
    sky_mat.ground_bottom_color = Color(0.19, 0.26, 0.25)
    sky.sky_material = sky_mat
    env.sky = sky
    env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
    env.reflected_light_source = Environment.REFLECTION_SOURCE_BG
    env.fog_enabled = true
    env.fog_light_color = Color(0.67, 0.72, 0.69)
    env.fog_density = 0.004
    world_env.environment = env

func _create_shore() -> void:
    var water_plane := PlaneMesh.new()
    water_plane.size = Vector2(240, 200)
    water_plane.subdivide_width = 80
    water_plane.subdivide_depth = 80
    var water_material := ShaderMaterial.new()
    water_material.shader = load("res://shaders/water.gdshader")
    _mesh(self, water_plane, Vector3(0, 0, -95), Vector3.ONE, water_material)

    var sand := _material(Color(0.38, 0.32, 0.23), 0.97)
    var grass := _material(Color(0.21, 0.28, 0.18), 0.96)
    var dark_green := _material(Color(0.12, 0.23, 0.18), 0.96)
    var pine_green := _material(Color(0.12, 0.28, 0.22), 0.96)
    var bark := _material(Color(0.23, 0.19, 0.15), 0.98)
    var grey := _material(Color(0.33, 0.34, 0.31), 0.94)

    var shore := BoxMesh.new()
    shore.size = Vector3(250, 0.65, 20)
    _mesh(self, shore, Vector3(0, -0.28, 14), Vector3.ONE, sand)

    var back_bank := BoxMesh.new()
    back_bank.size = Vector3(260, 2.0, 37)
    _mesh(self, back_bank, Vector3(0, -0.4, -111), Vector3.ONE, grass)
    var far_hill := SphereMesh.new()
    for i in range(9):
        var x := (float(i) - 4.0) * 27.0
        _mesh(self, far_hill, Vector3(x, -2.0, -134), Vector3(rng.randf_range(19.0, 35.0), rng.randf_range(6.0, 12.0), 20.0), dark_green)

    for i in range(66):
        var far_x := rng.randf_range(-112.0, 112.0)
        var far_z := rng.randf_range(-102.0, -125.0)
        _tree(Vector3(far_x, 0.1, far_z), rng.randf_range(4.0, 10.0), bark, pine_green)

    # Nearby rocks and reeds frame the view without blocking the water.
    for i in range(35):
        var side := -1.0 if i % 2 == 0 else 1.0
        var x := side * rng.randf_range(8.0, 32.0)
        var z := rng.randf_range(3.5, 17.0)
        _tree(Vector3(x, 0.15, z), rng.randf_range(4.5, 9.5), bark, dark_green)
    for i in range(48):
        var side := -1.0 if i % 2 == 0 else 1.0
        var x := side * rng.randf_range(1.8, 19.0)
        var z := rng.randf_range(3.3, 6.0)
        var stalk_height := rng.randf_range(0.35, 1.05)
        _cylinder(self, Vector3(x, 0, z), Vector3(x + rng.randf_range(-0.07, 0.07), stalk_height, z), 0.017, grass)
    for i in range(20):
        var side := -1.0 if i % 2 == 0 else 1.0
        var x := side * rng.randf_range(2.5, 28.0)
        var rock := SphereMesh.new()
        _mesh(self, rock, Vector3(x, 0.03, rng.randf_range(3.5, 7.3)), Vector3(rng.randf_range(0.20, 0.65), rng.randf_range(0.14, 0.35), rng.randf_range(0.2, 0.56)), grey)

func _create_rod() -> void:
    rod_root = Node3D.new()
    camera.add_child(rod_root)
    rod_root.position = Vector3(0.30, -0.40, -0.52)
    var rod_dark := _material(Color(0.095, 0.11, 0.12), 0.34)
    var rod_grey := _material(Color(0.37, 0.39, 0.37), 0.30)
    var cork := _material(Color(0.35, 0.26, 0.18), 0.79)
    _cylinder(rod_root, Vector3(0.14, -0.16, 0.23), Vector3(0.03, -0.05, -0.75), 0.065, cork)
    _cylinder(rod_root, Vector3(0.03, -0.05, -0.75), Vector3(-0.14, 0.18, -1.64), 0.026, rod_dark)
    _cylinder(rod_root, Vector3(-0.14, 0.18, -1.64), Vector3(-0.29, 0.39, -2.86), 0.010, rod_dark)
    _cylinder(rod_root, Vector3(0.03, 0.015, -0.55), Vector3(0.03, -0.31, -0.55), 0.025, rod_grey)
    reel_spool = _cylinder(rod_root, Vector3(-0.08, -0.30, -0.55), Vector3(0.19, -0.30, -0.55), 0.13, rod_grey)
    rod_tip = Marker3D.new()
    rod_root.add_child(rod_tip)
    rod_tip.position = Vector3(-0.29, 0.39, -2.86)

    line_mesh = ImmediateMesh.new()
    line_node = MeshInstance3D.new()
    line_node.mesh = line_mesh
    line_node.material_override = _material(Color(0.9, 0.93, 0.89), 0.8)
    add_child(line_node)

func _create_bobber_and_fish() -> void:
    bobber = Node3D.new()
    add_child(bobber)
    var orange := _material(Color(0.97, 0.22, 0.13), 0.44)
    var white := _material(Color(0.94, 0.91, 0.80), 0.53)
    var top := SphereMesh.new()
    _mesh(bobber, top, Vector3(0, 0.095, 0), Vector3(0.16, 0.20, 0.16), orange)
    _mesh(bobber, top, Vector3(0, -0.015, 0), Vector3(0.17, 0.12, 0.17), white)
    _cylinder(bobber, Vector3(0, 0.22, 0), Vector3(0, 0.41, 0), 0.018, white)
    bobber.visible = false

    var torus := TorusMesh.new()
    torus.inner_radius = 0.40
    torus.outer_radius = 0.43
    ring = _mesh(self, torus, Vector3.ZERO, Vector3.ONE, _material(Color(0.80, 0.88, 0.82), 0.45))
    ring.visible = false

    fish_body = Node3D.new()
    add_child(fish_body)
    var fish_mat := _material(Color(0.32, 0.40, 0.23), 0.56)
    var belly_mat := _material(Color(0.69, 0.67, 0.48), 0.56)
    _mesh(fish_body, SphereMesh.new(), Vector3.ZERO, Vector3(0.27, 0.18, 0.62), fish_mat)
    _mesh(fish_body, SphereMesh.new(), Vector3(0, -0.10, 0), Vector3(0.20, 0.10, 0.51), belly_mat)
    var tail := PrismMesh.new()
    tail.size = Vector3(0.43, 0.38, 0.26)
    _mesh(fish_body, tail, Vector3(0, 0, 0.68), Vector3.ONE, fish_mat)
    fish_body.visible = false

func _create_ui() -> void:
    var ui := CanvasLayer.new()
    add_child(ui)
    var root := Control.new()
    root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    root.mouse_filter = Control.MOUSE_FILTER_PASS
    ui.add_child(root)

    var shade := ColorRect.new()
    shade.color = Color(0.02, 0.07, 0.08, 0.70)
    shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _place(shade, 0, 0, 1, 0.14)
    root.add_child(shade)

    var lower := ColorRect.new()
    lower.color = Color(0.025, 0.065, 0.065, 0.76)
    lower.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _place(lower, 0, 0.72, 1, 1)
    root.add_child(lower)

    title_label = _label(root, "ПЕРВЫЙ ЗАБРОС  •  ТИХОЕ ОЗЕРО", 27, 0.03, 0.012, 0.73, 0.067)
    message_label = _label(root, "", 21, 0.03, 0.073, 0.82, 0.13)
    catch_label = _label(root, "Улов: 0  •  Рекорд: —", 21, 0.66, 0.024, 0.985, 0.092)
    stats_label = _label(root, "", 21, 0.03, 0.73, 0.95, 0.785)

    tension_bar = ProgressBar.new()
    tension_bar.min_value = 0
    tension_bar.max_value = 100
    tension_bar.show_percentage = false
    _place(tension_bar, 0.44, 0.795, 0.965, 0.83)
    root.add_child(tension_bar)

    action_button = _button(root, "ЗАБРОС", 0.025, 0.835, 0.28, 0.96, Color(0.83, 0.49, 0.24))
    action_button.pressed.connect(_main_action)
    lure_button = _button(root, "ЧЕРВЬ", 0.30, 0.835, 0.47, 0.96, Color(0.24, 0.42, 0.44))
    lure_button.pressed.connect(_toggle_lure)
    reel_button = _button(root, "МОТАТЬ", 0.50, 0.835, 0.73, 0.96, Color(0.13, 0.47, 0.51))
    reel_button.button_down.connect(func() -> void: is_reeling = true)
    reel_button.button_up.connect(func() -> void: is_reeling = false)
    brace_button = _button(root, "ДЕРЖАТЬ", 0.75, 0.835, 0.975, 0.96, Color(0.36, 0.41, 0.28))
    brace_button.button_down.connect(func() -> void: is_bracing = true)
    brace_button.button_up.connect(func() -> void: is_bracing = false)

func _label(parent: Control, txt: String, font_size: int, l: float, t: float, r: float, b: float) -> Label:
    var result := Label.new()
    result.text = txt
    result.add_theme_font_size_override("font_size", font_size)
    result.add_theme_color_override("font_color", Color(0.96, 0.95, 0.87))
    result.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
    result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    _place(result, l, t, r, b)
    parent.add_child(result)
    return result

func _button(parent: Control, txt: String, l: float, t: float, r: float, b: float, color: Color) -> Button:
    var result := Button.new()
    result.text = txt
    result.add_theme_font_size_override("font_size", 23)
    result.add_theme_color_override("font_color", Color(1, 1, 1))
    var normal := StyleBoxFlat.new()
    normal.bg_color = color
    normal.set_corner_radius_all(11)
    result.add_theme_stylebox_override("normal", normal)
    var down := normal.duplicate() as StyleBoxFlat
    down.bg_color = color.darkened(0.3)
    result.add_theme_stylebox_override("pressed", down)
    var disabled := normal.duplicate() as StyleBoxFlat
    disabled.bg_color = Color(0.17, 0.21, 0.20)
    result.add_theme_stylebox_override("disabled", disabled)
    _place(result, l, t, r, b)
    parent.add_child(result)
    return result

func _place(node: Control, l: float, t: float, r: float, b: float) -> void:
    node.anchor_left = l
    node.anchor_top = t
    node.anchor_right = r
    node.anchor_bottom = b
    node.offset_left = 0
    node.offset_top = 0
    node.offset_right = 0
    node.offset_bottom = 0

func _material(col: Color, roughness: float) -> StandardMaterial3D:
    var result := StandardMaterial3D.new()
    result.albedo_color = col
    result.roughness = roughness
    return result

func _mesh(parent: Node3D, shape: Mesh, p: Vector3, sc: Vector3, mat: Material) -> MeshInstance3D:
    var result := MeshInstance3D.new()
    result.mesh = shape
    result.position = p
    result.scale = sc
    result.material_override = mat
    parent.add_child(result)
    return result

func _cylinder(parent: Node3D, a: Vector3, b: Vector3, radius: float, mat: Material) -> MeshInstance3D:
    var shape := CylinderMesh.new()
    shape.top_radius = radius
    shape.bottom_radius = radius
    shape.height = a.distance_to(b)
    shape.radial_segments = 8
    var result := _mesh(parent, shape, (a + b) * 0.5, Vector3.ONE, mat)
    result.quaternion = Quaternion(Vector3.UP, (b - a).normalized())
    return result

func _tree(p: Vector3, height: float, trunk_mat: Material, needles: Material) -> void:
    _cylinder(self, p, p + Vector3.UP * height * 0.48, maxf(0.065, height * 0.022), trunk_mat)
    for tier in range(3):
        var cone := CylinderMesh.new()
        cone.top_radius = 0.0
        cone.bottom_radius = height * (0.20 - tier * 0.032)
        cone.height = height * 0.47
        cone.radial_segments = 6
        _mesh(self, cone, p + Vector3.UP * (height * (0.56 + tier * 0.16)), Vector3.ONE, needles)

func _main_action() -> void:
    match phase:
        Phase.READY:
            _cast()
        Phase.BITE:
            phase = Phase.FIGHT
            timer = 0.0
            tension = 27.0
            fight_distance = camera.global_position.distance_to(bobber.global_position)
            _set_message("Рыба на крючке! Мотай, но не порви леску.")
            _update_buttons()
        Phase.RESULT:
            _reset_to_ready()
            _cast()

func _toggle_lure() -> void:
    if phase != Phase.READY and phase != Phase.RESULT:
        return
    lure_index = 1 - lure_index
    lure_button.text = "ЧЕРВЬ" if lure_index == 0 else "БЛЕСНА"
    _set_message("Червь: карась и окунь." if lure_index == 0 else "Блесна: окунь и щука.")

func _reset_to_ready() -> void:
    phase = Phase.READY
    is_reeling = false
    is_bracing = false
    bobber.visible = false
    fish_body.visible = false
    line_mesh.clear_surfaces()
    _set_message("Выбери приманку и забрось в озеро.")
    _update_buttons()

func _cast() -> void:
    phase = Phase.CASTING
    timer = 0.0
    cast_source = rod_tip.global_position
    var forward := -camera.global_transform.basis.z
    forward.y = 0
    forward = forward.normalized()
    cast_target = camera.global_position + forward * 27.0
    cast_target.y = 0.09
    cast_target.z = minf(1.5, cast_target.z)
    bobber.visible = true
    bobber.global_position = cast_source
    _set_message("Заброс! Следи за леской и поверхностью воды.")
    _update_buttons()

func _choose_fish() -> void:
    var roll := rng.randf()
    if lure_index == 0:
        fish_name = "Карась" if roll < 0.60 else "Окунь"
        fish_strength = 0.85 if fish_name == "Карась" else 1.2
        fish_weight = rng.randf_range(0.25, 1.3) if fish_name == "Карась" else rng.randf_range(0.18, 0.8)
    else:
        fish_name = "Окунь" if roll < 0.40 else "Щука"
        fish_strength = 1.1 if fish_name == "Окунь" else 1.95
        fish_weight = rng.randf_range(0.25, 0.95) if fish_name == "Окунь" else rng.randf_range(1.3, 4.6)

func _update_fight(delta: float) -> void:
    var fish_run := 0.8 + sin(elapsed * (1.3 + fish_strength * 0.3)) * 0.6
    if is_reeling:
        fight_distance -= (2.15 + (0.45 if is_bracing else 0.0)) * delta
        tension += (15.0 + fish_strength * 4.0 + (11.0 if is_bracing else 0.0)) * delta
    else:
        fight_distance += (0.48 + fish_strength * 0.35 + maxf(0.0, fish_run)) * delta
        tension -= 22.0 * delta
    if is_bracing and not is_reeling:
        fight_distance -= 0.65 * delta
        tension += 6.0 * delta
    tension += sin(elapsed * 3.3) * fish_strength * delta * 2.0
    tension = clampf(tension, 0.0, 110.0)
    if tension >= 100.0:
        _finish("Обрыв! Слишком сильное натяжение лески.")
        return
    if fight_distance > 38.0:
        _finish("Рыба ушла далеко и сорвалась с крючка.")
        return
    if fight_distance <= 2.5:
        catch_count += 1
        best_weight = maxf(best_weight, fish_weight)
        _finish("ТРОФЕЙ: %s, %.2f кг! Отличная работа." % [fish_name, fish_weight])
        return
    var forward := -camera.global_transform.basis.z
    forward.y = 0.0
    forward = forward.normalized()
    var fish_target := camera.global_position + forward * fight_distance
    fish_target.y = 0.11
    bobber.position = bobber.position.lerp(fish_target, minf(1.0, delta * 2.0))
    var show_jump := sin(elapsed * 2.9) > 0.74
    fish_body.visible = show_jump and fight_distance < 16.0
    fish_body.position = bobber.position + Vector3(0, 0.10 + absf(sin(elapsed * 3.8)) * 0.35, 0.6)
    fish_body.rotation.y = sin(elapsed * 2.2) * 0.6
    fish_body.rotation.z = sin(elapsed * 7.0) * 0.18
    if show_jump and ripple_age > 1.3:
        _splash()

func _finish(text: String) -> void:
    phase = Phase.RESULT
    result_text = text
    fish_body.visible = false
    is_reeling = false
    is_bracing = false
    _set_message(text)
    _update_buttons()

func _splash() -> void:
    ripple_age = 0.0
    ring.position = Vector3(bobber.position.x, 0.035, bobber.position.z)
    ring.scale = Vector3.ONE
    ring.visible = true

func _draw_line() -> void:
    line_mesh.clear_surfaces()
    if not bobber.visible:
        return
    var tip := rod_tip.global_position
    var last := bobber.global_position + Vector3.UP * 0.18
    var mid := tip.lerp(last, 0.53)
    mid.y -= 0.12 if phase == Phase.FIGHT else 0.55
    line_mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
    line_mesh.surface_add_vertex(tip)
    line_mesh.surface_add_vertex(mid)
    line_mesh.surface_add_vertex(last)
    line_mesh.surface_end()

func _set_message(txt: String) -> void:
    if message_label != null:
        message_label.text = txt

func _update_buttons() -> void:
    if action_button == null:
        return
    match phase:
        Phase.READY:
            action_button.text = "ЗАБРОС"
        Phase.CASTING:
            action_button.text = "ЛЕТИТ..."
        Phase.WAITING:
            action_button.text = "ЖДЁМ..."
        Phase.BITE:
            action_button.text = "ПОДСЕЧЬ!"
        Phase.FIGHT:
            action_button.text = "ВЫВАЖИВАНИЕ"
        Phase.RESULT:
            action_button.text = "ЕЩЁ ЗАБРОС"
    action_button.disabled = phase == Phase.CASTING or phase == Phase.WAITING or phase == Phase.FIGHT
    lure_button.disabled = phase != Phase.READY and phase != Phase.RESULT
    reel_button.disabled = phase != Phase.FIGHT
    brace_button.disabled = phase != Phase.FIGHT
    tension_bar.visible = phase == Phase.FIGHT

func _update_stats() -> void:
    if stats_label == null:
        return
    if phase == Phase.FIGHT:
        stats_label.text = "%s  •  Дистанция: %.1f м  •  Натяжение: %d%%" % [fish_name, fight_distance, int(tension)]
        tension_bar.value = clampf(tension, 0.0, 100.0)
    elif phase == Phase.BITE:
        stats_label.text = "Окно подсечки: %.1f сек." % maxf(0.0, 1.75 - timer)
    else:
        stats_label.text = "Наживка: %s  •  Свайп — обзор" % ("червь" if lure_index == 0 else "блесна")
    catch_label.text = "Улов: %d  •  Рекорд: %s" % [catch_count, ("%.2f кг" % best_weight) if best_weight > 0.0 else "—"]
