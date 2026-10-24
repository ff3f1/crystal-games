extends SceneTree
func pr(n: Node, d: int):
	var extra = ""
	if n is Skeleton3D: extra = " bones=%d" % n.get_bone_count()
	if n is MeshInstance3D: extra = " mesh surf=%d skin=%s" % [n.mesh.get_surface_count() if n.mesh else 0, str(n.skin != null)]
	print("  ".repeat(d), n.name, " [", n.get_class(), "]", extra)
	for c in n.get_children(): pr(c, d + 1)
func _init():
	for p in OS.get_cmdline_user_args():
		print("== ", p)
		var s = load(p).instantiate()
		pr(s, 0)
	quit()
