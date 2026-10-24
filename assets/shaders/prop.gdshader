shader_type spatial;
render_mode cull_back, depth_draw_opaque;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_albedo = false;
uniform vec4 tint : source_color = vec4(1.0);
uniform vec4 color_mul : source_color = vec4(1.0);
uniform sampler2D detail_tex : source_color, hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D detail_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform float detail_amount = 0.5;
uniform float detail_scale = 1.0;
uniform float rough = 0.8;
uniform float metal = 0.0;
uniform float desat = 0.25;
uniform sampler2D noise_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec4 emission_color : source_color = vec4(0.0);
uniform float world_triplanar = 0.0;
uniform vec3 proj_axis = vec3(0.0, 0.0, 1.0);
uniform float side_fix = 0.0;

instance uniform float blood = 0.0;
instance uniform float flash = 0.0;
instance uniform float dissolve = 0.0;
instance uniform float glow = 0.0;

varying vec3 opos;
varying vec3 onrm;
varying vec3 mnrm;

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	opos = mix(VERTEX, wp, world_triplanar);
	mnrm = NORMAL;
	onrm = mix(NORMAL, normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz), world_triplanar);
}

vec4 tri(sampler2D t, vec3 p, vec3 n) {
	vec3 w = pow(abs(n), vec3(4.0));
	w /= (w.x + w.y + w.z);
	return texture(t, p.zy) * w.x + texture(t, p.xz) * w.y + texture(t, p.xy) * w.z;
}

void fragment() {
	vec3 p = opos * detail_scale;
	vec3 base = has_albedo ? texture(albedo_tex, UV).rgb : vec3(1.0);
	base *= tint.rgb * color_mul.rgb;
	vec3 d = tri(detail_tex, p, onrm).rgb;
	float dl = dot(d, vec3(0.333));
	vec3 col = has_albedo ? base * mix(1.0, dl * 2.0, detail_amount) : mix(base, d * base * 1.6, detail_amount);
	if (has_albedo && side_fix > 0.0) {
		// боковые грани при фронтальной проекции текстуры тянутся полосами — заменяем их материалом
		float f = smoothstep(0.1, 0.45, abs(dot(normalize(mnrm), proj_axis)));
		vec3 blur = textureLod(albedo_tex, UV, 6.0).rgb * tint.rgb * color_mul.rgb;
		vec3 side = blur * (0.45 + dl * 1.1);
		col = mix(col, side, (1.0 - f) * side_fix);
	}
	float g = dot(col, vec3(0.299, 0.587, 0.114));
	col = mix(col, vec3(g), desat);
	float n = texture(noise_tex, UV * 2.0 + opos.xz * 0.3).r;
	if (blood > 0.0) {
		float bm = smoothstep(1.0 - blood, 1.06 - blood, n);
		col = mix(col, vec3(0.2, 0.008, 0.006), bm * 0.9);
	}
	if (dissolve > 0.0) {
		if (n < dissolve) discard;
	}
	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metal;
	vec3 dn = tri(detail_n, p, onrm).rgb;
	NORMAL_MAP = dn;
	NORMAL_MAP_DEPTH = detail_amount * 1.2;
	EMISSION = emission_color.rgb * emission_color.a + vec3(1.0) * flash + vec3(1.0, 0.45, 0.1) * glow;
}
