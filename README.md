# Crystal Games

Две HTML5-игры с рекламой для RuStore (Android) и VK.

| Папка | Игра |
|---|---|
| `games/block` | «Кристальные блоки» — головоломка 8×8 |
| `games/path` | «Нарисуй путь» — физическая головоломка, 30 уровней |
| `games/snowball` | «Снежный ком» — аркада: кати ком, расти, сноси всё меньше себя |
| `android` | Android-оболочка (WebView + Яндекс Рекламная сеть) |
| `store` | иконки, скриншоты 1080×1920, тексты для витрин |
| `privacy.html` | политика конфиденциальности (публикуется через GitHub Pages) |
| `tests` | автотесты игр (Playwright) |

## Сборка
Каждый push в `main` запускает GitHub Actions (`.github/workflows/build.yml`):
- **RuStore** — подписанные `.apk` и `.aab` для каждой игры (артефакты `rustore-block`, `rustore-path`);
- **VK** — архивы `vk-block.zip`, `vk-path.zip` с подключённым VK Bridge.

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
python3 tools/path_levels.py <папка>   # пересборка и проверка уровней «Нарисуй путь»
```

## «Снежный ком» (ветка `snowball`)
Сборка `.github/workflows/build-snowball.yml` → ветка `builds-snowball`: `snowball-N.apk`, `snowball-N.aab`, `vk-snowball.zip`, `web-snowball.zip`.
Пакет `ru.crystalgames.snowball`; ID рекламы — переменные `SNOWBALL_AD_INTER`, `SNOWBALL_AD_REWARD` (пока не заданы — демо-блоки).
```
python3 tests/test_snowball.py <папка>    # автопилот проходит 2 уровня
python3 tools/snowball_assets.py          # иконка и скриншоты для витрин
```
