extends Node
## Звук: пул 3D-источников, UI, музыка.

var music: AudioStreamPlayer
var music_name = ""
var cache = {}
var pool: Array = []
var ui_player: AudioStreamPlayer
const POOL_SIZE := 40
var last_play = {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_buses()
	music = AudioStreamPlayer.new()
	music.bus = "Music"
	add_child(music)
	ui_player = AudioStreamPlayer.new()
	ui_player.bus = "SFX"
	add_child(ui_player)
	for i in POOL_SIZE:
		var p = AudioStreamPlayer3D.new()
		p.bus = "SFX"
		p.unit_size = 12.0
		p.max_distance = 70.0
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		add_child(p)
		pool.append(p)

func _setup_buses() -> void:
	if AudioServer.get_bus_index("Music") < 0:
		AudioServer.add_bus(); AudioServer.set_bus_name(AudioServer.bus_count - 1, "Music")
	if AudioServer.get_bus_index("SFX") < 0:
		AudioServer.add_bus(); AudioServer.set_bus_name(AudioServer.bus_count - 1, "SFX")
		var comp = AudioEffectCompressor.new(); comp.threshold = -10.0; comp.ratio = 4.0
		AudioServer.add_bus_effect(AudioServer.get_bus_index("SFX"), comp)

func _stream(name: String) -> AudioStream:
	if cache.has(name):
		var arr: Array = cache[name]
		return arr[randi() % arr.size()] if not arr.is_empty() else null
	var arr2 = []
	for ext in ["ogg", "wav", "mp3"]:
		var p = "res://assets/sfx/%s.%s" % [name, ext]
		if ResourceLoader.exists(p):
			arr2.append(load(p))
		for i in range(1, 9):
			var p2 = "res://assets/sfx/%s_%d.%s" % [name, i, ext]
			if ResourceLoader.exists(p2):
				arr2.append(load(p2))
	cache[name] = arr2
	return arr2[randi() % arr2.size()] if not arr2.is_empty() else null

func at(name: String, pos: Vector3, vol := 0.0, pitch_var := 0.08) -> void:
	var now = Time.get_ticks_msec()
	if now - int(last_play.get(name, 0)) < 35:
		return
	last_play[name] = now
	var s = _stream(name)
	if s == null:
		return
	var best: AudioStreamPlayer3D = null
	for p in pool:
		if not p.playing:
			best = p
			break
	if best == null:
		best = pool[randi() % pool.size()]
	best.stream = s
	best.volume_db = vol
	best.pitch_scale = randf_range(1.0 - pitch_var, 1.0 + pitch_var) * clampf(Engine.time_scale * 0.5 + 0.5, 0.5, 1.0)
	best.global_position = pos
	best.play()

func ui(name: String, vol := -4.0) -> void:
	var s = _stream(name)
	if s == null:
		return
	var p = AudioStreamPlayer.new()
	p.bus = "SFX"
	p.stream = s
	p.volume_db = vol
	add_child(p)
	p.play()
	p.finished.connect(p.queue_free)

func play_music(name: String) -> void:
	if name == music_name and music.playing:
		return
	music_name = name
	var s: AudioStream = null
	# свои треки игрока из папки music рядом с exe
	var user_dir = OS.get_executable_path().get_base_dir().path_join("music")
	if name != "menu" and DirAccess.dir_exists_absolute(user_dir):
		var files = []
		for f in DirAccess.get_files_at(user_dir):
			if f.get_extension().to_lower() in ["ogg", "mp3", "wav"]:
				files.append(user_dir.path_join(f))
		if not files.is_empty():
			s = _load_external(files[randi() % files.size()])
	if s == null:
		var opts = []
		for ext in ["ogg", "mp3"]:
			var p = "res://assets/music/%s.%s" % [name, ext]
			if ResourceLoader.exists(p):
				opts.append(p)
			for i in range(1, 7):
				var p2 = "res://assets/music/%s_%d.%s" % [name, i, ext]
				if ResourceLoader.exists(p2):
					opts.append(p2)
		if not opts.is_empty():
			s = load(opts[randi() % opts.size()])
	if s == null and name == "victory":
		music_name = ""
		play_music("menu")
		music_name = name
		return
	if s == null:
		music.stop()
		return
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = true
	elif s is AudioStreamMP3:
		(s as AudioStreamMP3).loop = true
	var tw = create_tween()
	if music.playing:
		tw.tween_property(music, "volume_db", -40.0, 0.6)
	tw.tween_callback(func():
		music.stream = s
		music.volume_db = -40.0
		music.play())
	tw.tween_property(music, "volume_db", 0.0, 1.0)

func _load_external(path: String) -> AudioStream:
	var ext = path.get_extension().to_lower()
	if ext == "ogg":
		return AudioStreamOggVorbis.load_from_file(path)
	if ext == "mp3":
		return AudioStreamMP3.load_from_file(path)
	if ext == "wav":
		return AudioStreamWAV.load_from_file(path)
	return null

func stop_music() -> void:
	music_name = ""
	var tw = create_tween()
	tw.tween_property(music, "volume_db", -40.0, 0.8)
	tw.tween_callback(music.stop)
