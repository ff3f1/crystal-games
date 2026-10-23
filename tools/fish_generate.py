"""Генерация картинок для «Рыбалка: Клюёт!» через локальный ComfyUI (Flux).

ComfyUI должен быть запущен (обычно http://127.0.0.1:8188). Только стандартная библиотека Python.

  python tools/fish_generate.py                       всё, чего ещё нет (можно прерывать и запускать снова)
  python tools/fish_generate.py --only fish,items     только рыбы и иконки (группы: bg, fish, items, ui)
  python tools/fish_generate.py --ckpt flux1-dev-fp8.safetensors --steps 24
  python tools/fish_generate.py --workflow my_flux_api.json
        свой воркфлоу: в ComfyUI «Workflow → Export (API)». Текст промпта подставится в узел
        CLIPTextEncode, где написано {PROMPT} (или в тот, что идёт в positive), размер — в Empty*Latent*.
  python tools/fish_generate.py --redo fish/pike       перегенерировать одну картинку (другой seed)

Готовые файлы: tools/raw_assets/<группа>/<имя>.png. Потом: python tools/fish_process.py
"""
import argparse, json, os, random, sys, time, urllib.error, urllib.parse, urllib.request, uuid, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "tools", "raw_assets")
MANIFEST = os.path.join(ROOT, "tools", "fish_assets.json")

DEFAULT_WF = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "flux1-dev-fp8.safetensors"}},
    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
    "3": {"class_type": "FluxGuidance", "inputs": {"guidance": 3.5, "conditioning": ["2", 0]}},
    "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
    "5": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
    "6": {"class_type": "KSampler", "inputs": {"seed": 1, "steps": 20, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple",
                                                "denoise": 1.0, "model": ["1", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0]}},
    "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
    "8": {"class_type": "SaveImage", "inputs": {"filename_prefix": "fishing", "images": ["7", 0]}},
}


def api(host, path, data=None):
    url = host.rstrip("/") + path
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"} if data is not None else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
    return json.loads(body) if body[:1] in (b"{", b"[") else body


def find_prompt_nodes(wf):
    enc = [k for k, n in wf.items() if n.get("class_type", "").startswith("CLIPTextEncode")]
    marked = [k for k in enc if "{PROMPT}" in json.dumps(wf[k]["inputs"])]
    if marked:
        return marked
    # идём от сэмплера по входу positive (через FluxGuidance и т.п.)
    for n in wf.values():
        pos = n.get("inputs", {}).get("positive") or n.get("inputs", {}).get("conditioning")
        if n.get("class_type", "") in ("KSampler", "KSamplerAdvanced", "BasicGuider", "CFGGuider") and isinstance(pos, list):
            cur = pos[0]
            for _ in range(6):
                node = wf.get(cur)
                if not node:
                    break
                if node["class_type"].startswith("CLIPTextEncode"):
                    return [cur]
                nxt = node["inputs"].get("conditioning")
                if not isinstance(nxt, list):
                    break
                cur = nxt[0]
    return enc[:1]


def prepare(wf_template, prompt, w, h, seed, steps, ckpt, prefix):
    wf = json.loads(json.dumps(wf_template))
    for k in find_prompt_nodes(wf):
        inp = wf[k]["inputs"]
        for field in ("text", "clip_l", "t5xxl"):
            if field in inp:
                inp[field] = prompt
    for n in wf.values():
        inp = n.get("inputs", {})
        ct = n.get("class_type", "")
        if "Latent" in ct and "width" in inp and "height" in inp:
            inp["width"], inp["height"] = w, h
        for f in ("seed", "noise_seed"):
            if f in inp and not isinstance(inp[f], list):
                inp[f] = seed
        if steps and "steps" in inp and not isinstance(inp["steps"], list):
            inp["steps"] = steps
        if ckpt and ct == "CheckpointLoaderSimple":
            inp["ckpt_name"] = ckpt
        if ct == "SaveImage":
            inp["filename_prefix"] = prefix
    return wf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="http://127.0.0.1:8188")
    ap.add_argument("--workflow")
    ap.add_argument("--ckpt")
    ap.add_argument("--steps", type=int, default=0)
    ap.add_argument("--only", default="bg,fish,items")
    ap.add_argument("--redo", default="")
    args = ap.parse_args()

    man = json.load(open(MANIFEST, encoding="utf-8"))
    groups = set(args.only.split(","))
    redo = set(x for x in args.redo.split(",") if x)
    try:
        api(args.host, "/system_stats")
    except Exception as e:
        sys.exit("ComfyUI не отвечает на %s — запустите его и повторите (%s)" % (args.host, e))

    if args.workflow:
        wf_t = json.load(open(args.workflow, encoding="utf-8"))
    else:
        wf_t = DEFAULT_WF
        if not args.ckpt:
            try:
                names = api(args.host, "/object_info/CheckpointLoaderSimple")["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
                flux = [n for n in names if "flux" in n.lower()]
                if DEFAULT_WF["1"]["inputs"]["ckpt_name"] not in names:
                    if not flux:
                        sys.exit("Не нашёл чекпойнт Flux в models/checkpoints. Укажите --ckpt имя_файла или --workflow свой_воркфлоу.json\nЕсть: " + ", ".join(names[:20]))
                    args.ckpt = flux[0]
                    print("Беру чекпойнт:", args.ckpt)
            except Exception:
                pass

    todo = []
    for it in man["images"]:
        if it["group"] not in groups and it["key"] not in redo:
            continue
        out = os.path.join(RAW, it["key"] + ".png")
        if os.path.exists(out) and it["key"] not in redo:
            continue
        todo.append(it)
    print("К генерации: %d картинок" % len(todo))
    client = str(uuid.uuid4())
    t0 = time.time()
    for i, it in enumerate(todo):
        w, h = it["size"]
        seed = random.randint(1, 2 ** 31) if it["key"] in redo else zlib.crc32(it["key"].encode())
        wf = prepare(wf_t, it["prompt"], w, h, seed, args.steps, args.ckpt, "fishing/" + it["key"].replace("/", "_"))
        try:
            pid = api(args.host, "/prompt", {"prompt": wf, "client_id": client})["prompt_id"]
        except urllib.error.HTTPError as e:
            sys.exit("ComfyUI отклонил воркфлоу: %s\n%s" % (e, e.read().decode("utf-8", "ignore")[:1500]))
        while True:
            time.sleep(1.5)
            hist = api(args.host, "/history/" + pid)
            if pid in hist and hist[pid].get("outputs"):
                break
            if pid in hist and hist[pid].get("status", {}).get("status_str") == "error":
                sys.exit("Ошибка генерации %s: %s" % (it["key"], json.dumps(hist[pid]["status"])[:800]))
        imgs = [im for o in hist[pid]["outputs"].values() for im in o.get("images", [])]
        im = imgs[0]
        q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im.get("subfolder", ""), "type": im.get("type", "output")})
        data = api(args.host, "/view?" + q)
        out = os.path.join(RAW, it["key"] + ".png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "wb").write(data)
        el = time.time() - t0
        print("[%d/%d] %s  (осталось ~%d мин)" % (i + 1, len(todo), it["key"], el / (i + 1) * (len(todo) - i - 1) / 60))
    print("Готово. Дальше: python tools/fish_process.py")


if __name__ == "__main__":
    main()
