# Crystal Games

Две HTML5-игры с рекламой для RuStore (Android) и VK.

| Папка | Игра |
|---|---|
| `games/block` | «Кристальные блоки» — головоломка 8×8 |
| `games/idle` | «Кристальная шахта» — idle-кликер |
| `android` | Android-оболочка (WebView + Яндекс Рекламная сеть) |
| `store` | иконки, скриншоты 1080×1920, тексты для витрин |
| `privacy.html` | политика конфиденциальности (публикуется через GitHub Pages) |
| `tests` | автотесты игр (Playwright) |

## Сборка
Каждый push в `main` запускает GitHub Actions (`.github/workflows/build.yml`):
- **RuStore** — подписанные `.apk` и `.aab` для каждой игры (артефакты `rustore-block`, `rustore-idle`);
- **VK** — архивы `vk-block.zip`, `vk-idle.zip` с подключённым VK Bridge.

### Секреты репозитория (Settings → Secrets and variables → Actions)
`KEYSTORE_B64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` — ключ подписи (хранится отдельно, в репозиторий не кладётся).

### Переменные репозитория (вкладка Variables)
ID рекламных блоков из кабинета Яндекс Рекламной сети. Пока они не заданы, используются демо-блоки Яндекса:
`BLOCK_AD_INTER`, `BLOCK_AD_REWARD`, `IDLE_AD_INTER`, `IDLE_AD_REWARD`.

## Реклама в играх
Игры вызывают единый слой `Ads`:
- в Android — `window.AndroidAds` (Яндекс: полноэкранная и с вознаграждением);
- в VK (есть `vk_app_id` в адресе) — `VKWebAppShowNativeAds`;
- в обычном браузере — тестовая заглушка.

Межстраничная реклама показывается не чаще раза в 90 с (блоки) / 3 мин (шахта), с вознаграждением — только по желанию игрока.

## Тесты
```
python3 tests/test_block.py <папка_для_скриншотов>
python3 tests/test_idle.py <папка_для_скриншотов>
```
