shader_type spatial;
render_mode cull_back, diffuse_burley, specular_schlick_ggx;

// Dark natural cork: fine pores and wood grain, without stock photo billboards.
varying vec3 local_pos;

void vertex() {
    local_pos = VERTEX;
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(123.917, 453.172))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 g = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(g);
    float b = hash(g + vec2(1.0, 0.0));
    float c = hash(g + vec2(0.0, 1.0));
    float d = hash(g + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void fragment() {
    vec2 pos = vec2(local_pos.y * 28.0 + sin(local_pos.x * 48.0) * 0.5, local_pos.x * 64.0 + local_pos.z * 73.0);
    float soft_grain = noise(pos * 0.84);
    float tiny_pores = noise(pos * 3.9);
    float fleck = step(0.72, tiny_pores);
    vec3 cork = mix(vec3(0.26, 0.19, 0.115), vec3(0.39, 0.285, 0.177), soft_grain);
    cork -= vec3(0.068, 0.048, 0.023) * fleck;
    ALBEDO = cork;
    ROUGHNESS = 0.95;
    SPECULAR = 0.19;
    METALLIC = 0.0;
}
