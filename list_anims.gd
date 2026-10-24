extends SceneTree
func _init():
	for p in ["res://assets/anim/UAL1.glb", "res://assets/anim/UAL2.glb"]:
		var s = load(p).instantiate()
		var ap: AnimationPlayer = s.find_children("*", "AnimationPlayer", true, false)[0]
		var names = ap.get_animation_list()
		print(p, " count=", names.size())
		var out = []
		for n in names:
			out.append("%s(%.2f)" % [n, ap.get_animation(n).length])
		print(", ".join(out))
		var sk = s.find_children("*", "Skeleton3D", true, false)
		if sk.size() > 0:
			var bones = []
			for i in sk[0].get_bone_count(): bones.append(sk[0].get_bone_name(i))
			print("bones: ", ", ".join(bones))
		var meshes = s.find_children("*", "MeshInstance3D", true, false)
		print("meshes: ", meshes.size())
	quit()
