extends Node
## Глобальные данные, сохранения, настройки, ввод.

signal settings_changed
signal save_changed

const SAVE_PATH := "user://save.json"
const SETTINGS_PATH := "user://settings.cfg"
const VERSION := "2.0.0"

const C_BONE := Color(0.9, 0.87, 0.8)
const C_ASH := Color(0.55, 0.53, 0.5)
const C_NECRO := Color(0.35, 1.0, 0.55)
const C_BLOOD := Color(0.78, 0.04, 0.05)
const C_GOLD := Color(0.95, 0.72, 0.3)
const C_FIRE := Color(1.0, 0.45, 0.1)

const TEAM_DEAD := 0
const TEAM_ORDER := 1

# ---------------------------------------------------------------- материалы пропсов
var MATERIALS = {
	"stone": {"tex": "stonewall", "rough": 0.9, "detail": 0.55, "scale": 1.2},
	"granite": {"tex": "granite", "rough": 0.85, "detail": 0.6, "scale": 1.0},
	"marble": {"tex": "acg_marble", "rough": 0.35, "detail": 0.45, "scale": 0.6},
	"wood": {"tex": "woodplank", "rough": 0.85, "detail": 0.55, "scale": 1.4},
	"bark": {"tex": "bark", "rough": 0.9, "detail": 0.6, "scale": 1.5},
	"metal": {"tex": "ironplate", "rough": 0.4, "metal": 0.75, "detail": 0.45, "scale": 3.0},
	"rust": {"tex": "rust", "rough": 0.8, "metal": 0.3, "detail": 0.6, "scale": 2.0},
	"bronze": {"tex": "bronze", "rough": 0.45, "metal": 0.7, "detail": 0.4, "scale": 1.5},
	"bone": {"tex": "bone", "rough": 0.65, "detail": 0.45, "scale": 3.0},
	"flesh": {"tex": "flesh", "rough": 0.3, "detail": 0.6, "scale": 4.0},
	"cloth": {"tex": "canvas", "rough": 0.95, "detail": 0.5, "scale": 1.5},
	"leather": {"tex": "leather", "rough": 0.7, "detail": 0.5, "scale": 3.0},
	"hay": {"tex": "gravedirt", "rough": 0.95, "detail": 0.5, "scale": 2.0},
}

# ---------------------------------------------------------------- предметы на костях
const GRIP_R := Vector3(0, 0.085, 0.0)
var ITEMS = {
	"w_sword": {"mesh": "res://assets/weapons/q/Sword.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.17, "mat": "metal", "len": 0.95},
	"w_sword2": {"mesh": "res://assets/weapons/q/Sword_2.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.17, "mat": "metal", "len": 0.95},
	"w_greatsword": {"mesh": "res://assets/weapons/q/Sword_Big.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.23, "mat": "metal", "len": 1.5},
	"w_claymore": {"mesh": "res://assets/weapons/q/Claymore.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.22, "mat": "metal", "len": 1.45},
	"w_exec_axe": {"mesh": "res://assets/weapons/q/Axe_Double.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0.15), "rot": Vector3(90, 0, 0), "scale": 0.26, "mat": "metal", "len": 1.4},
	"w_axe": {"mesh": "res://assets/weapons/q/Axe.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0.05), "rot": Vector3(90, 0, 0), "scale": 0.17, "mat": "metal", "len": 0.8},
	"w_hammer": {"mesh": "res://assets/weapons/q/Hammer_Double.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0.1), "rot": Vector3(90, 0, 0), "scale": 0.24, "mat": "metal", "len": 1.2},
	"w_pitchfork": {"mesh": "res://assets/weapons/q/Spear.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, -0.25), "rot": Vector3(90, 0, 0), "scale": 0.18, "mat": "wood", "len": 1.5},
	"w_spear": {"mesh": "res://assets/weapons/q/Spear.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, -0.25), "rot": Vector3(90, 0, 0), "scale": 0.19, "mat": "metal", "len": 1.6},
	"w_scythe": {"mesh": "res://assets/weapons/q/Scythe.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, -0.2), "rot": Vector3(90, 0, 0), "scale": 0.3, "mat": "metal", "len": 1.7},
	"w_dagger": {"mesh": "res://assets/weapons/q/Dagger.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.17, "mat": "metal", "len": 0.45},
	"w_dagger_l": {"mesh": "res://assets/weapons/q/Dagger.obj", "bone": "LeftHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.17, "mat": "metal", "len": 0.45},
	"w_staff": {"mesh": "res://assets/weapons/q/Spear.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, -0.45), "rot": Vector3(90, 0, 0), "scale": 0.19, "mat": "bone", "len": 1.7},
	"w_torch": {"mesh": "res://assets/weapons/q/Dagger.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.2, "mat": "wood", "len": 0.5, "fire": true},
	"w_crossbow": {"mesh": "res://assets/weapons/q/Axe.obj", "bone": "RightHand", "pos": Vector3(0, 0.085, 0), "rot": Vector3(90, 0, 0), "scale": 0.15, "mat": "wood", "len": 0.6},
	"s_kite": {"mesh": "res://assets/weapons/q/Shield_Heater.obj", "bone": "LeftLowerArm", "pos": Vector3(0.06, 0.2, 0.0), "rot": Vector3(0, -90, 0), "scale": 0.2, "mat": "metal", "shield": true},
	"s_round": {"mesh": "res://assets/weapons/q/Shield_Round.obj", "bone": "LeftLowerArm", "pos": Vector3(0.06, 0.2, 0.0), "rot": Vector3(0, -90, 0), "scale": 0.2, "mat": "wood", "shield": true},
}

# ---------------------------------------------------------------- облики
var LOOKS = {
	"zealot": {"base": "peasant_m", "cloth": Color(0.32, 0.28, 0.24, 1.0), "leather": Color(0.18, 0.13, 0.1, 0.7), "value": 0.9, "items": ["p_pitchfork"]},
	"torch": {"base": "peasant_m", "cloth": Color(0.25, 0.22, 0.2, 1.0), "leather": Color(0.15, 0.1, 0.08, 0.7), "value": 0.85, "items": ["p_torch"]},
	"flagellant": {"base": "bare_m", "extra": [["peasant_m", "Legs"], ["ranger_m", "Hood"]], "skin": Color(0.85, 0.75, 0.7), "cloth": Color(0.2, 0.18, 0.16, 1.0), "items": ["g_battleaxe"]},
	"knight": {"base": "ranger_m", "hide": ["Hood"], "cloth": Color(0.72, 0.72, 0.7, 1.0), "mail": 0.95, "leather": Color(0.2, 0.16, 0.13, 0.8), "metal": Color(0.75, 0.75, 0.76, 0.6), "tabard": Color(0.66, 0.03, 0.03, 1.0), "items": ["g_crusader", "g_kite"]},
	"crossbow": {"base": "ranger_m", "hide": ["Hood"], "cloth": Color(0.42, 0.41, 0.4, 1.0), "leather": Color(0.2, 0.15, 0.12, 0.8), "tabard": Color(0.66, 0.03, 0.03, 1.0), "tabard_cloth": Color(0.55, 0.54, 0.5), "items": ["g_crossbow", "h_kettle"]},
	"priest": {"base": "peasant_m", "cloth": Color(0.92, 0.9, 0.85, 1.0), "leather": Color(0.75, 0.6, 0.3, 0.9), "value": 1.1, "tabard": Color(0.75, 0.55, 0.15, 1.0), "tabard_cloth": Color(0.95, 0.93, 0.88), "items": ["g_mace"]},
	"sister": {"base": "peasant_f", "cloth": Color(0.12, 0.12, 0.13, 1.0), "leather": Color(0.85, 0.84, 0.8, 0.9), "items": ["g_sickle"]},
	"templar": {"base": "ranger_m", "hide": ["Hood"], "scale": 1.22, "cloth": Color(0.5, 0.5, 0.52, 1.0), "mail": 1.0, "leather": Color(0.15, 0.12, 0.1, 0.9), "metal": Color(0.6, 0.6, 0.62, 0.8), "tabard": Color(0.66, 0.03, 0.03, 1.0), "tabard_cloth": Color(0.88, 0.86, 0.8), "items": ["g_warhammer", "h_greathelm"]},
	"witchhunter": {"base": "ranger_f", "cloth": Color(0.1, 0.1, 0.1, 1.0), "leather": Color(0.12, 0.1, 0.09, 0.9), "items": ["g_sickle"]},
	# нежить (общая база)
	"ghoul": {"base": "bare_m", "extra": [["peasant_m", "Legs"]], "undead": 1.0, "skin": Color(0.6, 0.62, 0.55), "eyes": Color(0.3, 1.0, 0.45, 3.0), "value": 0.8, "items": []},
	# герои
	"lich": {"base": "ranger_m", "cloth": Color(0.06, 0.06, 0.07, 1.0), "leather": Color(0.08, 0.07, 0.07, 0.9), "metal": Color(0.35, 0.36, 0.34, 0.7), "undead": 1.0, "skin": Color(0.5, 0.5, 0.48), "eyes": Color(0.3, 1.0, 0.45, 6.0), "items": ["p_staff"]},
	"deathknight": {"base": "ranger_m", "hide": ["Hood"], "scale": 1.08, "cloth": Color(0.12, 0.12, 0.13, 1.0), "mail": 1.0, "leather": Color(0.06, 0.05, 0.05, 0.9), "metal": Color(0.18, 0.18, 0.19, 0.9), "undead": 1.0, "skin": Color(0.45, 0.45, 0.43), "eyes": Color(1.0, 0.15, 0.1, 5.0), "tabard": Color(0.5, 0.02, 0.02, 1.0), "tabard_cloth": Color(0.07, 0.07, 0.08), "items": ["g_greatsword", "h_horned"]},
	"reaper": {"base": "ranger_f", "cloth": Color(0.05, 0.05, 0.06, 1.0), "leather": Color(0.1, 0.08, 0.08, 0.9), "metal": Color(0.5, 0.5, 0.5, 0.7), "undead": 0.6, "skin": Color(0.75, 0.72, 0.7), "eyes": Color(0.3, 1.0, 0.45, 4.0), "items": ["g_scythe"]},
	# боссы
	"executioner": {"base": "bare_m", "extra": [["peasant_m", "Legs"]], "scale": 1.65, "skin": Color(0.8, 0.68, 0.6), "cloth": Color(0.08, 0.07, 0.07, 1.0), "items": ["g_exec_axe", "h_exec_hood"]},
	"marshal": {"base": "ranger_m", "hide": ["Hood"], "scale": 1.5, "cloth": Color(0.85, 0.85, 0.82, 1.0), "mail": 1.0, "metal": Color(0.85, 0.8, 0.6, 0.8), "leather": Color(0.25, 0.18, 0.1, 0.8), "tabard": Color(0.7, 0.03, 0.03, 1.0), "items": ["g_longsword", "g_kite", "h_greathelm"]},
	"inquisitor": {"base": "peasant_m", "scale": 1.35, "cloth": Color(0.5, 0.04, 0.04, 1.0), "leather": Color(0.1, 0.08, 0.07, 0.9), "tabard": Color(0.85, 0.7, 0.3, 1.0), "tabard_cloth": Color(0.12, 0.1, 0.1), "items": ["p_staff"]},
	"colossus": {"base": "ranger_m", "hide": ["Hood"], "scale": 2.5, "stone": 1.0, "cloth": Color(0.6, 0.6, 0.6, 1.0), "mail": 0.4, "metal": Color(0.7, 0.62, 0.4, 0.5), "leather": Color(0.4, 0.4, 0.4, 0.5), "eyes": Color(1.0, 0.8, 0.4, 8.0), "items": ["g_greatsword", "h_greathelm"]},
}

# ---------------------------------------------------------------- юниты
# атаки: anim, t (момент удара 0..1), dmg (множитель), range, arc (градусы), knock, heavy, lunge
var UNITS = {
	"zealot": {"name": "Фанатик", "look": "zealot", "team": 1, "hp": 60, "speed": 4.7, "dmg": 9, "poise": 8, "ai": "melee", "xp": 6, "souls": 1, "raise": "u_zealot",
		"attacks": [{"anim": "a1/Sword_Attack", "t": 0.42, "range": 2.0, "arc": 70, "speed": 1.25}, {"anim": "a2/Melee_Hook", "t": 0.5, "range": 1.6, "arc": 80}]},
	"torch": {"name": "Факельщик", "look": "torch", "team": 1, "hp": 55, "speed": 4.5, "dmg": 8, "poise": 8, "ai": "melee", "xp": 7, "souls": 1, "raise": "u_zealot", "ignite": true,
		"attacks": [{"anim": "a1/Sword_Attack", "t": 0.42, "range": 1.9, "arc": 80, "speed": 1.2, "fire": true}]},
	"flagellant": {"name": "Флагеллант", "look": "flagellant", "team": 1, "hp": 95, "speed": 6.2, "dmg": 12, "poise": 14, "ai": "berserk", "xp": 10, "souls": 2, "raise": "u_flagellant",
		"attacks": [{"anim": "a2/Sword_Regular_A", "t": 0.55, "range": 2.0, "arc": 90, "speed": 1.2}, {"anim": "a2/Sword_Regular_B", "t": 0.5, "range": 2.0, "arc": 90, "speed": 1.2}]},
	"knight": {"name": "Рыцарь Рассвета", "look": "knight", "team": 1, "hp": 170, "speed": 3.9, "dmg": 16, "poise": 45, "armor": 0.2, "ai": "shield", "xp": 12, "souls": 2, "raise": "u_knight", "shield": 0.8,
		"attacks": [{"anim": "a2/Sword_Regular_A", "t": 0.55, "range": 2.3, "arc": 90}, {"anim": "a2/Sword_Regular_B", "t": 0.5, "range": 2.3, "arc": 100}, {"anim": "a2/Shield_OneShot", "t": 0.45, "range": 1.8, "arc": 70, "dmg": 0.6, "knock": 7.0}]},
	"crossbow": {"name": "Арбалетчик", "look": "crossbow", "team": 1, "hp": 70, "speed": 4.1, "dmg": 20, "poise": 10, "ai": "ranged", "xp": 9, "souls": 2, "raise": "u_crossbow", "range": 16.0, "keep": 10.0, "proj": "bolt", "cd": 2.6,
		"attacks": [{"anim": "a1/Pistol_Shoot", "t": 0.3, "ranged": true}]},
	"priest": {"name": "Жрец Рассвета", "look": "priest", "team": 1, "hp": 95, "speed": 3.5, "dmg": 10, "poise": 10, "ai": "priest", "xp": 14, "souls": 3, "raise": "u_zealot", "range": 13.0, "keep": 11.0, "proj": "holy", "cd": 3.2,
		"attacks": [{"anim": "a1/Spell_Simple_Shoot", "t": 0.4, "ranged": true}]},
	"templar": {"name": "Храмовник", "look": "templar", "team": 1, "hp": 420, "speed": 3.3, "dmg": 34, "poise": 160, "armor": 0.3, "ai": "heavy", "xp": 30, "souls": 6, "raise": "u_templar", "elite": true,
		"attacks": [{"anim": "a2/TreeChopping", "t": 0.48, "range": 2.9, "arc": 60, "knock": 9.0, "heavy": true, "aoe": 2.6, "speed": 0.75, "tele": 0.55}, {"anim": "a2/Sword_Regular_C", "t": 0.35, "range": 3.0, "arc": 160, "knock": 6.0, "speed": 0.85}]},
	"witchhunter": {"name": "Ведьмоловка", "look": "witchhunter", "team": 1, "hp": 85, "speed": 4.6, "dmg": 12, "poise": 12, "ai": "bomber", "xp": 12, "souls": 3, "raise": "u_witch", "range": 12.0, "keep": 8.5, "proj": "firebomb", "cd": 3.6,
		"attacks": [{"anim": "a2/OverhandThrow", "t": 0.45, "ranged": true}, {"anim": "a2/Sword_Regular_A", "t": 0.55, "range": 1.9, "arc": 80}]},
	# нежить
	"u_zealot": {"name": "Мёртвый фанатик", "look": "zealot", "undead": true, "team": 0, "hp": 70, "speed": 4.6, "dmg": 10, "poise": 10, "ai": "minion",
		"attacks": [{"anim": "a2/Zombie_Scratch", "t": 0.45, "range": 1.9, "arc": 80, "speed": 1.3}, {"anim": "a1/Sword_Attack", "t": 0.42, "range": 2.0, "arc": 70, "speed": 1.25}]},
	"u_flagellant": {"name": "Мёртвый флагеллант", "look": "flagellant", "undead": true, "team": 0, "hp": 95, "speed": 5.8, "dmg": 14, "poise": 14, "ai": "minion",
		"attacks": [{"anim": "a2/Sword_Regular_A", "t": 0.55, "range": 2.0, "arc": 90, "speed": 1.2}, {"anim": "a2/Sword_Regular_B", "t": 0.5, "range": 2.0, "arc": 90, "speed": 1.2}]},
	"u_knight": {"name": "Павший рыцарь", "look": "knight", "undead": true, "team": 0, "hp": 170, "speed": 4.4, "dmg": 16, "poise": 45, "armor": 0.2, "ai": "minion", "shield": 0.6,
		"attacks": [{"anim": "a2/Sword_Regular_A", "t": 0.55, "range": 2.3, "arc": 90}, {"anim": "a2/Sword_Regular_B", "t": 0.5, "range": 2.3, "arc": 100}]},
	"u_crossbow": {"name": "Мёртвый стрелок", "look": "crossbow", "undead": true, "team": 0, "hp": 70, "speed": 4.6, "dmg": 18, "poise": 10, "ai": "minion_ranged", "range": 15.0, "keep": 6.0, "proj": "bonebolt", "cd": 2.0,
		"attacks": [{"anim": "a1/Pistol_Shoot", "t": 0.3, "ranged": true}]},
	"u_templar": {"name": "Костяной колосс", "look": "templar", "undead": true, "team": 0, "hp": 380, "speed": 3.8, "dmg": 30, "poise": 140, "armor": 0.25, "ai": "minion", "elite": true,
		"attacks": [{"anim": "a2/TreeChopping", "t": 0.48, "range": 2.9, "arc": 60, "knock": 9.0, "heavy": true, "aoe": 2.6, "speed": 0.8}]},
	"u_witch": {"name": "Мёртвая ведьмоловка", "look": "witchhunter", "undead": true, "team": 0, "hp": 80, "speed": 4.8, "dmg": 12, "poise": 12, "ai": "minion_ranged", "range": 11.0, "keep": 6.0, "proj": "soulfire", "cd": 2.8,
		"attacks": [{"anim": "a2/OverhandThrow", "t": 0.45, "ranged": true}]},
	"u_ghoul": {"name": "Упырь", "look": "ghoul", "undead": true, "team": 0, "hp": 55, "speed": 5.6, "dmg": 9, "poise": 6, "ai": "minion",
		"attacks": [{"anim": "a2/Zombie_Scratch", "t": 0.45, "range": 1.8, "arc": 90, "speed": 1.4}]},
	# боссы
	"executioner": {"name": "Палач Бертран", "epithet": "Мясник Вересковой пустоши", "look": "executioner", "team": 1, "hp": 4600, "speed": 4.4, "dmg": 30, "poise": 9999, "armor": 0.15, "ai": "boss", "boss": true, "xp": 180, "souls": 40, "script": "res://scripts/actors/boss.gd",
		"attacks": [{"anim": "a2/Sword_Regular_A", "t": 0.5, "range": 2.4, "arc": 110, "dmg": 1.0, "knock": 7.0, "speed": 0.9}, {"anim": "a2/Sword_Regular_B", "t": 0.5, "range": 2.4, "arc": 110, "dmg": 1.0, "knock": 7.0, "speed": 0.9}]},
	"marshal": {"name": "Маршал Гуго", "epithet": "Железная рука Ордена", "look": "marshal", "team": 1, "hp": 5200, "speed": 4.0, "dmg": 26, "poise": 9999, "armor": 0.3, "shield": 0.85, "ai": "boss", "boss": true, "xp": 220, "souls": 50, "script": "res://scripts/actors/boss.gd",
		"attacks": [{"anim": "a2/Sword_Regular_A", "t": 0.5, "range": 2.5, "arc": 110, "dmg": 1.0, "knock": 6.0}, {"anim": "a2/Shield_OneShot", "t": 0.45, "range": 2.0, "arc": 80, "dmg": 0.7, "knock": 11.0, "heavy": true}]},
	"inquisitor": {"name": "Великий Инквизитор", "epithet": "Очищающее пламя", "look": "inquisitor", "team": 1, "hp": 4000, "speed": 4.2, "dmg": 24, "poise": 9999, "armor": 0.1, "ai": "boss", "boss": true, "xp": 260, "souls": 60, "script": "res://scripts/actors/boss.gd",
		"attacks": [{"anim": "a1/Sword_Attack", "t": 0.42, "range": 2.2, "arc": 90, "dmg": 0.8}]},
	"colossus": {"name": "Святой Колосс", "epithet": "Камень, что верит", "look": "colossus", "team": 1, "hp": 8500, "speed": 2.6, "dmg": 30, "poise": 9999, "armor": 0.3, "ai": "boss", "boss": true, "xp": 400, "souls": 90, "script": "res://scripts/actors/boss.gd", "death_sfx": "stone_break",
		"attacks": [{"anim": "a2/Sword_Regular_B", "t": 0.5, "range": 2.2, "arc": 120, "dmg": 1.0, "knock": 10.0, "heavy": true, "speed": 0.75}]},
}

# ---------------------------------------------------------------- герои
var HEROES = {
	"lich": {"title": "Лич", "look": "lich", "hp": 280, "mana": 130, "speed": 5.5, "armor": 0.0, "cost": 0,
		"desc": "Повелитель костей. Костяные копья пронзают строй, ПКМ — веер пылающих черепов. Подъём мёртвых дешевле на 25%, взрыв трупов сильнее.",
		"lmb": "Костяное копьё", "rmb": "Веер черепов", "dmg": 24},
	"deathknight": {"title": "Рыцарь Смерти", "look": "deathknight", "hp": 440, "mana": 100, "speed": 5.2, "armor": 0.25, "cost": 300,
		"desc": "Двуручный меч и чёрные латы. Серии тяжёлых ударов рубят толпу, третий удар раскалывает щиты. ПКМ — Сокрушение: удар о землю, сбивающий всех с ног.",
		"lmb": "Серия ударов", "rmb": "Сокрушение", "dmg": 40},
	"reaper": {"title": "Жнец", "look": "reaper", "hp": 330, "mana": 110, "speed": 6.2, "armor": 0.05, "cost": 500,
		"desc": "Коса и скорость. Быстрые размашистые удары, вампиризм, убийства сбрасывают перезарядку рывка. ПКМ — Кровавый вихрь.",
		"lmb": "Взмах косой", "rmb": "Кровавый вихрь", "dmg": 26},
}

# ---------------------------------------------------------------- миссии
var MISSIONS = [
	{"id": "graveyard", "title": "Погост Вересковой", "biome": "graveyard", "boss": "executioner",
		"desc": "Ночь новолуния. Фанатики Ордена пришли сжечь твой склеп и выволокли Палача. Встреть их на кладбище.",
		"waves": [[["zealot", 7], ["torch", 2]], [["zealot", 8], ["flagellant", 3], ["torch", 3]], [["zealot", 8], ["knight", 3], ["flagellant", 3]], [["knight", 5], ["zealot", 8], ["crossbow", 3], ["torch", 3]]], "souls": 60},
	{"id": "camp", "title": "Зимний лагерь", "biome": "camp", "boss": "marshal",
		"desc": "Снег, костры и палатки охотников на нежить. Маршал Гуго держит лагерь железной рукой. Залей снег кровью.",
		"waves": [[["knight", 4], ["crossbow", 4], ["zealot", 6]], [["knight", 6], ["crossbow", 4], ["priest", 2]], [["templar", 1], ["knight", 6], ["flagellant", 4], ["crossbow", 4]], [["templar", 2], ["knight", 7], ["crossbow", 5], ["priest", 2], ["zealot", 6]]], "souls": 95},
	{"id": "crypt", "title": "Пыточные катакомбы", "biome": "crypt", "boss": "inquisitor",
		"desc": "Под монастырём Инквизиция жжёт мёртвых. Здесь пахнет палёной плотью и ладаном. Отомсти за каждую кость.",
		"waves": [[["witchhunter", 3], ["flagellant", 5], ["zealot", 6]], [["knight", 6], ["witchhunter", 4], ["priest", 2]], [["templar", 2], ["flagellant", 6], ["witchhunter", 4], ["crossbow", 3]], [["templar", 3], ["knight", 7], ["witchhunter", 5], ["priest", 3]]], "souls": 135},
	{"id": "cathedral", "title": "Собор Рассвета", "biome": "cathedral", "boss": "colossus",
		"desc": "Сердце Ордена. Над алтарём пробуждается Святой Колосс — каменный страж веры. Закончи эту войну.",
		"waves": [[["knight", 8], ["priest", 3], ["crossbow", 4]], [["templar", 2], ["flagellant", 7], ["witchhunter", 4]], [["templar", 3], ["knight", 8], ["crossbow", 5], ["priest", 3]], [["templar", 4], ["knight", 9], ["witchhunter", 5], ["priest", 4], ["flagellant", 6]]], "souls": 220},
]
var ENDLESS = {"id": "endless", "title": "Бойня без конца", "biome": "random", "boss": "", "desc": "Бесконечные волны и босс каждые пять волн. Сколько продержишься?", "waves": [], "souls": 0}

# ---------------------------------------------------------------- дары (на уровень)
var PERKS = [
	{"id": "dmg", "name": "Тёмная ярость", "desc": "+15% к урону героя", "max": 5, "icon": "ab_curse"},
	{"id": "aspd", "name": "Лихорадка", "desc": "+12% к скорости атак", "max": 4, "icon": "ab_dash"},
	{"id": "pierce", "name": "Сквозь плоть", "desc": "Снаряды пробивают ещё одного врага, удары шире", "max": 3, "icon": "ab_bonebolt"},
	{"id": "cap", "name": "Легион", "desc": "+2 к лимиту армии", "max": 4, "icon": "ab_command"},
	{"id": "minion_hp", "name": "Окаменевшие кости", "desc": "Армия: +30% здоровья", "max": 3, "icon": "ab_shield"},
	{"id": "minion_dmg", "name": "Заточенные кости", "desc": "Армия: +25% урона", "max": 3, "icon": "ab_raise"},
	{"id": "minion_boom", "name": "Костяные бомбы", "desc": "Павшие слуги взрываются шрапнелью", "max": 1, "icon": "ab_explode"},
	{"id": "explode", "name": "Гнилая начинка", "desc": "Взрыв трупа: +35% радиуса и урона", "max": 3, "icon": "ab_explode"},
	{"id": "chain", "name": "Цепная реакция", "desc": "Взрыв трупа подрывает ещё два тела рядом", "max": 1, "icon": "ab_explode"},
	{"id": "leech", "name": "Кровопийца", "desc": "Каждое убийство лечит героя на 5", "max": 3, "icon": "ab_harvest"},
	{"id": "mana", "name": "Источник душ", "desc": "+30 к мане и +25% к её восстановлению", "max": 3, "icon": "ab_skullfan"},
	{"id": "hp", "name": "Нечестивая плоть", "desc": "+50 к здоровью и полное исцеление", "max": 4, "icon": "ab_shield"},
	{"id": "speed", "name": "Шаг тени", "desc": "+10% к скорости, рывок восстанавливается быстрее", "max": 3, "icon": "ab_dash"},
	{"id": "crit", "name": "Мясник", "desc": "+8% к шансу крита: двойной урон и расчленение", "max": 3, "icon": "ab_execute"},
	{"id": "raise_cost", "name": "Дешёвая смерть", "desc": "Подъём мёртвых дешевле на 30%", "max": 2, "icon": "ab_raise"},
	{"id": "frenzy", "name": "Кровавая баня", "desc": "Жатва копится на 40% быстрее", "max": 2, "icon": "ab_harvest"},
	{"id": "thorns", "name": "Шипастый костяк", "desc": "Враги получают 30% урона, нанесённого тебе", "max": 2, "icon": "ab_shield"},
	{"id": "elite_raise", "name": "Тёмный ритуал", "desc": "Поднятые встают сильнее: +40% здоровья и урона", "max": 1, "icon": "ab_raise"},
	{"id": "headsman", "name": "Палач", "desc": "Казни лечат вдвое сильнее, сломить можно раньше", "max": 1, "icon": "ab_execute"},
	{"id": "grip", "name": "Мёртвая хватка", "desc": "Удары героя замедляют врагов на 30%", "max": 1, "icon": "ab_curse"},
]

var UPGRADES = [
	{"id": "u_hp", "name": "Костяная плоть", "desc": "+25 к здоровью героя", "max": 5, "base": 35},
	{"id": "u_mana", "name": "Колодец душ", "desc": "+15 к мане и +10% восстановления", "max": 5, "base": 35},
	{"id": "u_dmg", "name": "Тёмная мощь", "desc": "+8% к урону героя", "max": 5, "base": 45},
	{"id": "u_cap", "name": "Легион", "desc": "+1 к лимиту армии", "max": 5, "base": 50},
	{"id": "u_start", "name": "Верные слуги", "desc": "+2 упыря в начале битвы", "max": 3, "base": 60},
	{"id": "u_army", "name": "Кузня костей", "desc": "+10% здоровья и урона армии", "max": 5, "base": 45},
	{"id": "u_souls", "name": "Жадность могильщика", "desc": "+15% к добыче душ", "max": 3, "base": 70},
	{"id": "u_dash", "name": "Тень за спиной", "desc": "+1 заряд рывка", "max": 1, "base": 220},
]

# сгенерированное оружие и шлемы (assets/items/*.glb, ось — +Y, начало координат — в хвате)
# id: [файл, кость, длина/масштаб, материал, доп. поля]
const GEN_ITEMS := {
	"g_longsword": ["w_longsword", "RightHand", 1.0, "metal", {}],
	"g_crusader": ["w_crusader", "RightHand", 0.95, "metal", {}],
	"g_greatsword": ["w_longsword", "RightHand", 1.5, "metal", {}],
	"g_exec_axe": ["w_exec_axe", "RightHand", 1.35, "metal", {}],
	"g_battleaxe": ["w_battleaxe", "RightHand", 0.85, "metal", {}],
	"g_warhammer": ["w_warhammer", "RightHand", 1.0, "metal", {}],
	"g_mace": ["w_mace", "RightHand", 0.65, "metal", {}],
	"g_flail": ["w_flail", "RightHand", 0.7, "metal", {}],
	"g_spear": ["w_spear", "RightHand", 1.9, "metal", {}],
	"g_pitchfork": ["w_pitchfork", "RightHand", 1.6, "wood", {}],
	"g_torch": ["w_torch", "RightHand", 0.62, "wood", {"fire": true, "flip": true}],
	"g_scythe": ["w_scythe", "RightHand", 1.85, "metal", {}],
	"g_staff": ["w_lich_staff", "RightHand", 1.7, "bone", {"staff": true}],
	"g_sickle": ["w_sickle", "RightHand", 0.55, "metal", {}],
	"g_censer": ["w_censer", "LeftHand", 0.4, "metal", {}],
	"g_crossbow": ["w_crossbow", "RightHand", 0.75, "wood", {}],
	"g_kite": ["w_kite_shield", "LeftLowerArm", 0.78, "metal", {"shield": true}],
	"g_heater": ["w_heater_shield", "LeftLowerArm", 0.62, "metal", {"shield": true}],
	"h_greathelm": ["h_greathelm", "Head", 0.95, "metal", {"helm": true}],
	"h_kettle": ["h_kettle", "Head", 0.95, "metal", {"helm": true, "dy": 0.07}],
	"h_exec_hood": ["h_exec_hood", "Head", 0.9, "leather", {"helm": true}],
	"h_horned": ["h_horned", "Head", 0.85, "metal", {"helm": true}],
	"h_skull": ["h_skull", "Head", 1.05, "bone", {"helm": true}],
}
var HELM_POS = Vector3(0, 0.1, 0.015)
const PROC_ITEMS := {
	"p_staff": {"proc": "staff", "bone": "RightHand", "rot": Vector3(180, 0, 0), "mat": "wood"},
	"p_pitchfork": {"proc": "pitchfork", "bone": "RightHand", "rot": Vector3(90, 0, 0), "mat": "wood"},
	"p_spear": {"proc": "spear", "bone": "RightHand", "rot": Vector3(90, 0, 0), "mat": "wood"},
	"p_torch": {"proc": "torch", "bone": "RightHand", "rot": Vector3(90, 0, 0), "mat": "wood", "fire": true, "fire_at": 0.6},
}
var SHIELD_POS = Vector3(0.09, 0.16, 0.0)

func _load_gen_items() -> void:
	for id in PROC_ITEMS:
		var pd: Dictionary = PROC_ITEMS[id].duplicate()
		pd["pos"] = GRIP_R
		pd["scale"] = 1.0
		ITEMS[id] = pd
	var info = {}
	var f = FileAccess.open("res://assets/items/items.json", FileAccess.READ)
	if f:
		var j = JSON.parse_string(f.get_as_text())
		if j is Dictionary:
			info = j
	for id in GEN_ITEMS:
		var g: Array = GEN_ITEMS[id]
		var path = "res://assets/items/%s.glb" % g[0]
		if not ResourceLoader.exists(path):
			continue
		var inf: Dictionary = info.get(g[0], {})
		var d = {"mesh": path, "bone": g[1], "mat": g[3]}
		var ex: Dictionary = g[4]
		if ex.get("helm", false):
			d["pos"] = HELM_POS + Vector3(0, float(ex.get("dy", 0.0)), float(ex.get("dz", 0.0))); d["rot"] = Vector3.ZERO; d["scale"] = float(g[2]); d["helm"] = true
		elif ex.get("shield", false):
			var sz: Array = inf.get("size", [1, 1, 0.2])
			d["pos"] = SHIELD_POS; d["rot"] = Vector3(0, -90, 0); d["scale"] = float(g[2]) / maxf(0.1, float(sz[1])); d["shield"] = true
		else:
			var L = float(inf.get("len", 1.0))
			var k = float(g[2]) / maxf(0.05, L)
			d["pos"] = GRIP_R; d["rot"] = Vector3(-90 if ex.get("flip", false) else 90, 0, 0); d["scale"] = k
			if ex.get("staff", false):
				# посох держим вертикально: навершие вверх вдоль предплечья
				d["rot"] = Vector3(180, 0, 0)
				d["mesh_pos"] = Vector3(0, -0.12 * L, 0)
			d["len"] = float(g[2])
			if ex.get("fire", false):
				d["fire"] = true
				d["fire_at"] = (L - float(inf.get("grip", 0.0))) * k
		ITEMS[id] = d

var save = {"souls": 0, "upgrades": {}, "unlocked": ["lich"], "missions_done": [], "best_endless": 0, "total_kills": 0, "hero": "lich"}
var settings = {
	"preset": "high", "fullscreen": true, "vsync": true, "fps_cap": 0, "render_scale": 1.0, "fsr": false,
	"msaa": 2, "fxaa": true, "shadows": 2, "ssao": true, "ssil": false, "volumetric": true, "glow": true,
	"gore": 2, "shake": 1.0, "dmg_numbers": true, "mono": false, "grain": false,
	"vol_master": 0.85, "vol_music": 0.6, "vol_sfx": 0.9, "brightness": 1.0,
}

var run = {}
var mission: Dictionary = {}
var world: Node = null

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_load_gen_items()
	_setup_input()
	load_save()
	load_settings()
	call_deferred("apply_settings")

# ---------------------------------------------------------------- ввод
func _key(action: String, keys: Array, mouse: Array = []) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, 0.2)
	for k in keys:
		var e = InputEventKey.new(); e.physical_keycode = k
		InputMap.action_add_event(action, e)
	for b in mouse:
		var m = InputEventMouseButton.new(); m.button_index = b
		InputMap.action_add_event(action, m)

func _setup_input() -> void:
	_key("up", [KEY_W, KEY_UP]); _key("down", [KEY_S, KEY_DOWN]); _key("left", [KEY_A, KEY_LEFT]); _key("right", [KEY_D, KEY_RIGHT])
	_key("attack", [], [MOUSE_BUTTON_LEFT]); _key("special", [], [MOUSE_BUTTON_RIGHT])
	_key("dash", [KEY_SPACE, KEY_SHIFT]); _key("raise", [KEY_Q]); _key("explode", [KEY_E]); _key("execute", [KEY_F])
	_key("ult", [KEY_R]); _key("command", [KEY_C], [MOUSE_BUTTON_MIDDLE]); _key("pause", [KEY_ESCAPE, KEY_P])
	_key("zoom_in", [], [MOUSE_BUTTON_WHEEL_UP]); _key("zoom_out", [], [MOUSE_BUTTON_WHEEL_DOWN])

# ---------------------------------------------------------------- прогресс
func upgrade_level(id: String) -> int:
	return int(save.upgrades.get(id, 0))

func upgrade_cost(u: Dictionary) -> int:
	var l = upgrade_level(u.id)
	return int(u.base * (1 + l) * (1.0 + 0.25 * l))

func perk_level(id: String) -> int:
	return int(run.get("perks", {}).get(id, 0))

func available_perks() -> Array:
	var out = []
	for p in PERKS:
		if perk_level(p.id) < p.max:
			out.append(p)
	return out

func xp_for_level(l: int) -> int:
	return int(50 + 38 * (l - 1) + 8 * (l - 1) * (l - 1))

func army_cap() -> int:
	return 6 + upgrade_level("u_cap") + 2 * perk_level("cap")

func gore() -> int:
	return int(settings.gore)

func start_run(m: Dictionary) -> void:
	mission = m
	run = {"hero": save.hero, "level": 1, "xp": 0, "kills": 0, "souls": 0, "perks": {}, "wave": 0, "time": 0.0,
		"max_combo": 0, "raised": 0, "executions": 0, "gibs": 0}

func load_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var f = FileAccess.open(SAVE_PATH, FileAccess.READ)
		var d = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			for k in d:
				save[k] = d[k]
	if not save.unlocked.has("lich"):
		save.unlocked.append("lich")
	if not HEROES.has(save.hero):
		save.hero = "lich"

func write_save() -> void:
	var f = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(save, "\t"))
	save_changed.emit()

const SETTINGS_VER := 3
func load_settings() -> void:
	var cf = ConfigFile.new()
	if cf.load(SETTINGS_PATH) == OK:
		var ver = int(cf.get_value("s", "ver", 1))
		for k in settings.keys():
			# новые значения по умолчанию для стиля и отдачи после обновления
			if ver < SETTINGS_VER and k in ["mono", "grain", "dmg_numbers", "brightness"]:
				continue
			settings[k] = cf.get_value("s", k, settings[k])

func write_settings() -> void:
	var cf = ConfigFile.new()
	cf.set_value("s", "ver", SETTINGS_VER)
	for k in settings:
		cf.set_value("s", k, settings[k])
	cf.save(SETTINGS_PATH)

const PRESETS := {
	"low": {"msaa": 0, "fxaa": true, "shadows": 0, "ssao": false, "ssil": false, "volumetric": false, "glow": true, "render_scale": 0.8, "fsr": true},
	"medium": {"msaa": 0, "fxaa": true, "shadows": 1, "ssao": true, "ssil": false, "volumetric": true, "glow": true, "render_scale": 1.0, "fsr": false},
	"high": {"msaa": 2, "fxaa": true, "shadows": 2, "ssao": true, "ssil": false, "volumetric": true, "glow": true, "render_scale": 1.0, "fsr": false},
	"ultra": {"msaa": 4, "fxaa": false, "shadows": 3, "ssao": true, "ssil": true, "volumetric": true, "glow": true, "render_scale": 1.0, "fsr": false},
}

func apply_preset(p: String) -> void:
	settings.preset = p
	settings.merge(PRESETS[p], true)

func apply_settings() -> void:
	if DisplayServer.get_name() == "headless":
		settings_changed.emit()
		return
	var testing := false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--test="):
			testing = true
	if testing:
		pass
	elif settings.fullscreen:
		if DisplayServer.window_get_mode() != DisplayServer.WINDOW_MODE_FULLSCREEN:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		if DisplayServer.window_get_mode() != DisplayServer.WINDOW_MODE_WINDOWED:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
			var sc = DisplayServer.screen_get_size()
			var sz = Vector2i(mini(1600, sc.x - 80), mini(900, sc.y - 80))
			DisplayServer.window_set_size(sz)
			DisplayServer.window_set_position(DisplayServer.screen_get_position() + (sc - sz) / 2)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if settings.vsync else DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = int(settings.fps_cap)
	var vp = get_viewport()
	vp.msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_2X, Viewport.MSAA_4X][clampi(int(settings.msaa), 0, 4)]
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if settings.fxaa else Viewport.SCREEN_SPACE_AA_DISABLED
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if settings.fsr else Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = float(settings.render_scale)
	var sh: int = int(settings.shadows)
	RenderingServer.directional_shadow_atlas_set_size([1024, 2048, 4096, 8192][sh], true)
	vp.positional_shadow_atlas_size = [1024, 2048, 4096, 4096][sh]
	RenderingServer.directional_soft_shadow_filter_set_quality([RenderingServer.SHADOW_QUALITY_HARD, RenderingServer.SHADOW_QUALITY_SOFT_LOW, RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM, RenderingServer.SHADOW_QUALITY_SOFT_HIGH][sh])
	RenderingServer.positional_soft_shadow_filter_set_quality([RenderingServer.SHADOW_QUALITY_HARD, RenderingServer.SHADOW_QUALITY_SOFT_LOW, RenderingServer.SHADOW_QUALITY_SOFT_LOW, RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM][sh])
	_apply_volumes()
	settings_changed.emit()

func _apply_volumes() -> void:
	for pair in [["Master", "vol_master"], ["Music", "vol_music"], ["SFX", "vol_sfx"]]:
		var b = AudioServer.get_bus_index(pair[0])
		if b >= 0:
			AudioServer.set_bus_volume_db(b, linear_to_db(maxf(0.0001, float(settings[pair[1]]))))
