extends Control
## Circular, lightweight sonar. Never invents fish or hides gameplay
## under a giant rectangular map. Every marker is in actual world-space.

var game: Node3D
var font: Font
var pulse := 0.0
var px_per_metre := 2.30

func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    font = ThemeDB.fallback_font

func _process(delta: float) -> void:
    pulse += delta
    if visible and game != null:
        queue_redraw()

func _radar_center() -> Vector2:
    return size * 0.5

func _radar_radius() -> float:
    return minf(size.x, size.y) * 0.48

func _player_on_radar() -> Vector2:
    return _radar_center() + Vector2(0.0, _radar_radius() * 0.42)

func _world_to_map(p: Vector3) -> Vector2:
    var player: Vector3 = game.camera.global_position
    return _player_on_radar() + Vector2(p.x - player.x, p.z - player.z) * px_per_metre

func _inside(pos: Vector2, inset: float = 5.0) -> bool:
    return pos.distance_to(_radar_center()) < _radar_radius() - inset

func _draw() -> void:
    if game == null or size.x < 50.0:
        return
    var center := _radar_center()
    var radius := _radar_radius()
    var water := Color(0.036, 0.155, 0.178, 0.81)
    var rim := Color(0.72, 0.85, 0.77, 0.40)
    draw_circle(center, radius, water)
    draw_arc(center, radius - 0.75, 0.0, TAU, 96, rim, 1.6, true)
    draw_arc(center, radius * 0.65, 0.0, TAU, 64, Color(0.64, 0.81, 0.77, 0.17), 1.0, true)
    draw_arc(center, radius * 0.31, 0.0, TAU, 48, Color(0.64, 0.81, 0.77, 0.12), 1.0, true)
    draw_line(center + Vector2(-radius * 0.85, 0), center + Vector2(radius * 0.85, 0), Color(0.77, 0.90, 0.84, 0.09), 1)
    draw_line(center + Vector2(0, -radius * 0.86), center + Vector2(0, radius * 0.86), Color(0.77, 0.90, 0.84, 0.09), 1)

    # The shape of the walkable bank is sampled from the exact same
    # shore_edge function used for movement constraints.
    var player: Vector3 = game.camera.global_position
    for iy in range(28):
        for ix in range(24):
            var map_pos := center + Vector2((float(ix) / 23.0 - 0.5) * radius * 1.85, (float(iy) / 27.0 - 0.5) * radius * 1.85)
            if not _inside(map_pos, 2.5):
                continue
            var world_x := player.x + (map_pos.x - _player_on_radar().x) / px_per_metre
            var world_z := player.z + (map_pos.y - _player_on_radar().y) / px_per_metre
            if world_z > float(game.shore_art.call("shore_edge", world_x)):
                draw_circle(map_pos, 2.8, Color(0.36, 0.45, 0.35, 0.48))
    var last_point := Vector2.ZERO
    for ix in range(67):
        var sample_x := player.x + (float(ix) / 66.0 - 0.5) * (radius * 2.4) / px_per_metre
        var bank_z: float = float(game.shore_art.call("shore_edge", sample_x))
        var p := _world_to_map(Vector3(sample_x, 0, bank_z))
        if ix > 0 and _inside(p, 1.5) and _inside(last_point, 1.5):
            draw_line(last_point, p, Color(0.80, 0.72, 0.48, 0.75), 1.7, true)
        last_point = p

    # These faint spots are habitat hints, not guaranteed fish locations.
    for i in range(game.fish_spots.size()):
        var spot: Dictionary = game.fish_spots[i]
        var position: Vector3 = spot["pos"]
        var marker := _world_to_map(position)
        if not _inside(marker, 10.0):
            continue
        var active: bool = i < game.activity_rings.size() and bool(game.activity_rings[i].visible)
        if active:
            var wave := 11.0 + sin(pulse * 2.7 + float(i)) * 2.2
            draw_arc(marker, wave, 0.0, TAU, 28, Color(0.98, 0.79, 0.40, 0.68), 1.5, true)
            draw_circle(marker, 3.6, Color(0.95, 0.77, 0.44, 0.88))
        else:
            draw_arc(marker, 6.0, 0.0, TAU, 22, Color(0.63, 0.84, 0.73, 0.23), 1.0, true)

    if game.fish_population != null and game.bobber.visible:
        var real_bait: Vector3 = game.bobber.global_position
        for living in game.fish_population.agents:
            var mode: String = str(living["mode"])
            if mode == "absent" or mode == "hooked":
                continue
            var location: Vector3 = living["pos"]
            if location.distance_to(real_bait) > 9.0:
                continue
            var echo := _world_to_map(location)
            if not _inside(echo):
                continue
            var investigating: bool = mode in ["approach", "inspect", "strike"]
            draw_circle(echo, 2.8 if investigating else 1.6,
                Color(1.0, 0.79, 0.41, 0.87) if investigating else Color(0.52, 0.76, 0.73, 0.39))

    var player_marker := _player_on_radar()
    draw_circle(player_marker, 5.0, Color(0.95, 0.96, 0.88))
    var heading: Vector3 = -game.camera.global_transform.basis.z
    var direction := Vector2(heading.x, heading.z).normalized()
    draw_line(player_marker, player_marker + direction * 13.0, Color(1.0, 0.79, 0.41), 2.5, true)

    if game.bobber.visible:
        var target: Vector2 = _world_to_map(game.bobber.global_position)
        var radial := target - center
        if radial.length() > radius - 10.0:
            target = center + radial.normalized() * (radius - 10.0)
        draw_line(player_marker, target, Color(0.95, 0.78, 0.48, 0.47), 1.4, true)
        var biting: bool = float(game.bite_sign_age) < 1.4 and int(game.phase) >= 2 and int(game.phase) <= 3
        var bait_color := Color(1.0, 0.78, 0.35) if biting else Color(0.98, 0.55, 0.33)
        draw_circle(target, 5.0 + sin(pulse * 4.0) * 0.5, bait_color)
        draw_arc(target, 8.5 + sin(pulse * 3.3), 0.0, TAU, 32, Color(bait_color.r, bait_color.g, bait_color.b, 0.71), 1.4, true)

    # Small labels inside the radar, instead of the old heavy title bar.
    draw_string(font, center + Vector2(-29, -radius + 20), "РАДАР", HORIZONTAL_ALIGNMENT_CENTER, 58, 13, Color(0.94, 0.95, 0.88, 0.85))
    if game.bobber.visible:
        var dist := Vector2(game.bobber.global_position.x - player.x, game.bobber.global_position.z - player.z).length()
        draw_string(font, center + Vector2(-40, radius - 8), "%.0f м · %.1f м" % [dist, game.lure_depth], HORIZONTAL_ALIGNMENT_CENTER, 80, 12, Color(0.94, 0.94, 0.82, 0.92))
    else:
        draw_string(font, center + Vector2(-25, radius - 8), "БЕРЕГ", HORIZONTAL_ALIGNMENT_CENTER, 50, 12, Color(0.90, 0.94, 0.85, 0.78))
