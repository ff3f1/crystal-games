shader_type spatial;
render_mode cull_disabled;
uniform vec4 cloth : source_color = vec4(0.82, 0.8, 0.74, 1.0);
uniform vec4 cross : source_color = vec4(0.62, 0.03, 0.03, 1.0);
uniform sampler2D cloth_tex : source_color, hint_default_white, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise_tex : hint_default_white, repeat_enable;
uniform float undead = 0.0;
instance uniform float blood = 0.0;
instance uniform float flash = 0.0;
instance uniform float dissolve = 0.0;
void fragment() {
	vec2 uv = UV;
	vec3 c = cloth.rgb * texture(cloth_tex, uv * vec2(1.0, 1.6)).rgb * 1.25;
	float cx = step(abs(uv.x - 0.5), 0.085) * step(0.06, uv.y) * step(uv.y, 0.78);
	float cy = step(abs(uv.y - 0.27), 0.065) * step(abs(uv.x - 0.5), 0.34);
	float cr = max(cx, cy);
	c = mix(c, cross.rgb, cr * cross.a);
	float n = texture(noise_tex, uv * 1.7).r;
	float n2 = texture(noise_tex, uv * 5.0 + 0.3).r;
	// грязный подол
	c *= mix(1.0, 0.45 + n2 * 0.3, smoothstep(0.6, 1.0, uv.y));
	if (undead > 0.0) {
		c = mix(c, vec3(0.22, 0.21, 0.18) * (0.6 + n2), undead * 0.7);
		if (n > 0.78 && uv.y > 0.4) discard;
	}
	if (blood > 0.0) {
		float bm = smoothstep(1.0 - blood, 1.07 - blood, n * 0.6 + n2 * 0.4);
		c = mix(c, vec3(0.2, 0.008, 0.006), bm * 0.92);
	}
	if (dissolve > 0.0 && n < dissolve) discard;
	ALBEDO = c;
	ROUGHNESS = 0.95;
	EMISSION = vec3(1.0) * flash;
}
