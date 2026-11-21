shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;

// The bottom is a real sloping mesh beneath the water. Moving caustics are
// subtle refraction patterns tied to world coordinates, not fake white decals.
uniform sampler2D lake_silt : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 silt_tint : source_color = vec4(0.32, 0.38, 0.29, 1.0);
uniform vec4 refracted_light : source_color = vec4(0.54, 0.70, 0.62, 1.0);
uniform float caustic_strength : hint_range(0.0, 0.5) = 0.13;
varying vec3 floor_world;

void vertex() {
    floor_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
    vec3 p = floor_world;
    vec3 sand = texture(lake_silt, UV).rgb * silt_tint.rgb;
    float t = TIME * 0.48;
    float a = sin(p.x * 1.4 + 0.66 * sin(p.z * 0.91 + t) + t * 0.72);
    float b = cos(p.z * 1.54 - 0.55 * cos(p.x * 1.21 - t) - t * 0.90);
    float c = sin(p.x * 1.21 + p.z * 0.76 - t * 1.1);
    float lines = abs(a * b + c * 0.37);
    float glint = pow(clamp(1.0 - lines, 0.0, 1.0), 4.0);
    float depth = clamp(-p.y / 6.0, 0.0, 1.0);
    float illumination = caustic_strength * glint * (1.0 - depth * 0.65);
    ALBEDO = sand + refracted_light.rgb * illumination;
    ROUGHNESS = 0.96;
    METALLIC = 0.0;
    SPECULAR = 0.14;
}
