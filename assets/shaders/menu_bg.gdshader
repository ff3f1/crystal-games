shader_type canvas_item;
uniform float zoom_speed = 0.012;
uniform float darken = 0.12;
uniform float desat = 0.2;
void fragment() {
	float z = 1.0 + 0.06 * (0.5 + 0.5 * sin(TIME * zoom_speed * 6.2831));
	vec2 uv = (UV - 0.5) / z + 0.5 + vec2(sin(TIME * 0.05), cos(TIME * 0.04)) * 0.006;
	vec4 c = texture(TEXTURE, uv);
	float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	vec3 g = mix(c.rgb, vec3(l), desat);
	g *= 1.0 - darken;
	vec2 cu = UV - 0.5;
	g *= smoothstep(0.95, 0.3, length(cu * vec2(1.0, 0.8)));
	COLOR = vec4(g, c.a);
}
