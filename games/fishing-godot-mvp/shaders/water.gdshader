shader_type spatial;
render_mode cull_back, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;

uniform vec4 deep_color : source_color = vec4(0.060, 0.225, 0.265, 1.0);
uniform vec4 reflection_color : source_color = vec4(0.39, 0.56, 0.56, 1.0);

void vertex() {
    VERTEX.y += sin(VERTEX.x * 0.38 + TIME * 0.9) * 0.055;
    VERTEX.y += cos(VERTEX.z * 0.36 - TIME * 0.75) * 0.045;
}
void fragment() {
    float ripple = sin(UV.x * 360.0 + TIME * 2.8) * cos(UV.y * 260.0 - TIME * 1.7);
    float fresnel = pow(1.0 - max(dot(normalize(NORMAL), normalize(VIEW)), 0.0), 2.0);
    float mix_value = clamp(0.12 + fresnel * 0.85 + ripple * 0.045, 0.0, 0.93);
    ALBEDO = mix(deep_color.rgb, reflection_color.rgb, mix_value);
    ROUGHNESS = 0.22 + ripple * 0.028;
    METALLIC = 0.08;
    SPECULAR = 0.82;
}
