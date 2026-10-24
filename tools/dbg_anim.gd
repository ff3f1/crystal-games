extends SceneTree
func _init():
	for lp in ["res://assets/anim/UAL1.glb", "res://assets/anim/UAL2.glb", "res://assets/chars/outfits/Male_Ranger.gltf"]:
		var s: Node = load(lp).instantiate()
		var aps = s.find_children("*", "AnimationPlayer", true, false)
		var sk: Skeleton3D = s.find_children("*", "Skeleton3D", true, false)[0]
		print(lp, " skel name=", sk.name, " unique=", sk.unique_name_in_owner, " bones0..6=", [sk.get_bone_name(0), sk.get_bone_name(1), sk.get_bone_name(2), sk.get_bone_name(5)])
		if aps.size() > 0:
			var a: Animation = aps[0].get_animation(aps[0].get_animation_list()[3])
			print(" anim ", aps[0].get_animation_list()[3], " tracks=", a.get_track_count())
			for i in mini(4, a.get_track_count()): print("   ", a.track_get_path(i), " type ", a.track_get_type(i))
			print(" ap root_node=", aps[0].root_node, " ap parent=", aps[0].get_parent().name)
	quit()
