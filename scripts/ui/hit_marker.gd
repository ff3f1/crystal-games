class_name HitMarker extends Control
## Маркер попадания у курсора.

var t = 0.0
var kill = false
var crit = false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	size = Vector2(60, 60)
	pivot_offset = size * 0.5

func _process(delta: float) -> void:
	t += delta / maxf(0.05, Engine.time_scale)
	if t > (0.32 if kill else 0.2):
		queue_free()
		return
	queue_redraw()

func _draw() -> void:
	var life = 0.32 if kill else 0.2
	var k = t / life
	var a = 1.0 - k
	var c = Color(1, 0.18, 0.12, a) if kill else (Color(1, 0.8, 0.35, a) if crit else Color(1, 1, 1, a * 0.95))
	var r0 = 9.0 + 6.0 * k + (4.0 if kill else 0.0)
	var r1 = r0 + (12.0 if kill else 8.0)
	var w = 3.0 if kill or crit else 2.0
	var cc = size * 0.5
	for ang in [45.0, 135.0, 225.0, 315.0]:
		var d = Vector2.from_angle(deg_to_rad(ang))
		draw_line(cc + d * r0 + Vector2(1, 1), cc + d * r1 + Vector2(1, 1), Color(0, 0, 0, a * 0.6), w + 1.0)
		draw_line(cc + d * r0, cc + d * r1, c, w)
