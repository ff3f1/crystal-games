# Cozy Realistic Art — review-only staging

Working branch: feature/cozy-realistic-art-review. No APK is assembled until the owner approves the real game screenshots.

Why: the 2.0.1 repo already includes high-detail isolated equipment PNG/WebP files. The previous Cozy UI layer replaced these with low-detail procedural SVG sprites. This branch restores the realistic existing artwork across the 14 rods, 8 lines, 5 hooks, 23 bait/lure variants and the float choices.

Scope: Artwork paths and CSS readability only. No catch logic, physics, saved data, purchases, ads or analytics changes. Existing art is reused; sea/winter/tier-specific models may share photo families until their bespoke premium replacements are approved.

Test: launch the real games/fish/index.html in Chromium; inspect lure, rod, line, hook, bait, tackle screens. Screenshot through tests/capture_cozy_real_art.cjs. Only browser screenshots produced from this branch; no Android build workflow here.

Review correction: all 14 rods now use existing native-transparent HD complete-rod assets by category (float, feeder, spinning, ice), avoiding the unwanted rectangular source-photo background. Minor detached speck in old hammered spoon PNG is hidden in UI with CSS clipping, leaving actual lure untouched. Individual tier model renders remain a future art pass.
