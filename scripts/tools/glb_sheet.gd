extends SceneTree
## Контактный лист GLB: godot --script glb_sheet.gd -- <dir> <out.png> [cols]

func _init() -> void:
	await process_frame
	var a = OS.get_cmdline_user_args()
	var dir: String = a[0]
	var out: String = a[1]
	var cols = int(a[2]) if a.size() > 2 else 8
	var files = []
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".glb"):
			files.append(f)
	files.sort()
	var root = Node3D.new()
	get_root().add_child(root)
	var env = WorldEnvironment.new(); var e = Environment.new(); env.environment = e
	e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.22, 0.22, 0.24)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; e.ambient_light_color = Color(0.6, 0.6, 0.62); e.ambient_light_energy = 0.9
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	root.add_child(env)
	var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, 30, 0); sun.light_energy = 1.5; root.add_child(sun)
	var sp = 3.0
	var i = 0
	for f in files:
		var doc = GLTFDocument.new(); var st = GLTFState.new()
		if doc.append_from_file(dir.path_join(f), st) != OK:
			continue
		var n: Node3D = doc.generate_scene(st)
		# нормализуем размер
		var ab = AABB(); var first = true
		for mi in n.find_children("*", "MeshInstance3D", true, false):
			var b = (mi as MeshInstance3D).get_aabb()
			b = (mi as MeshInstance3D).transform * b
			ab = b if first else ab.merge(b); first = false
		var k = 2.4 / maxf(0.01, maxf(ab.size.x, maxf(ab.size.y, ab.size.z)))
		var holder = Node3D.new()
		holder.add_child(n)
		n.scale = Vector3.ONE * k
		n.position = -ab.get_center() * k + Vector3(0, ab.size.y * k * 0.5, 0)
		root.add_child(holder)
		holder.position = Vector3((i % cols) * sp, 0, (i / cols) * sp)
		var l = Label3D.new(); l.text = f.get_basename(); l.pixel_size = 0.006; l.position = Vector3(0, -0.25, 1.2); l.rotation_degrees.x = -50; l.modulate = Color(1, 1, 0.6)
		holder.add_child(l)
		i += 1
	var rows = (i + cols - 1) / cols
	var cam = Camera3D.new(); root.add_child(cam)
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = maxf(rows * sp * 1.05, cols * sp * 0.6) 
	var c = Vector3((cols - 1) * sp * 0.5, 0, (rows - 1) * sp * 0.5)
	cam.look_at_from_position(c + Vector3(0, 12, 12), c + Vector3(0, 0.8, 0))
	cam.current = true
	for f in 8:
		await process_frame
	get_root().get_texture().get_image().save_png(out)
	print("SHEET ", out, " n=", i)
	quit()
