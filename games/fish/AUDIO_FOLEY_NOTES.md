# Fishing sampled Foley and new music (2026-11-21)

Current implementation lives on branch `codex/fishing-overhaul`, in
`games/fish/js/audio.js`, `games/fish/js/foley-bank.js`, and `assets/assets.js`.

## Foley from user-supplied Beneath the Frozen Surface

Audio is a short **embedded** Ogg/Opus bank (about 6 KB). It requires no
extra runtime asset. Cues:

| Event | Source seconds | In-game use |
| --- | --- | --- |
| reel_tick | 3.00–3.34 | reel, rate follows winding speed |
| drag_click | 18.50–18.99 | low-tension line slip |
| drag_rattle | 31.93–32.86 | moderate drag slip |
| drag_strain | 58.70–59.54 | heavy drag slip |
| line_snap | 79.72–80.18 | line break |

All cues have short anti-click fades and low-frequency cleanup. A sample
decoder failure falls back to the original procedural WebAudio effects.
Multiple drag events are rate limited to prevent an overlapping buzz.

**Do not treat these audio picks as final until they have been listened
to in gameplay on a real phone.** The originals contain repeated material.

## Optional music pack

Two external MP3s (112 kb/s, normalized to -19 LUFS) are prepared, but **not
committed into the repository yet**:

- `games/fish/assets/audio/music_wooden_docks.mp3` — spring / summer
- `games/fish/assets/audio/music_still_water.mp3` — autumn / night

The mapping already exists in `assets/assets.js`. If a custom file is absent,
`audio.js` automatically retries the pre-existing seasonal music.
Winter retains the existing winter track.

**Required before music release:** copy the two supplied MP3s to the paths
above on this working branch, verify browser/Android audio playback and
run `node tests/test_fish_foley.cjs` and existing gameplay tests.

Original user files: `Beneath_the_Frozen_Surface(1).mp3`,
`Wooden_Docks_at_Dawn(1).mp3`, `Still_Water_Ritual(1).mp3`.

No APK/AAB build or RuStore release is implied by this change.
