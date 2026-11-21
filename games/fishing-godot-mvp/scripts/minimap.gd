extends Control
## Shoreline sonar/minimap. Always tracks the actual lure world position.
## Drawn entirely as a lightweight 2D CanvasItem over the 3D game.

var game
var font: Font
var blink := 0.0
var px_per_metre := 2.55
var spot_colors := [
    Color(0.78, 0.86, 0.53, 0.40),
    Color(0.63, 0.82, 0.96, 0.39),
    Color(0.89, 0.53, 0.30, 0.43),
    Color(0.71, 0.75, 0.89, 0.34)
]

func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    font = ThemeDB.fallback_font

func _process(delta: float) -> void:
    blink += delta
    if visible and game != null:
        queue_redraw()

func _world_to_map(p: Vector3) -> Vector2:
    var player: Vector3 = game.camera.global_position
    return Vector2(size.x * 0.50 + (p.x - player.x) * px_per_metre, size.y * 0.77 + (p.z - player.z) * px_per_metre)

func _draw() -> void:
    if game == null or size.x < 50.0:
        return
    var width := size.x
    var height := size.y
    draw_rect(Rect2(Vector2.ZERO, size), Color(0.026, 0.095, 0.119, 0.90), true)
    # Wide shoreline topography, sandy strip and deep-water shading.
    var shore_points := PackedVector2Array()
    for x in range(21):
        var world_x: float = game.camera.position.x + (float(x) / 20.0 - 0.5) * width / px_per_metre
        var z: float = game.shore_art.call("shore_edge", world_x)
        shore_points.append(_world_to_map(Vector3(world_x, 0.0, z)))
    var earth := PackedVector2Array()
    earth.append(shore_points[0])
    for p in shore_points.slice(1):
        earth.append(p)
    earth.append(Vector2(width, height))
    earth.append(Vector2(0, height))
    draw_colored_polygon(earth, Color(0.31, 0.36, 0.27, 0.93))
    draw_polyline(shore_points, Color(0.79, 0.71, 0.53, 0.86), 2.8, true)
    draw_line(Vector2(10, height * 0.35), Vector2(width - 10, height * 0.35), Color(0.19, 0.40, 0.44, 0.18), 1)
    for i in range(4):
        draw_arc(Vector2(width * 0.12 + i * width * 0.26, height * 0.31), 14.0, 0.5, 2.65, 19, Color(0.31, 0.58, 0.65, 0.15), 1.0, true)

    # The fish grounds are real coordinates used by the bite system, not fake pins.
    for i in range(game.fish_spots.size()):
        var spot: Dictionary = game.fish_spots[i]
        var pos: Vector3 = spot["pos"]
        var marker := _world_to_map(pos)
        if marker.x < 12 or marker.x > width - 12 or marker.y < 35 or marker.y > height - 16:
            continue
        var col: Color = spot_colors[i % spot_colors.size()]
        draw_circle(marker, 10.5 + sin(blink * 1.2 + i * 2.6) * 1.0, col)
        draw_arc(marker, 16.5, 0.0, TAU, 32, Color(col.r, col.g, col.b, 0.32), 1.4, true)
        draw_circle(marker, 3.5, Color(col.r, col.g, col.b, 0.9))

    var player := Vector2(width * 0.50, height * 0.77)
    var heading: Vector3 = -game.camera.global_transform.basis.z
    var forward := Vector2(heading.x, heading.z).normalized()
    draw_circle(player, 5.7, Color(0.98, 0.94, 0.84))
    var nose := player + Vector2(forward.x, forward.y) * 13.0
    draw_line(player, nose, Color(1.0, 0.92, 0.65), 2.4, true)
    if game.bobber.visible:
        var lure_pos: Vector2 = _world_to_map(game.bobber.global_position)
        lure_pos.x = clampf(lure_pos.x, 7.0, width - 7.0)
        lure_pos.y = clampf(lure_pos.y, 34.0, height - 8.0)
        draw_line(player, lure_pos, Color(0.96, 0.88, 0.71, 0.55), 1.2, true)
        draw_circle(lure_pos, 5.4 + sin(blink * 5.5) * 1.0, Color(1.0, 0.55, 0.24))
        draw_arc(lure_pos, 11.0 + sin(blink * 2.5) * 2.0, 0.0, TAU, 32, Color(1.0, 0.68, 0.40, 0.65), 1.7, true)
        var dist: float = game.camera.global_position.distance_to(game.bobber.global_position)
        draw_string(font, Vector2(12, height - 9), "%.0f м   ·   %.1f м глуб." % [dist, game.lure_depth], HORIZONTAL_ALIGNMENT_LEFT, width - 17, 15, Color(0.97, 0.91, 0.81))
    else:
        draw_string(font, Vector2(12, height - 9), "ИЩИ МЕСТА КЛЁВА", HORIZONTAL_ALIGNMENT_LEFT, width - 17, 15, Color(0.76, 0.86, 0.83))

    draw_rect(Rect2(Vector2.ZERO, Vector2(width, 30)), Color(0.018, 0.053, 0.071, 0.98), true)
    draw_string(font, Vector2(12, 21), "ЭХОЛОТ · МИНИ-КАРТА", HORIZONTAL_ALIGNMENT_LEFT, width - 18, 16, Color(0.94, 0.91, 0.79))
    draw_rect(Rect2(Vector2.ZERO, size), Color(0.46, 0.65, 0.66, 0.72), false, 1.2, true)
