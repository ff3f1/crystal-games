extends SceneTree
# Рендер линейки обликов. args: looks(через запятую) anim time out.png [mono]
var frames = 0
var args: PackedStringArray
func _process(_d) -> bool:
	frames += 1
	if frames == 2:
		args = OS.get_cmdline_user_args()
		var r = Node3D.new(); get_root().add_child(r)
		var env = WorldEnvironment.new(); var e = Environment.new(); env.environment = e
		e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.16, 0.16, 0.17)
		e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; e.ambient_light_color = Color(0.45, 0.45, 0.5); e.ambient_light_energy = 0.8
		e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		r.add_child(env)
		var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-40, 35, 0); sun.light_energy = 1.4; sun.shadow_enabled = true; r.add_child(sun)
		var fill = DirectionalLight3D.new(); fill.rotation_degrees = Vector3(-20, -140, 0); fill.light_energy = 0.4; r.add_child(fill)
		var gr = MeshInstance3D.new(); var pm = PlaneMesh.new(); pm.size = Vector2(40, 40); gr.mesh = pm; r.add_child(gr)
		var looks = args[0].split(",")
		var n = looks.size()
		for i in n:
			var lk: String = looks[i]
			var look: Dictionary = G.LOOKS[lk.trim_suffix("@u")].duplicate()
			if lk.ends_with("@u"):
				look["undead"] = 1.0; look["eyes"] = Color(0.3, 1.0, 0.45, 5.0)
			var m = CharBuilder.build(look, lk)
			r.add_child(m)
			m.position.x = (i - (n - 1) * 0.5) * 1.25
			var ap = AnimationPlayer.new(); m.add_child(ap)
			AnimLib.attach(ap)
			ap.play(args[1]); ap.seek(float(args[2]) + i * 0.07, true); ap.pause()
		var cam = Camera3D.new(); r.add_child(cam)
		var w = n * 1.25
		cam.fov = 35
		cam.position = Vector3(0, 1.6, 2.2 + w * 1.1); cam.look_at(Vector3(0, 0.95, 0))
	if frames == 14:
		get_root().get_texture().get_image().save_png(args[3]); quit()
	return false
