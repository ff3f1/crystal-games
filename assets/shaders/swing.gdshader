shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0, 0.9, 0.8, 1.0);
uniform float progress = 0.0;
uniform float tail = 0.55;
uniform float fade = 0.0;
uniform float energy = 2.2;
uniform sampler2D noise_tex : hint_default_white, repeat_enable;
void fragment() {
	float x = UV.x;
	float head = progress;
	float vis = step(x, head) * smoothstep(head - tail, head, x);
	float edge = pow(UV.y, 2.2);
	float core = smoothstep(0.82, 1.0, UV.y) * 1.6;
	float n = texture(noise_tex, vec2(UV.x * 3.0 - progress * 2.0, UV.y * 0.7)).r;
	float a = vis * (edge * (0.55 + 0.45 * n) + core * vis) * (1.0 - fade);
	ALBEDO = color.rgb * a * energy;
	ALPHA = 1.0;
}
