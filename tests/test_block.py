import sys, os, json
from playwright.sync_api import sync_playwright

URL = "file://" + os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "games", "block", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
errors = []

# Жадный бот: выбирает ход, который убирает больше линий/кристаллов/бомб
BOT = """(maxMoves)=>{
  const G=__game; let n=0;
  const score=(s,r,c)=>{const t=G.grid.map(x=>x.slice());s.c.forEach(([a,b])=>t[r+a][c+b]={k:'b'});
    let v=0;const rows=[],cols=[];for(let i=0;i<8;i++){if(t[i].every(Boolean))rows.push(i);if(t.every(x=>x[i]))cols.push(i);}
    v+=(rows.length+cols.length)*100;
    rows.forEach(i=>t[i].forEach(x=>{if(x&&x.k==='g')v+=60;if(x&&x.k==='x')v+=80;}));
    cols.forEach(i=>t.forEach(x=>{const y=x[i];if(y&&y.k==='g')v+=60;if(y&&y.k==='x')v+=80;}));
    // как живой игрок: заполняем линии, где есть кристаллы и бомбы
    s.c.forEach(([a,b])=>{const R=r+a,C=c+b;for(let k=0;k<8;k++){const x1=G.grid[R][k],x2=G.grid[k][C];
      if(x1&&x1.k==='g')v+=6;if(x2&&x2.k==='g')v+=6;if(x1&&x1.k==='x')v+=30/Math.max(1,x1.n);if(x2&&x2.k==='x')v+=30/Math.max(1,x2.n);}});
    // предпочитаем края и соседство с занятыми клетками
    s.c.forEach(([a,b])=>{const R=r+a,C=c+b;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{const y=R+dr,x=C+dc;if(y<0||x<0||y>7||x>7||G.grid[y][x])v+=2;});});
    return v+Math.random();};
  while(!G.over&&n<maxMoves){let bestV=-1,bm=null;
    G.pieces.forEach((p,i)=>{if(!p)return;for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(G.fits(p.s,r,c)){const v=score(p.s,r,c);if(v>bestV){bestV=v;bm=[i,r,c];}}});
    if(!bm)break;G.place(bm[0],bm[1],bm[2]);n++;
    if(G.mode!=='levels')for(let i=0;i<8;i++){if(G.grid[i].every(Boolean)||G.grid.every(x=>x[i]))throw new Error('full line left');}
  }
  return {n,score:G.score,over:G.over,moves:G.movesLeft,gems:G.gemsLeft};
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(URL); pg.wait_for_timeout(700)
    pg.screenshot(path=f"{OUT}/b_menu.png")

    # --- Классика: реальное перетаскивание ---
    pg.click("[data-go=classic]"); pg.wait_for_timeout(400)
    if pg.is_visible("#iGo"): pg.click("#iGo")
    L = pg.evaluate("__game.L()"); placed = 0
    for k in range(10):
        idx = next((i for i, v in enumerate(pg.evaluate("__game.pieces.map(p=>p?1:0)")) if v), None)
        if idx is None: break
        sx = L["bx"] + L["bs"] / 6 * (1 + 2 * idx); sy = L["ty"] + L["th"] / 2
        tx = L["bx"] + (1 + k % 6) * L["cs"]; ty = L["by"] + (3 + k % 5) * L["cs"]
        before = pg.evaluate("__game.score")
        pg.mouse.move(sx, sy); pg.mouse.down()
        for s in range(1, 11): pg.mouse.move(sx + (tx - sx) * s / 10, sy + (ty - sy) * s / 10)
        pg.mouse.up(); pg.wait_for_timeout(100)
        placed += pg.evaluate("__game.score") > before
    print("classic drag placements:", placed)
    pg.screenshot(path=f"{OUT}/b_classic.png")
    r = pg.evaluate(BOT, 2000); print("classic bot:", r)
    pg.wait_for_timeout(1000); pg.screenshot(path=f"{OUT}/b_classic_over.png")
    pg.click("#eRev"); pg.wait_for_timeout(1500); print("revived, over:", pg.evaluate("__game.over"))
    r = pg.evaluate(BOT, 2000); pg.wait_for_timeout(1000)
    print("after revive bot:", r, "revive offered again:", pg.is_visible("#eRev"))
    pg.click("#eMenu"); pg.wait_for_timeout(1500)

    # --- Бонусы ---
    pg.evaluate("__game.startGame('classic')"); pg.wait_for_timeout(300)
    if pg.is_visible("#iGo"): pg.click("#iGo")
    pg.evaluate("__game.place(0,0,0)")
    hb = pg.evaluate("__game.boosts.hammer")
    pg.evaluate("__game.useBoost('hammer')"); pg.evaluate("__game.smash(0,0)")
    print("hammer:", hb, "->", pg.evaluate("__game.boosts.hammer"), "cell cleared:", pg.evaluate("__game.grid[0][0]===null"))
    pg.evaluate("__game.useBoost('refresh')"); print("refresh left:", pg.evaluate("__game.boosts.refresh"))

    # --- Блиц ---
    pg.evaluate("__game.goMenu()"); pg.click("[data-go=blitz]"); pg.wait_for_timeout(300)
    if pg.is_visible("#iGo"): pg.click("#iGo")
    pg.evaluate(BOT, 15); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/b_blitz.png")
    pg.evaluate("__game.timeLeft=0.3"); pg.wait_for_timeout(1500)
    print("blitz over by time:", pg.evaluate("__game.over"), pg.is_visible("#eRev"))
    pg.click("#eRev"); pg.wait_for_timeout(1500); print("blitz +time:", round(pg.evaluate("__game.timeLeft")))
    pg.evaluate("__game.goMenu()"); pg.wait_for_timeout(200)

    # --- Бомбы ---
    pg.click("[data-go=bombs]"); pg.wait_for_timeout(300)
    if pg.is_visible("#iGo"): pg.click("#iGo")
    r = pg.evaluate(BOT, 14); pg.wait_for_timeout(200); pg.screenshot(path=f"{OUT}/b_bombs.png")
    r = pg.evaluate(BOT, 3000); print("bombs bot:", r)
    runs=[]
    for k in range(6):
        pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'));__game.startGame('bombs')")
        r2 = pg.evaluate(BOT, 3000); runs.append((r2["n"], r2["score"], pg.evaluate("__game.lastResult")))
    print("bombs runs (moves, score, reason):", runs)
    pg.wait_for_timeout(1500); pg.screenshot(path=f"{OUT}/b_bombs_over.png")
    pg.evaluate("__game.goMenu()"); pg.wait_for_timeout(200)

    # --- Приключение: бот проходит все 60 уровней ---
    res = []; reasons = {}
    for lv in range(1, 61):
        wins = 0
        for attempt in range(3):
            pg.evaluate(f"__game.startGame('levels',{lv})")
            r = pg.evaluate(BOT, 500)
            lr = pg.evaluate("__game.lastResult"); wins += lr == "win"
            if lr != "win": reasons[lr] = reasons.get(lr, 0) + 1
            pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))")
        res.append(wins)
    print("level win counts (of 3):", res, "total", sum(res), "/180", reasons)
    # скриншоты: карта уровней, интро уровня, игровой уровень, победа
    pg.evaluate("localStorage.setItem('cb_stars',JSON.stringify(Array(17).fill(3).concat([2,1])))")
    pg.reload(); pg.wait_for_timeout(500)
    pg.click("[data-go=levels]"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/b_map.png")
    pg.click(".lv.cur", force=True); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/b_intro.png")
    pg.click("#iGo"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/b_level.png")
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'));localStorage.removeItem('cb_stars');__game.startGame('levels',1)")
    r = pg.evaluate(BOT, 500); pg.wait_for_timeout(2200); pg.screenshot(path=f"{OUT}/b_win.png")
    print("lv1 result:", r, "win card:", pg.is_visible("#eNext"))
    # темы
    pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'));__game.goMenu()"); pg.click("#bThemes"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/b_themes.png")
    for th in ["neon", "candy", "space"]:
        pg.evaluate(f"__game.setTheme('{th}');__game.startGame('levels',22);document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))")
        pg.evaluate(BOT, 3); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/b_theme_{th}.png")
        pg.evaluate("document.querySelectorAll('.ov').forEach(o=>o.classList.remove('on'))")
    b.close()
print("ERRORS:", errors or "none")
