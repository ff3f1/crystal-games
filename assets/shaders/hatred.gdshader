shader_type canvas_item;
// Монохром с сохранением ярких красного/оранжевого/зелёного/золотого, зерно, виньетка, боль.
uniform sampler2D scr : hint_screen_texture, filter_linear_mipmap;
uniform float mono = 1.0;
uniform float contrast = 1.22;
uniform float black = 0.035;
uniform float grain = 0.05;
uniform float vignette = 0.55;
uniform float hurt = 0.0;
uniform float rage = 0.0;
uniform float aberr = 0.0;
uniform float brightness = 1.0;
uniform float time_k = 0.0;
uniform float keep_red = 1.0;
uniform float keep_fire = 0.95;
uniform float keep_green = 1.0;
uniform float keep_gold = 0.7;
uniform vec3 tint = vec3(0.98, 0.99, 1.02);

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 cuv = uv - 0.5;
	vec3 c;
	if (aberr > 0.001) {
		vec2 o = cuv * aberr * 0.012;
		c = vec3(texture(scr, uv + o).r, texture(scr, uv).g, texture(scr, uv - o).b);
	} else {
		c = texture(scr, uv).rgb;
	}
	c *= brightness;
	vec3 hsv = rgb2hsv(max(c, vec3(0.0)));
	float h = hsv.x, s = hsv.y, v = hsv.z;
	float dred = min(h, 1.0 - h);
	float red = (1.0 - smoothstep(0.03, 0.065, dred)) * smoothstep(0.45, 0.7, s) * smoothstep(0.03, 0.1, v);
	float fire = (1.0 - smoothstep(0.03, 0.065, abs(h - 0.085))) * smoothstep(0.55, 0.8, s) * smoothstep(0.35, 0.6, v);
	float gold = (1.0 - smoothstep(0.025, 0.05, abs(h - 0.125))) * smoothstep(0.45, 0.7, s) * smoothstep(0.35, 0.6, v);
	float green = (1.0 - smoothstep(0.06, 0.12, abs(h - 0.37))) * smoothstep(0.4, 0.65, s) * smoothstep(0.08, 0.2, v);
	float keep = max(max(red * keep_red, fire * keep_fire), max(green * keep_green, gold * keep_gold));
	keep = max(keep, rage * red);
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	float lc = clamp((l - 0.5) * contrast + 0.5, 0.0, 4.0);
	lc = max(0.0, lc - black) / (1.0 - black);
	vec3 g = vec3(lc) * tint;
	vec3 colored = c * (1.0 + 0.15 * keep);
	// кровь как в Hatred: тёмно-красное поднимаем до сочного алого
	vec3 vivid = vec3(clamp(c.r * 1.7 + 0.06, 0.0, 1.2), c.g * 0.45, c.b * 0.45);
	colored = mix(colored, vivid, red * keep_red * 0.6 * (1.0 - fire));
	vec3 outc = mix(g, colored, keep);
	outc = mix(c, outc, mono);
	// ярость Жатвы: подкрашиваем тени в кровь
	outc = mix(outc, outc * vec3(1.12, 0.8, 0.78), rage * 0.3);
	float vig = smoothstep(0.85, 0.25, length(cuv * vec2(1.0, 0.8)));
	outc *= mix(1.0 - vignette, 1.0, vig);
	if (hurt > 0.0) {
		float hv = smoothstep(0.25, 0.75, length(cuv * vec2(1.0, 0.85)));
		outc = mix(outc, vec3(0.45, 0.0, 0.0), hv * hurt * 0.65);
	}
	float gr = hash(uv * vec2(1920.0, 1080.0) + fract(time_k) * 91.7) - 0.5;
	outc += gr * grain * (0.4 + l);
	COLOR = vec4(max(outc, vec3(0.0)), 1.0);
}
