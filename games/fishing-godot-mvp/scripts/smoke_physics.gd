extends SceneTree
## Isolated deterministic model checks for real input and frame-rate independence.
func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var Lure := load("res://scripts/lure_physics.gd") as GDScript
    var Fight := load("res://scripts/fight_physics.gd") as GDScript
    var bait = Lure.new()
    bait.begin_cast(Vector3(0, 1.4, 7), Vector3(7, 0.07, -28), 1)
    _check(not bait.is_landed, "lure should start airborne")
    for i in range(16):
        bait.tick_air(0.10)
    _check(bait.is_landed, "ballistic lure should land")
    _check(absf(bait.position.z + 28) < 0.1, "lure should land at intended target")
    var before: float = bait.position.distance_to(Vector3(0, 0, 7))
    for i in range(40):
        bait.tick_water(0.05, true, false, Vector3(0, 1.4, 7))
    var after: float = bait.position.distance_to(Vector3(0, 0, 7))
    _check(after < before - 1.5, "retrieved spinner should approach the angler")
    _check(bait.depth >= 0.0 and bait.depth < 3.2, "underwater lure depth should be physical")

    var spots: Array = [
        {"pos": Vector3(-8, 0, -18), "type": "carp"},
        {"pos": Vector3(0, 0, -30), "type": "pike"}
    ]
    var spinner_bonus: float = bait.bite_readiness(spots, true)
    var idle_bonus: float = bait.bite_readiness(spots, false)
    _check(spinner_bonus > idle_bonus, "working the spinner should matter")

    var fish: RefCounted = Fight.new()
    fish.call("begin", "Окунь", 0.52, 19.0)
    var first: float = fish.get("distance")
    for i in range(10):
        fish.call("step", 0.06, true, false)
    _check(float(fish.get("distance")) < first, "reeling should pull fish closer")
    var tension_hi: float = fish.get("tension")
    for i in range(8):
        fish.call("step", 0.06, false, false)
    _check(float(fish.get("tension")) < tension_hi, "letting go should ease tension")

    var a: RefCounted = Fight.new()
    var b: RefCounted = Fight.new()
    a.call("begin", "Окунь", 0.52, 20.0)
    b.call("begin", "Окунь", 0.52, 20.0)
    for i in range(360):
        a.call("step", 1.0 / 30.0, (i % 90) < 53, false)
    for i in range(1440):
        b.call("step", 1.0 / 120.0, (i % 360) < 212, false)
    _check(absf(float(a.get("distance")) - float(b.get("distance"))) < 2.0, "fight distance should be consistent at 30/120 FPS")

    var loss: RefCounted = Fight.new()
    loss.call("begin", "Щука", 3.0, 20.0)
    loss.set("drag_level", 2)
    loss.set("tension", 103.0)
    var outcome: int = loss.call("step", 0.1, true, true)
    _check(outcome == 2, "tight reel at 103 percent should snap the line")

    var slack: RefCounted = Fight.new()
    slack.call("begin", "Карась", 0.6, 20.0)
    slack.set("tension", 0.0)
    var loss_type := -1
    for i in range(90):
        loss_type = slack.call("step", 0.1, false, false)
        if loss_type != 0:
            break
    _check(loss_type == 4, "excessive slack should lose the fish")

    _check(str(ProjectSettings.get_setting("display/window/stretch/aspect", "")) == "expand", "aspect expand must be enabled for ultrawide phone screens")
    print("FISHING_PHYSICS_OK: cast, retrieve, bite spots, reel/drag/slack, 30/120 FPS, adaptive screen")
    quit(0)

func _check(ok: bool, message: String) -> void:
    if not ok:
        push_error("FISHING_PHYSICS_FAIL: " + message)
        quit(1)
