extends SceneTree
func _init():
	for f in DirAccess.get_files_at("res://assets/weapons/q"):
		if f.ends_with(".obj"):
			var m = load("res://assets/weapons/q/" + f)
			if m is Mesh:
				print(f, " ", m.get_aabb())
	quit()
