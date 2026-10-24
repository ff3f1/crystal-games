class_name UIBar extends Control
## Полоса с «хвостом» урона и делениями.

var value = 1.0
var trail = 1.0
var col = Color(0.75, 0.05, 0.05)
var col2 = Color(0.45, 0.02, 0.02)
var trail_col = Color(1, 0.85, 0.7)
var ticks = 0
var glow = 0.0
var text = ""
var font_size = 18

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func set_value(v: float) -> void:
	v = clampf(v, 0.0, 1.0)
	if v > value:
		trail = v
	value = v

func _process(delta: float) -> void:
	if trail > value:
		trail = maxf(value, trail - delta * (0.25 + (trail - value) * 2.0))
	elif trail < value:
		trail = value
	queue_redraw()

func _draw() -> void:
	var r = Rect2(Vector2.ZERO, size)
	draw_rect(r, Color(0, 0, 0, 0.75))
	var inner = r.grow(-2)
	if trail > value:
		draw_rect(Rect2(inner.position + Vector2(inner.size.x * value, 0), Vector2(inner.size.x * (trail - value), inner.size.y)), trail_col)
	var w = inner.size.x * value
	if w > 0.5:
		var top = Rect2(inner.position, Vector2(w, inner.size.y * 0.5))
		var bot = Rect2(inner.position + Vector2(0, inner.size.y * 0.5), Vector2(w, inner.size.y * 0.5))
		draw_rect(top, col.lerp(Color.WHITE, 0.12 + glow * 0.3))
		draw_rect(bot, col2.lerp(col, glow * 0.4))
	if ticks > 1:
		for i in range(1, ticks):
			var x = inner.position.x + inner.size.x * float(i) / float(ticks)
			draw_line(Vector2(x, inner.position.y), Vector2(x, inner.end.y), Color(0, 0, 0, 0.55), 2.0)
	draw_rect(r, Color(0.45, 0.4, 0.37, 0.9), false, 1.0)
	if text != "":
		UIK.fonts()
		var f = UIK.f_bold
		var ts = f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
		var p = Vector2((size.x - ts.x) * 0.5, (size.y + ts.y * 0.62) * 0.5)
		draw_string_outline(f, p, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 4, Color(0, 0, 0, 0.9))
		draw_string(f, p, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, UIK.BONE)
