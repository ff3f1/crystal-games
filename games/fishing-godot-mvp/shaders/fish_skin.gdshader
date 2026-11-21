shader_type spatial;
render_mode cull_back, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;

uniform sampler2D fish_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D fish_normal : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float wetness : hint_range(0.0, 1.0) = 0.75;
uniform float swim_power : hint_range(0.0, 2.5) = 0.6;

void vertex() {
    // Head and gills stay anchored while muscle flex increases toward the
    // caudal peduncle. The separate tail pivot completes the swimming beat.
    float rear = smoothstep(-0.10, 1.34, VERTEX.z);
    float travelling_wave = sin(TIME * 6.3 - VERTEX.z * 2.7);
    VERTEX.x += travelling_wave * rear * rear * 0.058 * swim_power;
}

void fragment() {
    vec3 skin = texture(fish_albedo, UV).rgb;
    ALBEDO = skin * COLOR.rgb;
    NORMAL_MAP = texture(fish_normal, UV).rgb;
    NORMAL_MAP_DEPTH = 0.43;
    ROUGHNESS = mix(0.63, 0.31, wetness);
    METALLIC = 0.03;
    SPECULAR = 0.63 + wetness * 0.22;
}
