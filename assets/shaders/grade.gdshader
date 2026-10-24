shader_type canvas_item;
// «Костяная Жатва»: приглушённая цветная палитра — холодные тени, тёплый свет,
// насыщенными остаются только некро-зелень, огонь, золото и кровь.
// Режим mono = старый чёрно-белый фильтр (по желанию в настройках).
uniform sampler2D scr : hint_screen_texture, filter_linear_mipmap;
uniform float mono = 0.0;
uniform float desat = 0.12;
uniform float contrast = 1.16;
uniform vec3 shadow_tint = vec3(0.96, 0.99, 1.04);
uniform vec3 high_tint = vec3(1.0, 1.0, 1.0);
uniform vec3 grade_tint = vec3(1.0);
uniform float grain = 0.0;
uniform float vignette = 0.3;
uniform float hurt = 0.0;
uniform float rage = 0.0;
uniform float brightness = 1.0;
uniform float time_k = 0.0;

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
	vec3 c = texture(scr, uv).rgb * brightness;
	vec3 hsv = rgb2hsv(max(c, vec3(0.0)));
	float h = hsv.x, s = hsv.y, v = hsv.z;
	float dred = min(h, 1.0 - h);
	float red = (1.0 - smoothstep(0.03, 0.07, dred)) * smoothstep(0.45, 0.7, s) * smoothstep(0.03, 0.1, v);
	float fire = (1.0 - smoothstep(0.035, 0.07, abs(h - 0.085))) * smoothstep(0.5, 0.75, s) * smoothstep(0.3, 0.55, v);
	float gold = (1.0 - smoothstep(0.03, 0.06, abs(h - 0.125))) * smoothstep(0.4, 0.65, s) * smoothstep(0.3, 0.55, v);
	float green = (1.0 - smoothstep(0.07, 0.13, abs(h - 0.37))) * smoothstep(0.35, 0.6, s) * smoothstep(0.08, 0.2, v);
	float keep = clamp(max(max(red, fire), max(green, gold)), 0.0, 1.0);
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	vec3 outc;
	if (mono > 0.5) {
		float lc = clamp((l - 0.5) * 1.22 + 0.5, 0.0, 4.0);
		outc = mix(vec3(lc), c, keep);
	} else {
		// приглушаем всё, кроме «сигнальных» цветов
		vec3 g = mix(c, vec3(l), desat * (1.0 - keep));
		// раздельное тонирование: тени холоднее, света теплее
		float lw = smoothstep(0.05, 0.6, l);
		g *= mix(shadow_tint, high_tint, lw);
		g *= grade_tint;
		// мягкая S-кривая
		g = clamp((g - 0.5) * contrast + 0.5, 0.0, 8.0);
		// кровь — сочный контрастный багрянец
		vec3 vivid = vec3(clamp(c.r * 1.75 + 0.05, 0.0, 1.3), c.g * 0.4, c.b * 0.4);
		g = mix(g, vivid, red * 0.7 * (1.0 - fire));
		outc = g;
	}
	outc = mix(outc, outc * vec3(1.15, 0.82, 0.8), rage * 0.35);
	float vig = smoothstep(0.9, 0.3, length(cuv * vec2(1.0, 0.82)));
	outc *= mix(1.0 - vignette, 1.0, vig);
	if (hurt > 0.0) {
		float hv = smoothstep(0.3, 0.8, length(cuv * vec2(1.0, 0.85)));
		outc = mix(outc, vec3(0.4, 0.0, 0.0), hv * hurt * 0.6);
	}
	if (grain > 0.0) {
		float gr = hash(uv * vec2(1920.0, 1080.0) + fract(time_k) * 91.7) - 0.5;
		outc += gr * grain * (0.4 + l);
	}
	COLOR = vec4(max(outc, vec3(0.0)), 1.0);
}
