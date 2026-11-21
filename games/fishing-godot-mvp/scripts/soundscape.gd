extends Node
## Lightweight synthesized ambient lake and fishing events.
## Generates PCM16 AudioStreamWAV assets locally on first launch (no network).

var rng := RandomNumberGenerator.new()
var effects: Dictionary = {}
var channels: Array[AudioStreamPlayer] = []
var channel_cursor := 0
var ambient: AudioStreamPlayer

func _ready() -> void:
    rng.seed = 453789
    for i in range(3):
        var player := AudioStreamPlayer.new()
        add_child(player)
        channels.append(player)
    effects["cast"] = _tone(0.43, 215.0, 290.0, 0.17, 0.16)
    effects["splash"] = _tone(0.53, 92.0, 38.0, 0.82, 0.045)
    effects["bite"] = _tone(0.60, 650.0, 850.0, 0.09, 0.27)
    effects["hook"] = _tone(0.24, 430.0, 190.0, 0.15, 0.20)
    effects["reel"] = _tone(0.17, 115.0, 160.0, 0.22, 0.09)
    effects["catch"] = _tone(0.82, 390.0, 720.0, 0.04, 0.32)
    effects["fail"] = _tone(0.58, 180.0, 78.0, 0.05, 0.22)
    ambient = AudioStreamPlayer.new()
    add_child(ambient)
    ambient.volume_db = -17.0
    ambient.stream = _ambient_water(3.5)
    ambient.play()

func play(name: String) -> void:
    if not effects.has(name):
        return
    var channel: AudioStreamPlayer = channels[channel_cursor]
    channel_cursor = (channel_cursor + 1) % channels.size()
    channel.stream = effects[name]
    channel.volume_db = -4.0
    channel.play()

func set_volume_fraction(value: float) -> void:
    # Master volume also affects background ambience.
    if value <= 0.001:
        AudioServer.set_bus_mute(0, true)
    else:
        AudioServer.set_bus_mute(0, false)
        AudioServer.set_bus_volume_db(0, linear_to_db(clampf(value, 0.001, 1.0)))

func _tone(length: float, f0: float, f1: float, grit: float, amp: float) -> AudioStreamWAV:
    const SR = 22050
    var frames := maxi(1, int(length * float(SR)))
    var bytes := PackedByteArray()
    bytes.resize(frames * 2)
    var previous_noise := 0.0
    for i in range(frames):
        var t := float(i) / float(frames)
        var fade := pow(1.0 - t, 1.7) * minf(1.0, t * 34.0)
        var f := lerpf(f0, f1, t)
        previous_noise = lerpf(previous_noise, rng.randf_range(-1.0, 1.0), 0.17)
        var value := sin(TAU * (f0 * float(i) / SR + (f1 - f0) * length * t * t * 0.5)) * (1.0 - grit) + previous_noise * grit
        var sample := clampi(int(value * fade * amp * 32767.0), -32768, 32767)
        bytes.encode_s16(i * 2, sample)
    var stream := AudioStreamWAV.new()
    stream.format = AudioStreamWAV.FORMAT_16_BITS
    stream.mix_rate = SR
    stream.stereo = false
    stream.data = bytes
    return stream

func _ambient_water(length: float) -> AudioStreamWAV:
    const SR = 22050
    var count := int(float(SR) * length)
    var data := PackedByteArray()
    data.resize(count * 2)
    var smooth := 0.0
    for i in range(count):
        var phase := float(i) / SR
        var target := rng.randf_range(-1.0, 1.0)
        smooth = lerpf(smooth, target, 0.009)
        var wave := sin(TAU * phase * 0.48) * 0.31 + sin(TAU * phase * 0.83) * 0.19
        var sample := clampi(int((smooth * 0.62 + wave * 0.38) * 10500.0), -32768, 32767)
        data.encode_s16(i * 2, sample)
    var stream := AudioStreamWAV.new()
    stream.format = AudioStreamWAV.FORMAT_16_BITS
    stream.mix_rate = SR
    stream.stereo = false
    stream.data = data
    stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
    stream.loop_begin = 0
    stream.loop_end = count
    return stream
