extends Node
## WAV soundscape generated during build, played completely offline.
## Broad-spectrum reel, nylon, water, bird and drag layers without harsh beeps.

var effects: Dictionary = {}
var channels: Array[AudioStreamPlayer] = []
var cursor := 0
var water: AudioStreamPlayer
var birds: AudioStreamPlayer

func _ready() -> void:
    for i in range(5):
        var channel := AudioStreamPlayer.new()
        channel.volume_db = -2.0
        add_child(channel)
        channels.append(channel)
    for key in ["cast", "splash", "bite", "hook", "reel", "drag", "catch", "fail", "footstep"]:
        var path := "res://assets/audio/%s.wav" % key
        var stream := load(path) as AudioStream
        if stream != null:
            effects[key] = stream
        else:
            push_warning("Missing offline audio asset: " + path)
    water = _looping_player("lake_water", -14.0)
    birds = _looping_player("forest_birds", -15.0)

func _looping_player(key: String, decibels: float) -> AudioStreamPlayer:
    var player := AudioStreamPlayer.new()
    add_child(player)
    player.volume_db = decibels
    var track := load("res://assets/audio/%s.wav" % key) as AudioStream
    if track != null:
        # Do not set AudioStreamWAV.loop_mode: Godot 4.5 keeps looped
        # imported WAVs alive at engine shutdown. Restart on natural end.
        player.stream = track
        player.play()
    return player

func _process(_delta: float) -> void:
    if water != null and water.stream != null and not water.playing:
        water.play()
    if birds != null and birds.stream != null and not birds.playing:
        birds.play()

func play(key: String) -> void:
    if not effects.has(key):
        return
    var player := channels[cursor]
    cursor = (cursor + 1) % channels.size()
    player.stream = effects[key]
    player.volume_db = 1.0 if key == "splash" or key == "catch" else -3.5
    player.play()

func set_volume_fraction(value: float) -> void:
    if value <= 0.001:
        AudioServer.set_bus_mute(0, true)
    else:
        AudioServer.set_bus_mute(0, false)
        AudioServer.set_bus_volume_db(0, linear_to_db(clampf(value, 0.001, 1.0)))

func _exit_tree() -> void:
    for channel in channels:
        if channel != null:
            channel.stop()
            channel.stream = null
    if water != null:
        water.stop()
        water.stream = null
    if birds != null:
        birds.stop()
        birds.stream = null
    effects.clear()
