shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform sampler2D tex : hint_default_white;
uniform vec4 color : source_color = vec4(0.3, 1.0, 0.45, 1.0);
uniform float energy = 2.0;
instance uniform float fade = 1.0;
void fragment() {
	vec2 uv = UV - 0.5;
	float s = sin(TIME * 0.6), c = cos(TIME * 0.6);
	uv = mat2(vec2(c, -s), vec2(s, c)) * uv + 0.5;
	float t = texture(tex, uv).a;
	float pulse = 0.75 + 0.25 * sin(TIME * 5.0);
	ALBEDO = color.rgb * t * energy * pulse * fade;
	ALPHA = 1.0;
}
