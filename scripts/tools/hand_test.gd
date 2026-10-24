extends SceneTree
var frames = 0
var cam: Camera3D
func _process(_d) -> bool:
	frames += 1
	if frames == 1:
		var r = Node3D.new(); get_root().add_child(r)
		var env = WorldEnvironment.new(); env.environment = Environment.new()
		env.environment.background_mode = Environment.BG_COLOR; env.environment.background_color = Color(0.3, 0.3, 0.33)
		env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.environment.ambient_light_color = Color(0.6, 0.6, 0.6)
		r.add_child(env)
		var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-50, 30, 0); r.add_child(sun)
		cam = Camera3D.new(); r.add_child(cam); var cp: Array = str_to_var(OS.get_cmdline_user_args()[3]); cam.position = Vector3(cp[0], cp[1], cp[2]); cam.look_at(Vector3(0, 1.0, 0)); cam.fov = 40
		var m: Node3D = load("res://assets/chars/outfits/Male_Ranger.gltf").instantiate(); r.add_child(m)
		var sk: Skeleton3D = m.find_children("*", "Skeleton3D", true, false)[0]
		var ap = AnimationPlayer.new(); m.add_child(ap)
		for lp in ["res://assets/anim/UAL1.glb", "res://assets/anim/UAL2.glb"]:
			var ls: Node = load(lp).instantiate()
			ap.add_animation_library(lp.get_file().get_basename(), (ls.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer).get_animation_library(""))
		ap.play(OS.get_cmdline_user_args()[0]); ap.seek(float(OS.get_cmdline_user_args()[1]), true); ap.pause()
		var ba = BoneAttachment3D.new(); ba.bone_name = "RightHand"; sk.add_child(ba)
		var mi = MeshInstance3D.new(); var bm = BoxMesh.new(); bm.size = Vector3(0.03, 0.03, 0.9)
		var mat = StandardMaterial3D.new(); mat.albedo_color = Color.RED; mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bm.material = mat; mi.mesh = bm; mi.position = Vector3(0, 0.085, 0.38); ba.add_child(mi)
		var mi2 = MeshInstance3D.new(); var bm2 = BoxMesh.new(); bm2.size = Vector3(0.12, 0.03, 0.03); bm2.material = mat; mi2.mesh = bm2; mi2.position = Vector3(0, 0.085, 0.0); ba.add_child(mi2)
	if frames == 10:
		get_root().get_texture().get_image().save_png(OS.get_cmdline_user_args()[2]); quit()
	return false
