shader_type spatial;
// Wind driven lake for Godot Compatibility / Android OpenGL.
// Surface is a mesh, not a flat lake photograph; reflect the same procedural
// blue sky used in the physical 3D scene, without duplicate mountain images.
render_mode blend_mix, depth_prepass_alpha, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform vec4 water_deep : source_color = vec4(0.035, 0.130, 0.166, 1.0);
uniform vec4 water_shallow : source_color = vec4(0.083, 0.209, 0.209, 1.0);
uniform vec4 horizon_sky : source_color = vec4(0.67, 0.79, 0.84, 1.0);
uniform vec4 upper_sky : source_color = vec4(0.24, 0.49, 0.76, 1.0);
uniform float breeze : hint_range(0.0, 1.0) = 0.30;
uniform float transparency_near : hint_range(0.0, 1.0) = 0.88;
uniform float reflection_strength : hint_range(0.0, 1.0) = 0.60;

varying vec3 water_world;
varying float shallows;

void vertex() {
    // Mixed waves, with irregularly crossing directions instead of visible
    // long undulating rows or jagged white seams along the horizon.
    float time = TIME * (0.6 + breeze * 0.85);
    float w1 = sin(VERTEX.x * 0.31 + VERTEX.z * 0.13 + time * 0.79);
    float w2 = sin(VERTEX.z * 0.53 - VERTEX.x * 0.21 - time * 1.13);
    float w3 = cos(VERTEX.x * 0.89 + VERTEX.z * 0.73 + time * 1.42);
    VERTEX.y += (0.015 * w1 + 0.012 * w2 + 0.004 * w3) * (0.70 + breeze);
    water_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
    shallows = smoothstep(-40.0, 5.5, water_world.z);
}

vec3 sky_reflection(vec3 ray) {
    float elevation = clamp(ray.y, -0.35, 1.0);
    float glow = smoothstep(-0.17, 0.63, elevation);
    vec3 sky = mix(horizon_sky.rgb, upper_sky.rgb, glow);
    float cloud_layer = sin(ray.x * 25.0 + ray.z * 17.0 + TIME * 0.004);
    cloud_layer += 0.53 * sin(ray.x * 58.0 - ray.z * 43.0);
    float cloud = smoothstep(0.93, 1.37, cloud_layer);
    sky = mix(sky, vec3(0.84, 0.88, 0.87), cloud * 0.31);
    return sky;
}

void fragment() {
    vec2 pos = water_world.xz;
    float time = TIME * (0.6 + breeze * 0.85);
    float w1 = sin(pos.x * 0.31 + pos.y * 0.13 + time * 0.79);
    float w2 = sin(pos.y * 0.53 - pos.x * 0.21 - time * 1.13);
    float w3 = cos(pos.x * 0.89 + pos.y * 0.73 + time * 1.42);
    float w4 = sin(pos.x * 2.19 - pos.y * 1.33 - time * 2.11);
    float wave_scale = 0.63 + breeze * 0.7;
    vec2 slope = vec2(
        (w1 * 0.024 + w2 * 0.008 + w3 * 0.015 + w4 * 0.004),
        (w2 * 0.030 + w1 * 0.008 - w3 * 0.013 + w4 * 0.006)
    ) * wave_scale;
    vec3 normal_world = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 view_ray = normalize(water_world - CAMERA_POSITION_WORLD);
    vec3 mirror = reflect(view_ray, normal_world);
    float facing = clamp(dot(normal_world, -view_ray), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 5.0);
    float distance_to_eye = distance(water_world.xz, CAMERA_POSITION_WORLD.xz);
    vec3 sky = sky_reflection(mirror);
    vec3 body_color = mix(water_deep.rgb, water_shallow.rgb, shallows * 0.83);
    float mirrored = clamp(reflection_strength * (0.24 + 0.78 * fresnel) + smoothstep(24.0, 115.0, distance_to_eye) * 0.23, 0.0, 0.78);
    vec3 color_out = mix(body_color, sky, mirrored);
    // Green water near the distant wooded edge, not a pasted photo reflection.
    float bank_distance = smoothstep(44.0, 113.0, distance_to_eye);
    color_out = mix(color_out, vec3(0.19, 0.29, 0.275), bank_distance * 0.11);
    // Wind produces tiny highlights, never thick static white reflection bands.
    float fine_glint = pow(max(0.0, w3 * 0.52 + w4 * 0.48), 10.0);
    color_out += vec3(0.055, 0.076, 0.072) * fine_glint * (0.36 + breeze);
    ALBEDO = color_out;
    NORMAL_MAP = normalize(vec3(slope.x * 2.3, slope.y * 2.3, 1.0)) * 0.5 + 0.5;
    NORMAL_MAP_DEPTH = 0.18;
    ROUGHNESS = clamp(0.32 + breeze * 0.11 + abs(w3) * 0.035, 0.31, 0.49);
    SPECULAR = 0.36;
    METALLIC = 0.0;
    // Shallows reveal the actual lakebed; distance conceals geometry below.
    ALPHA = clamp(transparency_near + smoothstep(6.0, 85.0, distance_to_eye) * 0.09 + fresnel * 0.025, 0.87, 0.982);
    if (!FRONT_FACING) {
        // The camera attached to the lure sees real underwater fish.
        ALBEDO = vec3(0.06, 0.18, 0.175) + fine_glint * vec3(0.004, 0.008, 0.007);
        ROUGHNESS = 0.77;
        SPECULAR = 0.13;
        ALPHA = 0.86;
    }
}
