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
        if track is AudioStreamWAV:
            var pcm := track as AudioStreamWAV
            pcm.loop_mode = AudioStreamWAV.LOOP_FORWARD
            pcm.loop_begin = 0
            pcm.loop_end = pcm.data.size() / 2
        player.stream = track
        player.play()
    return player

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
