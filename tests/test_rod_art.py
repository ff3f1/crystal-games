"""The four complete tackle images must remain integrated, transparent and loadable."""
import pathlib,xml.etree.ElementTree as ET,re
root=pathlib.Path(__file__).resolve().parents[1]
rod=root/"games/fish/assets/equipment/complete"
for mode in ("float","feeder","spin","ice"):
 p=rod/(mode+".svg")
 assert p.exists(),p
 tree=ET.parse(p).getroot()
 assert tree.attrib["viewBox"]=="0 0 1440 300",mode
 assert len(list(tree.iter()))>=35,mode
 assert any("reel" in (e.attrib.get("id") or "") for e in tree.iter()) or any(e.tag.endswith("ellipse") for e in tree.iter()),mode
html=(root/"games/fish/index.html").read_text()
assert 'src="js/rod-art.js"' in html
js=(root/"games/fish/js/worldgl.js").read_text()
assert "assets/equipment/complete/" in js
assert "const meshes=[],guides=[]" not in js
assert "gripSprite" not in js and "ferrule" not in js
assert "jointOverlap:" not in js
scene=(root/"games/fish/js/scene.js").read_text()
assert "FZ.RodArt.draw" in scene and "rodPoly" not in scene
art=(root/"games/fish/js/rod-art.js").read_text()
assert all(m+':{' in art for m in ('float','feeder','spin','ice'))
print("PASS four complete rod SVGs; WebGL and Canvas integrated render paths")
