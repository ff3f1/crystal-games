shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never;
uniform sampler2D noise_tex : hint_default_white, repeat_enable;
uniform vec4 c_hot : source_color = vec4(1.0, 0.85, 0.45, 1.0);
uniform vec4 c_cool : source_color = vec4(1.0, 0.28, 0.04, 1.0);
uniform float intensity = 2.2;
varying float age;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
	age = INSTANCE_CUSTOM.y;
}
void fragment() {
	vec2 uv = UV - 0.5;
	float r = length(uv * vec2(1.0, 0.8));
	float n = texture(noise_tex, UV * 0.6 + vec2(0.0, -TIME * 0.9) + COLOR.a * 3.0).r;
	float n2 = texture(noise_tex, UV * 1.7 + vec2(0.3, -TIME * 1.6)).r;
	float m = smoothstep(0.5, 0.02, r + (n - 0.5) * 0.25 + (n2 - 0.5) * 0.12);
	m *= m;
	vec3 c = mix(c_hot.rgb, c_cool.rgb, clamp(age * 1.3 + r, 0.0, 1.0));
	float a = m * (1.0 - age) * COLOR.a;
	ALBEDO = c * intensity * a;
	ALPHA = 1.0;
}
