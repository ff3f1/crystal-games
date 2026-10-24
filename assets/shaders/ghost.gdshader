shader_type spatial;
render_mode blend_add, unshaded, cull_back, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(0.4, 1.0, 0.6, 1.0);
uniform float alpha = 1.0;
void fragment() {
	float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
	ALBEDO = color.rgb * (0.18 + fr * 1.4) * alpha;
	ALPHA = 1.0;
}
