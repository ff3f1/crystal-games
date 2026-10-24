extends OmniLight3D
var base = -1.0
var t = 0.0
func _process(d: float) -> void:
	if base < 0.0:
		base = light_energy
	t += d * randf_range(8.0, 14.0)
	light_energy = base * (0.82 + 0.18 * sin(t) * sin(t * 0.37 + 1.3) + randf() * 0.05)
