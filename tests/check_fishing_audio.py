"""Check decode, headroom and silent tails of the packaged one-shot foley."""
import array
import math
import subprocess
import sys
from pathlib import Path

root=Path('games/fish/assets/audio/renewal')
effects=['click','cast','plop','splash','flop','bite','strike','snap','reel','drag','drill','birds']
for name in effects:
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/(name+'.mp3')),
                                 '-f','f32le','-ac','1','-ar','16000','pipe:1'])
    samples=array.array('f');samples.frombytes(raw)
    if sys.byteorder!='little':samples.byteswap()
    assert samples and all(math.isfinite(x) for x in samples),name+' contains invalid samples'
    peak=max(abs(x) for x in samples)
    tail=math.sqrt(sum(x*x for x in samples[-480:])/480)
    assert .005<peak<.90,(name,'peak',peak)
    assert tail<.0003,(name,'tail RMS',tail)
for name in ['dawn','winter','night']:
    seconds=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration',
                                            '-of','default=noprint_wrappers=1:nokey=1',str(root/(name+'.mp3'))]))
    assert seconds>70,(name,seconds)
print('PASS 12 decodable authored effects with headroom and quiet tails; three full-length music tracks')
