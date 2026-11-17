"""Original, deterministic one-shot foley. Render to MP3; no recorded sample dependencies."""
from pathlib import Path
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = Path('games/fish/assets/audio/renewal')
RNG = np.random.default_rng(20261117)


def render(name, duration, layers):
    length = int((duration + .12) * SR)
    mix = np.zeros((length, 2), dtype=np.float64)
    def put(signal, start, gain=.3, pan=.5):
        start = int(start * SR)
        count = min(len(signal), length - start)
        if count > 0:
            mix[start:start+count] += signal[:count, None] * gain * [np.cos(pan*np.pi/2), np.sin(pan*np.pi/2)]
    def burst(seconds, lo, hi, decay, attack=.004):
        t = np.arange(int(seconds*SR)) / SR
        sos = butter(3, [lo, hi], btype='bandpass', fs=SR, output='sos')
        noise = sosfilt(sos, RNG.standard_normal(len(t)))
        noise /= max(.01, np.max(np.abs(noise)))
        return noise * np.minimum(1, t/attack) * np.exp(-t*decay)
    def tone(freq, seconds, decay, sweep=0, attack=.002):
        t = np.arange(int(seconds*SR)) / SR
        return np.sin(2*np.pi*(freq*t + sweep*t*t/2)) * np.minimum(1,t/attack) * np.exp(-decay*t)
    layers(put, burst, tone)
    # Each sound has silence after its tail, avoiding a click or looping hiss.
    peak = np.max(np.abs(mix))
    if peak: mix *= min(1, .25/peak)
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0',
                    '-c:a','libmp3lame','-b:a','160k',str(OUT/(name+'.mp3'))],
                   input=mix.astype('<f4').tobytes(),check=True)


def click(put,b,t):
    put(b(.075,250,2300,65),0,.4); put(t(730,.07,70),0,.12)

def cast(put,b,t):
    # Brief, soft arc through the air with two quiet mechanical ticks.
    put(b(.38,300,3300,8,attack=.055),0,.17,.35)
    for i in range(3): put(b(.035,900,3900,95),.07+i*.095,.08,.42+i*.08)

def drops(put,b,t,start=0,amount=1):
    for i in range(round(8*amount)):
        at=start+.035+i*.043; f=370+(i*193)%1100
        put(t(f,.18,23,sweep=-f*.3),at,.045/(1+i*.12),.18+(i%5)*.16)

def plop(put,b,t):
    put(b(.14,130,2600,28),0,.18);put(t(185,.27,15,sweep=-160),0,.19);drops(put,b,t,.02,.65)

def splash(put,b,t):
    put(b(.24,180,4100,18,attack=.008),0,.28);put(t(145,.3,12,sweep=-80),.008,.13);drops(put,b,t,.01,1)

def flop(put,b,t):
    put(b(.12,120,2100,29),0,.24);put(t(105,.19,24),0,.15);drops(put,b,t,.015,.5)

def bite(put,b,t):
    for at in (0,.13):
        put(b(.045,350,2500,80),at,.1);put(t(690,.09,32),at,.07)

def strike(put,b,t):
    put(b(.18,250,3200,17,attack=.015),0,.19,.35);put(t(230,.13,27,sweep=-80),.01,.06)

def snap(put,b,t):
    put(b(.07,450,6200,60),0,.30);put(t(245,.12,31,sweep=-190),0,.12)

def reel(put,b,t):
    for i in range(3):
        put(b(.023,650,3500,150),i*.035,.12,.45+i*.04);put(t(480,.03,110),i*.035,.035)

def drag(put,b,t):
    for i in range(5):put(b(.028,500,3100,115),i*.031,.11,.4+i*.05)

def drill(put,b,t):
    for i in range(12):
        put(b(.16,180,2200,19,attack=.015),i*.095,.075,.3+(i%4)*.12)
        put(t(95+i%3*14,.13,23),i*.095,.035)

def birds(put,b,t):
    # Short whistled phrases with varying pitch and pauses, without a noise bed.
    for i,(at,f) in enumerate(((0,2210),(.14,2490),(.31,2150),(.68,2370),(.82,2630))):
        put(t(f,.15,9,sweep=(750 if i%2==0 else -1000),attack=.015),at,.08,.36+i*.06)
        put(t(f*2,.11,24,sweep=800,attack=.012),at,.006,.36+i*.06)

for name,duration,fn in [('click',.12,click),('cast',.48,cast),('plop',.52,plop),('splash',.68,splash),
                         ('flop',.42,flop),('bite',.27,bite),('strike',.25,strike),('snap',.18,snap),
                         ('reel',.13,reel),('drag',.19,drag),('drill',1.4,drill),('birds',1.05,birds)]:
    render(name,duration,fn)
