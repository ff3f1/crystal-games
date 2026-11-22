shader_type spatial;
render_mode cull_back, diffuse_burley, specular_schlick_ggx;

// Fine woven sleeves on real 3D forearm volumes. The glove itself is an
// externally authored, UV-mapped CC0 PBR model, never drawn by this shader.
// Stable object-space texture coordinates mean no blocky per-vertex colors.
uniform vec4 cloth_tint : source_color = vec4(0.19, 0.235, 0.22, 1.0);
uniform float weave_scale : hint_range(10.0, 300.0) = 185.0;
varying vec3 cloth_coord;

void vertex() {
    cloth_coord = VERTEX;
}

float noise2(vec2 uv) {
    vec2 id = floor(uv);
    vec2 f = fract(uv);
    f = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(id, vec2(121.72, 453.57))) * 43758.545);
    float b = fract(sin(dot(id + vec2(1.0, 0.0), vec2(121.72, 453.57))) * 43758.545);
    float c = fract(sin(dot(id + vec2(0.0, 1.0), vec2(121.72, 453.57))) * 43758.545);
    float d = fract(sin(dot(id + vec2(1.0, 1.0), vec2(121.72, 453.57))) * 43758.545);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}

void fragment() {
    vec2 fabric_uv = vec2(cloth_coord.x + cloth_coord.z * 0.37,
                          cloth_coord.y - cloth_coord.z * 0.23) * weave_scale;
    float cross_fibres = 0.5 * sin(fabric_uv.x) * sin(fabric_uv.y * 1.17);
    float thread = 0.035 * cross_fibres;
    float grain = (noise2(fabric_uv * 0.25) - 0.5) * 0.055;
    float folds = sin(cloth_coord.y * 54.0 + cloth_coord.x * 19.0) * 0.033;
    ALBEDO = cloth_tint.rgb * (0.92 + thread + grain + folds);
    ROUGHNESS = 0.91;
    SPECULAR = 0.12;
    METALLIC = 0.0;
}
