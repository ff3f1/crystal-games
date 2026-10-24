import struct, os, sys
exe, out = sys.argv[1], sys.argv[2]
f=open(exe,'rb'); f.seek(0,2); size=f.tell()
f.seek(size-12); psize,magic=struct.unpack('<Q4s',f.read(12))
start=size-12-psize
f.seek(start); assert f.read(4)==b'GDPC'
ver,maj,mi,pa,flags=struct.unpack('<5I',f.read(20))
file_base,dir_off=struct.unpack('<QQ',f.read(16))
file_base+=start; dir_off+=start
f.seek(dir_off); n=struct.unpack('<I',f.read(4))[0]
ents=[]
for i in range(n):
    sl=struct.unpack('<I',f.read(4))[0]; p=f.read(sl).decode('utf-8').rstrip('\0')
    ofs,sz=struct.unpack('<QQ',f.read(16)); md5=f.read(16); fl=struct.unpack('<I',f.read(4))[0]
    ents.append((p,ofs,sz,fl))
for p,ofs,sz,fl in ents:
    rp=p.replace('res://','')
    dst=os.path.join(out,rp); os.makedirs(os.path.dirname(dst),exist_ok=True)
    f.seek(file_base+ofs); open(dst,'wb').write(f.read(sz))
print(n,'files')
