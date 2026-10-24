shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform int orm_mode = 0; // 0 нет, 1 ORM (R=AO G=rough B=metal), 2 только roughness в R
uniform float normal_strength = 1.0;
uniform vec4 tint : source_color = vec4(1.0);
// перекраска по оттенку: зелёная ткань, коричневая кожа, серый металл
uniform vec4 cloth_color : source_color = vec4(0.5, 0.5, 0.5, 0.0);
uniform vec4 leather_color : source_color = vec4(0.3, 0.2, 0.15, 0.0);
uniform vec4 metal_color : source_color = vec4(0.6, 0.6, 0.62, 0.0);
uniform float desat = 0.0;
uniform float value_mul = 1.0;
uniform sampler2D mail_tex : source_color, hint_default_black, filter_linear_mipmap, repeat_enable;
uniform float mail_amount = 0.0;
uniform float mail_scale = 26.0;
uniform bool is_skin = false;
uniform vec4 skin_tint : source_color = vec4(1.0);
uniform float undead = 0.0;
uniform float stone = 0.0;
uniform sampler2D noise_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec4 emission_color : source_color = vec4(0.0);
uniform float base_rough = 0.85;
uniform float base_metal = 0.0;

instance uniform float blood = 0.0;
instance uniform float flash = 0.0;
instance uniform vec3 flash_color = vec3(1.0, 1.0, 1.0);
instance uniform float dissolve = 0.0;
instance uniform float burn = 0.0;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

void fragment() {
	vec4 a = texture(albedo_tex, UV);
	vec3 col = a.rgb * tint.rgb;
	vec3 hsv = rgb2hsv(a.rgb);
	float lum = dot(a.rgb, vec3(0.299, 0.587, 0.114));
	float rough = base_rough;
	float metal = base_metal;
	float ao = 1.0;
	if (orm_mode == 1) {
		vec3 orm = texture(orm_tex, UV).rgb;
		ao = orm.r; rough = orm.g; metal = orm.b;
	} else if (orm_mode == 2) {
		rough = texture(orm_tex, UV).r;
	}
	if (!is_skin) {
		float sat = hsv.y;
		float green = smoothstep(0.10, 0.03, abs(hsv.x - 0.31)) * smoothstep(0.12, 0.3, sat);
		float brown = smoothstep(0.07, 0.02, abs(hsv.x - 0.075)) * smoothstep(0.18, 0.35, sat);
		float grey = smoothstep(0.2, 0.08, sat) * smoothstep(0.25, 0.45, lum);
		float shade = lum / 0.35;
		col = mix(col, cloth_color.rgb * shade, green * cloth_color.a);
		col = mix(col, leather_color.rgb * (lum / 0.3), brown * leather_color.a);
		col = mix(col, metal_color.rgb * (lum / 0.55), grey * metal_color.a);
		if (mail_amount > 0.0) {
			vec3 m = texture(mail_tex, UV * mail_scale).rgb;
			float mk = green * mail_amount;
			col = mix(col, m * (0.6 + shade * 0.5), mk);
			metal = mix(metal, 0.85, mk); rough = mix(rough, 0.42, mk);
		}
	} else {
		col *= skin_tint.rgb;
	}
	float gl = dot(col, vec3(0.299, 0.587, 0.114));
	col = mix(col, vec3(gl), desat) * value_mul;
	float n = texture(noise_tex, UV * 3.0).r;
	float n2 = texture(noise_tex, UV * 11.0 + vec2(0.37, 0.71)).r;
	if (undead > 0.0) {
		// мертвечина: серо-зелёная кожа, ткань лишь тускнеет — без «камуфляжа»
		vec3 rot = mix(vec3(0.16, 0.18, 0.15), vec3(0.3, 0.31, 0.27), smoothstep(0.25, 0.75, n));
		if (is_skin) {
			col = mix(col, rot * (0.75 + gl * 0.6), undead);
		} else {
			col = mix(col, vec3(gl) * vec3(0.8, 0.84, 0.8), undead * 0.35) * (1.0 - undead * 0.15);
		}
		float wound = smoothstep(0.78, 0.82, n) * undead * (is_skin ? 0.8 : 0.0);
		col = mix(col, vec3(0.09, 0.012, 0.01), wound);
		rough = mix(rough, 0.5, wound);
	}
	if (stone > 0.0) {
		col = mix(col, vec3(0.42, 0.41, 0.39) * (0.7 + n2 * 0.5), stone);
		metal *= 1.0 - stone; rough = mix(rough, 0.9, stone);
	}
	if (burn > 0.0) {
		float bk = smoothstep(1.0 - burn, 1.05 - burn, n * 0.6 + n2 * 0.4);
		col = mix(col, vec3(0.03, 0.025, 0.02), bk);
	}
	if (blood > 0.0) {
		float bm = smoothstep(1.0 - blood, 1.0 - blood + 0.08, n * 0.55 + n2 * 0.45);
		col = mix(col, vec3(0.34, 0.012, 0.01) * (0.7 + n2 * 0.6), bm * 0.9);
		rough = mix(rough, 0.25, bm);
		metal = mix(metal, 0.0, bm);
	}
	if (dissolve > 0.0) {
		float d = n * 0.7 + n2 * 0.3;
		if (d < dissolve) discard;
		float edge = 1.0 - smoothstep(dissolve, dissolve + 0.06, d);
		EMISSION += vec3(0.25, 1.0, 0.45) * edge * 4.0;
	}
	if (!FRONT_FACING) {
		col = vec3(0.24, 0.015, 0.012) * (0.6 + n2 * 0.6);
		rough = 0.3; metal = 0.0;
	}
	// микрошум яркости по ткани/коже — убирает «пластиковую» ровность
	col *= 0.9 + n2 * 0.2;
	ALBEDO = col;
	RIM = 0.1;
	RIM_TINT = 0.6;
	SPECULAR = mix(0.22, 0.5, metal);
	ROUGHNESS = clamp(max(rough, mix(0.62, 0.3, metal)), 0.04, 1.0);
	METALLIC = clamp(metal, 0.0, 1.0);
	AO = ao;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	NORMAL_MAP_DEPTH = normal_strength;
	EMISSION += emission_color.rgb * emission_color.a + flash_color * flash * 1.6;
}
