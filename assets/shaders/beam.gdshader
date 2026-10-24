shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(0.35, 1.0, 0.5, 1.0);
uniform float alpha = 1.0;
uniform sampler2D noise_tex : hint_default_white, repeat_enable;
void fragment() {
	float n = texture(noise_tex, vec2(UV.x * 2.0, UV.y * 0.6 - TIME * 1.4)).r;
	float v = smoothstep(1.0, 0.0, UV.y) * smoothstep(0.0, 0.08, UV.y);
	ALBEDO = color.rgb * (0.4 + n * 1.2) * v * alpha * 1.6;
	ALPHA = 1.0;
}
