extends RefCounted
## Frame-rate-independent arc, depth, drift and retrieve mechanics for both rigs.
## World X/Z are authoritative: sonar reflects real lure coordinates.

var position := Vector3.ZERO
var source := Vector3.ZERO
var destination := Vector3.ZERO
var lure_type := 0  # 0 worm + float, 1 spinner
var flight_time := 0.0
var flight_duration := 1.32
var depth := 0.0
var water_time := 0.0
var retrieve_speed := 0.0
var is_landed := false
var twitch_cooldown := 0.0
var twitch_boost := 0.0
var start_range := 0.0
var current_dir := Vector3(0.16, 0, -0.10)

func begin_cast(from_pos: Vector3, target_pos: Vector3, bait: int) -> void:
    source = from_pos
    destination = target_pos
    position = from_pos
    lure_type = bait
    flight_time = 0.0
    water_time = 0.0
    depth = 0.0
    is_landed = false
    retrieve_speed = 0.0
    twitch_boost = 0.0
    twitch_cooldown = 0.0
    start_range = from_pos.distance_to(target_pos)

func tick_air(delta: float) -> bool:
    flight_time = minf(flight_duration, flight_time + maxf(0.0, delta))
    var t := clampf(flight_time / flight_duration, 0.0, 1.0)
    # Ease-out cast with a continuous ballistic arc.
    var horizontal := t * (1.85 - 0.85 * t)
    position = source.lerp(destination, horizontal)
    position.y = lerpf(source.y, 0.075, t) + 3.35 * sin(PI * t)
    if t >= 1.0:
        position = Vector3(destination.x, 0.075, destination.z)
        is_landed = true
    return is_landed

func tick_water(delta: float, reeling: bool, jerking: bool, angler: Vector3) -> void:
    if not is_landed:
        return
    var step := maxf(0.0, minf(delta, 0.2))
    water_time += step
    twitch_cooldown = maxf(0.0, twitch_cooldown - step)
    twitch_boost = maxf(0.0, twitch_boost - step * 1.6)
    var drift := Vector3(sin(water_time * 0.22) * 0.11 + current_dir.x, 0.0, current_dir.z)
    if lure_type == 0:
        # Float fishing: light ripples/current and a hook just below the float.
        position += drift * step * 0.13
        depth = 0.75 + 0.09 * sin(water_time * 1.4)
        retrieve_speed = 0.0
    else:
        # Spinner: player actively controls retrieve speed and depth.
        var pull_dir := angler - position
        pull_dir.y = 0
        pull_dir = pull_dir.normalized()
        if jerking and twitch_cooldown <= 0.01:
            twitch_boost = 0.52
            twitch_cooldown = 0.48
        retrieve_speed = lerpf(retrieve_speed, 3.35 if reeling else 0.0, minf(1.0, step * 5.0))
        position += (pull_dir * (retrieve_speed + twitch_boost * 1.9) + drift * 0.13) * step
        depth = clampf(depth + (0.52 if not reeling else -0.60) * step - twitch_boost * step * 0.90, 0.35, 3.1)
    position.y = 0.07 if lure_type == 0 else -depth

func visible_surface_position() -> Vector3:
    return Vector3(position.x, 0.065, position.z)

func get_spot_bonus(spots: Array) -> float:
    var best := 0.25
    for entry in spots:
        var world: Vector3 = entry["pos"]
        var dist := Vector2(position.x - world.x, position.z - world.z).length()
        var influence := exp(-dist * dist / 250.0)
        var affinity := 1.0
        var kind: String = str(entry.get("type", ""))
        if lure_type == 1 and kind == "pike":
            affinity = 1.65
        elif lure_type == 0 and kind == "carp":
            affinity = 1.70
        elif lure_type == 1 and kind == "carp":
            affinity = 0.33
        elif lure_type == 0 and kind == "pike":
            affinity = 0.25
        best = maxf(best, influence * affinity)
    return best

func bite_readiness(spots: Array, retrieve_active: bool) -> float:
    var spot_bonus := get_spot_bonus(spots)
    var method := 1.0
    if lure_type == 1:
        method = 1.25 if retrieve_active else 0.35
        # Retrieve at a moderate depth, not permanently scraping the bottom.
        method *= 0.5 if depth > 2.65 else 1.0
    else:
        method = 1.0 if depth >= 0.55 else 0.6
    return clampf(spot_bonus * method, 0.08, 2.2)

func is_near_angler(angler: Vector3) -> bool:
    return Vector2(position.x - angler.x, position.z - angler.z).length() < 3.2
