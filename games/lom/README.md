# ЛОМ / ЦЕПЬ — Android 3.2
Physics-driven HTML5 arcade for touch-screen Android and desktop keyboard/mouse. GitHub Actions builds the Android WebView wrapper already present in this repository.

## What is implemented
- True top-down tracked vehicle sprite, rotation in the direction of movement
- Multitouch virtual joystick + release-to-smash trigger; desktop WASD/arrows, Space/right-mouse, Esc, 1-3 shortcuts, and gamepad support
- Original adaptive WebAudio engine, chain friction, metallic impacts, enemy weapons, explosions and procedural score, adjustable music/SFX/volume
- Directional warning telegraphs for ramming enemies and magnetic boss
- Ground contact shadows and track/dust decals
- Impulse-based flail/chain mechanics, particle hit FX, shockwave decals and camera recoil
- Persistent garage upgrades, wave rewards and boss fights
- Yandex Mobile Ads bridge via existing android/app/src/main/java/ru/crystalgames/shell/MainActivity.java
- Rewarded bonus is awarded only after __adResult(id, true) from the native SDK; interstitials are between runs

## Package and ads
App ID: ru.crystalgames.lomcep
Version: 3.2.0 (1)
CI uses demo ad block IDs unless GitHub Actions repository variables LOM_AD_INTER and LOM_AD_REWARD are configured with UNIQUE IDs created for this application.
Existing ad units for block/path/fish MUST NOT be reused.

The CI workflow is isolated to feat/lom-cep-android; main is unchanged. Artifacts: debug APK, release APK and AAB. Release is valid for RuStore only if the repo's signing secrets match the intended signing key. Real-device QA, privacy disclosure update and store review are still required.
