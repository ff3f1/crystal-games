extends Node3D
## Fishing: First Cast — an isolated, playable Godot 4 mobile prototype.
## Mobile-first realistic lake renderer, physical fish, and visual-only first-person gear.

enum Phase { READY, CASTING, WAITING, BITE, FIGHT, LANDING, RESULT }

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
var menu_open := true
var session_started := false
var profile: Dictionary = {"volume": 0.7, "sensitivity": 1.0, "fov": 70.0, "shadows": true}
var catches: Array[Dictionary] = []
var hud_layer: CanvasLayer
var overlay: CanvasLayer
var sounds: Node
var sun_light: DirectionalLight3D
var hands: Node3D
var landing_from := Vector3.ZERO
var last_sound_reel := 0.0
var last_drag_sound := -10.0
var last_rod_creak := -10.0
var lure_sim
var fight_sim
var ecology
var lake_hour := 7.1
var wind := 0.28
var last_footstep := -10.0
var current_bite_species := ""
var bite_sign_age := 99.0
var shoreline_activity := 0.0
var rod_angle := 0.0
var rod_spring_speed := 0.0
var fish_population: Node3D
var pending_fish_id := -1
var fight_world_pos := Vector3.ZERO
var fight_world_axis := Vector3.FORWARD
var fight_world_side := Vector3.RIGHT
var fight_prev_pos := Vector3.ZERO
var staged_fish_body: Node3D
var fish_swim_clock := 0.0
var activity_rings: Array[MeshInstance3D] = []
var minimap: Control
var lure_depth := 0.0
var fish_spots: Array[Dictionary] = [
    {"pos": Vector3(-8.0, 0.0, -18.0), "type": "carp", "name": "Травяная заводь"},
    {"pos": Vector3(11.0, 0.0, -23.0), "type": "perch", "name": "Каменная гряда"},
    {"pos": Vector3(0.0, 0.0, -33.0), "type": "pike", "name": "Глубокий свал"},
    {"pos": Vector3(-20.0, 0.0, -25.0), "type": "perch", "name": "Коряжник"}
]
var drag_button: Button
var stamina_label: Label
var bait_underwater: MeshInstance3D
var worm_hook: MeshInstance3D
var lure_view: Control
var spinner_glint: MeshInstance3D
var float_parts: Array[MeshInstance3D] = []
var bite_window := 2.0
var cast_charging := false
var cast_charge := 0.64
var cast_charge_bar: ProgressBar

var shore_art: Node3D
var joystick_vector := Vector2.ZERO
var joystick_touch_id := -1
var look_touch_id := -1
var joystick_origin := Vector2.ZERO
var joystick_knob: Panel
var player_walk_phase := 0.0

var camera: Camera3D
var rod_root: Node3D
var rod_tip: Marker3D
var reel_spool: MeshInstance3D
var reel_crank: Node3D
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
    rng.randomize()
    _load_profile()
    _create_environment()
    _create_shore()
    _create_rod()
    _create_bobber_and_fish()
    lure_sim = (load("res://scripts/lure_physics.gd") as GDScript).new()
    fight_sim = (load("res://scripts/fight_physics.gd") as GDScript).new()
    ecology = (load("res://scripts/lake_ecology.gd") as GDScript).new()
    _create_hotspots()
    _create_lake_population()
    _create_ui()
    sounds = (load("res://scripts/soundscape.gd") as GDScript).new() as Node
    add_child(sounds)
    sounds.call("set_volume_fraction", float(profile["volume"]))
    overlay = (load("res://scripts/interface.gd") as GDScript).new() as CanvasLayer
    overlay.set("game", self)
    add_child(overlay)
    _reset_to_ready()
    apply_video_settings()
    overlay.call("show_home")
    set_process(true)

func _process(delta: float) -> void:
    elapsed += delta
    if menu_open:
        return
    _update_player(delta)
    ripple_age += delta
    bite_sign_age += delta
    if bobber != null:
        bobber.rotation.x = move_toward(bobber.rotation.x, 0.0, delta * 2.2)
    lake_hour = fposmod(lake_hour + delta * 0.0014, 24.0)
    wind = clampf(0.31 + 0.22 * sin(elapsed * 0.015), 0.05, 0.68)
    _animate_lake(delta)
    # The full fish population keeps swimming even when the angler is not
    # fishing. Only WAITING permits a fish to chase the actual bait.
    if phase == Phase.BITE:
        # Keep the attacking resident physically at the bait until the
        # hook window expires or the player's real input sets the hook.
        fish_population.call(
            "simulate", delta, true,
            Vector3(lure_sim.position.x, -lure_sim.depth, lure_sim.position.z),
            lure_index, float(lure_sim.retrieve_speed), 0.0,
            lake_hour, wind, camera.global_position
        )
    elif phase != Phase.WAITING:
        fish_population.call(
            "simulate", delta, false, Vector3.ZERO, lure_index,
            0.0, 0.0, lake_hour, wind, camera.global_position
        )
    if cast_charging and (phase == Phase.READY or phase == Phase.RESULT):
        cast_charge = clampf(cast_charge + delta * 0.48, 0.64, 1.0)
    if hands != null:
        hands.call("set_winding", is_reeling)
    if rod_root != null:
        # Elastic loaded blank: damped return, no instant angular snapping.
        var bending := 0.0
        if phase == Phase.CASTING:
            bending = -sin(PI * clampf(timer / 1.35, 0.0, 1.0)) * 0.34
        elif phase == Phase.FIGHT:
            bending = -0.10 - clampf(tension / 245.0, 0.0, 0.40)
            bending += sin(elapsed * 8.2) * float(fight_sim.burst) * 0.015
        var dt := minf(delta, 0.05)
        rod_spring_speed += ((bending - rod_angle) * 38.0 - rod_spring_speed * 11.5) * dt
        rod_angle += rod_spring_speed * dt
        rod_root.rotation.x = -0.04 + rod_angle + sin(elapsed * 1.2) * 0.005
    if reel_spool != null:
        if is_reeling and (phase == Phase.FIGHT or phase == Phase.WAITING):
            reel_spool.rotate_z(delta * 17.0)
            if reel_crank != null:
                reel_crank.rotate_x(delta * 17.0)
        elif phase == Phase.FIGHT and float(fight_sim.slip_velocity) > 0.04:
            # Drag payout should visibly spin the crank backward too.
            reel_spool.rotate_z(-delta * float(fight_sim.slip_velocity) * 16.0)
            if reel_crank != null:
                reel_crank.rotate_x(-delta * float(fight_sim.slip_velocity) * 10.0)

    match phase:
        Phase.CASTING:
            timer += delta
            var landed: bool = lure_sim.tick_air(delta)
            bobber.position = lure_sim.position
            if landed:
                phase = Phase.WAITING
                timer = 0.0
                bite_delay = rng.randf_range(4.3, 7.1)
                _splash()
                sounds.call("play", "splash")
                _set_message("Поплавок в воде. Следи за поклёвкой." if lure_index == 0 else "Блесна в воде. Удерживай «ВЕСТИ» и подыгрывай рывками.")
                _update_buttons()
        Phase.WAITING:
            lure_sim.tick_water(delta, is_reeling, is_bracing, camera.global_position)
            lure_depth = lure_sim.depth
            bobber.position = lure_sim.visible_surface_position()
            bobber.position.y += sin(elapsed * 2.8) * (0.018 + wind * 0.023)
            bobber.rotation.z = sin(elapsed * 2.2) * (0.035 + wind * 0.05)
            if bite_sign_age < 1.4:
                # A real nibble first tilts the float and creates a tiny dip.
                var tap := sin(bite_sign_age * 11.0) * exp(-bite_sign_age * 1.65)
                bobber.position.y -= maxf(0.0, tap) * 0.14
                bobber.rotation.x += tap * 0.14
            if spinner_glint != null:
                spinner_glint.scale = Vector3.ONE * (0.95 + sin(elapsed * 7.4) * 0.10)
            if bait_underwater != null:
                bait_underwater.visible = lure_index == 1
                bait_underwater.global_position = lure_sim.position
                # The metal spoon now has a curved 3D body with rigged hook.
                # A pull makes it flash and roll; a pause lets it settle.
                bait_underwater.rotation.y += delta * (10.0 if is_reeling else 1.2)
                bait_underwater.rotation.z = sin(elapsed * (12.0 if is_reeling else 2.0)) * (0.42 if is_reeling else 0.08)
                bait_underwater.rotation.x = sin(elapsed * 5.4) * (0.21 if is_reeling else 0.045)
            if worm_hook != null:
                worm_hook.visible = lure_index == 0
                worm_hook.global_position = Vector3(lure_sim.position.x, -lure_sim.depth, lure_sim.position.z)
                worm_hook.rotation.y = sin(elapsed * 1.4) * 0.16
            # Fish react to appropriate food and motion, not an arbitrary
            # strike countdown. A short nibble precedes a proper hook window.
            # The bait is a world-space point at its actual depth, NOT an
            # invisible random bite table. Physical resident fish inspect it.
            var lure_world := Vector3(lure_sim.position.x, -lure_sim.depth, lure_sim.position.z)
            var reaction: Dictionary = fish_population.call(
                "simulate", delta, true, lure_world, lure_index,
                float(lure_sim.retrieve_speed), float(lure_sim.twitch_boost),
                lake_hour, wind, camera.global_position
            )
            shoreline_activity = float(reaction["activity"])
            timer += delta
            if lure_index == 1 and lure_sim.is_near_angler(camera.global_position):
                ecology.reset_cast()
                _reset_to_ready()
                _set_message("Блесна у берега. Сменишь глубину или проводку?")
            elif int(reaction["signal"]) == 1:
                current_bite_species = str(reaction["species"])
                bite_sign_age = 0.0
                _splash()
                sounds.call("play", "nibble")
                _set_message("Осторожная поклёвка... Не спеши подсекать!")
            elif int(reaction["signal"]) == 2:
                current_bite_species = str(reaction["species"])
                pending_fish_id = int(reaction["id"])
                phase = Phase.BITE
                timer = 0.0
                _choose_fish()
                is_reeling = false
                is_bracing = false
                bite_sign_age = 0.0
                _splash()
                sounds.call("play", "bite")
                _set_message("УВЕРЕННАЯ ПОКЛЁВКА! Сейчас подсекай!")
                _update_buttons()
        Phase.BITE:
            timer += delta
            bobber.position.y = -0.06 + absf(sin(elapsed * 12.0)) * 0.20
            if timer >= bite_window:
                _finish("Опоздал с подсечкой. Рыба ушла.")
        Phase.FIGHT:
            _update_fight(delta)
        Phase.LANDING:
            timer += delta
            var progress := clampf(timer / 1.55, 0.0, 1.0)
            fish_body.visible = true
            var forward := -camera.global_transform.basis.z
            forward.y = 0.0
            forward = forward.normalized()
            var landing_target := camera.global_position + forward * 2.4 + Vector3.UP * 0.60
            fish_body.global_position = landing_from.lerp(landing_target, progress)
            fish_population.call("move_hooked", fish_body.global_position)
            fish_body.rotation.z = sin(elapsed * 14.0) * 0.24 * (1.0 - progress)
            fish_body.rotation.x = sin(elapsed * 11.0) * 0.13 * (1.0 - progress)
            if fish_body.has_method("set_wiggle"):
                fish_body.call("set_wiggle", 1.85 * (1.0 - progress) + 0.15)
            else:
                for visual in fish_body.get_children():
                    if visual.has_method("set_wiggle"):
                        visual.call("set_wiggle", 1.85 * (1.0 - progress) + 0.15)
            if progress >= 1.0:
                _record_catch()
                sounds.call("play", "catch")
                _finish("Трофей: %s, %.2f кг!" % [fish_name, fish_weight], true)
        _:
            if bobber.visible and phase == Phase.RESULT:
                bobber.position.y = 0.09 + sin(elapsed * 2.2) * 0.035

    if ring.visible:
        var ripple_shader := ring.material_override as ShaderMaterial
        if ripple_shader != null:
            ripple_shader.set_shader_parameter("age", ripple_age)
            ripple_shader.set_shader_parameter("wind", wind)
        if ripple_age > 1.72:
            ring.visible = false
    _draw_line()
    if lure_view != null:
        var lens_active := phase == Phase.WAITING or phase == Phase.BITE or phase == Phase.FIGHT
        var lens_position := fish_body.global_position if phase == Phase.FIGHT else Vector3(lure_sim.position.x, -lure_sim.depth, lure_sim.position.z)
        lure_view.call("update_bait_view", delta, lens_active, lens_position, camera.global_position)
    _update_stats()
    if minimap != null:
        minimap.queue_redraw()
    if cast_charging and cast_charge_bar != null:
        cast_charge_bar.value = cast_charge * 100.0

func _input(event: InputEvent) -> void:
    if menu_open:
        return
    if event is InputEventScreenTouch:
        var view_size := get_viewport().get_visible_rect().size
        if event.pressed:
            if event.position.x < view_size.x * 0.32 and event.position.y > view_size.y * 0.52 and joystick_touch_id == -1:
                joystick_touch_id = event.index
                joystick_origin = Vector2(103.0, view_size.y - 87.0)
                _move_joystick(event.position)
            elif look_touch_id == -1 and event.position.y < view_size.y * 0.73:
                look_touch_id = event.index
        else:
            if event.index == joystick_touch_id:
                joystick_touch_id = -1
                joystick_vector = Vector2.ZERO
                _update_joystick_knob()
            if event.index == look_touch_id:
                look_touch_id = -1
    elif event is InputEventScreenDrag:
        if event.index == joystick_touch_id:
            _move_joystick(event.position)
        elif event.index == look_touch_id:
            _look_drag(event.relative)

func _move_joystick(pos: Vector2) -> void:
    joystick_vector = ((pos - joystick_origin) / 53.0).limit_length(1.0)
    _update_joystick_knob()

func _update_joystick_knob() -> void:
    if joystick_knob != null:
        joystick_knob.position = Vector2(42, 42) + joystick_vector * 34.0

func _update_player(delta: float) -> void:
    var move := joystick_vector
    if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
        move.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
        move.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
        move.y -= 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
        move.y += 1.0
    move = move.limit_length(1.0)
    if move.length() < 0.04 or shore_art == null:
        player_walk_phase = 0.0
        return
    var right_dir := camera.global_transform.basis.x
    var back_dir := camera.global_transform.basis.z
    right_dir.y = 0.0
    back_dir.y = 0.0
    var delta_pos := (right_dir.normalized() * move.x + back_dir.normalized() * move.y) * 3.9 * delta
    var next_position := camera.position + delta_pos
    next_position.x = clampf(next_position.x, -42.0, 42.0)
    next_position.z = clampf(next_position.z, -6.0, 39.0)
    var dock_walk := absf(next_position.x - 15.5) < 1.16 and next_position.z < 6.7
    var edge: float = shore_art.call("shore_edge", next_position.x)
    if not dock_walk:
        next_position.z = maxf(next_position.z, edge + 0.50)
    var ground: float = shore_art.call("ground_height", next_position.x, next_position.z)
    if dock_walk:
        ground = 0.73
    player_walk_phase += delta * 8.0
    if elapsed - last_footstep > 0.47:
        last_footstep = elapsed
        sounds.call("play", "footstep")
        if next_position.z < edge + 5.0:
            ecology.register_disturbance(0.025)
    next_position.y = lerpf(camera.position.y, 1.67 + ground + sin(player_walk_phase) * 0.018, minf(1.0, delta * 6.0))
    camera.position = next_position

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
        if menu_open:
            if session_started:
                resume_game()
        else:
            open_pause()
        return
    if menu_open:
        return
    if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
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
    var speed := float(profile.get("sensitivity", 1.0))
    camera.rotation.y = clampf(camera.rotation.y - movement.x * 0.0035 * speed, -1.2, 1.2)
    camera.rotation.x = clampf(camera.rotation.x - movement.y * 0.002 * speed, -0.78, 0.28)

func _create_environment() -> void:
    camera = Camera3D.new()
    add_child(camera)
    camera.position = Vector3(0, 1.68, 9.2)
    camera.fov = 70.0
    camera.far = 410.0
    camera.look_at(Vector3(0, 0.3, -30.0), Vector3.UP)
    camera.current = true

    var light := DirectionalLight3D.new()
    sun_light = light
    add_child(light)
    light.rotation_degrees = Vector3(-49, -52, -8)
    light.light_color = Color(1.0, 0.965, 0.87)
    light.light_energy = 1.20
    light.shadow_enabled = true

    var world_env := WorldEnvironment.new()
    add_child(world_env)
    var env := Environment.new()
    env.background_mode = Environment.BG_SKY
    var sky := Sky.new()
    # The world has a physical far bank now. Do not show a second mountain
    # range painted onto the sky or reflected as a flat panorama in the lake.
    var sky_mat := ShaderMaterial.new()
    sky_mat.shader = load("res://shaders/cloud_sky.gdshader")
    sky.sky_material = sky_mat
    env.sky = sky
    env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
    env.ambient_light_energy = 0.95
    env.reflected_light_source = Environment.REFLECTION_SOURCE_BG
    # The mobile Compatibility renderer renders global fog across the entire
    # photographic sky, destroying its detail. Keep it OFF in the main view;
    # the secondary underwater camera has its own localized greenish fog.
    env.fog_enabled = false
    env.fog_light_color = Color(0.46, 0.58, 0.57)
    env.fog_density = 0.0017
    world_env.environment = env

func _create_shore() -> void:
    var art_script := load("res://scripts/art.gd") as GDScript
    shore_art = art_script.new() as Node3D
    add_child(shore_art)
    shore_art.call("populate")

func _create_rod() -> void:
    # First-person carbon spinning rod, assembled as a coherent 3D rig.
    # Separate material surfaces allow reel/handle/guide details without
    # the broken bending/rotation of the earlier preview-model GLB.
    rod_root = Node3D.new()
    camera.add_child(rod_root)
    rod_root.position = Vector3(0.59, -0.44, -0.70)

    var carbon := _material(Color(0.075, 0.09, 0.092), 0.27)
    carbon.metallic = 0.35
    var carbon_edge := _material(Color(0.15, 0.18, 0.18), 0.29)
    carbon_edge.metallic = 0.42
    var cork := ShaderMaterial.new()
    cork.shader = load("res://shaders/cork_grip.gdshader")
    var rubber := _material(Color(0.08, 0.075, 0.07), 0.92)
    var steel := _material(Color(0.62, 0.67, 0.66), 0.20)
    steel.metallic = 0.89
    var gunmetal := _material(Color(0.20, 0.23, 0.23), 0.29)
    gunmetal.metallic = 0.83
    var copper := _material(Color(0.57, 0.39, 0.19), 0.29)
    copper.metallic = 0.75
    var cobalt := _material(Color(0.14, 0.21, 0.64), 0.21)
    cobalt.metallic = 0.76

    var butt := Vector3(0.025, -0.31, 0.23)
    var grip_start := Vector3(0.015, -0.18, -0.18)
    var grip_end := Vector3(-0.02, -0.08, -0.90)
    var joint := Vector3(-0.09, 0.015, -1.55)
    var middle := Vector3(-0.22, 0.13, -2.65)
    var tip := Vector3(-0.36, 0.22, -3.85)
    _taper_rod(butt, grip_start, 0.058, 0.049, rubber)
    _taper_rod(grip_start, grip_end, 0.047, 0.041, cork)
    _taper_rod(grip_end, joint, 0.031, 0.020, carbon_edge)
    _taper_rod(joint, middle, 0.020, 0.0095, carbon)
    _taper_rod(middle, tip, 0.0095, 0.0037, carbon)
    # Decorative hardware rings at blank joints and grip collar.
    for p in [grip_start, grip_end, joint]:
        _ring_guide(rod_root, p, 0.039 if p == grip_end else 0.030, copper, 0.012)

    var guide_steps := [0.19, 0.42, 0.62, 0.78, 0.89, 0.99]
    for progress in guide_steps:
        var guide_pos := joint.lerp(tip, progress)
        var size := lerpf(0.055, 0.023, progress)
        var mount_end := guide_pos + Vector3(0, -size * 1.1, 0)
        _taper_rod(guide_pos, mount_end, 0.008, 0.005, gunmetal)
        _ring_guide(rod_root, mount_end, size, steel, 0.007)

    # Spinning reel attached under the blank, with silver spool, bail arm,
    # dark reel body, bronze spool lip and winding handle.
    var foot := Vector3(0.0, -0.065, -0.62)
    var reel_center := Vector3(0.08, -0.39, -0.61)
    _taper_rod(foot, reel_center, 0.034, 0.055, gunmetal)
    var reel_ball := SphereMesh.new()
    _mesh(rod_root, reel_ball, reel_center, Vector3(0.13, 0.11, 0.21), gunmetal)
    _taper_rod(reel_center, reel_center + Vector3(0.25, 0.0, 0.0), 0.078, 0.073, steel)
    _taper_rod(reel_center + Vector3(0.19, 0.0, 0.0), reel_center + Vector3(0.32, 0.0, 0.0), 0.12, 0.114, copper)

    reel_spool = _mesh(rod_root, CylinderMesh.new(), reel_center + Vector3(0.34, 0, 0), Vector3.ONE * 0.11, steel)
    reel_spool.rotation.z = PI / 2.0
    var blue_lip := TorusMesh.new()
    blue_lip.inner_radius = 0.092
    blue_lip.outer_radius = 0.115
    var blue_rim := _mesh(rod_root, blue_lip, reel_center + Vector3(0.40, 0.0, 0.0), Vector3.ONE, cobalt)
    blue_rim.rotation.z = PI * 0.5

    var bail := TorusMesh.new()
    bail.inner_radius = 0.115
    bail.outer_radius = 0.123
    var bail_obj := _mesh(rod_root, bail, reel_center + Vector3(0.33, 0.00, 0), Vector3.ONE, steel)
    bail_obj.rotation.z = PI * 0.5
    # The handle is mounted on an actual pivot. Unlike the former static
    # decorative rod, both the crank and its rubber grip orbit during winding.
    reel_crank = Node3D.new()
    reel_crank.name = "AnimatedReelHandle3D"
    reel_crank.position = reel_center + Vector3(-0.18, 0.0, 0.0)
    rod_root.add_child(reel_crank)
    var crank_base := Vector3.ZERO
    var crank_elbow := Vector3(0.0, -0.17, 0.09)
    _rod_section(reel_crank, crank_base, crank_elbow, 0.022, 0.019, steel)
    _rod_section(reel_crank, crank_elbow, crank_elbow + Vector3(-0.075, -0.048, 0.0), 0.034, 0.032, rubber)

    rod_tip = Marker3D.new()
    rod_root.add_child(rod_tip)
    rod_tip.position = tip

    line_mesh = ImmediateMesh.new()
    line_node = MeshInstance3D.new()
    line_node.mesh = line_mesh
    line_node.material_override = _material(Color(0.91, 0.92, 0.87), 0.65)
    add_child(line_node)
    # First-person hand models do not affect rod physics or casting.
    hands = (load("res://scripts/first_person_hands.gd") as GDScript).new() as Node3D
    camera.add_child(hands)

func _taper_rod(a: Vector3, b: Vector3, radius_start: float, radius_end: float, mat: Material) -> void:
    _rod_section(rod_root, a, b, radius_start, radius_end, mat)

func _rod_section(parent: Node3D, a: Vector3, b: Vector3, radius_start: float, radius_end: float, mat: Material) -> void:
    var shape := CylinderMesh.new()
    shape.top_radius = radius_end
    shape.bottom_radius = radius_start
    shape.height = maxf(a.distance_to(b), 0.001)
    shape.radial_segments = 16
    var m := _mesh(parent, shape, (a + b) * 0.5, Vector3.ONE, mat)
    m.quaternion = Quaternion(Vector3.UP, (b - a).normalized())

func _ring_guide(parent: Node3D, p: Vector3, radius: float, mat: Material, width: float) -> void:
    var ring_mesh := TorusMesh.new()
    ring_mesh.inner_radius = maxf(0.002, radius - width)
    ring_mesh.outer_radius = radius
    var guide := _mesh(parent, ring_mesh, p, Vector3.ONE, mat)
    guide.rotation.x = PI * 0.5

func _create_bobber_and_fish() -> void:
    bobber = Node3D.new()
    add_child(bobber)
    var orange := _material(Color(0.97, 0.22, 0.13), 0.44)
    var white := _material(Color(0.94, 0.91, 0.80), 0.53)
    var top := SphereMesh.new()
    float_parts.append(_mesh(bobber, top, Vector3(0, 0.095, 0), Vector3(0.16, 0.20, 0.16), orange))
    float_parts.append(_mesh(bobber, top, Vector3(0, -0.015, 0), Vector3(0.17, 0.12, 0.17), white))
    float_parts.append(_cylinder(bobber, Vector3(0, 0.22, 0), Vector3(0, 0.41, 0), 0.018, white))
    bobber.visible = false
    var metal := _material(Color(0.86, 0.77, 0.49), 0.17)
    metal.metallic = 0.74
    metal.emission_enabled = true
    metal.emission = Color(0.54, 0.41, 0.12)
    metal.emission_energy_multiplier = 0.55
    var tackle: RefCounted = (load("res://scripts/tackle_visual_3d.gd") as GDScript).new()
    bait_underwater = _mesh(self, tackle.call("make_spoon_mesh") as Mesh, Vector3.ZERO, Vector3.ONE, metal)
    bait_underwater.name = "SculptedSpoon3D"
    tackle.call("add_spoon_hardware", bait_underwater)
    bait_underwater.visible = false
    var worm_material := _material(Color(0.45, 0.18, 0.15), 0.78)
    worm_hook = _mesh(self, tackle.call("make_worm_mesh") as Mesh, Vector3.ZERO, Vector3.ONE, worm_material)
    worm_hook.name = "SculptedWorm3D"
    tackle.call("add_worm_hook", worm_hook)
    worm_hook.visible = false
    var glint_mat := _material(Color(0.95, 0.72, 0.28), 0.20)
    glint_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    glint_mat.emission_enabled = true
    glint_mat.emission = Color(0.96, 0.59, 0.22)
    spinner_glint = _mesh(bobber, SphereMesh.new(), Vector3(0.0, 0.15, 0.0), Vector3(0.11, 0.065, 0.16), glint_mat)
    spinner_glint.visible = false

    var ripple_plane := PlaneMesh.new()
    ripple_plane.size = Vector2(5.1, 5.1)
    var ripple_mat := ShaderMaterial.new()
    ripple_mat.shader = load("res://shaders/water_ripples.gdshader")
    ring = _mesh(self, ripple_plane, Vector3.ZERO, Vector3.ONE, ripple_mat)
    ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    ring.visible = false

    fish_body = Node3D.new()
    add_child(fish_body)
    staged_fish_body = fish_body
    _set_fish_model("Окунь")
    fish_body.visible = false

func _set_fish_model(species: String) -> void:
    if fish_body == null:
        return
    for old in fish_body.get_children():
        fish_body.remove_child(old)
        old.queue_free()
    var visual := make_fish_visual(species)
    fish_body.add_child(visual)
    visual.scale = Vector3.ONE * (0.47 if species == "Щука" else 0.80)

func make_fish_visual(species: String) -> Node3D:
    var visual := (load("res://scripts/fish_visual.gd") as GDScript).new() as Node3D
    visual.call("configure", species)
    return visual

func _create_hotspots() -> void:
    # World ripple circles match exactly the species-rich points on the sonar.
    var colors := [Color(0.67, 0.77, 0.47, 0.19), Color(0.59, 0.76, 0.79, 0.16), Color(0.71, 0.68, 0.50, 0.13), Color(0.59, 0.74, 0.73, 0.17)]
    for i in range(fish_spots.size()):
        var info: Dictionary = fish_spots[i]
        var shape := PlaneMesh.new()
        shape.size = Vector2(5.2, 5.2)
        var mat := ShaderMaterial.new()
        mat.shader = load("res://shaders/water_ripples.gdshader")
        mat.set_shader_parameter("ripple_color", colors[i])
        var marker_mesh := _mesh(self, shape, info["pos"] + Vector3.UP * 0.075, Vector3.ONE, mat)
        marker_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
        marker_mesh.visible = false
        activity_rings.append(marker_mesh)

func _create_lake_population() -> void:
    # A single fish identity persists from free swimming to contact, hook
    # and landing. Models are not generated at the moment of a strike.
    fish_population = (load("res://scripts/fish_population.gd") as GDScript).new() as Node3D
    add_child(fish_population)
    fish_population.call("initialize", fish_spots, ecology)

func _animate_lake(delta: float) -> void:
    fish_swim_clock += delta
    var sunlight := clampf(sin((lake_hour - 6.0) / 13.5 * PI), 0.15, 1.0)
    sun_light.light_energy = lerpf(sun_light.light_energy, 0.51 + sunlight * 0.41, minf(1.0, delta * 0.18))
    shore_art.call("set_wind", wind)
    sounds.call("set_weather", wind, lake_hour)
    # Activity indicators are connected to actual nearby resident fish
    # investigating food, rather than cyclic arbitrary spectacle.
    for i in range(activity_rings.size()):
        var marker := activity_rings[i]
        var activity: float = fish_population.call("get_activity", i)
        marker.visible = activity > 0.24 and phase != Phase.FIGHT and phase != Phase.LANDING
        if marker.visible:
            var sh := marker.material_override as ShaderMaterial
            if sh != null:
                sh.set_shader_parameter("age", fposmod(elapsed, 1.3))
                sh.set_shader_parameter("wind", wind)
            marker.scale = Vector3.ONE * (0.85 + activity * 0.23)

func _create_ui() -> void:
    # The lake is the interface. Keep the full landscape visible and dock
    # controls in small, self-contained circular touch targets at the edges.
    var ui := CanvasLayer.new()
    hud_layer = ui
    add_child(ui)
    var root := Control.new()
    root.name = "FishingHUD"
    root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    root.mouse_filter = Control.MOUSE_FILTER_PASS
    ui.add_child(root)

    title_label = _hud_text(root, "ТИХОЕ ОЗЕРО    /    РАННЕЕ УТРО", 17, 20, 14, 365, 30)
    title_label.add_theme_color_override("font_color", Color(0.96, 0.96, 0.88))
    message_label = _hud_text(root, "", 15, 20, 44, 470, 32)
    catch_label = _hud_text(root, "0 РЫБ   ·   РЕКОРД —", 14, 420, 15, 330, 28)
    catch_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
    catch_label.anchor_left = 1.0
    catch_label.anchor_right = 1.0
    catch_label.offset_left = -410
    catch_label.offset_right = -80

    var pause_button := _hud_circle(root, "II", 52, 24, 22, Color(0.08, 0.17, 0.18, 0.62), true)
    pause_button.add_theme_font_size_override("font_size", 20)
    pause_button.pressed.connect(open_pause)

    # Status stays ABOVE the action cluster instead of covering the lake.
    stats_label = _hud_text(root, "", 15, 0, 0, 510, 30)
    stats_label.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
    stats_label.offset_left = -531
    stats_label.offset_right = -21
    stats_label.offset_top = -177
    stats_label.offset_bottom = -146
    stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
    stamina_label = _hud_text(root, "", 14, 0, 0, 340, 26)
    stamina_label.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
    stamina_label.offset_left = -350
    stamina_label.offset_right = -20
    stamina_label.offset_top = -198
    stamina_label.offset_bottom = -175

    tension_bar = ProgressBar.new()
    tension_bar.name = "LineTension"
    tension_bar.min_value = 0.0
    tension_bar.max_value = 100.0
    tension_bar.show_percentage = false
    tension_bar.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
    tension_bar.offset_left = -336
    tension_bar.offset_right = -20
    tension_bar.offset_top = -139
    tension_bar.offset_bottom = -131
    var meter_bg := StyleBoxFlat.new()
    meter_bg.bg_color = Color(0.06, 0.13, 0.14, 0.65)
    meter_bg.set_corner_radius_all(5)
    tension_bar.add_theme_stylebox_override("background", meter_bg)
    var meter_fill := StyleBoxFlat.new()
    meter_fill.bg_color = Color(0.80, 0.63, 0.37, 0.95)
    meter_fill.set_corner_radius_all(5)
    tension_bar.add_theme_stylebox_override("fill", meter_fill)
    root.add_child(tension_bar)

    # Virtual stick: a real circular control, not a stretched rectangle.
    var pad := Panel.new()
    pad.name = "ThumbstickRing"
    pad.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
    pad.offset_left = 36
    pad.offset_right = 170
    pad.offset_top = -154
    pad.offset_bottom = -20
    var pad_style := StyleBoxFlat.new()
    pad_style.bg_color = Color(0.030, 0.11, 0.12, 0.22)
    pad_style.border_color = Color(0.81, 0.89, 0.80, 0.29)
    pad_style.set_border_width_all(2)
    pad_style.set_corner_radius_all(69)
    pad.add_theme_stylebox_override("panel", pad_style)
    pad.mouse_filter = Control.MOUSE_FILTER_IGNORE
    root.add_child(pad)
    joystick_knob = Panel.new()
    joystick_knob.name = "Thumbstick"
    var knob_style := StyleBoxFlat.new()
    knob_style.bg_color = Color(0.83, 0.91, 0.82, 0.53)
    knob_style.border_color = Color(0.96, 0.98, 0.90, 0.27)
    knob_style.set_border_width_all(1)
    knob_style.set_corner_radius_all(27)
    joystick_knob.add_theme_stylebox_override("panel", knob_style)
    joystick_knob.size = Vector2(50, 50)
    joystick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
    pad.add_child(joystick_knob)
    _update_joystick_knob()

    # Every primary/secondary action is a discrete round touch target.
    # Hidden actions free the camera view rather than leaving dead tiles.
    action_button = _hud_circle(root, "ЗАБРОС", 112, 19, 20, Color(0.68, 0.41, 0.22, 0.86))
    action_button.name = "ActionCircle"
    action_button.add_theme_font_size_override("font_size", 17)
    action_button.pressed.connect(_main_action)
    action_button.button_down.connect(_begin_charge)
    action_button.button_up.connect(_end_charge)

    lure_button = _hud_circle(root, "ЧЕРВЬ", 78, 143, 37, Color(0.10, 0.28, 0.28, 0.73))
    lure_button.name = "BaitCircle"
    lure_button.add_theme_font_size_override("font_size", 16)
    lure_button.pressed.connect(_toggle_lure)

    reel_button = _hud_circle(root, "МОТАТЬ", 108, 142, 21, Color(0.08, 0.26, 0.27, 0.78))
    reel_button.add_theme_font_size_override("font_size", 16)
    reel_button.button_down.connect(func() -> void: is_reeling = true)
    reel_button.button_up.connect(func() -> void: is_reeling = false)

    brace_button = _hud_circle(root, "ПОДНЯТЬ", 91, 25, 140, Color(0.20, 0.33, 0.23, 0.78))
    brace_button.add_theme_font_size_override("font_size", 15)
    brace_button.button_down.connect(func() -> void: is_bracing = true)
    brace_button.button_up.connect(func() -> void: is_bracing = false)

    drag_button = _hud_circle(root, "ФРИКЦИОН", 88, 267, 30, Color(0.16, 0.23, 0.24, 0.78))
    drag_button.add_theme_font_size_override("font_size", 13)
    drag_button.pressed.connect(_cycle_drag)

    cast_charge_bar = ProgressBar.new()
    cast_charge_bar.min_value = 0.0
    cast_charge_bar.max_value = 100.0
    cast_charge_bar.show_percentage = false
    cast_charge_bar.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
    cast_charge_bar.offset_left = -130
    cast_charge_bar.offset_right = -20
    cast_charge_bar.offset_top = -143
    cast_charge_bar.offset_bottom = -135
    cast_charge_bar.add_theme_stylebox_override("background", meter_bg.duplicate())
    cast_charge_bar.add_theme_stylebox_override("fill", meter_fill.duplicate())
    root.add_child(cast_charge_bar)
    cast_charge_bar.visible = false

    # Compact translucent radar, real lure coordinates, real fish contacts.
    minimap = (load("res://scripts/minimap.gd") as GDScript).new() as Control
    minimap.name = "Radar"
    minimap.set("game", self)
    minimap.set_anchors_preset(Control.PRESET_TOP_RIGHT)
    minimap.offset_left = -198
    minimap.offset_right = -26
    minimap.offset_top = 84
    minimap.offset_bottom = 256
    root.add_child(minimap)
    var map_toggle := _hud_circle(root, "MAP", 47, 27, 267, Color(0.07, 0.17, 0.18, 0.68), true)
    map_toggle.name = "RadarToggle"
    map_toggle.add_theme_font_size_override("font_size", 12)
    # Toggling only affects the radar: the physical fish still exist.
    map_toggle.pressed.connect(func() -> void: minimap.visible = not minimap.visible)

    lure_view = (load("res://scripts/lure_camera.gd") as GDScript).new() as Control
    lure_view.set_anchors_preset(Control.PRESET_TOP_RIGHT)
    lure_view.offset_left = -218
    lure_view.offset_right = -26
    lure_view.offset_top = 283
    lure_view.offset_bottom = 398
    root.add_child(lure_view)

func _hud_text(parent: Control, value: String, font_size: int, left: float, top: float, width: float, height: float) -> Label:
    var result := Label.new()
    result.text = value
    result.position = Vector2(left, top)
    result.size = Vector2(width, height)
    result.mouse_filter = Control.MOUSE_FILTER_IGNORE
    result.add_theme_font_size_override("font_size", font_size)
    result.add_theme_color_override("font_color", Color(0.92, 0.94, 0.89, 0.96))
    result.add_theme_color_override("font_shadow_color", Color(0.02, 0.05, 0.06, 0.78))
    result.add_theme_constant_override("shadow_offset_x", 1)
    result.add_theme_constant_override("shadow_offset_y", 2)
    parent.add_child(result)
    return result

func _hud_circle(parent: Control, label: String, diameter: int, margin_right: int, margin_bottom: int, color: Color, top_right: bool = false) -> Button:
    var result := Button.new()
    result.text = label
    result.focus_mode = Control.FOCUS_NONE
    result.set_anchors_preset(Control.PRESET_TOP_RIGHT if top_right else Control.PRESET_BOTTOM_RIGHT)
    result.offset_left = -margin_right - diameter
    result.offset_right = -margin_right
    if top_right:
        result.offset_top = margin_bottom
        result.offset_bottom = margin_bottom + diameter
    else:
        result.offset_top = -margin_bottom - diameter
        result.offset_bottom = -margin_bottom
    result.add_theme_font_size_override("font_size", 15)
    result.add_theme_color_override("font_color", Color(0.95, 0.96, 0.89))
    result.add_theme_color_override("font_hover_color", Color(1.0, 1.0, 0.96))
    var normal := StyleBoxFlat.new()
    normal.bg_color = color
    normal.border_color = Color(0.81, 0.88, 0.79, 0.32)
    normal.set_border_width_all(1)
    normal.set_corner_radius_all(ceili(float(diameter) * 0.5))
    result.add_theme_stylebox_override("normal", normal)
    var hover := normal.duplicate() as StyleBoxFlat
    hover.bg_color = color.lightened(0.13)
    result.add_theme_stylebox_override("hover", hover)
    var down := normal.duplicate() as StyleBoxFlat
    down.bg_color = color.darkened(0.17)
    result.add_theme_stylebox_override("pressed", down)
    var disabled := normal.duplicate() as StyleBoxFlat
    disabled.bg_color = Color(0.06, 0.15, 0.15, 0.47)
    result.add_theme_stylebox_override("disabled", disabled)
    parent.add_child(result)
    return result

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
    result.add_theme_font_size_override("font_size", 18)
    result.add_theme_color_override("font_color", Color(1, 1, 1))
    var normal := StyleBoxFlat.new()
    normal.bg_color = color
    normal.set_corner_radius_all(14)
    normal.border_color = Color(0.73, 0.80, 0.71, 0.34)
    normal.set_border_width_all(1)
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

func _begin_charge() -> void:
    if phase != Phase.READY and phase != Phase.RESULT:
        return
    cast_charging = true
    cast_charge = 0.64
    cast_charge_bar.visible = true
    cast_charge_bar.value = cast_charge * 100.0

func _end_charge() -> void:
    if not cast_charging:
        return
    cast_charging = false
    cast_charge_bar.visible = false
    if phase == Phase.RESULT:
        _reset_to_ready()
    if phase == Phase.READY:
        _cast()

func _main_action() -> void:
    match phase:
        Phase.READY:
            _cast()
        Phase.BITE:
            phase = Phase.FIGHT
            timer = 0.0
            tension = 22.0
            if pending_fish_id >= 0:
                var live_fish: Node3D = fish_population.call("take_hooked", pending_fish_id)
                if live_fish != null:
                    fish_body = live_fish
                    fish_body.visible = true
            fight_world_pos = fish_body.global_position
            fight_prev_pos = fight_world_pos
            fight_world_axis = fight_world_pos - camera.global_position
            fight_world_axis.y = 0.0
            if fight_world_axis.length_squared() < 0.04:
                fight_world_axis = -camera.global_transform.basis.z
                fight_world_axis.y = 0.0
            fight_world_axis = fight_world_axis.normalized()
            fight_world_side = Vector3(-fight_world_axis.z, 0.0, fight_world_axis.x)
            pending_fish_id = -1
            fight_sim.begin(fish_name, fish_weight, camera.global_position.distance_to(bobber.global_position) * 0.78)
            fight_distance = fight_sim.distance
            tension = fight_sim.tension
            is_reeling = false
            is_bracing = false
            sounds.call("play", "hook")
            _set_message("Рыба на крючке! Мотай. На красной шкале — отпусти.")
            _update_buttons()
        Phase.RESULT:
            _reset_to_ready()
            _cast()

func _toggle_lure() -> void:
    if phase != Phase.READY and phase != Phase.RESULT:
        return
    lure_index = 1 - lure_index
    lure_button.text = "ЧЕРВЬ" if lure_index == 0 else "БЛЕСНА"
    _set_message("Червь: карась и окунь." if lure_index == 0 else "Блесна: веди приманку для окуня и щуки.")
    _update_buttons()

func _reset_to_ready() -> void:
    phase = Phase.READY
    is_reeling = false
    is_bracing = false
    if pending_fish_id >= 0 and fish_population != null:
        fish_population.call("release_strike", pending_fish_id)
        pending_fish_id = -1
    current_bite_species = ""
    bobber.visible = false
    fish_body.visible = false
    cast_charging = false
    cast_charge_bar.visible = false
    bait_underwater.visible = false
    worm_hook.visible = false
    spinner_glint.visible = false
    lure_depth = 0.0
    line_mesh.clear_surfaces()
    _set_message("Выбери приманку и забрось в озеро.")
    _update_buttons()

func _cast() -> void:
    if camera.position.z > 18.0:
        _set_message("Подойди поближе к воде, чтобы сделать заброс.")
        return
    if (-camera.global_transform.basis.z).z > -0.22:
        _set_message("Повернись лицом к озеру.")
        return
    phase = Phase.CASTING
    cast_charging = false
    cast_charge_bar.visible = false
    sounds.call("play", "cast")
    timer = 0.0
    cast_source = rod_tip.global_position
    var forward := -camera.global_transform.basis.z
    forward.y = 0
    forward = forward.normalized()
    cast_target = camera.global_position + forward * (11.0 + cast_charge * 27.0)
    cast_target.y = 0.09
    cast_target.z = minf(1.5, cast_target.z)
    lure_sim.begin_cast(cast_source, cast_target, lure_index)
    ecology.reset_cast()
    ecology.register_disturbance(0.07)
    pending_fish_id = -1
    lure_depth = 0.0
    is_reeling = false
    is_bracing = false
    for part in float_parts:
        part.visible = lure_index == 0
    spinner_glint.visible = lure_index == 1
    bait_underwater.visible = false
    worm_hook.visible = false
    bobber.visible = true
    bobber.global_position = cast_source
    _set_message("Заброс! Следи за поплавком и отметкой на мини-карте.")
    _update_buttons()


func _choose_fish() -> void:
    # Select the same real fish that crossed the hook contact radius.
    if pending_fish_id >= 0:
        var original: Dictionary = fish_population.call("get_info", pending_fish_id)
        if not original.is_empty():
            fish_name = str(original["species"])
            fish_weight = float(original["weight"])
            fish_strength = 0.95 if fish_name == "Карась" else 1.20 if fish_name == "Окунь" else 1.86
            return
    # Fallback only for testing the trophy presentation in isolation.
    fish_name = current_bite_species
    if fish_name.is_empty():
        fish_name = "Карась" if lure_index == 0 else "Окунь"
    match fish_name:
        "Карась":
            fish_weight = rng.randf_range(0.25, 1.60)
            fish_strength = 0.95
        "Окунь":
            fish_weight = rng.randf_range(0.18, 1.15)
            fish_strength = 1.20
        _:
            fish_weight = rng.randf_range(1.20, 5.20)
            fish_strength = 1.86
    _set_fish_model(fish_name)

func _cycle_drag() -> void:
    if phase != Phase.FIGHT:
        return
    fight_sim.cycle_drag()
    drag_button.text = "ТОРМОЗ: %s" % fight_sim.drag_name()
    sounds.call("play", "reel")

func _update_fight(delta: float) -> void:
    var result: int = fight_sim.step(delta, is_reeling, is_bracing)
    tension = fight_sim.tension
    fight_distance = fight_sim.distance
    if is_reeling and elapsed - last_sound_reel > 0.27:
        last_sound_reel = elapsed
        sounds.call("play", "reel")
    if float(fight_sim.slip_velocity) > 0.10 and elapsed - last_drag_sound > 0.54:
        last_drag_sound = elapsed
        sounds.call("play", "drag")
    if tension > 84.0 and elapsed - last_rod_creak > 2.1:
        last_rod_creak = elapsed
        sounds.call("play", "rod_creak")
    if result == 2:
        _finish("Обрыв! Ослабь фрикцион или отпусти подмотку.")
        return
    elif result == 3:
        _finish("Рыба ушла далеко. Держи её ближе.")
        return
    elif result == 4:
        _finish("Слабина лески! Не отпускай её надолго.")
        return
    elif result == 1:
        phase = Phase.LANDING
        timer = 0.0
        landing_from = fish_body.global_position
        fish_body.visible = true
        sounds.call("play", "splash")
        _set_message("Подводим трофей к берегу!")
        _update_buttons()
        return

    # Keep the fish in physical WORLD coordinates. Rotating the camera
    # cannot teleport a trophy around the player's viewpoint.
    var goal: Vector3 = camera.global_position + fight_world_axis * fight_distance + fight_world_side * float(fight_sim.lateral)
    goal.y = -float(fight_sim.depth)
    fight_prev_pos = fight_world_pos
    var maximum_swim_speed := 5.4 + float(fight_sim.burst) * 2.1
    fight_world_pos = fight_world_pos.move_toward(goal, maximum_swim_speed * maxf(0.0, delta))
    var swim_direction := fight_world_pos - fight_prev_pos
    var show_jump: bool = float(fight_sim.burst) > 0.80 and fight_distance < 14.0
    var fish_depth := -float(fight_sim.depth)
    if show_jump:
        fish_depth = 0.16 + maxf(0.0, sin(elapsed * 8.7)) * 0.65
    fish_body.visible = true
    fish_body.global_position = Vector3(fight_world_pos.x, fish_depth, fight_world_pos.z)
    bobber.global_position = Vector3(fight_world_pos.x, 0.07, fight_world_pos.z)
    if swim_direction.length_squared() > 0.015:
        fish_body.rotation.y = lerp_angle(fish_body.rotation.y, atan2(-swim_direction.x, -swim_direction.z), minf(1.0, delta * 6.0))
    fish_body.rotation.z = float(fight_sim.headshake) * 0.17
    fish_population.call("move_hooked", fish_body.global_position)
    if fish_body.has_method("set_wiggle"):
        fish_body.call("set_wiggle", 0.48 + float(fight_sim.burst) * 1.8)
    else:
        for visual in fish_body.get_children():
            if visual.has_method("set_wiggle"):
                visual.call("set_wiggle", 0.48 + float(fight_sim.burst) * 1.8)
    if show_jump and ripple_age > 1.3:
        _splash()

func _finish(text: String, won: bool = false) -> void:
    phase = Phase.RESULT
    result_text = text
    fish_body.visible = false
    if fish_population != null:
        if pending_fish_id >= 0:
            fish_population.call("release_strike", pending_fish_id)
            pending_fish_id = -1
        fish_population.call("finish_hook", won)
    fish_body = staged_fish_body
    bobber.visible = false
    bait_underwater.visible = false
    worm_hook.visible = false
    is_reeling = false
    is_bracing = false
    if not won:
        sounds.call("play", "line_break" if text.begins_with("Обрыв") else "fail")
    _set_message(text)
    _update_buttons()
    overlay.call("show_result", won, fish_name, fish_weight, text)

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
    var endpoint := bobber.global_position + Vector3.UP * 0.16
    if lure_index == 1 and bait_underwater.visible and phase == Phase.WAITING:
        endpoint = bait_underwater.global_position
    var load := clampf(tension / 100.0, 0.0, 1.0) if phase == Phase.FIGHT else 0.05
    var slack := 0.45 * (1.0 - load)
    if phase == Phase.CASTING:
        slack = 0.24
    var sway := wind * 0.11
    # Twelve segments make the nylon sag and drift under wind; tension pulls
    # it straight. One continuous thread from the actual rod tip to the lure.
    line_mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
    for i in range(13):
        var t := float(i) / 12.0
        var point := tip.lerp(endpoint, t)
        point.y -= sin(t * PI) * slack
        point.x += sin(t * PI) * sway * sin(elapsed * 1.9)
        line_mesh.surface_add_vertex(point)
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
            action_button.text = "..."
        Phase.WAITING:
            action_button.text = "ЖДЁМ"
        Phase.BITE:
            action_button.text = "ПОДСЕЧЬ!"
        Phase.FIGHT:
            action_button.text = "БОРЬБА"
        Phase.LANDING:
            action_button.text = "ТРОФЕЙ..."
        Phase.RESULT:
            action_button.text = "ЗАБРОС"
    action_button.disabled = phase == Phase.CASTING or phase == Phase.WAITING or phase == Phase.FIGHT or phase == Phase.LANDING
    action_button.visible = phase == Phase.READY or phase == Phase.BITE or phase == Phase.RESULT
    lure_button.disabled = phase != Phase.READY and phase != Phase.RESULT
    lure_button.visible = phase == Phase.READY or phase == Phase.RESULT
    var lure_retrieve := phase == Phase.WAITING and lure_index == 1
    reel_button.visible = phase == Phase.FIGHT or lure_retrieve
    reel_button.disabled = not reel_button.visible
    reel_button.text = "ВЕСТИ" if lure_retrieve else "МОТАТЬ"
    brace_button.visible = phase == Phase.FIGHT or lure_retrieve
    brace_button.disabled = not brace_button.visible
    brace_button.text = "РЫВОК" if lure_retrieve else "ПОДНЯТЬ"
    drag_button.visible = phase == Phase.FIGHT
    drag_button.disabled = phase != Phase.FIGHT
    if phase == Phase.FIGHT:
        drag_button.text = "ФРИКЦИОН: %s" % fight_sim.drag_name()
    tension_bar.visible = phase == Phase.FIGHT
    stamina_label.visible = phase == Phase.FIGHT

func _update_stats() -> void:
    if stats_label == null:
        return
    match phase:
        Phase.FIGHT:
            stats_label.text = "%s %.2f кг  ·  До рыбы %.1f м  ·  Натяжение %d%%" % [fish_name, fish_weight, fight_distance, int(tension)]
            tension_bar.value = clampf(tension, 0.0, 100.0)
            stamina_label.text = "СИЛЫ РЫБЫ  %d%%" % int(fight_sim.stamina)
            var warning_style := Color(0.97, 0.46, 0.29) if tension >= 79.0 else Color(0.75, 0.86, 0.82)
            stats_label.add_theme_color_override("font_color", warning_style)
        Phase.WAITING:
            var attention := "ОСТОРОЖНАЯ ПОКЛЁВКА" if bite_sign_age < 1.4 else ("АКТИВНОСТЬ ВЫСОКАЯ" if shoreline_activity > 0.65 else "ИЩИ УКРЫТИЯ")
            stats_label.text = "%.0f м  ·  Глубина %.1f м  ·  %s" % [Vector2(bobber.position.x - camera.position.x, bobber.position.z - camera.position.z).length(), lure_depth, attention]
        Phase.BITE:
            stats_label.text = "ПОДСЕЧЬ СЕЙЧАС  ·  %.1f сек." % maxf(0.0, bite_window - timer)
        Phase.LANDING:
            stats_label.text = "Рыба у берега — поднимаем трофей!"
        _:
            stats_label.text = "ОЗЕРО   ·   %s   ·   07:00" % ("ЧЕРВЬ" if lure_index == 0 else "БЛЕСНА")
    if phase != Phase.FIGHT:
        stats_label.add_theme_color_override("font_color", Color(0.96, 0.95, 0.87))
    catch_label.text = "УЛОВ %d   ·   РЕКОРД %s" % [catch_count, ("%.2f кг" % best_weight) if best_weight > 0.0 else "—"]

func _load_profile() -> void:
    var config := ConfigFile.new()
    if config.load("user://fishing_settings.cfg") == OK:
        for key in profile.keys():
            profile[key] = config.get_value("preferences", key, profile[key])
    catches.clear()
    if FileAccess.file_exists("user://fishing_catches.json"):
        var source := FileAccess.open("user://fishing_catches.json", FileAccess.READ)
        if source != null:
            var parsed = JSON.parse_string(source.get_as_text())
            if parsed is Array:
                for entry in parsed:
                    if entry is Dictionary and entry.has("species") and entry.has("weight"):
                        catches.append(entry)
    catch_count = catches.size()
    best_weight = 0.0
    for entry in catches:
        best_weight = maxf(best_weight, float(entry.get("weight", 0.0)))

func _save_settings() -> void:
    var config := ConfigFile.new()
    for key in profile.keys():
        config.set_value("preferences", key, profile[key])
    var err := config.save("user://fishing_settings.cfg")
    if err != OK:
        push_warning("Could not save preferences: %d" % err)

func _record_catch() -> void:
    var entry: Dictionary = {
        "species": fish_name,
        "weight": snappedf(fish_weight, 0.01),
        "lure": "Червь" if lure_index == 0 else "Блесна",
        "date": Time.get_date_string_from_system()
    }
    catches.append(entry)
    catch_count = catches.size()
    best_weight = maxf(best_weight, fish_weight)
    var file := FileAccess.open("user://fishing_catches.json", FileAccess.WRITE)
    if file == null:
        push_warning("Could not save trophy journal")
        return
    file.store_string(JSON.stringify(catches, "\t"))
    file.close()

func set_preference(key: String, value: float) -> void:
    if not profile.has(key):
        return
    profile[key] = value
    if key == "volume":
        sounds.call("set_volume_fraction", value)
    if key == "fov":
        camera.fov = value
    _save_settings()

func set_graphics_quality(shadows_enabled: bool) -> void:
    profile["shadows"] = shadows_enabled
    apply_video_settings()
    _save_settings()

func apply_video_settings() -> void:
    camera.fov = float(profile.get("fov", 70.0))
    if sun_light != null:
        sun_light.shadow_enabled = bool(profile.get("shadows", true))

func start_game() -> void:
    session_started = true
    overlay.call("hide_overlay")
    camera.position = Vector3(0, 1.68, 9.2)
    camera.look_at(Vector3(0, 0.3, -30.0), Vector3.UP)
    _reset_to_ready()

func open_pause() -> void:
    if not session_started or menu_open:
        return
    joystick_touch_id = -1
    look_touch_id = -1
    joystick_vector = Vector2.ZERO
    _update_joystick_knob()
    overlay.call("show_pause")

func resume_game() -> void:
    if not session_started:
        return
    overlay.call("hide_overlay")
    is_reeling = false
    is_bracing = false

func exit_to_menu() -> void:
    session_started = false
    is_reeling = false
    is_bracing = false
    cast_charging = false
    _reset_to_ready()
    overlay.call("show_home")

func retry_cast() -> void:
    session_started = true
    overlay.call("hide_overlay")
    _reset_to_ready()
    _cast()
