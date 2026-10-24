class_name AnimLib
## Общие библиотеки анимаций (Quaternius UAL1 + UAL2), загружаются один раз.

static var _libs: Dictionary = {}
static var _ready = false

const LOOPS := ["a1/Idle", "a1/Walk", "a1/Jog_Fwd", "a1/Sprint", "a1/Crouch_Fwd", "a1/Crouch_Idle", "a1/Sword_Idle",
	"a1/Spell_Simple_Idle", "a1/Pistol_Idle", "a1/Idle_Torch", "a1/Fixing_Kneeling", "a1/Walk_Formal", "a1/Sitting_Idle",
	"a2/Zombie_Idle", "a2/Zombie_Walk_Fwd", "a2/Idle_Shield", "a2/Idle_FoldArms", "a2/Idle_Lantern", "a2/NinjaJump_Idle",
	"a1/Swim_Idle", "a1/Idle_Talking", "a2/Idle_No", "a1/Dance", "a2/Slide", "a2/Walk_Carry", "a1/Pistol_Aim_Neutral"]
# у атакующих клипов убираем горизонтальный дрейф таза: перемещение делаем кодом
const STRIP_DRIFT := ["a2/Sword_Regular_A", "a2/Sword_Regular_B", "a2/Sword_Regular_C", "a2/Sword_Regular_Combo",
	"a2/Sword_Regular_A_Rec", "a2/Sword_Regular_B_Rec", "a1/Sword_Attack", "a2/Melee_Hook", "a2/Melee_Hook_Rec",
	"a2/TreeChopping", "a2/Shield_OneShot", "a2/Zombie_Scratch", "a1/Punch_Cross", "a1/Punch_Jab", "a2/OverhandThrow",
	"a2/Hit_Knockback", "a1/Hit_Chest", "a1/Hit_Head", "a2/Farm_Harvest", "a1/Spell_Simple_Shoot", "a1/Roll",
	"a2/Sword_Dash_RM", "a2/Shield_Dash_RM", "a1/Death01", "a2/Consume", "a1/Push", "a1/Jump_Start", "a1/Jump_Land",
	"a2/NinjaJump_Start", "a2/NinjaJump_Land", "a2/Slide_Start", "a2/Slide_Exit", "a2/Sword_Block", "a2/LayToIdle"]

static func setup() -> void:
	if _ready:
		return
	_ready = true
	for pair in [["a1", "res://assets/anim/UAL1.glb"], ["a2", "res://assets/anim/UAL2.glb"]]:
		var sc: Node = load(pair[1]).instantiate()
		var ap: AnimationPlayer = sc.find_children("*", "AnimationPlayer", true, false)[0]
		var lib: AnimationLibrary = ap.get_animation_library("")
		_libs[pair[0]] = lib
		sc.free()
	for full in LOOPS:
		var a = get_anim(full)
		if a:
			a.loop_mode = Animation.LOOP_LINEAR
	for full in STRIP_DRIFT:
		var a = get_anim(full)
		if a:
			_strip_drift(a)

static func get_anim(full: String) -> Animation:
	var p = full.split("/")
	if p.size() != 2 or not _libs.has(p[0]):
		return null
	var lib: AnimationLibrary = _libs[p[0]]
	if not lib.has_animation(p[1]):
		return null
	return lib.get_animation(p[1])

static func length(full: String) -> float:
	var a = get_anim(full)
	return a.length if a else 0.5

static func attach(ap: AnimationMixer) -> void:
	setup()
	for k in _libs:
		if not ap.has_animation_library(k):
			ap.add_animation_library(k, _libs[k])

static func _strip_drift(a: Animation) -> void:
	for t in a.get_track_count():
		if a.track_get_type(t) != Animation.TYPE_POSITION_3D:
			continue
		var path = String(a.track_get_path(t))
		if not path.ends_with(":Hips") and not path.ends_with(":Root"):
			continue
		var n = a.track_get_key_count(t)
		if n == 0:
			continue
		var p0: Vector3 = a.track_get_key_value(t, 0)
		for k in n:
			var p: Vector3 = a.track_get_key_value(t, k)
			a.track_set_key_value(t, k, Vector3(p0.x, p.y, p0.z))
