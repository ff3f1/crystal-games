shader_type spatial;
// A mobile-safe planar lake with panorama-correct reflections.
// Reflects a genuine CC0 alpine sky photograph; uses inexpensive multi-scale
// normal waves instead of SSR/reflection probes, so Godot Compatibility can run it.
render_mode blend_mix, depth_prepass_alpha, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform sampler2D sky_reflection : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 deep_water : source_color = vec4(0.025, 0.102, 0.171, 1.0);
uniform vec4 shallow_water : source_color = vec4(0.091, 0.250, 0.270, 1.0);
uniform float breeze : hint_range(0.0, 1.0) = 0.34;
uniform float transparency_near : hint_range(0.0, 1.0) = 0.72;
uniform float reflect_strength : hint_range(0.0, 1.0) = 0.76;

varying vec3 surface_world;
varying float near_shore;

void vertex() {
    float t = TIME * (0.58 + breeze * 1.2);
    float a = sin(VERTEX.x * 0.27 + VERTEX.z * 0.16 + t * 0.61);
    float b = sin(VERTEX.z * 0.52 - VERTEX.x * 0.27 - t * 0.89);
    float c = cos((VERTEX.x + VERTEX.z) * 1.07 + t * 1.38);
    VERTEX.y += (a * 0.010 + b * 0.007 + c * 0.004) * (0.46 + breeze);
    surface_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    near_shore = smoothstep(-43.0, 2.5, surface_world.z);
}

vec3 photograph_reflection(vec3 dir) {
    // Equirectangular panorama: up is V=0, the horizon V=0.5.
    float u = atan(dir.x, -dir.z) / 6.2831853 + 0.5;
    float v = acos(clamp(dir.y, -0.999, 0.999)) / 3.14159265;
    vec2 uv = vec2(fract(u), clamp(v, 0.003, 0.997));
    return texture(sky_reflection, uv).rgb;
}

void fragment() {
    float t = TIME * (0.58 + breeze * 1.2);
    vec2 pos = surface_world.xz;
    // A small-scale wind texture breaks the straight horizon stripes.
    float w1 = sin(pos.x * 0.52 + pos.y * 0.28 + t * 1.11);
    float w2 = cos(pos.y * 0.92 - pos.x * 0.19 - t * 0.91);
    float w3 = sin(pos.x * 2.05 + pos.y * 1.31 + t * 1.78);
    float w4 = cos(pos.x * 3.57 - pos.y * 2.07 - t * 2.62);
    float glint = w1 * 0.37 + w2 * 0.33 + w3 * 0.20 + w4 * 0.10;
    float wave = 0.35 + breeze * 0.52;
    float sx = (w1 * 0.014 + w3 * 0.006 + w4 * 0.003) * wave;
    float sz = (w2 * 0.018 + w3 * 0.005 - w4 * 0.004) * wave;
    vec3 world_normal = normalize(vec3(sx, 1.0, sz));
    vec3 view_ray = normalize(surface_world - CAMERA_POSITION_WORLD);
    vec3 reflected_ray = normalize(reflect(view_ray, world_normal));
    vec3 sky_color = photograph_reflection(reflected_ray);
    float dist = distance(surface_world.xz, CAMERA_POSITION_WORLD.xz);
    float fresnel = pow(1.0 - clamp(dot(world_normal, -view_ray), 0.0, 1.0), 4.1);
    float reflect_amount = reflect_strength * (0.43 + 0.30 * fresnel + 0.18 * smoothstep(3.0, 65.0, dist));
    vec3 base_water = mix(deep_water.rgb, shallow_water.rgb, near_shore * 0.47);
    vec3 tint = mix(base_water, sky_color, clamp(reflect_amount, 0.25, 0.86));
    tint += vec3(0.009, 0.015, 0.018) * glint;
    // Let the photograph blend into the far lake without opaque matte teal.
    float aerial = smoothstep(70.0, 265.0, dist);
    tint = mix(tint, sky_color * 0.92 + vec3(0.015, 0.025, 0.035), aerial * 0.31);
    ALBEDO = tint;
    NORMAL_MAP = normalize(vec3(sx * 2.5, sz * 2.5, 1.0)) * 0.5 + 0.5;
    NORMAL_MAP_DEPTH = 0.09;
    ROUGHNESS = clamp(0.25 + abs(glint) * 0.042 + breeze * 0.045, 0.25, 0.36);
    METALLIC = 0.0;
    SPECULAR = 0.49;
    ALPHA = clamp(transparency_near + smoothstep(8.0, 98.0, dist) * 0.248 + fresnel * 0.02, 0.69, 0.984);

    if (!FRONT_FACING) {
        // Underwater bait camera sees genuine physical fish, not mirrored clouds.
        ALBEDO = vec3(0.069, 0.212, 0.209) + vec3(glint * 0.007);
        ROUGHNESS = 0.70;
        SPECULAR = 0.10;
        ALPHA = 0.86;
    }
}
