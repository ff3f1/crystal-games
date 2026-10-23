# Crystal Games

HTML5-игры с рекламой для RuStore (Android) и VK.

| Папка | Игра |
|---|---|
| `games/block` | «Кристальные блоки» — головоломка 8×8 |
| `games/path` | «Нарисуй путь» — физическая головоломка, 30 уровней |
| `games/fish` | «Рыбалка: Клюёт!» — рыбалка на 8 водоёмах России, 31 вид рыбы, 4 сезона |
| `android` | Android-оболочка (WebView + Яндекс Рекламная сеть) |
| `store` | иконки, скриншоты 1080×1920, тексты для витрин |
| `privacy.html` | политика конфиденциальности (публикуется через GitHub Pages) |
| `tests` | автотесты игр (Playwright) |

## Сборка
Каждый push в `main` запускает GitHub Actions (`.github/workflows/build.yml`):
- **RuStore** — подписанные `.apk` и `.aab` для каждой игры (артефакты `rustore-block`, `rustore-path`, `rustore-fish`);
- **VK** — архивы `vk-block.zip`, `vk-path.zip`, `vk-fish.zip` с подключённым VK Bridge.

### Секреты репозитория (Settings → Secrets and variables → Actions)
`KEYSTORE_B64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` — ключ подписи (хранится отдельно, в репозиторий не кладётся).

### Переменные репозитория (вкладка Variables)
ID рекламных блоков из кабинета Яндекс Рекламной сети. Пока они не заданы, используются демо-блоки Яндекса:
`BLOCK_AD_INTER`, `BLOCK_AD_REWARD`, `PATH_AD_INTER`, `PATH_AD_REWARD`.

## Реклама в играх
Игры вызывают единый слой `Ads`:
- в Android — `window.AndroidAds` (Яндекс: полноэкранная и с вознаграждением);
- в VK (есть `vk_app_id` в адресе) — `VKWebAppShowNativeAds`;
- в обычном браузере — тестовая заглушка.

Межстраничная реклама показывается не чаще раза в 90 с, с вознаграждением — только по желанию игрока.

## Тесты
```
python3 tests/test_block.py <папка_для_скриншотов>
python3 tests/test_path.py <папка_для_скриншотов>
python3 tests/test_fish.py <папка_для_скриншотов>
python3 tools/path_levels.py <папка>   # пересборка и проверка уровней «Нарисуй путь»
```

## «Рыбалка: Клюёт!»: свои картинки и музыка

Игра полностью работает и без них: рыбы, водоёмы и иконки рисуются кодом. Сгенерированные ассеты подхватываются сами.

1. Запустить ComfyUI с моделью Flux.
2. В папке репозитория: `python tools/fish_generate.py` — 89 картинок (32 фона, 31 рыба, 26 иконок) в `tools/raw_assets`.
   Можно прерывать и запускать снова — готовое пропускается. Свой воркфлоу: `--workflow файл_API.json`, другой чекпойнт: `--ckpt имя`.
   Если системного Python нет — тем, что внутри ComfyUI: `python_embeded\python.exe tools\fish_generate.py`.
3. Музыка (по желанию): в ACE-Step сделать треки по тегам из `tools/fish_assets.json` (раздел `music`) и положить в
   `tools/raw_assets/audio/` с именами `music_summer`, `music_spring`, `music_autumn`, `music_winter`, `music_night` (mp3/wav/flac).
4. `python tools/fish_process.py` — вырезает фон, сжимает в webp, подключает к игре (`games/fish/assets/assets.js`).
   С `pip install rembg` фон у рыб вырезается аккуратнее.
5. `git add games/fish/assets && git commit -m "Ассеты рыбалки" && git push` — и сборка.

Тонкая настройка — `tools/fish_tuning.json`: `flip` разворачивает спрайт рыбы головой влево (`{"flip": {"fish/pike": true}}`),
`waterline` — где на фоне линия воды (доля высоты, по умолчанию 0.97).
Иконка: `python tools/fish_icon.py` (если есть `games/fish/assets/ui/icon.png` — берётся она). Скриншоты: `python tools/store_shots.py`.
Ссылка на YouTube-канал для кнопки в настройках — `FZ.CONFIG.youtube` в `games/fish/js/platform.js`.
