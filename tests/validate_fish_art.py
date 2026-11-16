"""Asset release gate: real dimensions, provenance, all species/seasons, no aliases."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / 'games/fish/assets'
text = (A / 'assets.js').read_text()
manifest = json.loads(text[text.index('{'):text.rindex('}') + 1])
profiles = set(re.findall(r'\b([a-z]+):\[', (ROOT / 'games/fish/js/fish3d.js').read_text()))
provenance = json.loads((A / 'FISH_ART.json').read_text())
assert len(profiles) == 62, len(profiles)
assert set(provenance) == profiles, profiles ^ set(provenance)
hashes = set()
for species in sorted(profiles):
    path = A / manifest['images']['fishhd/' + species]
    info = provenance[species]
    with Image.open(path) as image:
        assert image.width >= 1600, (species, image.size)
        assert list(image.size) == info['native_size'], species
        assert image.mode == 'RGBA' and image.getchannel('A').getextrema() == (0, 255), species
        assert not info['upscaled'], species
        bbox = image.getchannel('A').getbbox()
        assert bbox and bbox[2] - bbox[0] > 1000, (species, bbox)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == info['output_sha256'], species
    assert digest not in hashes, f'duplicated species image: {species}'
    hashes.add(digest)
    for suffix in ['', '_sil']:
        with Image.open(A / 'fish-thumb' / f'{species}{suffix}.webp') as image:
            assert image.width <= 384 and image.getchannel('A').getextrema() == (0, 255), species
assert not any(k.startswith('fish/') for k in manifest['images'])
assert 'assetAlias' not in (ROOT / 'games/fish/js/realism12.js').read_text()
scenes = {k: v for k, v in manifest['images'].items() if k.startswith('bg/')}
assert len(scenes) == 80, len(scenes)
scene_hashes = set()
for key, file in scenes.items():
    with Image.open(A / file) as image:
        assert image.width >= 900 and image.height >= 500, (key, image.size)
    assert 0.2 <= manifest['tuning']['waterline'].get(key,.97) <= 1, key
    digest = hashlib.sha256((A / file).read_bytes()).hexdigest()
    # Legacy scene duplicates remain a tracked art limitation.
    scene_hashes.add(digest)
bases={k:v for k,v in manifest['images'].items() if k.startswith('base/')}
assert len(bases)==20,len(bases)
seen=set()
for key,file in bases.items():
    with Image.open(A/file) as im:
        assert im.size==(1122,1402),(key,im.size)
        digest=hashlib.sha256(im.convert('RGB').tobytes()).hexdigest()
        assert digest not in seen,key
        seen.add(digest)
print(f'PASS: {len(profiles)} original HD portraits, 124 thumbnails, 80 seasonal fallback slots + 19 approved portrait bases; no aliases or upscaling.')
