shader_type spatial;
render_mode cull_back, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;

// Three moving wave frequencies, soft sky highlights and shallow-bank color.
// No external shader textures, works with Godot 4.5 GL Compatibility on phones.
uniform vec4 deep_color : source_color = vec4(0.014, 0.087, 0.110, 1.0);
uniform vec4 bank_color : source_color = vec4(0.080, 0.180, 0.175, 1.0);
uniform vec4 reflected_sky : source_color = vec4(0.31, 0.39, 0.41, 1.0);
uniform float wave_height : hint_range(0.0, 0.15) = 0.070;
uniform float wind_speed : hint_range(0.0, 4.0) = 0.95;

varying float coast;
varying vec2 world_waves;

void vertex() {
    float t = TIME * wind_speed;
    world_waves = VERTEX.xz;
    // The actual shore lies near local Z = 115 on this 240m plane.
    coast = smoothstep(99.0, 119.0, VERTEX.z);
    float long_wave = sin(VERTEX.x * 0.38 + t * 0.93) * 0.55;
    float cross_wave = cos(VERTEX.z * 0.43 - t * 0.62) * 0.28;
    float small_wave = sin((VERTEX.x + VERTEX.z) * 1.24 + t * 1.53) * 0.17;
    VERTEX.y += (long_wave + cross_wave + small_wave) * wave_height * (1.0 - coast * 0.65);
}

void fragment() {
    float t = TIME * wind_speed;
    vec2 coords = world_waves;
    float small1 = sin(coords.x * 1.8 + coords.y * 0.46 + t * 2.6);
    float small2 = cos(coords.y * 1.25 - coords.x * 0.58 - t * 1.6);
    float crossed = sin((coords.x - coords.y) * 2.23 + t * 2.0);
    float ripples = small1 * 0.48 + small2 * 0.34 + crossed * 0.18;
    float wave_glint = pow(max(0.0, ripples * 0.5 + 0.45), 11.0);
    float view = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
    float fresnel = pow(1.0 - view, 3.0);
    vec3 water = mix(deep_color.rgb, bank_color.rgb, coast * 0.68);
    water = mix(water, reflected_sky.rgb, 0.14 + fresnel * 0.66);
    water += vec3(0.22, 0.28, 0.26) * wave_glint * 0.16;
    // Subtle shallow glints, not giant foam circles or bright neon stripes.
    water += vec3(0.12, 0.18, 0.15) * max(0.0, ripples - 0.60) * coast * 0.07;
    ALBEDO = water;
    NORMAL_MAP = normalize(vec3(small1 * 0.14, small2 * 0.13, 1.0)) * 0.5 + 0.5;
    NORMAL_MAP_DEPTH = 0.27;
    ROUGHNESS = clamp(0.12 + (1.0 - fresnel) * 0.055 + ripples * 0.014, 0.09, 0.26);
    METALLIC = 0.12;
    SPECULAR = 0.86;
}
