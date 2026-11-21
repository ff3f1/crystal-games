extends Node3D
## One real population of three-dimensional fish. The very fish that swims up
## to the lure is later attached to the line and removed if landed. No random
## fish is created on demand for a bite.
##
## Fish positions/velocities are simulated in water space (Y < 0); orientation,
## schooling, spacing, depth and stamina-aware pursuit update every frame.
## No RigidBody solver is required: a damped steering integration is predictable
## at different mobile frame rates and prevents fish tunneling through banks.

const NONE := 0
const NIBBLE := 1
const STRIKE := 2

var rng := RandomNumberGenerator.new()
var agents: Array[Dictionary] = []
var habitats: Array[Dictionary] = []
var ecology: RefCounted
var current_hook := -1
var reserved_fish := -1
var elapsed := 0.0
var active_count := 0
var last_lure := Vector3.ZERO
var tracked_target := Vector3.ZERO
var bite_particle_position := Vector3.ZERO
var visual_distance := 49.0

func initialize(spots: Array[Dictionary], fish_ecology: RefCounted) -> void:
    rng.seed = 20261122
    habitats = spots.duplicate(true)
    ecology = fish_ecology
    var groups := [
        {"species":"Карась", "count":5},
        {"species":"Окунь", "count":4},
        {"species":"Щука", "count":3},
        {"species":"Окунь", "count":4}
    ]
    for i in range(mini(groups.size(), habitats.size())):
        var group: Dictionary = groups[i]
        for j in range(int(group["count"])):
            _spawn_agent(i, str(group["species"]), j)
    active_count = agents.size()

func _spawn_agent(habitat_index: int, species: String, number: int) -> void:
    var habitat: Dictionary = habitats[habitat_index]
    var home: Vector3 = habitat["pos"]
    var theta := TAU * (float(number) / 6.0 + float(habitat_index) * 0.17)
    var radius := rng.randf_range(1.1, 4.5)
    var y := -rng.randf_range(0.78, 1.82) if species != "Щука" else -rng.randf_range(1.50, 2.55)
    var world := Vector3(home.x + cos(theta) * radius, y, home.z + sin(theta) * radius)
    var mesh := (load("res://scripts/fish_visual.gd") as GDScript).new() as Node3D
    mesh.call("configure", species)
    # Scales are consistent with the trophy models and body weights. Young
    # perch travel in small schools; larger pike are less common.
    var base_size := 0.25 if species == "Окунь" else (0.34 if species == "Карась" else 0.37)
    var weight := rng.randf_range(0.22, 1.05) if species == "Окунь" else (
        rng.randf_range(0.30, 1.65) if species == "Карась" else rng.randf_range(1.4, 4.8)
    )
    mesh.scale = Vector3.ONE * base_size * (0.88 + sqrt(weight) * 0.13)
    add_child(mesh)
    mesh.position = world
    mesh.visible = true
    agents.append({
        "id": agents.size(),
        "species": species,
        "weight": weight,
        "habitat": habitat_index,
        "home": home,
        "pos": world,
        "vel": Vector3(-sin(theta) * 0.6, 0.0, cos(theta) * 0.6),
        "target": world,
        "mode": "cruise",
        "timer": rng.randf_range(0.2, 3.5),
        "interest": rng.randf_range(0.83, 1.18),
        "speed": rng.randf_range(1.05, 1.55) if species != "Щука" else rng.randf_range(1.2, 1.8),
        "mesh": mesh,
        "cooldown": 0.0,
        "nibble": 0.0,
        "respawn": 0.0
    })

func total_fish() -> int:
    return agents.size()

func get_info(id: int) -> Dictionary:
    if id < 0 or id >= agents.size():
        return {}
    var fish: Dictionary = agents[id]
    return {"id": id, "species": fish["species"], "weight": fish["weight"], "position": fish["pos"], "mode": fish["mode"]}

func get_activity(habitat_index: int) -> float:
    var count := 0
    for fish in agents:
        if int(fish["habitat"]) != habitat_index:
            continue
        if str(fish["mode"]) in ["approach", "inspect", "strike"]:
            count += 1
    return clampf(float(count) / 3.0, 0.0, 1.0)

func take_hooked(id: int) -> Node3D:
    if id < 0 or id >= agents.size():
        return null
    var fish: Dictionary = agents[id]
    if str(fish["mode"]) != "strike":
        return null
    fish["mode"] = "hooked"
    fish["vel"] = Vector3.ZERO
    agents[id] = fish
    current_hook = id
    reserved_fish = -1
    var mesh: Node3D = fish["mesh"]
    mesh.visible = true
    return mesh

func move_hooked(world_position: Vector3) -> void:
    if current_hook < 0 or current_hook >= agents.size():
        return
    var fish: Dictionary = agents[current_hook]
    # The authoritative fish remains the same agent for the whole fight.
    fish["pos"] = world_position
    agents[current_hook] = fish

func release_strike(id: int) -> void:
    if id < 0 or id >= agents.size():
        return
    var fish: Dictionary = agents[id]
    if str(fish["mode"]) == "strike" or str(fish["mode"]) == "inspect":
        fish["mode"] = "spooked"
        fish["timer"] = rng.randf_range(6.0, 9.0)
        fish["cooldown"] = 8.0
        agents[id] = fish
    if reserved_fish == id:
        reserved_fish = -1

func finish_hook(landed: bool) -> void:
    if current_hook < 0 or current_hook >= agents.size():
        return
    var fish: Dictionary = agents[current_hook]
    var mesh: Node3D = fish["mesh"]
    if landed:
        fish["mode"] = "absent"
        fish["respawn"] = rng.randf_range(70.0, 110.0)
        mesh.visible = false
        active_count = maxi(0, active_count - 1)
    else:
        fish["mode"] = "spooked"
        fish["timer"] = rng.randf_range(6.0, 9.0)
        fish["cooldown"] = 11.0
        var home: Vector3 = fish["home"]
        fish["pos"] = Vector3(home.x + rng.randf_range(-6, 6), -1.9, home.z + rng.randf_range(-6, 6))
        mesh.position = fish["pos"]
        mesh.visible = true
    agents[current_hook] = fish
    current_hook = -1

func _return_home(fish: Dictionary) -> Vector3:
    var p: Vector3 = fish["home"]
    var travel := elapsed * (0.13 + float(fish["id"] % 5) * 0.012)
    var angle := travel + float(fish["id"]) * 2.39996
    var radius := 1.45 + float(fish["id"] % 4) * 0.7
    var depth := -1.02 if str(fish["species"]) != "Щука" else -1.95
    return Vector3(p.x + cos(angle) * radius, depth + sin(travel * 0.8) * 0.23, p.z + sin(angle) * radius)

func _can_see_lure(fish: Dictionary, lure: Vector3, lure_type: int, retrieve_speed: float, twitch: float, hour: float, wind: float) -> float:
    var species := str(fish["species"])
    var speed_bonus := 1.35 if species == "Щука" else 1.0
    var sight := 8.2 * speed_bonus
    var p: Vector3 = fish["pos"]
    var d := p.distance_to(lure)
    if d >= sight:
        return 0.0
    # Fish can see nearby movement through water, but become harder to attract
    # as depth and distance from the correct feeding zone increase.
    var affinity: float = ecology.call(
        "species_affinity", species, lure_type, -lure.y,
        retrieve_speed, twitch, hour, wind
    )
    if affinity <= 0.0:
        return 0.0
    var speed_requirement := 1.0
    if lure_type == 1:
        speed_requirement = 0.90 if retrieve_speed > 0.65 or twitch > 0.1 else 0.18
    var environment := 0.84 + 0.16 * cos(elapsed * 0.21 + float(fish["id"]))
    var strength := float(fish["interest"])
    return affinity * strength * speed_requirement * environment * clampf(1.0 - d / sight, 0.0, 1.0)

func simulate(
    delta: float, fishing: bool, lure_pos: Vector3, lure_type: int,
    retrieve_speed: float, twitch: float, hour: float, wind: float,
    camera_position: Vector3
) -> Dictionary:
    var step := clampf(delta, 0.0, 0.12)
    elapsed += step
    last_lure = lure_pos
    var out: Dictionary = {"signal": NONE, "id": -1, "species": "", "position": lure_pos, "activity": 0.0}
    var nearest := 0.0
    for i in range(agents.size()):
        var fish: Dictionary = agents[i]
        var mode: String = str(fish["mode"])
        var model: Node3D = fish["mesh"]
        if not fishing and mode in ["approach", "inspect", "strike"]:
            mode = "cruise"
            fish["mode"] = mode
            fish["cooldown"] = 1.8
            if reserved_fish == i:
                reserved_fish = -1
        if mode == "absent":
            fish["respawn"] = float(fish["respawn"]) - step
            if float(fish["respawn"]) <= 0.0:
                fish["mode"] = "cruise"
                fish["cooldown"] = 5.0
                fish["pos"] = _return_home(fish)
                fish["vel"] = Vector3.ZERO
                model.position = fish["pos"]
                model.visible = true
                active_count += 1
            agents[i] = fish
            continue
        if mode == "hooked":
            # Game/fight physics owns this exact visual while connected to line.
            continue
        var remaining: float = maxf(0.0, float(fish["cooldown"]) - step)
        fish["cooldown"] = remaining
        var pos: Vector3 = fish["pos"]
        var target: Vector3 = _return_home(fish)
        var urgency := 1.0
        if mode == "spooked":
            fish["timer"] = float(fish["timer"]) - step
            var flee := pos - lure_pos
            flee.y = 0.0
            if flee.length() < 0.3:
                flee = Vector3(0.8, 0, -0.4)
            target = pos + flee.normalized() * 8.0
            urgency = 1.65
            if float(fish["timer"]) <= 0.0:
                mode = "cruise"
        elif mode == "strike":
            # Hold the attacking fish near the hook until the player reacts.
            target = lure_pos
            urgency = 0.18
        elif mode == "inspect":
            # Approach closely, hesitate, then commit to a short strike.
            target = lure_pos + Vector3(0.0, -0.16, 0.0)
            urgency = 0.55
            fish["nibble"] = float(fish["nibble"]) - step
            if float(fish["nibble"]) <= 0.0:
                mode = "strike"
                reserved_fish = i
                out = {"signal": STRIKE, "id": i, "species": fish["species"], "position": lure_pos, "activity": 1.0}
        elif mode == "approach":
            if reserved_fish >= 0 and reserved_fish != i:
                # A contact already has dibs on this bait: don't issue a
                # second nibble from another fish before the first strikes.
                mode = "cruise"
                fish["cooldown"] = 2.3
            else:
                target = lure_pos
                urgency = 1.2 if str(fish["species"]) == "Щука" else 0.88
                var chase_distance := pos.distance_to(lure_pos)
                if chase_distance < 0.76:
                    mode = "inspect"
                    reserved_fish = i
                    fish["nibble"] = rng.randf_range(0.56, 1.15)
                    # A real mesh touched the lure: the very same id gets the
                    # later strike and is passed to the fighting simulation.
                    out = {"signal": NIBBLE, "id": i, "species": fish["species"], "position": pos, "activity": 1.0}
        elif mode == "cruise" and fishing and remaining <= 0.01 and reserved_fish < 0:
            var interest := _can_see_lure(fish, lure_pos, lure_type, retrieve_speed, twitch, hour, wind)
            nearest = maxf(nearest, interest)
            if interest > 0.05 and rng.randf() < 1.0 - exp(-step * 1.25 * interest):
                mode = "approach"
                target = lure_pos
                urgency = 1.1

        # School avoidance prevents fish clipping into one another. Predators
        # get a larger personal radius than small perch/carp.
        var separation := Vector3.ZERO
        var personal := 1.10 if str(fish["species"]) == "Щука" else 0.62
        for j in range(agents.size()):
            if i == j:
                continue
            var peer: Dictionary = agents[j]
            if str(peer["mode"]) == "absent":
                continue
            var offset: Vector3 = pos - peer["pos"]
            var gap: float = offset.length()
            if gap > 0.001 and gap < personal:
                separation += offset / gap * (personal - gap)
        target += separation * 1.30
        target.x = clampf(target.x, -57.0, 57.0)
        target.z = clampf(target.z, -88.0, -2.9)
        target.y = clampf(target.y, -3.1, -0.42)
        var displacement := target - pos
        var desired: Vector3 = displacement.normalized() * minf(3.0, float(fish["speed"]) * urgency) if displacement.length() > 0.05 else Vector3.ZERO
        var velocity: Vector3 = fish["vel"]
        var accel := (desired - velocity).limit_length(3.4 + urgency)
        velocity += accel * step
        var speed_limit := 3.25 if mode == "approach" and str(fish["species"]) == "Щука" else 2.40
        velocity = velocity.limit_length(speed_limit)
        pos += velocity * step
        pos.x = clampf(pos.x, -57.0, 57.0)
        pos.z = clampf(pos.z, -88.0, -2.9)
        pos.y = clampf(pos.y, -3.2, -0.40)
        fish["pos"] = pos
        fish["vel"] = velocity
        fish["mode"] = mode
        model.position = pos
        if velocity.length() > 0.10:
            var heading := atan2(-velocity.x, -velocity.z)
            model.rotation.y = lerp_angle(model.rotation.y, heading, minf(1.0, step * 4.2))
            model.rotation.z = lerpf(model.rotation.z, sin(elapsed * 2.4 + float(i)) * 0.045, step * 2.2)
        if model.has_method("set_wiggle"):
            model.call("set_wiggle", 0.70 + (0.42 if mode == "approach" else 0.0) + float(velocity.length()) * 0.11)
        # Rendering cull only: behavior still updates when off-camera.
        model.visible = pos.distance_to(camera_position) < visual_distance
        agents[i] = fish
    out["activity"] = clampf(nearest, 0.0, 1.0) if int(out["signal"]) == NONE else 1.0
    return out
