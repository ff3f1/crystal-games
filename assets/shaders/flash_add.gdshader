shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0, 0.9, 0.75, 1.0);
uniform sampler2D tex : hint_default_white;
uniform float alpha = 1.0;
uniform float stretch = 1.0;
void vertex() {
	// всегда лицом к камере
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz) * stretch, 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
}
void fragment() {
	vec4 t = texture(tex, UV);
	float a = max(t.a * dot(t.rgb, vec3(0.333)), 0.0);
	ALBEDO = color.rgb * a * alpha * 3.0;
	ALPHA = 1.0;
}
