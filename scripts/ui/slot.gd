class_name UISlot extends Control
## Ячейка способности: иконка, клавиша, перезарядка, цена.

var tex: Texture2D
var key = ""
var cost = 0
var cd = 0.0        # 0..1 доля оставшейся перезарядки
var ready_flash = 0.0
var usable = true
var active = 0.0    # подсветка активного эффекта (жатва)
var charges = -1
var charges_max = 0
var fill = -1.0     # для жатвы — заполнение снизу
var _was_cd = false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(76, 76)

func _process(delta: float) -> void:
	if cd > 0.01:
		_was_cd = true
	elif _was_cd:
		_was_cd = false
		ready_flash = 1.0
	ready_flash = maxf(0.0, ready_flash - delta * 3.0)
	queue_redraw()

func _draw() -> void:
	UIK.fonts()
	var r = Rect2(Vector2.ZERO, size)
	draw_rect(r.grow(3), Color(0, 0, 0, 0.8))
	if tex:
		var m = Color(1, 1, 1) if usable else Color(0.35, 0.35, 0.38)
		draw_texture_rect(tex, r, false, m)
	if fill >= 0.0 and fill < 1.0:
		draw_rect(Rect2(0, 0, size.x, size.y * (1.0 - fill)), Color(0, 0, 0, 0.72))
	if cd > 0.0:
		draw_rect(Rect2(0, size.y * (1.0 - cd), size.x, size.y * cd), Color(0, 0, 0, 0.7))
	var bc = Color(0.42, 0.38, 0.35)
	if fill >= 1.0:
		bc = Color(1, 0.12 + 0.1 * sin(Time.get_ticks_msec() * 0.01), 0.08)
	if active > 0.0:
		bc = Color(1, 0.15, 0.1)
	if ready_flash > 0.0:
		bc = bc.lerp(Color(1, 1, 1), ready_flash)
		draw_rect(r, Color(1, 1, 1, ready_flash * 0.35))
	draw_rect(r, bc, false, 2.0 if fill < 1.0 else 3.0)
	var f = UIK.f_bold
	if key != "":
		var ks = f.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1, 17)
		var kp = Vector2(4, 17)
		draw_rect(Rect2(Vector2(1, 1), Vector2(ks.x + 8, 21)), Color(0, 0, 0, 0.78))
		draw_string(f, kp, key, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, UIK.BONE)
	if cost > 0:
		var cs = str(cost)
		var w = f.get_string_size(cs, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		var p = Vector2(size.x - w - 4, size.y - 5)
		draw_string_outline(f, p, cs, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0, 0, 0))
		draw_string(f, p, cs, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, UIK.NECRO if usable else Color(0.8, 0.3, 0.3))
	if charges_max > 1:
		for i in charges_max:
			var c = Color(0.9, 0.85, 0.8) if i < charges else Color(0.2, 0.2, 0.2)
			draw_rect(Rect2(Vector2(4 + i * 12, size.y - 10), Vector2(9, 6)), c)
