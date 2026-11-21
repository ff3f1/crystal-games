extends SceneTree
## Test the actual single-lake habitat model without faking game timers.
func _initialize() -> void:
    call_deferred("_test")

func _test() -> void:
    var script := load("res://scripts/lake_ecology.gd") as GDScript
    var ecology = script.new()
    ecology.rng.seed = 71352
    var spots: Array = [
        {"pos": Vector3(-8.0, 0.0, -18.0), "type": "carp", "radius": 17.0},
        {"pos": Vector3(11.0, 0.0, -23.0), "type": "perch", "radius": 14.0},
        {"pos": Vector3(0.0, 0.0, -33.0), "type": "pike", "radius": 15.0}
    ]
    _check(is_zero_approx(ecology.species_affinity("Щука", 0, 0.9, 0.0, 0.0, 7.0, 0.2)), "A pike must never take a worm")
    _check(is_zero_approx(ecology.species_affinity("Карась", 1, 1.2, 2.3, 0.1, 8.0, 0.2)), "A crucian must never bite a metal spinner")
    var carp_habitat: Dictionary = ecology.habitat_weights(Vector3(-8.0, 0.0, -18.0), 0, 0.9, 0.0, 0.0, spots, 7.5, 0.2)
    _check(float(carp_habitat["Карась"]) > float(carp_habitat["Окунь"]), "The vegetated bay should favour crucian")
    _check(float(carp_habitat["Щука"]) == 0.0, "Worm fishing cannot select pike at any habitat")
    var pike_habitat: Dictionary = ecology.habitat_weights(Vector3(0.0, 0.0, -33.0), 1, 1.6, 3.1, 0.3, spots, 7.5, 0.2)
    _check(float(pike_habitat["Щука"]) > float(pike_habitat["Окунь"]), "Spinner at deep drop must prefer pike")
    _check(float(pike_habitat["Карась"]) == 0.0, "Metal lure cannot attract crucian")

    var saw_nibble := false
    var saw_strike := false
    var chosen := ""
    for i in range(1500):
        var response: Dictionary = ecology.tick(0.10, Vector3(-8.0, -0.82, -18.0), 0, 0.82, 0.0, 0.0, spots, 7.5, 0.25)
        if int(response["signal"]) == 1:
            saw_nibble = true
        if int(response["signal"]) == 2:
            saw_strike = true
            chosen = str(response["species"])
            break
    _check(saw_nibble, "Compatible fish must show a subtle nibble before hooking")
    _check(saw_strike, "A well-placed worm must lead to a strike within test horizon")
    _check(chosen == "Карась" or chosen == "Окунь", "Worm species must remain compatible")

    ecology.reset_cast()
    ecology.rng.seed = 91062
    saw_nibble = false
    saw_strike = false
    for i in range(1500):
        var response: Dictionary = ecology.tick(0.10, Vector3(0.0, -1.5, -33.0), 1, 1.5, 2.9, 0.14, spots, 8.0, 0.4)
        if int(response["signal"]) == 1:
            saw_nibble = true
        if int(response["signal"]) == 2:
            saw_strike = true
            chosen = str(response["species"])
            break
    _check(saw_nibble and saw_strike, "Spinner must trigger a pursuit strike after attracting a fish")
    _check(chosen == "Щука" or chosen == "Окунь", "Spinner species must remain compatible")

    var inactive := ecology.species_affinity("Щука", 1, 1.7, 0.0, 0.0, 12.0, 0.3)
    var active := ecology.species_affinity("Щука", 1, 1.7, 3.1, 0.1, 8.0, 0.3)
    _check(active > inactive, "Pike should respond to realistic predator retrieve in the morning")
    ecology.register_disturbance(0.50)
    _check(ecology.disturbance > 0.0, "Bank footsteps should generate temporary pressure")
    print("FISH_ECOLOGY_OK: species diets, habitat, depth, retrieve, nibble/strike, time and disturbance")
    quit(0)

func _check(ok: bool, label: String) -> void:
    if not ok:
        push_error("FISH_ECOLOGY_FAIL: " + label)
        quit(1)
