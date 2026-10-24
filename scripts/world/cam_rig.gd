class_name CamRig
extends Node3D
## Изометрическая камера: следование, упреждение к прицелу, тряска, зум.

var target: Node3D
var cam: Camera3D
var dist = 17.0
var dist_target = 17.0
var pitch = -54.0
var yaw = 38.0
var trauma = 0.0
var t = 0.0
var lead = Vector3.ZERO
var aim_point = Vector3.ZERO
var punch = Vector3.ZERO
var zoom_override = -1.0
var focus_override = null

func _ready() -> void:
	cam = Camera3D.new()
	cam.fov = 38.0
	cam.near = 0.3
	cam.far = 260.0
	add_child(cam)
	cam.current = true
	rotation_degrees = Vector3(0, yaw, 0)

func add_trauma(v: float) -> void:
	trauma = clampf(trauma + v, 0.0, 1.0)

func kick(dir: Vector3, amount: float) -> void:
	punch += dir * amount

func _process(delta: float) -> void:
	t += delta
	var real_dt = delta / maxf(0.05, Engine.time_scale)
	var focus = global_position
	if focus_override != null:
		focus = focus_override
	elif is_instance_valid(target):
		focus = target.global_position
		var to_aim = aim_point - focus
		to_aim.y = 0
		lead = lead.lerp(to_aim.limit_length(14.0) * 0.18, clampf(4.0 * real_dt, 0, 1))
		focus += lead
	var want = dist_target if zoom_override < 0.0 else zoom_override
	dist = lerpf(dist, want, clampf(5.0 * real_dt, 0, 1))
	global_position = global_position.lerp(focus, clampf(8.0 * real_dt, 0, 1))
	var p = deg_to_rad(pitch)
	var off = Vector3(0, -sin(p), cos(p)) * dist
	var sh = trauma * trauma
	var n1 = sin(t * 47.0) * 0.6 + sin(t * 23.0 + 1.3) * 0.4
	var n2 = sin(t * 41.0 + 2.1) * 0.6 + sin(t * 29.0 + 0.4) * 0.4
	punch = punch.lerp(Vector3.ZERO, clampf(12.0 * real_dt, 0, 1))
	cam.position = off + Vector3(n1, n2, 0) * sh * 0.55 + basis.inverse() * punch
	cam.rotation = Vector3(p + n2 * sh * 0.02, 0, n1 * sh * 0.03)
	trauma = maxf(0.0, trauma - real_dt * 1.6)

func mouse_ground(screen_pos: Vector2, plane_y := 0.0) -> Vector3:
	var o = cam.project_ray_origin(screen_pos)
	var d = cam.project_ray_normal(screen_pos)
	if absf(d.y) < 0.0001:
		return o
	var tt = (plane_y - o.y) / d.y
	return o + d * tt

func cam_basis_flat() -> Basis:
	return Basis(Vector3.UP, deg_to_rad(yaw))
