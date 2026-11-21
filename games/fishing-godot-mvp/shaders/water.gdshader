shader_type spatial;
render_mode cull_back, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;

uniform vec4 deep_color : source_color = vec4(0.018, 0.083, 0.105, 1.0);
uniform vec4 reflection_color : source_color = vec4(0.19, 0.30, 0.34, 1.0);

void vertex() {
    VERTEX.y += sin(VERTEX.x * 0.38 + TIME * 0.9) * 0.055;
    VERTEX.y += cos(VERTEX.z * 0.36 - TIME * 0.75) * 0.045;
}
void fragment() {
    float ripple = sin(UV.x * 360.0 + TIME * 2.8) * cos(UV.y * 260.0 - TIME * 1.7);
    float fresnel = pow(1.0 - max(dot(normalize(NORMAL), normalize(VIEW)), 0.0), 2.0);
    float mix_value = clamp(0.17 + fresnel * 0.68 + ripple * 0.045, 0.0, 0.85);
    ALBEDO = mix(deep_color.rgb, reflection_color.rgb, mix_value);
    ROUGHNESS = 0.15 + ripple * 0.025;
    METALLIC = 0.18;
    SPECULAR = 0.82;
}
