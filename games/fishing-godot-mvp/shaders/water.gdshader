shader_type spatial;
// A translucent, rough freshwater surface instead of metallic grey mirrors.
// The pixel shader is intentionally inexpensive for mobile GL Compatibility.
render_mode blend_mix, depth_prepass_alpha, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 deep_water : source_color = vec4(0.030, 0.154, 0.170, 1.0);
uniform vec4 shallow_water : source_color = vec4(0.082, 0.245, 0.217, 1.0);
uniform vec4 cloudy_sky : source_color = vec4(0.30, 0.42, 0.44, 1.0);
uniform float breeze : hint_range(0.0, 1.0) = 0.32;
uniform float transparency_near : hint_range(0.0, 1.0) = 0.68;

varying vec3 surface_world;
varying float shore;

void vertex() {
    float t = TIME * (0.60 + breeze * 1.8);
    float a = sin(VERTEX.x * 0.31 + VERTEX.z * 0.14 + t * 0.92);
    float b = sin(VERTEX.z * 0.47 - VERTEX.x * 0.16 - t * 0.73);
    float c = cos((VERTEX.x + VERTEX.z) * 1.23 + t * 1.52);
    // Small Gerstner-like displacement, no deep black highlights.
    VERTEX.y += (a * 0.039 + b * 0.022 + c * 0.012) * (0.55 + breeze);
    surface_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    shore = smoothstep(-42.0, 1.5, surface_world.z);
}

void fragment() {
    float t = TIME * (0.60 + breeze * 1.8);
    vec2 p = surface_world.xz;
    float wa = sin(p.x * 0.63 + p.y * 0.38 + t * 0.91);
    float wb = cos(p.y * 0.79 - p.x * 0.23 - t * 0.77);
    float wc = sin(p.x * 1.71 + p.y * 1.22 + t * 1.61);
    float ripple = wa * 0.41 + wb * 0.38 + wc * 0.21;
    vec3 bank = shallow_water.rgb;
    vec3 lake = mix(deep_water.rgb, bank, shore * 0.56);
    vec3 nrm = normalize(NORMAL);
    vec3 view_dir = normalize(VIEW);
    float fresnel = pow(1.0 - clamp(dot(nrm, view_dir), 0.0, 1.0), 3.4);
    // White sky reflection is a soft low-frequency veil, not discrete hard
    // black/white mirror stripes. Underwater fish remain visible near shore.
    vec3 tint = mix(lake, cloudy_sky.rgb, 0.06 + fresnel * 0.20);
    tint += vec3(0.033, 0.057, 0.055) * clamp(ripple, -0.6, 0.6);
    ALBEDO = tint;
    NORMAL_MAP = normalize(vec3(0.09 * wa + 0.04 * wc, 0.09 * wb, 1.0)) * 0.5 + 0.5;
    NORMAL_MAP_DEPTH = 0.18;
    ROUGHNESS = clamp(0.41 + ripple * 0.035 + fresnel * 0.05, 0.35, 0.54);
    METALLIC = 0.0;
    SPECULAR = 0.27;
    // Submerged fish and the lakebed can be seen in clear shallows; deeper
    // water becomes more opaque, with a proper opaque horizon at distance.
    float dist = distance(surface_world.xz, CAMERA_POSITION_WORLD.xz);
    ALPHA = clamp(transparency_near + smoothstep(10.0, 92.0, dist) * 0.285 + fresnel * 0.018, 0.64, 0.979);
}
