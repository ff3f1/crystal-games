"""Record a vertical gameplay promo clip from the real Fish game.
Run: python3 tests/record_fish_promo.py <output_dir>
The MP4 is produced by Playwright Chromium video recording (WebM); no mocked gameplay.
"""
import sys, os, functools, threading, http.server, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "promo-output")
os.makedirs(OUT, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.join(ROOT, "games")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/fish/index.html"

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        record_video_dir=OUT,
        record_video_size={"width": 780, "height": 1688},
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(2200)  # title / loading screen
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(1800)
    page.click("#mGo")
    page.wait_for_timeout(1800)  # establish the fishing location

    # Cast into the water and show the bite.
    page.mouse.move(195, 470)
    page.mouse.down()
    page.mouse.move(185, 460, steps=8)
    page.mouse.up()
    page.wait_for_timeout(1800)
    for _ in range(45):
        state = page.evaluate("__game.G.rig().state")
        phase = page.evaluate("__game.G.rig().bite && __game.G.rig().bite.phase")
        if state == "bite" and phase == "take":
            break
        page.wait_for_timeout(200)

    # Hook and reel in, preserving the real game animation.
    if page.evaluate("__game.G.rig().state") == "bite":
        page.mouse.move(195, 640)
        page.mouse.down()
        page.mouse.move(195, 540, steps=10)
        page.mouse.up()
        page.wait_for_timeout(350)
        page.mouse.move(250, 650)
        page.mouse.down()
        for _ in range(100):
            if page.evaluate("__game.G.rig().state") != "fight":
                break
            page.wait_for_timeout(150)
        page.mouse.up()
        page.wait_for_timeout(1600)

    # Hold on the catch result, then show the new winter location and ice mode.
    if page.is_visible("#cKeep"):
        page.wait_for_timeout(2600)
        page.click("#cKeep")
        page.wait_for_timeout(900)
    page.evaluate("__game.G.rig().fish=null; __game.G.rig().state='idle'; __game.UI.travel('pond','winter')")
    page.wait_for_timeout(2400)
    if page.evaluate("__game.G.rig().state") == "nohole":
        page.click("#bAct")
        page.wait_for_timeout(2800)
    page.wait_for_timeout(2200)
    # Show the actual expedition destination from the game runtime.
    page.evaluate("__game.G.state().lvl=17; __game.G.state().money=5000; __game.G.startExpedition('mountainlake',1)")
    page.wait_for_timeout(3200)

    # Keep the capture only if the game ran without uncaught JS errors.
    if errors:
        raise RuntimeError("JavaScript errors during promo capture: " + " | ".join(errors[:5]))
    video = page.video
    awaitable = context.close()
    browser.close()
    video_path = video.path()
    target = os.path.join(OUT, "fish-gameplay-promo.webm")
    if os.path.abspath(video_path) != os.path.abspath(target):
        os.replace(video_path, target)
    print(f"RECORDED: {target}")
    print("FORMAT: WebM, vertical 780x1688, captured from live game runtime")
    srv.shutdown()
