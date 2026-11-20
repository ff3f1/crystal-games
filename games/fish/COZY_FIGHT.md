# Cozy Fight — staged fighting and trophy polish

Targets: current original-version lineage 2.0.1, branch `feature/cozy-lodge-menu`.

## Changes
- Actual hooked fish positions create short V wakes driven by velocity and surface state.
- Near-shore fish make subtle double ripples only when their actual depth/surface state calls for it.
- Net landing creates quiet water rings tied to the existing landing progress.
- Catch card uses warm wood/brass tones, a small club seal, soft fish shadow and button feedback.
- No gameplay timeouts, random bite events, ad methods, collision, saves, physics or prize calculations changed.
- Drawing is lightweight: two strokes per wake, max two ellipses per ring; no new audio and no perpetual timers.

## Manual QA
1. Fight with small and large fish. Rips follow fish motion, no wake on empty water.
2. Jump: existing splash remains; no V ripple in midair.
3. Winter hole: no summer water wake.
4. Net: rings only during lift; no screen clipping at 320×568.
5. Catch panel: normal, new species, record, trophy and mandatory release.
6. All actions (keep, release, share, double after confirmed reward) still work; test old 1.0.10 save.
7. Test reduced motion, sound disabled, ad pause, background/resume.

No Android APK is claimed; code-only integration with test script.
