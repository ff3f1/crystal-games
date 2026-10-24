class_name SoulOrb extends Node3D
## Душа убитого: взлетает и летит к герою, восполняя ману.

var world: Node
var mana = 4.0
var vel = Vector3.ZERO
var t = 0.0
var mi: MeshInstance3D

static var _mesh: SphereMesh
static var _mat: StandardMaterial3D

func setup(w: Node, pos: Vector3, amount: float) -> void:
	world = w
	mana = amount
	vel = Vector3(randf_range(-2.5, 2.5), randf_range(4.0, 6.5), randf_range(-2.5, 2.5))
	if _mesh == null:
		_mesh = SphereMesh.new(); _mesh.radius = 0.09; _mesh.height = 0.18; _mesh.radial_segments = 8; _mesh.rings = 4
		_mat = StandardMaterial3D.new()
		_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_mat.albedo_color = Color(0.55, 1.0, 0.7)
		_mat.emission_enabled = true; _mat.emission = Color(0.35, 1.0, 0.55); _mat.emission_energy_multiplier = 5.0
	mi = MeshInstance3D.new()
	mi.mesh = _mesh
	mi.material_override = _mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	w.fx.add_child(self)
	global_position = pos
	w.fx.green_trail(self)

func _process(delta: float) -> void:
	t += delta
	var pl = world.player if world else null
	if pl == null or not is_instance_valid(pl) or pl.dead or t > 4.0:
		queue_free()
		return
	var target = pl.center() + Vector3.UP * 0.3
	var to = target - global_position
	var d = to.length()
	if t > 0.35:
		var want = to / maxf(0.01, d) * (10.0 + t * 14.0)
		vel = vel.lerp(want, clampf(delta * 6.0, 0, 1))
	else:
		vel.y -= 9.0 * delta
	global_position += vel * delta
	mi.scale = Vector3.ONE * (1.0 + 0.25 * sin(t * 20.0))
	if d < 0.6 and t > 0.3:
		pl.mana = minf(pl.max_mana, pl.mana + mana)
		Sfx.at("ui_tick", pl.global_position, -10.0)
		world.fx.muzzle(target, Color(0.4, 1.0, 0.55), 0.35)
		queue_free()
