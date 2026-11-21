extends SceneTree
## Deterministic integration test for REAL world fish and collision bites.
## No synthetic bite signals or spawning a stand-in fish during hooking.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var ecosystem := (load("res://scripts/lake_ecology.gd") as GDScript).new() as RefCounted
    var population := (load("res://scripts/fish_population.gd") as GDScript).new() as Node3D
    root.add_child(population)
    var habitats: Array[Dictionary] = [
        {"pos": Vector3(-8.0, 0.0, -18.0), "type": "carp"},
        {"pos": Vector3(11.0, 0.0, -23.0), "type": "perch"},
        {"pos": Vector3(0.0, 0.0, -33.0), "type": "pike"},
        {"pos": Vector3(-20.0, 0.0, -25.0), "type": "perch"}
    ]
    population.call("initialize", habitats, ecosystem)
    _check(population.call("total_fish") == 16, "Lake should contain 16 instantiated fish from the first scene")
    var initial: Dictionary = population.call("get_info", 0)
    var initial_pos: Vector3 = initial["position"]
    var fake_camera := Vector3(0, 1.6, 8.0)
    for i in range(30):
        population.call("simulate", 0.10, false, Vector3.ZERO, 0, 0.0, 0.0, 7.5, 0.3, fake_camera)
    var moved: Dictionary = population.call("get_info", 0)
    _check(initial_pos.distance_to(moved["position"]) > 0.05, "Fish must physically swim in the 3D water before a cast")

    var lure := Vector3(-8.0, -0.85, -18.0)
    var nibbled_id := -1
    var bitten_id := -1
    for i in range(1700):
        var e: Dictionary = population.call("simulate", 0.08, true, lure, 0, 0.0, 0.0, 7.5, 0.25, fake_camera)
        if int(e["signal"]) == 1:
            nibbled_id = int(e["id"])
        if int(e["signal"]) == 2:
            bitten_id = int(e["id"])
            break
    _check(nibbled_id >= 0, "A real fish must reach the lure for the first contact")
    _check(bitten_id >= 0, "Fish must inspect lure and then physically strike")
    _check(nibbled_id == bitten_id, "The SAME fish must nibble and strike")
    var info: Dictionary = population.call("get_info", bitten_id)
    _check(str(info["species"]) == "Карась" or str(info["species"]) == "Окунь", "Worm must not hook a pike")
    var hit_pos: Vector3 = info["position"]
    _check(hit_pos.distance_to(lure) < 1.50, "Strike must happen where the fish actually is")
    var original_mesh: Node3D = population.agents[bitten_id]["mesh"]
    var hooked: Node3D = population.call("take_hooked", bitten_id)
    _check(hooked == original_mesh, "The actual existing fish mesh must be attached to line")
    _check(str(population.call("get_info", bitten_id)["mode"]) == "hooked", "Hooked agent should leave the roaming simulation")
    population.call("finish_hook", true)
    _check(str(population.call("get_info", bitten_id)["mode"]) == "absent", "Caught fish must leave the water")
    _check(population.active_count == 15, "Catching one fish must decrease physical population")
    for i in range(1500):
        population.call("simulate", 0.10, false, Vector3.ZERO, 0, 0.0, 0.0, 7.5, 0.3, fake_camera)
    _check(population.active_count == 16, "Habitat should eventually replenish only after cooldown")
    population.queue_free()
    for i in range(3):
        await process_frame
    print("PHYSICAL_FISH_OK: persistent swimmers / real bait contact / nibble / same identity hooked / caught fish removed / natural replenishment")
    quit(0)

func _check(ok: bool, message: String) -> void:
    if not ok:
        push_error("PHYSICAL_FISH_FAIL: " + message)
        quit(1)
