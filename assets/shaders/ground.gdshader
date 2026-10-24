shader_type spatial;
render_mode cull_back;
uniform sampler2D tex_a : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_a_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_b : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_b_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D noise_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform float scale_a = 0.22;
uniform float scale_b = 0.18;
uniform float mix_scale = 0.035;
uniform float mix_bias = 0.0;
uniform float rough_a = 0.85;
uniform float rough_b = 0.8;
uniform float wet = 0.0;
uniform float snow = 0.0;
uniform vec4 tint : source_color = vec4(1.0);
uniform float value = 1.0;
varying vec3 wpos;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 p = wpos.xz;
	float n = texture(noise_tex, p * mix_scale).r;
	float n2 = texture(noise_tex, p * mix_scale * 4.3 + 0.5).r;
	float m = smoothstep(0.42, 0.58, n + (n2 - 0.5) * 0.25 + mix_bias);
	vec3 a = texture(tex_a, p * scale_a).rgb;
	vec3 b = texture(tex_b, p * scale_b).rgb;
	vec3 col = mix(a, b, m) * tint.rgb * value;
	vec3 na = texture(tex_a_n, p * scale_a).rgb;
	vec3 nb = texture(tex_b_n, p * scale_b).rgb;
	float rough = mix(rough_a, rough_b, m);
	float puddle = smoothstep(0.62, 0.7, texture(noise_tex, p * 0.05 + 0.31).r) * wet;
	col = mix(col, col * 0.45, puddle);
	rough = mix(rough, 0.06, puddle);
	rough = mix(rough, rough * 0.6, wet * 0.5);
	vec3 nm = mix(mix(na, nb, m), vec3(0.5, 0.5, 1.0), puddle);
	if (snow > 0.0) {
		float s = smoothstep(0.45, 0.55, n2 + snow - 0.5);
		col = mix(col, vec3(0.86, 0.87, 0.9) * (0.85 + n * 0.2), s * snow);
		rough = mix(rough, 0.75, s * snow);
	}
	ALBEDO = col;
	ROUGHNESS = rough;
	NORMAL_MAP = nm;
	NORMAL_MAP_DEPTH = 1.2;
}
