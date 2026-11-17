"""Reproducible original scores; no external recordings or samples. Python + numpy + ffmpeg."""
from pathlib import Path
import math, wave, subprocess
import numpy as np
ROOT=Path(__file__).resolve().parents[1]/'app/src/main/assets/assets'
SR=22050

def note(midi, duration, amplitude=.15, style='bell'):
    t=np.arange(int(duration*SR))/SR
    f=440*2**((midi-69)/12)
    env=np.minimum(t/.025,1)*np.minimum((duration-t)/.15,1)
    if style=='bell':
        env*=np.exp(-t*2.0)
        y=np.sin(2*np.pi*f*t)+.25*np.sin(2*np.pi*f*2.003*t)+.08*np.sin(2*np.pi*f*3*t)
    else:
        env*=np.sin(np.pi*np.minimum(t/duration,1))**.6
        y=np.sin(2*np.pi*f*t)+.16*np.sin(2*np.pi*f*2*t)+.05*np.sin(2*np.pi*f*3*t)
    return amplitude*env*y

def wav(path,data):
    data=np.clip(data,-.95,.95)
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
        if data.ndim==1:data=np.column_stack([data,data])
        w.writeframes((data*32767).astype('<i2').tobytes())

def score(name,chords,melody,bpm):
    beat=60/bpm;length=beat*64
    y=np.zeros((int(length*SR),2))
    def add(midi,start,duration,amp,style,pan=0):
        n=note(midi,duration,amp,style);i=int(start*SR);n=n[:len(y)-i]
        if len(n)>0:
            y[i:i+len(n),0]+=n*(.7-pan*.25);y[i:i+len(n),1]+=n*(.7+pan*.25)
    for bar in range(16):
        chord=chords[bar%len(chords)];t=bar*4*beat
        for j,m in enumerate(chord):add(m,t,beat*3.9,.042,'pad',(j-1)/2)
        add(chord[0]-12,t,beat*3.5,.05,'pad')
        for k in range(4):
            m=melody[(bar*4+k)%len(melody)]
            if m:add(m,t+k*beat,beat*1.6,.07,'bell',math.sin(bar+k)*.7)
    # Discrete stereo echoes, wrapped to preserve loop continuity.
    for secs,gain in [(.26,.13),(.53,.06)]:y+=np.roll(y,int(secs*SR),axis=0)*gain
    fade=int(.3*SR);y[:fade]*=np.linspace(0,1,fade)[:,None];y[-fade:]*=np.linspace(1,0,fade)[:,None]
    y*=.72/max(.72,np.max(np.abs(y)))
    tmp=ROOT/(name+'.wav');wav(tmp,y)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(tmp),'-c:a','libvorbis','-q:a','4',str(ROOT/(name+'.ogg'))],check=True);tmp.unlink()

score('haven',[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]],[76,0,79,72,74,0,72,67,69,72,0,76,74,71,0,67],78)
score('focus',[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,61]],[74,77,81,0,77,74,0,69,70,74,77,0,76,72,69,0],90)
score('dawn',[[53,60,65,69],[48,55,60,64],[50,57,62,65],[46,53,58,62]],[81,79,77,0,76,79,84,0,81,77,74,0,77,74,70,0],84)
for name,notes in {'tap':[81], 'reward':[72,76,79], 'level':[60,64,67,72,76,79,84]}.items():
    size=2.4 if name=='level' else 1.2;y=np.zeros(int(size*SR))
    for i,m in enumerate(notes):
        n=note(m,.9,.15 if name!='tap' else .06);start=int(i*.12*SR);n=n[:len(y)-start];y[start:start+len(n)]+=n
    wav(ROOT/(name+'.wav'),y)
print('Created 3 original scores and 3 effects.')
