shader_type canvas_item;
uniform sampler2D noise_tex : hint_default_white, repeat_enable, filter_linear_mipmap;
uniform float strength = 0.5;
uniform vec3 fog_color = vec3(0.62, 0.66, 0.72);
void fragment() {
	vec2 uv = UV;
	float n1 = texture(noise_tex, uv * vec2(1.2, 0.8) + vec2(TIME * 0.012, 0.0)).r;
	float n2 = texture(noise_tex, uv * vec2(2.3, 1.4) + vec2(-TIME * 0.02, TIME * 0.004)).r;
	float f = smoothstep(0.35, 0.85, n1 * 0.6 + n2 * 0.5);
	float h = smoothstep(0.35, 1.0, uv.y);
	COLOR = vec4(fog_color, f * h * strength);
}
