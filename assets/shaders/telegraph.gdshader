shader_type spatial;
render_mode blend_mix, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0, 0.05, 0.03, 1.0);
uniform float arc = 360.0; // градусы
uniform float progress = 0.0;
uniform float inner = 0.0;
uniform int shape = 0; // 0 сектор/круг, 1 линия
void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	float a = 0.0;
	float p = clamp(progress, 0.0, 1.0);
	if (shape == 0) {
		float r = length(uv);
		float ang = degrees(abs(atan(uv.x, -uv.y)));
		float inside = step(r, 1.0) * step(inner, r) * step(ang, arc * 0.5);
		float rim = smoothstep(0.93, 1.0, r) * inside;
		float filled = step(r, p) * inside;
		float front = smoothstep(p - 0.08, p, r) * filled;
		a = inside * 0.05 + filled * 0.12 + front * 0.45 + rim * (0.55 + 0.4 * p);
	} else {
		float inside = step(abs(uv.x), 1.0) * step(abs(uv.y), 1.0);
		float t = (-uv.y + 1.0) * 0.5;
		float filled = step(t, p) * inside;
		float front = smoothstep(p - 0.06, p, t) * filled;
		float rim = smoothstep(0.88, 1.0, abs(uv.x)) * inside;
		a = inside * 0.05 + filled * 0.12 + front * 0.45 + rim * (0.55 + 0.4 * p);
	}
	ALBEDO = color.rgb * (0.75 + a * 0.6);
	ALPHA = clamp(a * 1.25, 0.0, 0.85);
}
