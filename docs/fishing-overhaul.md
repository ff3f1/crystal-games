# Fishing overhaul candidate

Based on full-realism-1.2 at 76157f9. Package, save key, species IDs,
locations, economy, expeditions and contracts remain unchanged.

The world uses a bundled Three.js renderer: lit tackle geometry, continuous
wind/ripple/reflection shading and the existing gameplay projection. Fish use
native transparent artwork on a continuously deformed relief mesh. They are
2.5D artwork, not fully sculpted 3D fish. There are no atlas slices or color aliases
in this rendering route. One shared portrait context and separate prebuilt
thumbnails keep the atlas from compiling 62 scenes on a phone.

All 40 uploaded fish supplement the 22 originals already saved. Uploaded images
were checked for native dimensions and actual alpha; some anatomy and patterns
still need expert review (notably salmon and the similar northern whitefish).
This is not a claim of biological or photographic ground truth.

Only pond_summer is a newly supplied environment. The other 79 seasonal slots
retain legacy art; several have composition/geographic/season problems recorded
in the original handoff. They have NOT been upgraded merely by changing shaders.

Five uploaded material maps are bound to tackle surfaces; wet_wood is imported
for a future wooden surface. No new asset generation was requested or used
while integrating the six uploaded archives.

Gameplay adds a visible burst warning, pressure-dependent fatigue and phase/
steering feedback. Sound has a periodic noise crossfade, lower water modulation,
softer reel/drag timbres and separate saved ambient/effect/music gains.

Release gate validates 62 distinct native alpha portraits, provenance hashes,
thumbnails and availability of all 80 scene slots. It does not certify the 79
legacy environments as final art. Browser tests do not certify Android FPS,
speaker quality or an on-device upgrade installation.

The isolated candidate workflow builds only fishing and requires the existing
release signing key. It does not deploy, merge main, publish RuStore or write
builds. Confirm certificate and save survival on a real 1.2.66 installation
before accepting a production release.
