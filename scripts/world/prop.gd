class_name Prop
extends StaticBody3D
## Объект уровня: модель + коллизия; может разрушаться.

var hp = -1.0
var model: Node3D
var kind = ""
var world: Node
var explosive = false
var mat_kind = "wood"

func damage(v: float, dir: Vector3) -> void:
	if hp < 0.0:
		return
	hp -= v
	if world and world.fx:
		if mat_kind in ["metal", "stone"]:
			world.fx.spark(global_position + Vector3.UP * 0.6, -dir, 4)
		else:
			world.fx.dust(global_position + Vector3.UP * 0.3, 0.5, 4)
	if hp <= 0.0:
		_break(dir)
	else:
		var tw = create_tween()
		var p0 = model.position
		tw.tween_property(model, "position", p0 + dir * 0.06, 0.04)
		tw.tween_property(model, "position", p0, 0.08)

func _break(dir: Vector3) -> void:
	hp = -1.0
	collision_layer = 0
	Sfx.at("wood_break" if mat_kind == "wood" else "stone_break", global_position, 0.0)
	if world and world.fx:
		world.fx.dust(global_position, 1.0, 12)
		var aabb = _aabb()
		for i in 7:
			var rb: RigidBody3D = world.fx.gib_chunk(global_position + Vector3(randf_range(-0.3, 0.3), aabb.size.y * randf(), randf_range(-0.3, 0.3)), dir * randf_range(2, 5) + Vector3(randf_range(-2, 2), randf_range(2, 5), randf_range(-2, 2)))
			for mi: MeshInstance3D in rb.find_children("*", "MeshInstance3D", true, false):
				mi.material_override = CharBuilder.prop_material(null, mat_kind)
				mi.scale = Vector3(randf_range(0.6, 1.4), randf_range(0.4, 1.0), randf_range(0.6, 1.4)) * 1.2
		if explosive:
			world.fx.fire_patch(global_position, 2.5, 6.0)
			world.add_zone(global_position, 2.5, 6.0, 14.0, 2, "fire")
			world.area_damage(global_position + Vector3.UP * 0.5, 3.5, 60.0, null, {"kind": "explosion", "fire": true, "team": 0, "knock": 9.0})
			world.area_damage(global_position + Vector3.UP * 0.5, 3.5, 30.0, null, {"kind": "explosion", "fire": true, "team": 1, "knock": 9.0})
			world.fx.flash_light(global_position + Vector3.UP, Color(1, 0.5, 0.15), 10.0, 10.0, 0.5)
			world.fx.shake(0.5)
			Sfx.at("firebomb", global_position, 5.0)
	queue_free()

func _aabb() -> AABB:
	var a = AABB(Vector3(-0.4, 0, -0.4), Vector3(0.8, 1.0, 0.8))
	for mi: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		a = a.merge(mi.get_aabb())
	return a
