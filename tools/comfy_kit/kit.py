"""Набор для ComfyUI: генерирует картинки (Flux) и музыку (ACE-Step) для игры «Рыбалка: Клюёт!»
и складывает результат в архивы на рабочий стол. Запуск — START.bat (двойной щелчок).

Работает на стандартной библиотеке Python. Pillow (есть в Python у ComfyUI) нужен только для сжатия в webp.
  START.bat               всё, чего ещё нет (можно закрыть окно и запустить снова — продолжит)
  START.bat --redo fish/pike,bg/oka_summer     переделать отдельные картинки с другим зерном
  START.bat --steps 28    больше шагов Flux (качество выше, дольше)
  START.bat --no-music    без музыки
"""
import io, json, os, random, sys, time, urllib.error, urllib.parse, urllib.request, uuid, zipfile, zlib, subprocess

KIT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(KIT, "out")
MAN = json.load(open(os.path.join(KIT, "fish_assets.json"), encoding="utf-8"))
_log = open(os.path.join(KIT, "log.txt"), "a", encoding="utf-8")


def say(*a):
    msg = " ".join(str(x) for x in a)
    try:
        print(msg, flush=True)
    except Exception:
        print(msg.encode("ascii", "replace").decode(), flush=True)
    _log.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n"); _log.flush()


# ---------- связь с ComfyUI ----------
HOSTS = ["http://127.0.0.1:8188", "http://127.0.0.1:8000", "http://127.0.0.1:8189", "http://localhost:8188", "http://localhost:8000"]


def api(host, path, data=None, timeout=120):
    req = urllib.request.Request(host + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"} if data is not None else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read()
    return json.loads(body) if body[:1] in (b"{", b"[") else body


def find_host():
    for h in HOSTS:
        try:
            api(h, "/system_stats", timeout=3)
            return h
        except Exception:
            pass
    return None


# ---------- поиск и запуск ComfyUI ----------
SKIP = {"windows", "program files", "program files (x86)", "programdata", "$recycle.bin", "system volume information", "appdata",
        "node_modules", ".git", "models", "custom_nodes", "site-packages", "output", "input", "temp", "__pycache__", "lib", "include"}


def known_folder(csidl, fallback):
    try:
        import ctypes
        from ctypes import wintypes
        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, csidl, None, 0, buf)
        if buf.value and os.path.isdir(buf.value):
            return buf.value
    except Exception:
        pass
    return fallback


def is_comfy(d):
    return os.path.isfile(os.path.join(d, "main.py")) and os.path.isdir(os.path.join(d, "comfy")) and os.path.isfile(os.path.join(d, "nodes.py"))


def find_comfy_dirs():
    home = os.path.expanduser("~")
    docs = known_folder(0x05, os.path.join(home, "Documents"))
    roots = [(os.path.join(docs, "ai-assets"), 5), (docs, 3), (home, 3), (os.path.join(home, "Desktop"), 3)]
    for drv in "CDEFG":
        roots.append((drv + ":\\", 3))
    found, seen = [], set()
    for root, depth in roots:
        if not os.path.isdir(root):
            continue
        stack = [(root, 0)]
        while stack:
            d, lv = stack.pop()
            key = os.path.normcase(os.path.abspath(d))
            if key in seen:
                continue
            seen.add(key)
            if is_comfy(d):
                found.append(d)
                continue
            if lv >= depth:
                continue
            try:
                for e in os.scandir(d):
                    if e.is_dir(follow_symlinks=False) and e.name.lower() not in SKIP and not e.name.startswith("."):
                        stack.append((e.path, lv + 1))
            except Exception:
                pass
    # сначала то, что в ai-assets
    found.sort(key=lambda d: ("ai-assets" not in d.lower(), len(d)))
    return found


def comfy_python(d):
    parent = os.path.dirname(d)
    for c in (os.path.join(parent, "python_embeded", "python.exe"), os.path.join(d, ".venv", "Scripts", "python.exe"),
              os.path.join(d, "venv", "Scripts", "python.exe"), os.path.join(parent, ".venv", "Scripts", "python.exe"),
              os.path.join(parent, "venv", "Scripts", "python.exe"), os.path.join(d, ".venv", "bin", "python"), os.path.join(d, "venv", "bin", "python")):
        if os.path.isfile(c):
            return c
    return sys.executable


def launch_comfy():
    local = os.environ.get("LOCALAPPDATA", "")
    for exe in (os.path.join(local, "Programs", "@comfyorgcomfyui-electron", "ComfyUI.exe"), os.path.join(local, "Programs", "ComfyUI", "ComfyUI.exe")):
        if local and os.path.isfile(exe):
            say("Запускаю приложение ComfyUI:", exe)
            subprocess.Popen([exe], cwd=os.path.dirname(exe))
            return True
    say("Ищу ComfyUI на компьютере (до минуты)...")
    dirs = find_comfy_dirs()
    if not dirs:
        return False
    d = dirs[0]
    say("Нашёл ComfyUI:", d)
    STATE["comfy_dir"] = d
    parent = os.path.dirname(d)
    bat = os.path.join(parent, "run_nvidia_gpu.bat")
    flags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    if os.path.isfile(bat) and os.name == "nt":
        say("Запускаю:", bat)
        subprocess.Popen(["cmd", "/c", bat], cwd=parent, creationflags=flags)
        return True
    py = comfy_python(d)
    cmd = [py, "-s", "main.py", "--port", "8188"]
    if os.path.isdir(os.path.join(parent, "python_embeded")):
        cmd.append("--windows-standalone-build")
    say("Запускаю:", " ".join('"%s"' % c if " " in c else c for c in cmd))
    subprocess.Popen(cmd, cwd=d, creationflags=flags)
    return True


def wait_host():
    h = find_host()
    if h:
        return h
    started = launch_comfy()
    if started:
        say("ComfyUI запускается в отдельном окне — первый запуск занимает 1–3 минуты. Это окно не закрывай.")
    else:
        say("ComfyUI на компьютере не нашёл. Запусти его сам — я подожду и продолжу (проверяю каждые 5 секунд).")
    for i in range(360):
        time.sleep(5)
        h = find_host()
        if h:
            time.sleep(3)
            return h
        if started and i == 60:
            say("Пять минут, а ComfyUI всё не отвечает. Посмотри в его окно — нет ли там ошибки. Я продолжаю ждать.")
    say("За 30 минут ComfyUI так и не запустился. Пришли log.txt из этой папки в чат.")
    sys.exit(1)


INFO = {}


def node_info(host, name):
    if name not in INFO:
        try:
            INFO[name] = api(host, "/object_info/" + urllib.parse.quote(name)).get(name)
        except Exception:
            INFO[name] = None
    return INFO[name]


def spec(host, node, inp):
    n = node_info(host, node)
    if not n:
        return None
    for sec in ("required", "optional"):
        v = (n.get("input") or {}).get(sec, {}).get(inp)
        if v:
            return v
    return None


def options(host, node, inp):
    v = spec(host, node, inp)
    if not v:
        return []
    if isinstance(v[0], list):
        return v[0]
    if v[0] == "COMBO" and len(v) > 1 and isinstance(v[1], dict):
        return v[1].get("options", [])
    return []


def fill(host, node, given):
    """Входы узла: что передали — берём, остальное — значения по умолчанию из ComfyUI (разные версии узлов)."""
    n = node_info(host, node)
    if not n:
        raise RuntimeError("в ComfyUI нет узла " + node)
    out = {}
    for sec in ("required", "optional"):
        for name, v in ((n.get("input") or {}).get(sec) or {}).items():
            if name in given:
                val = given[name]
                opts = v[0] if isinstance(v[0], list) else ((v[1] or {}).get("options") if v[0] == "COMBO" and len(v) > 1 else None)
                if opts and val not in opts:  # значение из списка: ищем похожее, иначе — по умолчанию
                    low = [str(o).lower() for o in opts]
                    sv = str(val).lower()
                    if sv in low:
                        val = opts[low.index(sv)]
                    else:
                        near = [o for o, l in zip(opts, low) if sv.split(" ")[0] in l.split(" ")[0] and sv.split(" ")[-1] in l]
                        val = near[0] if near else ((v[1] or {}).get("default") if len(v) > 1 and isinstance(v[1], dict) and (v[1] or {}).get("default") in opts else opts[0])
                out[name] = val
            elif sec == "required":
                t = v[0]
                extra = v[1] if len(v) > 1 and isinstance(v[1], dict) else {}
                if isinstance(t, list):
                    out[name] = t[0] if t else ""
                elif t == "COMBO":
                    opts = extra.get("options") or [""]
                    out[name] = extra.get("default", opts[0])
                elif "default" in extra:
                    out[name] = extra["default"]
                elif t in ("INT", "FLOAT"):
                    out[name] = extra.get("min", 0)
                elif t == "STRING":
                    out[name] = ""
                elif t == "BOOLEAN":
                    out[name] = False
    for k, v in given.items():
        if k not in out and isinstance(v, list):
            out[k] = v
    return {"class_type": node, "inputs": out}


# ---------- выбор модели для картинок ----------
BAD = ("kontext", "fill", "canny", "depth", "redux", "controlnet", "lora", "inpaint")


def flux_rank(n):
    l = n.lower()
    return (("dev" in l or "krea" in l) * 3 + ("schnell" in l) * 1 + ("fp8" in l) * 1 + (l.endswith(".gguf")) * 0.5)


def image_plan(host, steps_arg):
    ck = options(host, "CheckpointLoaderSimple", "ckpt_name")
    un = options(host, "UNETLoader", "unet_name")
    gg = options(host, "UnetLoaderGGUF", "unet_name")
    clips = options(host, "DualCLIPLoader", "clip_name1")
    vaes = options(host, "VAELoader", "vae_name")
    isflux = lambda n: "flux" in n.lower() and not any(b in n.lower() for b in BAD)
    f_un = sorted([n for n in un if isflux(n)], key=flux_rank, reverse=True)
    f_gg = sorted([n for n in gg if isflux(n)], key=flux_rank, reverse=True)
    f_ck = sorted([n for n in ck if isflux(n)], key=flux_rank, reverse=True)
    t5 = sorted([n for n in clips if "t5" in n.lower()], key=lambda n: ("fp8" in n.lower()) * 2 + ("fp16" in n.lower()), reverse=True)
    cl = [n for n in clips if "clip_l" in n.lower()] or [n for n in clips if "clip" in n.lower() and "t5" not in n.lower()]
    ae = [n for n in vaes if n.lower().startswith("ae") or "flux" in n.lower()]
    plans = []
    for name in f_un + f_gg:
        if t5 and cl and ae:
            plans.append({"kind": "unet" if name in f_un else "gguf", "model": name, "t5": t5[0], "clip_l": cl[0], "vae": ae[0]})
    for name in f_ck:
        plans.append({"kind": "ckpt", "model": name})
    xl = [n for n in ck if "xl" in n.lower() and "refiner" not in n.lower() and not isflux(n)]
    for name in xl[:1]:
        plans.append({"kind": "sdxl", "model": name})
    for p in plans:
        l = p["model"].lower()
        p["steps"] = steps_arg or (4 if "schnell" in l else 30 if p["kind"] == "sdxl" else 22)
    return plans, {"checkpoints": ck[:30], "unet": (un + gg)[:30], "clips": clips[:30], "vae": vaes[:30]}


def image_workflow(plan, host, prompt, w, h, seed, prefix):
    k = plan["kind"]
    wf = {}
    if k in ("unet", "gguf"):
        if k == "unet":
            l = plan["model"].lower()
            wd = "default" if ("fp8" in l or "nf4" in l or "q8" in l) else "fp8_e4m3fn"
            if wd not in options(host, "UNETLoader", "weight_dtype"):
                wd = "default"
            wf["1"] = fill(host, "UNETLoader", {"unet_name": plan["model"], "weight_dtype": wd})
        else:
            wf["1"] = fill(host, "UnetLoaderGGUF", {"unet_name": plan["model"]})
        wf["2"] = fill(host, "DualCLIPLoader", {"clip_name1": plan["t5"], "clip_name2": plan["clip_l"], "type": "flux"})
        wf["3"] = fill(host, "VAELoader", {"vae_name": plan["vae"]})
        model, clip, vae = ["1", 0], ["2", 0], ["3", 0]
    else:
        wf["1"] = fill(host, "CheckpointLoaderSimple", {"ckpt_name": plan["model"]})
        model, clip, vae = ["1", 0], ["1", 1], ["1", 2]
    wf["4"] = fill(host, "CLIPTextEncode", {"text": prompt, "clip": clip})
    neg = "text, letters, watermark, signature, people, person, frame, border, blurry, lowres, deformed" if k == "sdxl" else ""
    wf["5"] = fill(host, "CLIPTextEncode", {"text": neg, "clip": clip})
    pos = ["4", 0]
    if k != "sdxl" and node_info(host, "FluxGuidance"):
        wf["6"] = fill(host, "FluxGuidance", {"conditioning": ["4", 0], "guidance": 3.5})
        pos = ["6", 0]
    lat = "EmptySD3LatentImage" if (k != "sdxl" and node_info(host, "EmptySD3LatentImage")) else "EmptyLatentImage"
    wf["7"] = fill(host, lat, {"width": w, "height": h, "batch_size": 1})
    wf["8"] = fill(host, "KSampler", {"seed": seed, "steps": plan["steps"], "cfg": 6.0 if k == "sdxl" else 1.0,
                                      "sampler_name": "dpmpp_2m" if k == "sdxl" else "euler", "scheduler": "karras" if k == "sdxl" else "simple",
                                      "denoise": 1.0, "model": model, "positive": pos, "negative": ["5", 0], "latent_image": ["7", 0]})
    wf["9"] = fill(host, "VAEDecode", {"samples": ["8", 0], "vae": vae})
    wf["10"] = fill(host, "SaveImage", {"images": ["9", 0], "filename_prefix": prefix})
    return wf


# ---------- музыка ACE-Step ----------
def music_plan(host):
    if node_info(host, "TextEncodeAceStepAudio1.5") and node_info(host, "EmptyAceStep1.5LatentAudio"):
        un = [n for n in options(host, "UNETLoader", "unet_name") if "ace" in n.lower()]
        clips = [n for n in options(host, "DualCLIPLoader", "clip_name1") if "ace" in n.lower() or "qwen" in n.lower()]
        vaes = [n for n in options(host, "VAELoader", "vae_name") if "ace" in n.lower()]
        types = options(host, "DualCLIPLoader", "type")
        if un and len(clips) >= 1 and vaes and (not types or "ace" in types):
            un.sort(key=lambda n: ("turbo" in n.lower()) * 2 - ("xl" in n.lower()), reverse=True)
            small = sorted(clips, key=lambda n: ("0.6b" in n.lower()), reverse=True)[0]
            big = sorted(clips, key=lambda n: ("1.7b" in n.lower()) * 2 + ("4b" in n.lower()), reverse=True)[0]
            return {"v": "1.5", "unet": un[0], "c1": small, "c2": big, "vae": vaes[0]}
    if node_info(host, "TextEncodeAceStepAudio") and node_info(host, "EmptyAceStepLatentAudio"):
        ck = [n for n in options(host, "CheckpointLoaderSimple", "ckpt_name") if "ace" in n.lower()]
        if ck:
            return {"v": "1.0", "ckpt": ck[0]}
    return None


def music_workflow(plan, host, m, seed, prefix):
    wf = {}
    sec = m.get("seconds", 90)
    if plan["v"] == "1.5":
        turbo = "turbo" in plan["unet"].lower()
        wf["1"] = fill(host, "UNETLoader", {"unet_name": plan["unet"], "weight_dtype": "default"})
        wf["2"] = fill(host, "DualCLIPLoader", {"clip_name1": plan["c1"], "clip_name2": plan["c2"], "type": "ace"})
        wf["3"] = fill(host, "VAELoader", {"vae_name": plan["vae"]})
        wf["4"] = fill(host, "ModelSamplingAuraFlow", {"model": ["1", 0], "shift": 3.0})
        wf["5"] = fill(host, "TextEncodeAceStepAudio1.5", {"clip": ["2", 0], "tags": m["tags"], "lyrics": "[Instrumental]", "seed": seed,
                                                          "bpm": m.get("bpm", 80), "duration": float(sec), "timesignature": "4",
                                                          "language": "en", "keyscale": m.get("keyscale", "C major")})
        wf["6"] = fill(host, "ConditioningZeroOut", {"conditioning": ["5", 0]})
        wf["7"] = fill(host, "EmptyAceStep1.5LatentAudio", {"seconds": float(sec), "batch_size": 1})
        wf["8"] = fill(host, "KSampler", {"seed": seed, "steps": 8 if turbo else 32, "cfg": 1.0 if turbo else 4.0, "sampler_name": "euler",
                                          "scheduler": "simple", "denoise": 1.0, "model": ["4", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0]})
        wf["9"] = fill(host, "VAEDecodeAudio", {"samples": ["8", 0], "vae": ["3", 0]})
    else:
        wf["1"] = fill(host, "CheckpointLoaderSimple", {"ckpt_name": plan["ckpt"]})
        wf["5"] = fill(host, "TextEncodeAceStepAudio", {"clip": ["1", 1], "tags": m["tags"], "lyrics": "[instrumental]", "lyrics_strength": 0.99})
        wf["6"] = fill(host, "ConditioningZeroOut", {"conditioning": ["5", 0]}) if node_info(host, "ConditioningZeroOut") else wf["5"]
        wf["7"] = fill(host, "EmptyAceStepLatentAudio", {"seconds": float(sec), "batch_size": 1})
        wf["8"] = fill(host, "KSampler", {"seed": seed, "steps": 50, "cfg": 5.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0,
                                          "model": ["1", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0]})
        wf["9"] = fill(host, "VAEDecodeAudio", {"samples": ["8", 0], "vae": ["1", 2]})
    if node_info(host, "SaveAudioMP3"):
        q = options(host, "SaveAudioMP3", "quality")
        wf["10"] = fill(host, "SaveAudioMP3", {"audio": ["9", 0], "filename_prefix": prefix, "quality": "128k" if "128k" in q else (q[0] if q else "V0")})
    elif node_info(host, "SaveAudioAdvanced"):
        wf["10"] = fill(host, "SaveAudioAdvanced", {"audio": ["9", 0], "filename_prefix": prefix, "format": "mp3"})
    else:
        wf["10"] = fill(host, "SaveAudio", {"audio": ["9", 0], "filename_prefix": prefix})
    return wf


# ---------- очередь ----------
class GenError(Exception):
    pass


def run(host, wf, client):
    try:
        pid = api(host, "/prompt", {"prompt": wf, "client_id": client})["prompt_id"]
    except urllib.error.HTTPError as e:
        raise GenError(e.read().decode("utf-8", "ignore")[:1500])
    t0 = time.time()
    while True:
        time.sleep(1)
        try:
            hist = api(host, "/history/" + pid, timeout=30)
        except Exception:
            continue
        h = hist.get(pid)
        if h:
            st = h.get("status", {})
            if st.get("status_str") == "error":
                msgs = [m for m in st.get("messages", []) if m and m[0] == "execution_error"]
                raise GenError(json.dumps(msgs[0][1] if msgs else st, ensure_ascii=False)[:1500])
            if h.get("outputs"):
                files = []
                for o in h["outputs"].values():
                    for key in ("images", "audio"):
                        files += o.get(key, [])
                if files:
                    return files
        if time.time() - t0 > 1800:
            raise GenError("за 30 минут результата нет")


def fetch(host, f):
    q = urllib.parse.urlencode({"filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": f.get("type", "output")})
    return api(host, "/view?" + q, timeout=300)


def desktop():
    try:
        import ctypes
        from ctypes import wintypes
        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, 0x10, None, 0, buf)
        if buf.value and os.path.isdir(buf.value):
            return buf.value
    except Exception:
        pass
    d = os.path.join(os.path.expanduser("~"), "Desktop")
    return d if os.path.isdir(d) else KIT


def keep_awake():
    try:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
    except Exception:
        pass


def pack(include_music):
    try:
        from PIL import Image
    except Exception:
        Image = None
        say("Pillow не найден — картинки пойдут в архив в PNG (архив будет крупнее).")
    dst = desktop()
    zi = os.path.join(dst, "fishing_images.zip")
    n = 0
    with zipfile.ZipFile(zi, "w", zipfile.ZIP_DEFLATED) as z:
        for it in MAN["images"]:
            src = os.path.join(OUT, it["key"] + ".png")
            if not os.path.exists(src):
                continue
            if Image:
                im = Image.open(src).convert("RGB")
                b = io.BytesIO(); im.save(b, "WEBP", quality=92, method=5)
                z.writestr("images/" + it["key"] + ".webp", b.getvalue())
            else:
                z.write(src, "images/" + it["key"] + ".png")
            n += 1
        z.writestr("info.json", json.dumps(STATE, ensure_ascii=False, indent=1))
        z.write(os.path.join(KIT, "log.txt"), "log.txt")
    say("Картинки: %d шт. → %s (%.1f МБ)" % (n, zi, os.path.getsize(zi) / 1048576))
    out = [zi]
    mdir = os.path.join(OUT, "music")
    extra = os.path.join(KIT, "music")
    files = []
    for d in (mdir, extra):
        if os.path.isdir(d):
            files += [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.lower().endswith((".mp3", ".ogg", ".wav", ".flac", ".m4a", ".opus"))]
    if include_music and files:
        zm = os.path.join(dst, "fishing_music.zip")
        with zipfile.ZipFile(zm, "w", zipfile.ZIP_STORED) as z:
            for f in files:
                z.write(f, "audio/" + os.path.basename(f))
        say("Музыка: %d шт. → %s (%.1f МБ)" % (len(files), zm, os.path.getsize(zm) / 1048576))
        out.append(zm)
    return out


STATE = {}


def main():
    args = sys.argv[1:]
    redo = set()
    steps = 0
    music = True
    if "--redo" in args:
        redo = set(x for x in args[args.index("--redo") + 1].split(",") if x)
    if "--steps" in args:
        steps = int(args[args.index("--steps") + 1])
    if "--no-music" in args:
        music = False
    keep_awake()
    say("=== Рыбалка: Клюёт! — генерация ассетов ===")
    host = wait_host()
    say("ComfyUI найден:", host)
    plans, found = image_plan(host, steps)
    if not plans:
        say("Не нашёл ни Flux, ни SDXL. Вот что есть в ComfyUI:")
        for k, v in found.items():
            say("  %s: %s" % (k, ", ".join(v) or "—"))
        say("Нужна модель Flux (например flux1-dev-fp8.safetensors в models/checkpoints).")
        return
    client = str(uuid.uuid4())
    todo = [it for it in MAN["images"] if it["key"] in redo or not os.path.exists(os.path.join(OUT, it["key"] + ".png"))]
    say("Картинок к генерации: %d из %d" % (len(todo), len(MAN["images"])))
    plan = plans[0]
    STATE["images"] = {"model": plan["model"], "kind": plan["kind"], "steps": plan["steps"]}
    say("Модель: %s (%s, %d шагов)" % (plan["model"], plan["kind"], plan["steps"]))
    t0 = time.time(); done = 0
    for i, it in enumerate(todo):
        w, h = it["size"]
        seed = random.randint(1, 2 ** 31) if it["key"] in redo else zlib.crc32(it["key"].encode())
        ts = time.time()
        while True:
            try:
                files = run(host, image_workflow(plan, host, it["prompt"], w, h, seed, "fishing/" + it["key"].replace("/", "_")), client)
                break
            except GenError as e:
                say("Ошибка с моделью %s: %s" % (plan["model"], e))
                rest = [p for p in plans if p is not plan]
                if done == 0 and rest:
                    plans.remove(plan); plan = rest[0]
                    STATE["images"] = {"model": plan["model"], "kind": plan["kind"], "steps": plan["steps"]}
                    say("Пробую другую модель: %s (%s)" % (plan["model"], plan["kind"]))
                    continue
                if it.get("optional"):
                    files = None; break
                say("Пропускаю %s" % it["key"]); files = None; break
        if not files:
            continue
        data = fetch(host, files[0])
        dst = os.path.join(OUT, it["key"] + ".png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(data)
        done += 1
        el = time.time() - t0
        left = el / done * (len(todo) - i - 1)
        say("[%d/%d] %-22s %4.0f с   осталось ~%d мин" % (i + 1, len(todo), it["key"], time.time() - ts, left / 60 + 0.5))
    # музыка
    if music:
        mp = music_plan(host)
        if mp:
            say("Музыка: ACE-Step %s найден, делаю %d трека" % (mp["v"], len(MAN["music"])))
            STATE["music"] = mp
            for m in MAN["music"]:
                dst = os.path.join(OUT, "music", m["key"] + ".mp3")
                if os.path.exists(dst) and m["key"] not in redo:
                    continue
                ts = time.time()
                try:
                    files = run(host, music_workflow(mp, host, m, zlib.crc32(m["key"].encode()), "fishing_music/" + m["key"]), client)
                except GenError as e:
                    say("Музыка %s не получилась: %s" % (m["key"], e)); continue
                f = files[0]
                ext = os.path.splitext(f["filename"])[1] or ".mp3"
                dst = os.path.join(OUT, "music", m["key"] + ext)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                open(dst, "wb").write(fetch(host, f))
                say("  %s  %4.0f с" % (m["key"], time.time() - ts))
        else:
            say("ACE-Step в ComfyUI не найден — музыку можно сделать в своём ACE-Step по подсказкам из МУЗЫКА.txt")
            say("и положить mp3 в папку music рядом со START.bat, затем запустить START.bat ещё раз.")
            with open(os.path.join(KIT, "МУЗЫКА.txt"), "w", encoding="utf-8") as fh:
                for m in MAN["music"]:
                    fh.write("%s.mp3\n  Теги: %s\n  BPM %s, %s, %s сек, без слов\n\n" % (m["key"], m["tags"], m.get("bpm"), m.get("keyscale"), m.get("seconds")))
    files = pack(music)
    say("")
    say("Готово! Прикрепи в чат с Claude файл(ы):")
    for f in files:
        say("   " + f)
    try:
        subprocess.Popen(["explorer", "/select,", files[0]])
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        say("Остановлено. Запусти START.bat снова — продолжу с того же места.")
    except Exception as e:
        import traceback
        say("Неожиданная ошибка: %s" % e)
        _log.write(traceback.format_exc())
        say("Подробности в log.txt рядом со START.bat — пришли его в чат.")
