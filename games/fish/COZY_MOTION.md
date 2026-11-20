# Cozy Motion (stage 7)

- Spinning-reel handle uses existing RodArt crank and slows naturally when player releases. No second reel or line added.
- Real rod tip responds to actual fight phase, fish velocity, and measured line tension. Tiny movement is capped to avoid wild visual oscillation.
- Surface-running wobblers and mice stay tied to the existing line endpoint and receive distinct retrieve/idle movements. Mid-water spoons, spinners, and deep jigs remain underwater; only their subtle real surface displacement appears when the tackle is moving.
- Removed duplicate V-shaped fish wake: original scene already drew one. Near-shore rings remain.
- Corrected a latent ReferenceError in snag/fish-escaping-to-weeds logic; fish edge class now belongs to Ecology.
- No modifications to catch probability, payout, ad frequency or saved user data.
- Run `node tests/test_cozy_motion.cjs`, `node tests/test_fishing_ecology.cjs`, browser capture and Android side-by-side preview.
