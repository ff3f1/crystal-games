# Crystal Games

HTML5-игры с рекламой для RuStore (Android), VK и веба.

| Папка | Игра |
|---|---|
| `games/block` | «Кристальные блоки» — головоломка 8×8 |
| `games/path` | «Нарисуй путь» — физическая головоломка, 30 уровней |
| `games/swarm` | «Звёздный рой» — экшен: рой светлячков, 40 планет, WebGL |
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

## «Звёздный рой» (ветка `swarm`)
Отдельная сборка `.github/workflows/build-swarm.yml` (не трогает две другие игры):
- пакет `ru.crystalgames.swarm`, файлы попадают в ветку `builds-swarm`: `swarm-N.apk`, `swarm-N.aab`, `vk-swarm.zip`, `web-swarm.zip`;
- ID рекламных блоков — переменные `SWARM_AD_INTER`, `SWARM_AD_REWARD` (пока не заданы — демо-блоки);
- ключ подписи — те же секреты, что и у других игр.

Код: `games/swarm/js/` — `render.js` (WebGL, свечение), `world.js` (рой, бой, опасности, боты), `galaxy.js` (карта галактики),
`game.js` (экраны, награды, сохранение), `platform.js` (реклама Android/VK/Яндекс Игры), `data.js` (биомы, мутации, баланс).

```
python3 tests/test_swarm.py <папка>    # автопилот проходит первую планету + проверка баланса
python3 tools/swarm_shots.py           # скриншоты для витрин 1080×1920
```
