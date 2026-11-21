shader_type spatial;
render_mode cull_back, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;

uniform sampler2D fish_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D fish_normal : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float wetness : hint_range(0.0, 1.0) = 0.75;

void fragment() {
    vec3 skin = texture(fish_albedo, UV).rgb;
    ALBEDO = skin * COLOR.rgb;
    NORMAL_MAP = texture(fish_normal, UV).rgb;
    NORMAL_MAP_DEPTH = 0.43;
    ROUGHNESS = mix(0.63, 0.31, wetness);
    METALLIC = 0.03;
    SPECULAR = 0.63 + wetness * 0.22;
}
