extends SceneTree
# args: model_path anim_lib_path anim_name time out.png [cam_dist]
var frames := 0
var args: PackedStringArray
var root3d: Node3D
var ap: AnimationPlayer
func _init():
	pass
func setup():
	args = OS.get_cmdline_user_args()
	root3d = Node3D.new()
	get_root().add_child(root3d)
	var env := WorldEnvironment.new(); env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR; env.environment.background_color = Color(0.25, 0.25, 0.28)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.environment.ambient_light_color = Color(0.5, 0.5, 0.5)
	root3d.add_child(env)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-50, 30, 0); root3d.add_child(sun)
	var cam := Camera3D.new(); root3d.add_child(cam)
	var d := float(args[5]) if args.size() > 5 else 3.2
	cam.position = Vector3(d * 0.6, 1.2, d); cam.look_at(Vector3(0, 0.95, 0))
	var models := args[0].split(",")
	var i := 0
	for mp in models:
		var m: Node3D = load(mp).instantiate()
		m.position.x = (i - (models.size() - 1) * 0.5) * 1.1
		root3d.add_child(m)
		i += 1
		var sk: Skeleton3D = m.find_children("*", "Skeleton3D", true, false)[0]
		var p := AnimationPlayer.new(); m.add_child(p)
		for lp in args[1].split(","):
			var lib_scene: Node = load(lp).instantiate()
			var lap: AnimationPlayer = lib_scene.find_children("*", "AnimationPlayer", true, false)[0]
			var lib: AnimationLibrary = lap.get_animation_library("")
			p.add_animation_library(lp.get_file().get_basename(), lib)
		var an := args[2]
		if p.has_animation(an):
			p.play(an); p.seek(float(args[3]), true); p.pause()
		else:
			print("NO ANIM ", an, " have: ", p.get_animation_list())
func _process(_d):
	frames += 1
	if frames == 1: setup()
	if frames == 8:
		var img := get_root().get_texture().get_image()
		img.save_png(args[4])
		print("saved ", args[4])
		quit()
	return false
