КОСТЯНАЯ ЖАТВА — исходный проект (Godot 4.7.2)

Как открыть:
1. Скачай Godot 4.7.2 (Standard, не .NET): https://godotengine.org/download/archive/4.7.2-stable/
2. Запусти Godot → «Импорт» → выбери файл project.godot в этой папке.
3. Первый импорт ассетов займёт несколько минут.
4. F5 — запуск игры. Главная сцена: scenes/main.tscn.

Сборка exe: Проект → Экспорт → Windows (шаблоны экспорта 4.7.2 скачай в Godot: Редактор → Управление шаблонами экспорта).

Структура:
  scripts/g.gd            — данные игры: герои, враги, боссы, миссии, дары, улучшения, настройки, предметы
  scripts/main.gd         — поток игры: меню → бой → итоги
  scripts/actors/         — персонажи: actor.gd (база), player.gd (герой), unit.gd (ИИ врагов/армии), boss.gd (боссы), ragdoll.gd, projectile.gd, char_builder.gd
  scripts/world/          — world.gd (бой), director.gd (волны), level_builder.gd (локации, свет), cam_rig.gd (камера), prop.gd
  scripts/fx/             — эффекты: кровь, расчленение, следы ударов, вспышки, души
  scripts/ui/             — меню, HUD, настройки, пауза, итоги, выбор даров
  scripts/tests/          — автотесты (запуск с аргументом --test=...)
  assets/shaders/         — шейдеры: персонажи, пропсы, земля, цветокоррекция (grade.gdshader), огонь, следы
  assets/props, items, gore — 3D-модели, сгенерированные Hunyuan3D на твоей видеокарте
  assets/chars, anim      — персонажи и анимации Quaternius (CC0)
  assets/music, sfx       — музыка ACE-Step и звуки
  _dev/                   — служебные скрипты (распаковка старой сборки и т. п.)
