from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
import subprocess

OUT=Path(__file__).resolve().parents[1]/'games/fish2/assets/audio'
OUT.mkdir(parents=True,exist_ok=True)
SR=32000
rng=np.random.default_rng(27182)
def write(name,x,loop=False):
    if x.ndim==1: x=np.stack([x,x],axis=1)
    peak=max(.01,np.max(np.abs(x))); x=x/max(1,peak/0.89)
    if loop:
        n=SR//2
        # Crossfade the end into the start for a continuous soundscape.
        f=np.linspace(0,1,n)[:,None]
        x[:n]=x[-n:]*(1-f)+x[:n]*f
        x=x[:-n]
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-codec:a','libmp3lame','-b:a','128k',str(OUT/(name+'.mp3'))],input=x.astype('float32').tobytes(),check=True)
def filtered(n,lo,hi):
    return sosfilt(butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,n))
def score(winter=False):
    length=65.; x=np.zeros((int(length*SR),2))
    def note(start,midi,dur,amp,pan=.5,kind='piano'):
        f=440*2**((midi-69)/12); t=np.arange(int(dur*SR))/SR
        s=np.zeros(len(t))
        for h in range(1,9):
            decay=(1.7 if kind=='guitar' else 2.6)/(1+h*.19)
            s+=np.sin(2*np.pi*f*h*(1+h*h*.000045)*t+rng.random()*.05)*np.exp(-t/decay)/(h**1.8)
        s*=np.minimum(t/.012,1)*np.minimum((dur-t)/.15,1)*amp
        at=int(start*SR); n=min(len(s),len(x)-at)
        if n>0: x[at:at+n]+=s[:n,None]*np.array([np.cos(pan*np.pi/2),np.sin(pan*np.pi/2)])
    chords=[[48,55,60,64],[43,50,59,62],[45,52,60,64],[41,48,57,60]]
    melody=[76,None,74,72,67,None,71,74,72,None,69,67,69,72,76,None,
            79,None,76,74,71,None,67,62,64,67,72,None,69,67,64,None]
    for bar in range(16):
        chord=chords[bar%4]; base=bar*4
        note(base,chord[0]-12,4,.11,.5)
        for j in range(8):
            m=chord[[0,1,2,3,2,1,3,1][j]]+(12 if winter else 0)
            note(base+j*.5,m,3.8,.065 if winter else .09,.25+.5*(j%3)/2, 'piano' if winter else 'guitar')
        for j in range(2):
            m=melody[(bar*2+j)%len(melody)]
            if m: note(base+j*2+.045,m+(0 if winter else -12),4,.095,.52)
    # Soft stereo early reflections and longer diffuse echoes.
    dry=x.copy()
    for delay,gain in [(.079,.13),(.139,.11),(.271,.095),(.397,.065),(.619,.045)]:
        d=int(delay*SR); x[d:]+=dry[:-d,::-1]*gain
    x[:SR]*=np.linspace(0,1,SR)[:,None]; x[-SR:]*=np.linspace(1,0,SR)[:,None]
    write('winter' if winter else 'waterside',x)
score();score(True)
for kind in ['pond','river','sea','winterwind']:
    n=24*SR;t=np.arange(n)/SR
    a=filtered(n,65,900); b=filtered(n,900,4000)
    wave=(.5+.5*np.sin(t*(.8 if kind=='sea' else .37)))**2
    if kind=='sea': s=a*(.14+.42*wave)+b*(.014+.042*wave)
    elif kind=='river': s=a*.19+b*.027+filtered(n,220,1700)*(.04+.025*np.sin(t*2.3))
    elif kind=='winterwind': s=filtered(n,100,450)*(.10+.09*wave)
    else:
        s=a*.07+b*.008
        for at in [1.1,4.3,8.8,13.7,17.1,21.2]:
            d=.44;tt=np.arange(int(SR*d))/SR
            chirp=np.sin(2*np.pi*(2400*tt+330*np.sin(tt*19)*tt))*np.sin(np.pi*tt/d)**2*.018
            k=int(at*SR);s[k:k+len(chirp)]+=chirp
    stereo=np.stack([s,np.roll(s,113)],axis=1)
    write(kind,stereo,True)
for kind,dur in [('cast',.55),('splash',.85),('nibble',.19),('take',.65),('strike',.32),('lose',.9),('catch',1.8),('click',.09),('reel',1.0),('drill',1.1)]:
    n=int(dur*SR);t=np.arange(n)/SR;s=np.zeros(n)
    if kind in ['cast','strike']: s=filtered(n,400,3800)*np.sin(np.pi*t/dur)**2*.3
    elif kind in ['splash','nibble']:
        s=filtered(n,170,2500)*np.exp(-t*7)*.45
        for j in range(8 if kind=='splash' else 2):
            at=.02+j*.035; tt=np.maximum(0,t-at);f=300+j*85
            s+=np.sin(2*np.pi*(f*tt-180*tt**2))*np.exp(-tt*35)*(t>=at)*.065
    elif kind in ['take','click']:
        for at in ([.0,.17,.34] if kind=='take' else [.0]):
            tt=np.maximum(0,t-at)
            s+=(np.sin(2*np.pi*1560*tt)+.3*np.sin(2*np.pi*2870*tt))*np.exp(-tt*30)*(t>=at)*.12
    elif kind=='catch':
        for j,f in enumerate([261.63,329.63,392,523.25]):
            tt=np.maximum(0,t-j*.14);s+=np.sin(2*np.pi*f*tt)*np.exp(-tt*3.8)*(t>=j*.14)*.12*np.minimum(tt/.01,1)
    elif kind=='lose':
        s=filtered(n,150,1600)*np.exp(-t*7)*.13
    elif kind=='reel':
        pulse=np.maximum(0,np.sin(2*np.pi*23*t))**18
        s=filtered(n,900,4500)*pulse*.27+np.sin(2*np.pi*155*t)*.009
    elif kind=='drill': s=filtered(n,70,1400)*(.2+.2*np.sin(2*np.pi*9*t))*np.sin(np.pi*t/dur)**.5
    fade=min(300,n//4);s[:fade]*=np.linspace(0,1,fade);s[-fade:]*=np.linspace(1,0,fade)
    write(kind,s)
print('Created',len(list(OUT.glob('*.mp3'))),'original audio tracks')
