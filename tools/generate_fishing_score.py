"""Original quiet fishing score, synthesized without external recordings or a noise bed."""
from pathlib import Path
import subprocess
import numpy as np

SR=32000
OUT=Path('games/fish/assets/audio/renewal')
CHORDS=[[48,55,59,64],[43,50,55,59],[45,52,55,60],[41,48,53,57],
        [38,45,53,57],[43,50,55,60],[40,47,55,59],[48,55,59,64]]
MELODY=[[76,74,72,None,71,72,None,67],[74,None,71,67,None,69,71,None],
        [72,76,79,None,76,74,72,None],[69,None,72,76,74,72,None,69],
        [69,72,74,None,77,76,None,74],[74,None,72,71,67,69,71,None],
        [71,74,76,None,74,71,67,None],[72,None,67,71,72,None,None,None]]


def score(name, tempo, instrument, sparse=False):
    beat=60/tempo; bars=24; tail=2.0; duration=bars*4*beat+tail
    mix=np.zeros((int(SR*duration),2),dtype=np.float32)
    def note(at,midi,dur,amp,pan):
        t=np.arange(int(dur*SR),dtype=np.float64)/SR
        f=440*2**((midi-69)/12); s=np.zeros_like(t)
        # The high partials fade faster than the fundamental, like a struck string.
        for h in range(1,8):
            rate=(.36+h*.35) if instrument=='piano' else (.52+h*.48)
            partial=np.sin(2*np.pi*f*h*(1+h*h*.000035)*t)
            s+=partial*np.exp(-t*rate)/(h**(1.65 if instrument=='piano' else 1.8))
        s*=np.minimum(t/.018,1)*np.minimum((dur-t)/.16,1)*amp
        start=int(at*SR);end=min(start+len(s),len(mix));s=s[:end-start]
        if end>start:mix[start:end,0]+=s*np.cos(pan*np.pi/2);mix[start:end,1]+=s*np.sin(pan*np.pi/2)
    for bar in range(bars):
        chord=CHORDS[bar%8];base=bar*4*beat;section=bar//8
        note(base,chord[0]-12,beat*4.2,.055,.49)
        if not sparse:
            pat=[0,1,2,3,2,1,3,1] if instrument=='guitar' else [0,2,1,3,2,1,2,3]
            for j,k in enumerate(pat):
                if section==0 and j in (3,7):continue
                note(base+j*.5*beat,chord[k]+(12 if instrument=='piano' else 0),beat*2.6,.027,.28+.1*(j%5))
        else:
            for j,k in enumerate([0,2,1,3]):note(base+j*beat,chord[k],beat*3,.019,.30+.13*j)
        for j,m in enumerate(MELODY[bar%8]):
            if m is None or (sparse and j%2) or (section==0 and j in (1,4)):continue
            shift=-12 if instrument=='guitar' else (0 if instrument=='piano' else -12)
            note(base+j*.5*beat+.025,m+shift,beat*2.5,.036 if not sparse else .027,.55)
    dry=mix.copy()
    for delay,gain in [(.083,.14),(.171,.10),(.293,.075),(.457,.045)]:
        d=int(delay*SR);mix[d:]+=dry[:-d,::-1]*gain
    fade=int(SR*1.1);mix[:fade]*=np.linspace(0,1,fade)[:,None];mix[-fade:]*=np.linspace(1,0,fade)[:,None]
    peak=float(np.max(np.abs(mix)));mix*=.32/max(peak,.001)
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0',
                    '-codec:a','libmp3lame','-b:a','128k',str(OUT/(name+'.mp3'))],input=mix.astype('<f4').tobytes(),check=True)
    print(name, round(duration,1), 'seconds, peak', round(peak,3))

for args in [('dawn',74,'guitar',False),('winter',68,'piano',False),('night',62,'piano',True)]:score(*args)
