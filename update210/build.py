import hashlib
import struct
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from tempfile import TemporaryDirectory

here = Path(__file__).resolve().parent
source, dest = map(Path, sys.argv[1:])
assert hashlib.sha256(source.read_bytes()).hexdigest() == '52f412d1edbd76bad83414e891179fecbf84046b6449a2926724d5231b23c527'
with TemporaryDirectory() as tmp, ZipFile(source) as original:
    root = Path(tmp)
    for name in original.namelist():
        if name.startswith('assets/'):
            original.extract(name,root)
    subprocess.run(['patch','-s','-p1','-i',str(here/'game.patch')],cwd=root/'assets',check=True)
    (root/'assets/assets/scenes/below.webp').write_bytes((here/'below.webp').read_bytes())
    manifest = original.read('AndroidManifest.xml')
    for old,new in [('2.0.2'.encode('utf-16le'),'2.1.0'.encode('utf-16le')),(struct.pack('<I',2002),struct.pack('<I',2100))]:
        assert manifest.count(old)==1
        manifest=manifest.replace(old,new)
    with ZipFile(dest,'w') as output:
        for entry in original.infolist():
            n=entry.filename
            if n.startswith('META-INF/') and n.upper().endswith(('.RSA','.SF','.DSA','.EC','MANIFEST.MF')): continue
            data = manifest if n=='AndroidManifest.xml' else (root/n).read_bytes() if n.startswith('assets/') else original.read(n)
            output.writestr(entry,data)
        for f in sorted((root/'assets').rglob('*')):
            n=f.relative_to(root).as_posix()
            if f.is_file() and n not in original.NameToInfo: output.write(f,n,ZIP_DEFLATED)
