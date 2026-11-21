extends RefCounted
## Mobile-friendly, deterministic arcade-physics model for fish fights.
## Drag and rod pumping matter; line tension is not a random timer.
## Uses delta-based integration so gameplay is stable at 30/60/120 FPS.

enum Outcome { ACTIVE, LANDED, LINE_BROKE, FISH_ESCAPED, SLACK_LOSS }

var distance := 20.0
var tension := 23.0
var stamina := 100.0
var strength := 1.0
var weight := 0.5
var time := 0.0
var lateral := 0.0
var depth := 0.8
var burst := 0.0
var slack_time := 0.0
var run_phase := 0.0
var drag_level := 1 # 0 loose / 1 balanced / 2 tight
var reel_speed := 0.0
var pump_energy := 0.0

func begin(species: String, body_weight: float, distance_from_shore: float) -> void:
    weight = maxf(0.10, body_weight)
    strength = 0.94 if species == "Карась" else (1.16 if species == "Окунь" else 1.72)
    strength *= clampf(0.91 + sqrt(weight) * 0.12, 0.89, 1.28)
    distance = clampf(distance_from_shore, 15.0, 28.0)
    tension = 19.0
    stamina = 100.0
    time = 0.0
    lateral = 0.0
    depth = 0.8
    burst = 0.0
    run_phase = 0.7 + weight * 0.13
    slack_time = 0.0
    reel_speed = 0.0
    pump_energy = 0.0
    drag_level = 1

func drag_fraction() -> float:
    return [0.34, 0.59, 0.83][drag_level]

func cycle_drag() -> void:
    drag_level = (drag_level + 1) % 3

func drag_name() -> String:
    return ["СЛАБО", "НОРМА", "ТУГО"][drag_level]

func step(delta: float, reeling: bool, pumping: bool) -> int:
    var dt := clampf(delta, 0.0, 0.14)
    time += dt
    var energy := 0.28 + 0.72 * stamina / 100.0
    var wave := maxf(0.0, sin(time * (1.55 + strength * 0.15) + run_phase))
    burst = pow(wave, 3.0)
    var fish_pull := strength * energy * (0.62 + burst * 1.28)
    var drag := drag_fraction()
    lateral = sin(time * (0.64 + strength * 0.12)) * minf(9.0, distance * 0.27) * (0.55 + burst * 0.52)
    depth = 0.55 + 1.6 * burst + 0.3 * sin(time * 0.8)

    if pumping:
        pump_energy = clampf(pump_energy + 0.75 * dt, 0.0, 1.0)
    else:
        pump_energy = maxf(0.0, pump_energy - dt * 1.1)
    if reeling:
        reel_speed = move_toward(reel_speed, 1.0, dt * 4.0)
        var efficiency := (1.0 - fish_pull * 0.12) * (0.92 + pump_energy * 0.35)
        var retrieve := maxf(0.90, 3.75 * efficiency * reel_speed)
        distance -= retrieve * dt
        # The reel is pulling against the fish. Too tight a drag can snap line.
        tension += (12.5 + fish_pull * 6.5 + burst * 8.0 + pump_energy * 4.5) * (0.66 + drag * 0.64) * dt
        stamina = maxf(0.0, stamina - (2.0 + 0.9 * fish_pull) * dt)
    else:
        reel_speed = move_toward(reel_speed, 0.0, dt * 4.4)
        var release_distance := maxf(0.12, fish_pull * (0.55 + drag * 0.46))
        distance += release_distance * dt
        tension -= (24.0 + (1.0 - drag) * 9.0) * dt
        stamina = maxf(0.0, stamina - (0.35 + burst * 0.75) * dt)
    # A loose reel will slip under load, sacrificing line length to avoid snap.
    var slip_threshold := lerpf(57.0, 100.0, drag)
    if tension > slip_threshold and reeling:
        var slip := (tension - slip_threshold) * (0.16 + (1.0 - drag) * 0.54)
        tension -= slip * dt * 14.0
        distance += slip * dt * 0.20
    tension = clampf(tension, 0.0, 115.0)

    if tension < 6.0:
        slack_time += dt
    else:
        slack_time = maxf(0.0, slack_time - dt * 1.8)
    if tension >= 102.0:
        return Outcome.LINE_BROKE
    if distance >= 47.0:
        return Outcome.FISH_ESCAPED
    if slack_time > 5.8:
        return Outcome.SLACK_LOSS
    if distance <= 2.6:
        return Outcome.LANDED
    return Outcome.ACTIVE
