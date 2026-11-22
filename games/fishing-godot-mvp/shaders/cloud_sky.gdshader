shader_type sky;
// Texture-free atmospheric sky with fractal cloud banks.
// Terrain, not a skybox photograph, forms the full mountain horizon.
uniform vec3 sky_zenith : source_color = vec3(0.235, 0.477, 0.725);
uniform vec3 sky_horizon : source_color = vec3(0.72, 0.82, 0.88);
uniform vec3 ground_haze : source_color = vec3(0.45, 0.59, 0.59);
uniform vec3 cloud_highlights : source_color = vec3(0.95, 0.95, 0.91);
uniform float cloud_cover : hint_range(0.0, 1.0) = 0.54;

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float value_noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 part = fract(point);
    part = part * part * (3.0 - 2.0 * part);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, part.x), mix(c, d, part.x), part.y);
}

float clouds(vec2 p) {
    float result = 0.0;
    float amplitude = 0.54;
    for (int i = 0; i < 4; i++) {
        result += value_noise(p) * amplitude;
        p = mat2(1.58, -1.14, 1.14, 1.58) * p + vec2(9.7, 1.8);
        amplitude *= 0.49;
    }
    return result;
}

void sky() {
    float elevation = EYEDIR.y;
    float sky_height = smoothstep(-0.045, 0.70, elevation);
    vec3 atmosphere = mix(sky_horizon, sky_zenith, sky_height);
    if (elevation < 0.0) {
        atmosphere = mix(ground_haze, sky_horizon, smoothstep(-0.45, 0.0, elevation));
    }
    // Perspective compression places layered cloud bands near the horizon.
    float depth = max(0.16, elevation + 0.19);
    vec2 field = EYEDIR.xz / depth * 2.10;
    float broad = clouds(field * 0.47);
    float detail = clouds(field * 1.16 + vec2(6.2, 2.9));
    float density = broad * 0.80 + detail * 0.20;
    float coverage = smoothstep(0.51 + (0.52 - cloud_cover) * 0.22, 0.71 + (0.52 - cloud_cover) * 0.22, density);
    float near_horizon = smoothstep(-0.01, 0.12, elevation);
    float high_altitude = 1.0 - smoothstep(0.72, 0.98, elevation) * 0.48;
    float cloud_mask = coverage * near_horizon * high_altitude;
    vec3 shaded_cloud = mix(vec3(0.75, 0.79, 0.79), cloud_highlights, smoothstep(0.50, 0.73, density));
    atmosphere = mix(atmosphere, shaded_cloud, cloud_mask * 0.91);
    // Sunlit haze preserves depth over the real pine-covered hills.
    float horizon_glow = exp(-max(elevation, 0.0) * 8.0) * 0.035;
    COLOR = atmosphere + vec3(0.055, 0.041, 0.021) * horizon_glow;
}
