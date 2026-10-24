extends SceneTree
func _init():
	var nt = NoiseTexture2D.new()
	var fn = FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.fractal_octaves = 5
	nt.noise = fn; nt.width = 512; nt.height = 512; nt.seamless = true; nt.generate_mipmaps = true
	ResourceSaver.save(nt, "res://assets/tex/noise.tres")
	quit()
