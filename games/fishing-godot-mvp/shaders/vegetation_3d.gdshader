shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

// All positions are genuine 3D vertices, not a rotating billboard.
// Subtle GPU movement gives wind to the tip while keeping reed roots planted.
uniform float breeze : hint_range(0.0, 1.0) = 0.28;

void vertex() {
    float flexible_height = clamp(VERTEX.y + 0.08, 0.0, 1.95);
    float independent_phase = VERTEX.x * 0.47 + VERTEX.z * 0.29;
    VERTEX.x += sin(TIME * 1.17 + independent_phase) * flexible_height * 0.025 * breeze;
    VERTEX.z += cos(TIME * 0.83 + independent_phase * 1.37) * flexible_height * 0.019 * breeze;
}

void fragment() {
    ALBEDO = COLOR.rgb;
    ROUGHNESS = 0.96;
    SPECULAR = 0.14;
}
