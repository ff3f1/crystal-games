shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never;

uniform vec4 ripple_color : source_color = vec4(0.69, 0.83, 0.82, 1.0);
uniform float age : hint_range(0.0, 2.0) = 0.0;
uniform float wind : hint_range(0.0, 1.0) = 0.3;

void fragment() {
    vec2 p = (UV - vec2(0.5)) * 2.0;
    float r = length(p);
    float distortion = 0.016 * sin(atan(p.y, p.x) * 8.0 + TIME * 1.5) * wind;
    float small = exp(-pow((r - (0.10 + age * 0.25) + distortion) / 0.040, 2.0));
    float large = exp(-pow((r - (0.27 + age * 0.29) - distortion) / 0.047, 2.0));
    float wake = exp(-pow((r - (0.51 + age * 0.25)) / 0.052, 2.0));
    float fade = pow(clamp(1.0 - age / 1.7, 0.0, 1.0), 1.5);
    float a = (small * 0.28 + large * 0.17 + wake * 0.075) * fade;
    ALBEDO = ripple_color.rgb;
    ALPHA = a;
}
