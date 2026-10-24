extends Node
## Тесты/скриншоты без окна редактора: --test=<mode>|<args...>

var frames = 0
var shot_at = 14
var out = "/tmp/shot.png"
var mode = ""

func run(spec: String) -> void:
	var p = spec.split("|")
	mode = p[0]
	match mode:
		"lineup":
			_lineup(p[1].split(","), p[2], float(p[3]))
			out = p[4]
		"fight":
			_fight(p[1], p[2], int(p[3]), p[4], p.size() > 5 and p[5] == "nobot")
		"boss":
			_hud(p[1], p[2], int(p[3]), p[4], "boss")
		"animspeed":
			_animspeed()
		"bossmoves":
			_bossmoves(p[1])
		"menu":
			_menu(p[1])
			out = p[2]
			shot_at = int(p[3]) if p.size() > 3 else 40
		"hud":
			_hud(p[1], p[2], int(p[3]), p[4], p[5] if p.size() > 5 else "")

func _menu(screen: String) -> void:
	get_window().size = Vector2i(1920, 1080)
	var ui = CanvasLayer.new(); ui.layer = 10; get_parent().add_child.call_deferred(ui)
	G.save.souls = 640
	G.save.missions_done = ["graveyard"]
	var mm = MainMenu.new()
	ui.add_child(mm)
	match screen:
		"heroes": mm.show_heroes.call_deferred()
		"missions": mm.show_missions.call_deferred()
		"crypt": mm.show_crypt.call_deferred()
		"settings": mm.show_settings.call_deferred()
		"results":
			G.start_run(G.MISSIONS[0]); G.run.kills = 87; G.run.time = 412.0; G.run.max_combo = 23; G.run.level = 7
			var r = Results.new(); r.setup(true, 118); ui.add_child.call_deferred(r)

func _animspeed() -> void:
	var look: Dictionary = G.LOOKS["zealot"].duplicate()
	var m = CharBuilder.build(look, "zealot")
	add_child(m)
	var ap = AnimationPlayer.new(); m.add_child(ap)
	AnimLib.attach(ap)
	var sk: Skeleton3D = m.find_children("*", "Skeleton3D", true, false)[0]
	for clip in ["a1/Walk", "a1/Walk_Formal", "a1/Jog_Fwd", "a1/Sprint", "a2/Zombie_Walk_Fwd", "a1/Crouch_Fwd", "a2/Walk_Carry"]:
		var A: Animation = AnimLib.get_anim(clip)
		if A == null:
			continue
		ap.play(clip)
		var L = A.length
		var res = []
		for fb in ["LeftFoot", "RightFoot"]:
			var bi = sk.find_bone(fb)
			var pts = []
			var n = 240
			for i in n + 1:
				var t = L * float(i) / float(n)
				ap.seek(t, true)
				sk.force_update_all_bone_transforms()
				var gp = sk.get_bone_global_pose(bi).origin
				pts.append(gp)
			var miny = 1e9
			for q in pts:
				miny = minf(miny, q.y)
			# самый длинный непрерывный участок опоры
			var best = 0.0
			var runs = []
			var i0 = -1
			for i in n + 1:
				var low = pts[i].y < miny + 0.03
				if low and i0 < 0:
					i0 = i
				if (not low or i == n) and i0 >= 0:
					var i1 = i - 1 if not low else i
					if i1 - i0 >= 4:
						var dz = pts[i0].z - pts[i1].z
						var dt = L * float(i1 - i0) / float(n)
						runs.append([snappedf(dz, 0.01), snappedf(dt, 0.01), snappedf(dz / dt, 0.01)])
					i0 = -1
			var zmin = 1e9; var zmax = -1e9; var ymax = -1e9
			for q in pts:
				zmin = minf(zmin, q.z); zmax = maxf(zmax, q.z); ymax = maxf(ymax, q.y)
			var lowfrac = 0.0
			for q in pts:
				if q.y < miny + 0.06:
					lowfrac += 1.0
			res.append([snappedf(zmax - zmin, 0.01), snappedf(ymax - miny, 0.01), snappedf(lowfrac / pts.size(), 0.01)])
		var hip = sk.find_bone("Hips")
		ap.seek(0.0, true); sk.force_update_all_bone_transforms(); var h0 = sk.get_bone_global_pose(hip).origin
		ap.seek(L * 0.999, true); sk.force_update_all_bone_transforms(); var h1 = sk.get_bone_global_pose(hip).origin
		print("ANIMSPEED ", clip, " len=", snappedf(L, 0.01), " foot_speed=", res, " hips_drift=", h1 - h0, " skel_scale=", sk.global_transform.basis.get_scale())
	get_tree().quit()

var bm_boss = null
var bm_moves = []
var bm_t = 0.0
func _bossmoves(biome: String) -> void:
	_fight(biome, "lich", 999999, "/tmp/bm", false)
	shots = []
	world.director.waves = []
	world.director.phase_t = 0.3
	bm_moves = {"graveyard": ["chop", "sweep", "charge", "leap", "roar", "chop", "sweep", "roar", "chop"],
		"camp": ["combo", "volley", "shield_charge", "leap", "roar", "volley", "roar", "volley"],
		"crypt": ["blink", "bolts", "pillars", "purge", "pillar_line", "roar", "pillars", "roar", "bolts"],
		"cathedral": ["smash", "sweep_big", "rings", "beam", "debris", "roar", "beam", "roar", "rings"]}[biome]
	world.player.invuln_t = 9999.0

func _bm_tick(d: float) -> void:
	if bm_moves.is_empty() and bm_boss == null:
		return
	if bm_boss == null:
		if is_instance_valid(world.boss):
			bm_boss = world.boss
			bm_boss.intro_t = 0.0
			print("BOSS ", bm_boss.uid)
		return
	world.player.invuln_t = 9999.0
	world.player.hp = world.player.max_hp
	bm_t -= d
	if bm_t <= 0.0 and not bm_boss.busy and bm_boss.vuln_t <= 0.0:
		if bm_moves.is_empty():
			print("BOSSMOVES DONE hp=", bm_boss.hp, "/", bm_boss.max_hp, " phase=", bm_boss.phase_i)
			bm_boss.take_hit({"dmg": 999999.0, "dir": Vector3(1, 0, 0), "kind": "slash", "src": world.player})
			bm_moves = []
			get_tree().create_timer(3.0).timeout.connect(func(): print("BOSS DEAD OK ", bm_boss.dead); get_tree().quit())
			bm_t = 999.0
			return
		var m = bm_moves.pop_front()
		if m == "roar":
			bm_boss.hp = bm_boss.max_hp * (0.6 if bm_boss.phase_i == 0 else 0.3)
		else:
			bm_boss._start(m)
		print("MOVE ", m, " t=", G.run.get("time", 0.0))
		bm_t = 0.5

var shots: Array = []
var hud_extra = ""
func _hud(biome: String, hero: String, nframes: int, prefix: String, extra: String) -> void:
	_fight(biome, hero, nframes, prefix, false)
	hud_extra = extra
	var ui = CanvasLayer.new(); ui.layer = 10; get_parent().add_child.call_deferred(ui)
	var h = HUD.new()
	ui.add_child(h)
	h.setup.call_deferred(world)
	if extra == "boss":
		world.director.waves = []
		world.director.phase_t = 0.5
	if extra == "perk":
		get_tree().create_timer(3.0).timeout.connect(func():
			var pp = PerkPick.new(); ui.add_child(pp))
	if extra == "pause":
		get_tree().create_timer(3.0).timeout.connect(func():
			var pm = PauseMenu.new(); ui.add_child(pm))

var world: World
var fprefix = ""
func _fight(biome: String, hero: String, nframes: int, prefix: String, nobot: bool) -> void:
	get_window().size = Vector2i(1920, 1080)
	G.save.hero = hero
	var m: Dictionary = {}
	for mm in G.MISSIONS:
		if mm.biome == biome:
			m = mm
	G.start_run(m)
	world = World.new()
	world.setup(m, false)
	get_parent().add_child(world)
	if world.player:
		world.player.bot = not nobot
	fprefix = prefix
	shot_at = 999999
	var step = maxi(1, nframes / 4)
	shots = [step, step * 2, step * 3, nframes]

func _process(_d: float) -> void:
	frames += 1
	if mode == "bossmoves":
		_bm_tick(_d)
	if not shots.is_empty() and frames >= shots[0]:
		shots.pop_front()
		var img = get_viewport().get_texture().get_image()
		var fn = "%s_%03d.jpg" % [fprefix, frames]
		img.save_jpg(fn, 0.85)
		print("SHOT ", fn, " units0=", world.units_of(0).size(), " units1=", world.units_of(1).size(), " corpses=", world.corpses.size(), " fps=", Engine.get_frames_per_second(), " t=", G.run.get("time", 0.0), " kills=", G.run.get("kills", 0), " hp=", world.player.hp if world.player else -1)
		if shots.is_empty():
			get_tree().quit()
	if frames == shot_at:
		get_viewport().get_texture().get_image().save_png(out)
		print("SHOT ", out)
		get_tree().quit()

func _env(r: Node3D) -> void:
	var env = WorldEnvironment.new(); var e = Environment.new(); env.environment = e
	e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.16, 0.16, 0.17)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; e.ambient_light_color = Color(0.45, 0.45, 0.5); e.ambient_light_energy = 0.8
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	r.add_child(env)
	var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-40, 35, 0); sun.light_energy = 1.4; sun.shadow_enabled = true; r.add_child(sun)
	var fill = DirectionalLight3D.new(); fill.rotation_degrees = Vector3(-20, -140, 0); fill.light_energy = 0.4; r.add_child(fill)
	var gr = MeshInstance3D.new(); var pm = PlaneMesh.new(); pm.size = Vector2(40, 40); gr.mesh = pm; r.add_child(gr)

func _lineup(looks: PackedStringArray, anim: String, t: float) -> void:
	var r = Node3D.new(); add_child(r)
	_env(r)
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
		ap.play(anim); ap.seek(t + i * 0.07, true); ap.pause()
	var cam = Camera3D.new(); r.add_child(cam)
	var w = n * 1.25
	cam.fov = 35
	cam.position = Vector3(0, 1.6, 2.2 + w * 1.1); cam.look_at(Vector3(0, 0.95, 0))
	cam.current = true
