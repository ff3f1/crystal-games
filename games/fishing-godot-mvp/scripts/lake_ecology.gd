extends RefCounted
## One-lake fish ecology. Only compatible fish respond to a lure. Fish activity
## depends on cover, depth, weather, feeding time and angler disturbance.
## All state changes use delta and reproducible RNG for deterministic QA.

enum BiteEvent { NONE, NIBBLE, STRIKE }

var rng := RandomNumberGenerator.new()
var time_underwater := 0.0
var attraction := 0.0
var nibble_timer := 0.0
var cooldown := 0.0
var disturbance := 0.0
var nearby_species := ""
var last_activity := 0.0
var last_signal := BiteEvent.NONE

func _init() -> void:
    rng.seed = 122104

func reset_cast() -> void:
    time_underwater = 0.0
    attraction = 0.0
    nibble_timer = 0.0
    cooldown = 0.0
    nearby_species = ""
    last_signal = BiteEvent.NONE

func register_disturbance(amount: float) -> void:
    disturbance = clampf(disturbance + amount, 0.0, 1.0)

func species_affinity(species: String, lure_type: int, depth: float, retrieve_speed: float, twitch: float, hour: float, wind: float) -> float:
    # Mutual exclusion: a pike NEVER bites a worm, a crucian NEVER bites metal.
    if lure_type == 0 and species == "Щука":
        return 0.0
    if lure_type == 1 and species == "Карась":
        return 0.0
    var depth_factor := 1.0
    var retrieve_factor := 1.0
    var time_factor := 1.0
    if species == "Карась":
        depth_factor = 0.90 if depth <= 1.65 else 0.52
        time_factor = 1.18 if hour < 9.0 or hour > 17.0 else 0.70
    elif species == "Окунь":
        depth_factor = 1.10 if depth >= 0.7 and depth < 2.8 else 0.62
        retrieve_factor = 0.55 if lure_type == 1 and retrieve_speed < 0.85 else 1.0
        time_factor = 1.05 if hour >= 7.0 and hour <= 18.0 else 0.85
    else:
        depth_factor = 1.20 if depth >= 1.0 and depth <= 3.0 else 0.46
        retrieve_factor = 0.18 if retrieve_speed < 0.6 else (1.25 if retrieve_speed > 1.4 else 0.8)
        retrieve_factor *= 1.10 if twitch > 0.05 else 1.0
        time_factor = 1.32 if hour < 9.0 or hour > 17.0 else 0.68
    var wind_factor := 1.0 + clampf(wind, 0.0, 1.0) * (0.18 if species != "Карась" else -0.06)
    return depth_factor * retrieve_factor * time_factor * wind_factor

func habitat_weights(position: Vector3, lure_type: int, depth: float, retrieve_speed: float, twitch: float, spots: Array, hour: float, wind: float) -> Dictionary:
    var weights: Dictionary = {"Карась": 0.0, "Окунь": 0.0, "Щука": 0.0}
    for entry in spots:
        var p: Vector3 = entry["pos"]
        var d := Vector2(p.x - position.x, p.z - position.z).length()
        var radius: float = float(entry.get("radius", 17.0))
        var falloff := exp(-0.5 * pow(d / maxf(radius, 1.0), 2.0))
        var habitat: String = str(entry.get("type", "perch"))
        var cover := float(entry.get("cover", 1.0))
        for species in weights.keys():
            var habitat_match := 0.10
            if (habitat == "carp" and species == "Карась") or (habitat == "perch" and species == "Окунь") or (habitat == "pike" and species == "Щука"):
                habitat_match = 1.0
            elif species == "Окунь" and habitat != "carp":
                habitat_match = 0.47
            elif species == "Щука" and habitat == "perch":
                habitat_match = 0.24
            var affinity := species_affinity(str(species), lure_type, depth, retrieve_speed, twitch, hour, wind)
            weights[species] = float(weights[species]) + falloff * cover * habitat_match * affinity
    return weights

func tick(delta: float, position: Vector3, lure_type: int, depth: float, retrieve_speed: float, twitch: float, spots: Array, hour: float, wind: float) -> Dictionary:
    var dt := clampf(delta, 0.0, 0.25)
    time_underwater += dt
    disturbance = maxf(0.0, disturbance - dt * 0.013)
    cooldown = maxf(0.0, cooldown - dt)
    last_signal = BiteEvent.NONE
    var weights := habitat_weights(position, lure_type, depth, retrieve_speed, twitch, spots, hour, wind)
    var total := 0.0
    for value in weights.values():
        total += float(value)
    last_activity = clampf(total / 2.6, 0.0, 1.0)
    var quiet := clampf(1.0 - disturbance * 0.65, 0.22, 1.0)
    if time_underwater < 1.3 or cooldown > 0.0:
        return {"signal": BiteEvent.NONE, "species": "", "activity": last_activity}
    if nibble_timer > 0.0:
        nibble_timer -= dt
        if nibble_timer <= 0.0:
            last_signal = BiteEvent.STRIKE
            cooldown = rng.randf_range(2.0, 3.8)
            attraction = 0.0
            return {"signal": last_signal, "species": nearby_species, "activity": last_activity}
        return {"signal": BiteEvent.NONE, "species": nearby_species, "activity": last_activity}
    # A probabilistic search hazard means near-bank fish are not guaranteed;
    # repeated casting at productive cover genuinely improves success rate.
    var hazard := clampf(total * quiet * 0.14, 0.0, 0.38)
    var chance := 1.0 - exp(-hazard * dt)
    attraction = move_toward(attraction, minf(1.0, total * quiet * 0.30), dt * 0.7)
    if rng.randf() < chance:
        var ticket := rng.randf() * maxf(total, 0.00001)
        for species in ["Карась", "Окунь", "Щука"]:
            ticket -= float(weights[species])
            if ticket <= 0.0 and float(weights[species]) > 0.0:
                nearby_species = species
                break
        if nearby_species.is_empty():
            return {"signal": BiteEvent.NONE, "species": "", "activity": last_activity}
        last_signal = BiteEvent.NIBBLE
        nibble_timer = rng.randf_range(0.62, 1.32)
        return {"signal": last_signal, "species": nearby_species, "activity": last_activity}
    return {"signal": BiteEvent.NONE, "species": "", "activity": last_activity}

func describe_spot(spot: Dictionary, hour: float, wind: float) -> String:
    var habitat: String = str(spot.get("type", "perch"))
    var label := "Тень и укрытие"
    if habitat == "carp":
        label = "Тихая заводь — карась у травы"
    elif habitat == "pike":
        label = "Глубокий свал — щука на проводке"
    elif habitat == "perch":
        label = "Камни и коряги — окунь"
    if hour > 10.0 and hour < 17.0 and habitat == "carp":
        label += " · днём осторожнее"
    elif wind > 0.5 and habitat == "pike":
        label += " · ветер помогает"
    return label
