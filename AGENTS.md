# Codex engineering instructions — Fishing 1.2 complete visual rebuild

**READ FIRST:** [docs/CODEX_FISHING_1_2_MASTER_PROMPT.md](docs/CODEX_FISHING_1_2_MASTER_PROMPT.md). This is the authoritative handoff and acceptance checklist. All implementation work must follow it.

## Repository boundary
- Monorepo: `ff3f1/crystal-games`. Work on `games/fish/**`, relevant shared Android build wrapper `android/**`, dedicated `tests/test_fish.py`, and CI only when necessary. Preserve `games/block` and `games/path`.
- Base branch is `full-realism-1.2` (PR #5), currently functional but visually substandard. This branch `codex-full-realism-handoff` exists to start Codex work with the full task in-tree. Do not merge into `main` or publish to RuStore before owner's playtest approval.
- Android package `ru.crystalgames.fishing`; maintain signing, versionCode continuity and safe migration of saved data.
- Preserve at least **62 species**, **20 waters**, four seasons, float/feeder/spinning/ice fishing, marine fishing, expeditions, contracts, gear, economy, journal, achievements and existing player progress.

## Absolutely required
- Implement *real interactive photorealistic graphics*, NOT a promotional mockup, CSS recolor, or swapping in a single screenshot/photo.
- Each of 62 species must have correct anatomy, a sharp species-specific high-resolution catch asset and suitable LOD/animation. Existing `fish/realism_atlas.webp` is **480×304 total**, cropped to **120×76** for each of 16 species — unacceptable. Replace it. Remove `assetAlias` / recolored-fish stand-ins.
- All 20 waters must be convincingly differentiated and react to weather, seasons, time and play; render water physics, line, float, rod, hands, fish struggle and catch celebration convincingly.
- Test real game screenshots and Android performance, verify crash-free play and no loss of save data on upgrade from 1.2.66. Zero false claims about image quality, FPS, APK or achievements.
- User will provide visual reference assets from the archive `CODEX_FISHING_FULL_REALISM_HANDOFF.zip`: `reference/CONCEPT_TARGET.png` is **concept only**, `reference/CURRENT_GAME_1_2_66.jpg` is **real old gameplay**. Compare real new game to both; never claim the concept is captured gameplay.
- Run Playwright and signed Android builds; deliver PR, working APK/AAB, genuine screenshots, test logs and honest RuStore release notes. Do not publish/store-release without the user's approval.

## Execution style
Do the actual coding, assets, rendering and testing. Do not stop at writing another plan or a single beautiful scene. Work autonomously, avoid unnecessary confirmation questions, share meaningful build/test evidence, and do not label partial intermediate work as a complete release.
