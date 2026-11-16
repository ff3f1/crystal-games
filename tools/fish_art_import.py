#!/usr/bin/env python3
"""Import native transparent originals; never upscale or slice an atlas.

python tools/fish_art_import.py paths.json
paths.json maps immutable species IDs to generated PNG paths.
The original PNGs remain in the image library; shipped WebPs preserve native size.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'games/fish/assets'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def defringe(image):
    """Bleed nearby opaque RGB into translucent edges without eroding alpha/fins."""
    import numpy as np
    from scipy.ndimage import distance_transform_edt
    pixels=np.array(image)
    opaque=pixels[:,:,3]>=245
    distance,indices=distance_transform_edt(~opaque,return_indices=True)
    edge=(pixels[:,:,3]<245)&(distance<=4)
    near=pixels[indices[0],indices[1],:3]
    strength=(1-pixels[:,:,3].astype(float)/255)*edge
    pixels[:,:,:3]=np.rint(pixels[:,:,:3]*(1-strength[:,:,None])+near*strength[:,:,None]).astype('uint8')
    return Image.fromarray(pixels,'RGBA')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    args = parser.parse_args()
    inputs = json.loads(args.manifest.read_text())
    provenance_file = ASSETS / 'FISH_ART.json'
    provenance = json.loads(provenance_file.read_text()) if provenance_file.exists() else {}
    (ASSETS / 'fish-hd').mkdir(exist_ok=True)
    (ASSETS / 'fish-thumb').mkdir(exist_ok=True)
    for species, filename in sorted(inputs.items()):
        source = Path(filename)
        source_hash = digest(source)
        if provenance.get(species, {}).get('source_sha256') == source_hash and provenance.get(species, {}).get('edge_pipeline') == 1:
            continue
        image = Image.open(source).convert('RGBA')
        if image.width < 1600 or image.getchannel('A').getextrema() != (0, 255):
            raise ValueError(f'{species}: requires native 1600px+ art and genuine alpha: {image.size}')
        hd = ASSETS / 'fish-hd' / f'{species}.webp'
        image = defringe(image)
        image.save(hd, quality=92, method=3)
        native = list(image.size)
        bbox = image.getchannel('A').getbbox()
        image.thumbnail((384, 256), Image.Resampling.LANCZOS)
        image.save(ASSETS / 'fish-thumb' / f'{species}.webp', quality=88, method=3)
        silhouette = Image.new('RGBA', image.size, (16, 27, 28, 255))
        silhouette.putalpha(image.getchannel('A'))
        silhouette.save(ASSETS / 'fish-thumb' / f'{species}_sil.webp', lossless=True)
        provenance[species] = {
            'kind': ('user-supplied game artwork' if '/incoming/' in str(source) else 'original AI-generated game artwork') + ', not a gameplay screenshot',
            'source_id': source.stem,
            'source_sha256': source_hash,
            'native_size': native,
            'alpha_bbox': bbox,
            'upscaled': False,
            'edge_pipeline': 1,
            'output_sha256': digest(hd),
        }
    provenance_file.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    mf = ASSETS / 'assets.js'
    text = mf.read_text()
    data = json.loads(text[text.index('{'):text.rindex('}') + 1])
    # Retire all atlas and old low-resolution portrait entries permanently.
    data['images'] = {k: v for k, v in data['images'].items() if not k.startswith('fish/')}
    for species in provenance:
        data['images']['fishhd/' + species] = f'fish-hd/{species}.webp'
    mf.write_text('/* Bundled art manifest. HD portraits are loaded on demand. */\nwindow.FZ_ASSETS = ' +
                  json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
    print(f'Imported {len(provenance)} native portraits; independent UI thumbnails; no upscaling.')


if __name__ == '__main__':
    main()
