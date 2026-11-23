# DUSK//CUT 2.6.6 — Android / RuStore

Полноценный исходный Android-проект игры на основе исходников v2.6.6 (не версии 2.6.6).

## Внутри

- `app/src/main/assets/www/` — вся игра и все атласы в составе APK, никаких сетевых загрузок для геймплея;
- Native Android Activity (fullscreen/portrait, touch, hardware Back, haptics, локальные сохранения через localStorage WebViewAssetLoader);
- Android-системное «Поделиться» с ссылкой на карточку RuStore (активируется, когда приложение опубликовано);
- кнопки оценки ведут на карточку в RuStore;
- Yandex Games SDK полностью удалён;
- Яндекс Mobile Ads SDK **8.6.0** подключён в Android-проекте (это другой SDK);
- между забегами — interstitial, второй шанс и +25 осколков — rewarded **только при подтверждённом `onRewarded`**;
- если рекламных ID нет или реклама не загружена — игра продолжает работать, бонусные кнопки скрыты, фальшивых наград нет;
- оригинальные иконка и медиа для RuStore — папка `RUSTORE_MEDIA/`.

## Как открыть и собрать на Windows

1. Распакуйте ZIP. Откройте **именно корневую папку** `DuskCut_RuStore_Android` в Android Studio.
2. В Android SDK Manager установите Android SDK Platform 35 и согласитесь с лицензиями.
3. JDK 17 или 21, Android Gradle Plugin 8.7.3, Gradle 8.9 или совместимая версия. Если Studio предлагает выбрать Gradle, выберите Gradle 8.9 (не Gradle 9.x).
4. Дождитесь синхронизации Gradle. Меню **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Для отладки итог — `app/build/outputs/apk/debug/app-debug.apk` (тестовый APK, не финальная релизная подпись).
6. Проверьте APK на телефоне: движение стиком, рывок, меню, звук, смерть, локальный прогресс, поворот/сворачивание и возврат, выход; рекламу протестируйте сначала с демоблоками.

## Настоящая реклама и доход

В кабинете РСЯ добавьте **DUSK//CUT как отдельное Android-приложение** с package `ru.crystalgames.duskcut`.
Создайте `Rewarded` и `Interstitial` рекламные блоки именно для него. Рекламные блоки Яндекс Игр не подходят.

ID рекламных блоков уже подключены по умолчанию. Если потребуется заменить их, в `%USERPROFILE%\.gradle\gradle.properties` укажите:

```
DUSK_REWARDED_ID=R-M-20492584-1
DUSK_INTERSTITIAL_ID=R-M-20492584-2
```

Замените шаблоны настоящими ID, которые выдаст РСЯ. Для тестов можно временно использовать `demo-rewarded-yandex` и `demo-interstitial-yandex`, но **не выпускать их в RuStore**. До этого реклама и доход не активны.

## Релизная подпись

Для публикации нужна **постоянная подпись**. Один раз создайте новый `.jks` через Android Studio **Build → Generate Signed Bundle / APK** и обязательно сохраните ключ. Тот же ключ нужен для всех будущих обновлений.

Чтобы автоматизировать Gradle release подписание, можно добавить в `%USERPROFILE%\.gradle\gradle.properties`:

```
DUSK_STORE_FILE=C:/path/to/duskcut-release.jks
DUSK_STORE_PASSWORD=...     
DUSK_KEY_ALIAS=duskcut
DUSK_KEY_PASSWORD=...
```

Затем запускайте `assembleRelease` в Android Studio Gradle Tasks. **Не публикуйте `debug` APK и никогда не выкладывайте JKS и пароли в GitHub.**

## RuStore

- Package: `ru.crystalgames.duskcut` (новое приложение, не замена «Рыбалки»).
- Version Name: `2.6.6`, Version Code: `265`.
- Min Android: 6.0 (API 23), target: API 35.
- Тип: Игра / Экшен или Аркады (укажите подходящую категорию в консоли).
- Локальная игра работает без интернета; сеть нужна только для реальных рекламных объявлений и ссылки RuStore.
- Иконка `RUSTORE_MEDIA/icon_512.png`, скриншоты `phone_*.png`. При необходимости переснимите с нативного APK, чтобы карточка строго соответствовала мобильной сборке.
- Ссылка оценки/приглашения станет рабочей после публикации карточки с этим package.
- Прогресс из Яндекс Игр **не переносится автоматически**: это новое приложение с другим хранилищем.

## Статус

**Исходный Android-проект готов к сборке, но APK не собран в этой среде:** отсутствуют Android SDK Platform/Build Tools и Gradle; нет эмулятора/физического устройства. Пока не проведён нативный smoke-test и модерация.
Проверьте компиляцию и рекламные коллбэки в Android Studio до публикации. Код построен по официальной документации Yandex Mobile Ads 8.


## GitHub Actions
В проекте настроена сборка **debug APK** в GitHub Actions, которая не требует паролей. Публиковать debug APK в RuStore нельзя; для финального release APK нужен постоянный ключ подписи. APK из Actions — для проверки на телефоне. Файлы изображений лежат в архивном asset bundle и распаковываются до сборки.

## Подписанный APK прямо в GitHub Actions

Для **первого** релиза один раз создайте постоянный Java keystore (.jks) через Android Studio (Build → Generate Signed Bundle / APK) или `keytool`. Его нужно хранить в надёжном месте вне публичного GitHub; он понадобится для всех будущих обновлений.

В Settings → Secrets and variables → Actions → Repository secrets добавьте четыре секрета:
- `DUSK_KEYSTORE_BASE64`: содержимое JKS, закодированное Base64. На Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\\path\\to\\release.jks')) | Set-Clipboard`
- `DUSK_STORE_PASSWORD`: пароль хранилища.
- `DUSK_KEY_ALIAS`: алиас ключа.
- `DUSK_KEY_PASSWORD`: пароль самого ключа.

После задания секретов запустите GitHub Actions → DUSK CUT - Android APK / RuStore media → Run workflow. В артефактах появится `DUSK-CUT-2.6.6-RUSTORE-SIGNED-RELEASE` — подписанный APK. НЕ публикуйте тестовый debug APK.


## RuStore 2.6.6
- Multitouch Android: thumb on the movement stick and second finger on the slash surface work independently.
- Desktop keyboard hints hidden in the Android app, retained in browser version.
- Real native Yandex Mobile Ads 8 banner `R-M-20492584-3`, displayed only on menu and between-wave upgrade screen, without covering buttons. Requires ad fill and active monetization in RSYA.
- Existing rewarded (`-1`) and interstitial (`-2`) placements unchanged.
