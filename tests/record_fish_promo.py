"""Record a real 31-second, vertical Fish gameplay session with original WebAudio.
This is a staged playthrough of production game code, not a slideshow or mock render.
Requires: playwright, Pillow, ffmpeg, ffprobe. Output includes validation evidence.
"""
import base64
import functools
from fractions import Fraction
import http.server
import json
import pathlib
import shutil
import subprocess
import sys
import threading
import time
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "promo-output").resolve()
OUT.mkdir(parents=True, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def cmd(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Command failed: " + " ".join(args) + "\n" + result.stderr[-4000:])
    return result.stdout

srv = http.server.ThreadingHTTPServer(
    ("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT / "games"))
)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/fish/" % srv.server_port
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    context = browser.new_context(
        viewport={"width": 540, "height": 960},
        device_scale_factor=1,
    )
    # Capture the actual game compressor output, before browser speakers, not
    # a manufactured audio bed. No copyrighted background music is recorded.
    context.add_init_script("""(() => {
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function(target, ...args) {
        const result = connect.call(this, target, ...args);
        if (target === this.context.destination && !window.__fishAudioStream) {
          const output = this.context.createMediaStreamDestination();
          connect.call(this, output);
          window.__fishAudioStream = output.stream;
        }
        return result;
      };
    })();""")
    page_created = time.monotonic()
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_function("window.__game && document.querySelector('#mGo')", timeout=60000)
    page.click("#mGo")
    page.evaluate("""() => {
      const G=__game.G,st=G.state();
      FZ.Sound.unlock(); FZ.Sound.setMusic(false);
      st.tut=4;
      st.rods.push('s2'); st.lines.push('l4'); st.lures.jig=3;
      st.load.spin={rod:'s2',line:'l4',hook:'h3',bait:'jig'};
      st.active='spin';
      G.startSession('pond','summer');
      G.sess().hour=13;G.sess().wx.sky='clear';
      G.biteTable=()=>[]; // Freeze random bites until the filmed bite sequence.
      __game.UI.refreshTools();
    }""")
    page.wait_for_function("FZ.Scene.graphicsInfo().renderer==='webgl' && !!FZ.Assets.bg('pond','summer')", timeout=30000)
    page.wait_for_timeout(600)
    page.evaluate("""() => {
      if (!window.__fishAudioStream) throw new Error('WebAudio stream is unavailable');
      window.__promoAudioChunks=[];
      const recorder=new MediaRecorder(window.__fishAudioStream,
        {mimeType:'audio/webm;codecs=opus'});
      recorder.ondataavailable=e=>{if(e.data.size)window.__promoAudioChunks.push(e.data);};
      recorder.start(1000);
      window.__promoAudioRecorder=recorder;
      // Capture the actual canvas instead of Playwright's throttled screencast.
      const cv=document.getElementById("cv");
      // Chrome's headless WebGL surface may not directly notify captureStream
      // after swaps. A visible 2D staging canvas emits genuine fresh frames.
      const stage=document.createElement("canvas");
      stage.width=cv.width;stage.height=cv.height;
      const staging=stage.getContext("2d",{alpha:false});
      const sampleVideo=()=>{
        staging.drawImage(cv,0,0,stage.width,stage.height);
        requestAnimationFrame(sampleVideo);
      };
      sampleVideo();
      window.__promoStagingCanvas=stage;
      const source=stage.captureStream(30);
      const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ?"video/webm;codecs=vp8":"video/webm";
      const videoRecorder=new MediaRecorder(source,{mimeType:mime,videoBitsPerSecond:4500000});
      window.__promoVideoChunks=[];
      videoRecorder.ondataavailable=e=>{if(e.data.size)window.__promoVideoChunks.push(e.data);};
      videoRecorder.start(1000);
      window.__promoVideoRecorder=videoRecorder;
      window.__promoFrameTimes=[];
      const sample=t=>{window.__promoFrameTimes.push(t);requestAnimationFrame(sample);};
      requestAnimationFrame(sample);
    }""")
    started = time.monotonic()
    trim = 0  # Canvas capture starts together with the audio recorder.

    def until(sec):
        remaining = sec - (time.monotonic() - started)
        if remaining > 0:
            page.wait_for_timeout(round(remaining * 1000))

    until(3.3)
    assert page.evaluate("__game.G.cast(0,27)"), "Cast did not start"
    until(5.5)
    page.evaluate("FZ.Input.actionDown('promo-reel')")
    page.mouse.move(135, 570)
    page.mouse.down()
    page.mouse.move(180, 545, steps=9)
    page.mouse.up()
    a0=page.evaluate("__game.G.rig().rod.reelAngle")
    until(7.3)
    a1=page.evaluate("__game.G.rig().rod.reelAngle")
    assert a1 > a0 + .5, ("The reel was not turning in the live renderer",
      a0,a1,page.evaluate("""() => ({state:__game.G.rig().state,
        mode:__game.G.sess().mode,action:FZ.Input.snapshot(),
        reeling:__game.G.rig().reeling,rate:__game.G.rig().rod.reelRate,
        range:__game.G.rig().Z,open:__game.UI.anyOpen()})"""))
    until(9.8)
    page.evaluate("FZ.Input.actionUp('promo-reel')")
    until(11.2)
    # Advance the ordinary tutorial bite condition; the real game generates
    # the bite and the normal strike/fight/catch mechanics remain in charge.
    page.evaluate("""() => {
      const G=__game.G,r=G.rig();
      G.state().tut=2;
      r.state='wait';r.idleT=3.1;
      G.update(1/60,G.sess().t+1/60);
    }""")
    page.wait_for_function("__game.G.rig().state==='bite'", timeout=6000)
    until(14.0)
    page.evaluate("""() => {
      const r=__game.G.rig();
      if(r.state!=='bite' || !r.bite) throw new Error('No genuine bite');
      r.bite.phase='take';r.bite.t=0;
    }""")
    until(14.4)
    page.evaluate("""() => {
      const G=__game.G,r=G.rig(),rand=FZ.U.rand;
      if(r.state!=='bite') throw new Error('Fish dropped the bite before strike');
      FZ.U.rand=Object.assign(()=>0,{range:rand.range,int:rand.int,pick:rand.pick,normal:rand.normal});
      try {G.strike();} finally {FZ.U.rand=rand;}
      if(r.state!=='fight') throw new Error('Strike did not hook the fish');
      G.state().tut=4;
    }""")
    page.evaluate("FZ.Input.actionDown('promo-fight')")
    until(19.8)
    page.evaluate("""() => {
      const r=__game.G.rig(),f=r.fish;
      // A quick catch may already be landing by this timestamp.
      if(r.state==='fight' && f){
        f.S=.03;f.Z=3.55;f.vz=-.2;f.vx=0;f.phase='tired';f.phaseT=2;
      }else if(!['landing','result'].includes(r.state)){
        throw new Error('Unexpected fight phase '+r.state);
      }
    }""")
    page.wait_for_function("['landing','result'].includes(__game.G.rig().state)", timeout=4000)
    page.evaluate("FZ.Input.actionUp('promo-fight')")
    until(25.8)
    page.wait_for_function("__game.G.rig().state==='result' && document.querySelector('#ovCatch.on')", timeout=5000)
    until(31.3)
    fps=page.evaluate("""() => {
      const stamps=window.__promoFrameTimes;
      const intervals=stamps.slice(1).map((t,i)=>t-stamps[i]);
      intervals.sort((a,b)=>a-b);
      return {frames:stamps.length,seconds:(stamps.at(-1)-stamps[0])/1000,
        medianFps:1000/intervals[Math.floor(intervals.length/2)],
        measuredFps:(stamps.length-1)*1000/(stamps.at(-1)-stamps[0])};
    }""")
    audio_b64=page.evaluate("""async () => {
      const r=window.__promoAudioRecorder;
      return new Promise((resolve,reject)=>{
        r.onerror=e=>reject(Error(String(e.error||e)));
        r.onstop=async ()=>{
          const blob=new Blob(window.__promoAudioChunks,{type:'audio/webm'});
          const data=new Uint8Array(await blob.arrayBuffer());
          if(data.length<2048)return reject(Error('Empty captured WebAudio'));
          let binary='';
          for(let i=0;i<data.length;i+=32768)
            binary+=String.fromCharCode(...data.slice(i,i+32768));
          resolve(btoa(binary));
        };
        r.stop();
      });
    }""")
    (OUT / "fish-game-audio.webm").write_bytes(base64.b64decode(audio_b64))
    video_b64=page.evaluate("""async () => {
      const recorder=window.__promoVideoRecorder;
      return new Promise((resolve,reject)=>{
        recorder.onerror=e=>reject(Error(String(e.error||e)));
        recorder.onstop=async ()=>{
          const blob=new Blob(window.__promoVideoChunks,{type:'video/webm'});
          const data=new Uint8Array(await blob.arrayBuffer());
          if(data.length<2048)return reject(Error('Empty captured canvas video'));
          let binary='';
          for(let i=0;i<data.length;i+=32768)
            binary+=String.fromCharCode(...data.slice(i,i+32768));
          resolve(btoa(binary));
        };
        recorder.stop();
      });
    }""")
    (OUT / "fish-gameplay-original.webm").write_bytes(base64.b64decode(video_b64))
    if errors:
        raise RuntimeError("Game JavaScript errors: " + " | ".join(errors[:8]))
    context.close()
    browser.close()


srv.shutdown()

captions = """1
00:00:00,800 --> 00:00:05,000
А ты вытащишь свой трофей?

2
00:00:09,500 --> 00:00:13,300
Почувствуй каждую поклёвку!

3
00:00:22,800 --> 00:00:26,800
РЫБАЛКА: КЛЮЁТ!

4
00:00:27,000 --> 00:00:31,000
Твоя рыбалка начинается здесь!
"""
(OUT / "captions.srt").write_text(captions, encoding="utf-8")
# libass's subtitle sizes/margins are scaled to 1080x1920.
# Keep the Russian captions in the lower third, clear of the gameplay.
vf = ("scale=1080:1920:flags=lanczos,"
      "subtitles=" + str(OUT / "captions.srt") +
      ":force_style='Fontname=DejaVu Sans,Fontsize=10,Outline=1,Shadow=0,"
      "Alignment=2,MarginV=90,PrimaryColour=&H00FFFFFF&'")
clip = OUT / "fishing-promo-1080x1920.mp4"
cmd("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
    "-ss", "%.3f" % trim, "-i", str(OUT / "fish-gameplay-original.webm"),
    "-i", str(OUT / "fish-game-audio.webm"), "-t", "31",
    "-vf", vf, "-fps_mode", "vfr", "-c:v", "libx264", "-crf", "21",
    "-preset", "veryfast", "-pix_fmt", "yuv420p",
    # Lift quiet captured game sounds, limiting true peaks to -3 dBTP.
    # This only changes the promo export, not the game's audio engine.
    "-af", "loudnorm=I=-22:LRA=9:TP=-3",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
    "-movflags", "+faststart", str(clip))
# Distinguish source WebM FPS, real browser animation FPS, and MP4 FPS.
source_probe = json.loads(cmd("ffprobe", "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
    "-of", "json", str(OUT / "fish-gameplay-original.webm")))
source_video = next(st for st in source_probe["streams"] if st["codec_type"] == "video")
rate=source_video.get("avg_frame_rate","0/0")
source_fps = float(Fraction(rate)) if rate not in ("0/0","0/1","N/A") else 0
print("PROMO FRAME DIAGNOSTICS:", json.dumps({"browser":fps,"source":source_video,"source_fps":source_fps}),flush=True)
# Reject low-FPS captures rather than presenting duplicated 10 FPS as 30 FPS.
assert fps["measuredFps"] >= 24, ("Browser render FPS below release target", fps)
assert source_fps >= 24, ("Video capture FPS below release target", source_fps)
probe = json.loads(cmd("ffprobe", "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
    "-of", "json", str(clip)))
streams = probe["streams"]
v = next(s for s in streams if s["codec_type"] == "video")
a = next(s for s in streams if s["codec_type"] == "audio")
duration = float(probe["format"]["duration"])
assert (v["codec_name"], v["width"], v["height"]) == ("h264", 1080, 1920), probe
assert a["codec_name"] == "aac", probe
assert 25 <= duration <= 35, duration
movement=[]
previous=None
for t in (2, 7, 12, 17, 23, 29):
    image_path=OUT / ("promo-frame-%02d.png" % t)
    cmd("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", str(t), "-i", str(clip), "-frames:v", "1", str(image_path))
    image=Image.open(image_path).convert("RGB").resize((180, 320))
    if previous:
        movement.append(sum(ImageStat.Stat(ImageChops.difference(previous, image)).mean)/3)
    previous=image
assert sum(x > 2 for x in movement) >= 4, ("Static/failed capture",movement)
report = {
    "video": str(clip.name), "resolution": [v["width"],v["height"]],
    "video_codec":v["codec_name"],"audio_codec":a["codec_name"],
    "duration_seconds":duration,"encoded_fps":v["avg_frame_rate"],
    "actual_browser_fps":fps,
    "captured_source_fps":source_fps,
    "fps_mode":"Variable frame rate, original capture timestamps; no synthetic duplication",
    "playwright_webm_capture_fps":source_video["avg_frame_rate"],
    "playwright_webm_capture_duration":float(source_probe.get("format",{}).get("duration") or fps["seconds"]),
    "source_video_codec":source_video["codec_name"],
    "frame_motion_mean_differences":movement,
    "audio_processing":"EBU R128 normalisation to -22 LUFS, ceiling -3 dBTP",
    "scene":"Production WebGL gameplay, staged actions using actual game mechanics",
    "music":"disabled; original WebAudio ambience and effects only"
}
(OUT / "promo-validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("PROMO VERIFIED", json.dumps(report,ensure_ascii=False))
