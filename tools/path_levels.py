"""Сборка уровней для «Нарисуй путь».

Для каждого исходного уровня:
  * если корзина 'auto' — ставим её туда, куда падает шарик по эталонному решению;
  * проверяем, что без рисования уровень НЕ проходится;
  * проверяем, что эталонное решение проходит уровень;
  * ставим три звезды на траекторию решения, считаем запас чернил;
  * проверяем устойчивость: решения со случайными сдвигами линий тоже должны часто проходить;
  * пишем готовые уровни в games/path/index.html между /*LEVELS*/ и /*ENDLEVELS*/.
Запуск: python3 tools/path_levels.py [папка_для_картинок]
"""
import json, os, re, sys, random
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "games", "path", "index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else None
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from path_level_src import SRC

JS_SEARCH = """(src)=>{
  // перебор прямых линий по всему полю; учитываем запретные зоны и обязательную механику
  const G=__game, L0=JSON.parse(JSON.stringify(src)); const must=src.must;
  const inZ=p=>(L0.nodraw||[]).some(z=>p[0]>z[0]-1&&p[0]<z[0]+z[2]+1&&p[1]>z[1]-1&&p[1]<z[1]+z[3]+1);
  const placeCup=(L,sol)=>{ if(src.cup!=='auto') return L.cup;
    const r=G.simulate(Object.assign({},L,{cup:null,stars:[]}),sol,true); for(const p of r.path) if(p[1]>130) return [Math.round(Math.max(11,Math.min(89,p[0]))),152]; return null; };
  const okUse=r=>!must||(must==='fan'?r.used.fan>.15:r.used[must]>0);
  let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5;};
  const robust=(L,sol,N)=>{let ok=0;for(let k=0;k<N;k++){const sx=rnd()*3,sy=rnd()*3;
    const js=sol.map(st=>st.map(p=>[p[0]+sx+rnd()*1.6,p[1]+sy+rnd()*1.6]));const r=G.simulate(L,js,false);if(r.status==='win'&&okUse(r))ok++;}return ok/N;};
  const wins=[];
  for(let x0=4;x0<=96;x0+=6) for(let y0=20;y0<=146;y0+=8) for(const dir of [-1,1]) for(let ang=-10;ang<=80;ang+=10) for(const len of [8,14,22,34]){
    const a=ang*Math.PI/180, x1=x0+dir*Math.cos(a)*len, y1=y0+Math.sin(a)*len;
    if(x1<1||x1>99||y1>158||y1<2) continue;
    const pts=[[x0,y0],[(x0+x1)/2,(y0+y1)/2],[x1,y1]].map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)]);
    if(pts.some(inZ)) continue;
    const sol=[pts]; const L=Object.assign({},L0,{stars:[]}); const cup=placeCup(L,sol); if(!cup) continue; L.cup=cup;
    const r=G.simulate(L,sol,false); if(r.status!=='win'||!okUse(r)) continue;
    wins.push({sol,cup,len});
  }
  let best=null; wins.sort((a,b)=>a.len-b.len);
  for(const w of wins.slice(0,60)){ const L=Object.assign({},L0,{stars:[],cup:w.cup}); const rb=robust(L,w.sol,20);
    if(!best||rb>best.rb) best={rb,sol:w.sol,cup:w.cup,n:wins.length}; }
  return best;
}"""

JS_BUILD = """(src)=>{
  const G=__game, L=JSON.parse(JSON.stringify(src));
  const sol=L.sol; let note=[];
  if(L.cup==='auto'){
    const r=G.simulate(Object.assign({},L,{cup:null,stars:[]}),sol,true);
    let x=null; for(const p of r.path){ if(p[1]>130){x=p[0];break;} }
    if(x==null){return {err:'auto: шарик не долетел до низа ('+r.status+' '+r.x.toFixed(1)+','+r.y.toFixed(1)+')'};}
    L.cup=[Math.round(Math.max(11,Math.min(89,x))),152];
  }
  const base=Object.assign({},L,{stars:[]});
  const empty=G.simulate(base,[],false);
  if(empty.status==='win') note.push('ПРОХОДИТСЯ БЕЗ РИСОВАНИЯ');
  const r=G.simulate(base,sol,true);
  if(L.must&&!(L.must==='fan'?r.used.fan>.15:r.used[L.must]>0)) note.push('НЕ ИСПОЛЬЗУЕТ '+L.must);
  if(r.status!=='win') return {err:'решение не проходит: '+r.status+' at '+r.x.toFixed(1)+','+r.y.toFixed(1), L};
  // звёзды на траектории
  const P=r.path; let len=[0]; for(let i=1;i<P.length;i++) len.push(len[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  const tot=len[len.length-1]; const fr=L.starAt||[.3,.55,.78];
  L.stars=fr.map(f=>{let i=len.findIndex(v=>v>=tot*f); if(i<0)i=P.length-1; return [+P[i][0].toFixed(1),+P[i][1].toFixed(1)];});
  const r2=G.simulate(L,sol,false);
  if(r2.status!=='win'||r2.got<3) return {err:'со звёздами: '+r2.status+' got '+r2.got, L};
  const sl=sol.reduce((a,s)=>a+G.strokeLen(s),0);
  L.ink=L.ink||Math.ceil((sl*1.4+12)/5)*5;
  // устойчивость: дрожание каждой точки и сдвиг всей линии
  let ok=0,N=40,seed=1; const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5;};
  for(let k=0;k<N;k++){ const sx=rnd()*3, sy=rnd()*3;
    const js=sol.map(s=>s.map(p=>[p[0]+sx+rnd()*1.6,p[1]+sy+rnd()*1.6]));
    if(G.simulate(base,js,false).status==='win') ok++; }
  return {L, robust:ok/N, time:r.t, note:note.join('; ')};
}"""

def draw_debug(pg, L, path, fname):
    pg.evaluate("""([L,path])=>{
      let c=document.getElementById('dbg'); if(!c){c=document.createElement('canvas');c.id='dbg';c.width=300;c.height=480;
        c.style.cssText='position:fixed;left:0;top:0;z-index:99;background:#fff;width:300px;height:480px';document.body.appendChild(c);}
      const x=c.getContext('2d'),s=3; x.fillStyle='#eaf4ff';x.fillRect(0,0,300,480);
      const ln=(a,b,cl,w)=>{x.strokeStyle=cl;x.lineWidth=w;x.beginPath();x.moveTo(a[0]*s,a[1]*s);x.lineTo(b[0]*s,b[1]*s);x.stroke();};
      (L.nodraw||[]).forEach(z=>{x.fillStyle='rgba(255,0,0,.15)';x.fillRect(z[0]*s,z[1]*s,z[2]*s,z[3]*s);});
      (L.fans||[]).forEach(z=>{x.fillStyle='rgba(0,180,255,.18)';x.fillRect(z[0]*s,z[1]*s,z[2]*s,z[3]*s);});
      (L.walls||[]).forEach(w=>ln([w[0],w[1]],[w[2],w[3]],'#334',7));
      (L.boxes||[]).forEach(b=>{x.fillStyle='#334';x.fillRect(b[0]*s,b[1]*s,b[2]*s,b[3]*s);});
      (L.tramp||[]).forEach(w=>ln([w[0],w[1]],[w[2],w[3]],'#f39',7));
      (L.spikes||[]).forEach(w=>ln([w[0],w[1]],[w[2],w[3]],'#e22',6));
      (L.saws||[]).forEach(w=>{ln([w[0],w[1]],[w[2],w[3]],'rgba(0,0,0,.3)',2);x.fillStyle='rgba(120,120,140,.7)';x.beginPath();x.arc(w[0]*s,w[1]*s,w[4]*s,0,7);x.fill();x.beginPath();x.arc(w[2]*s,w[3]*s,w[4]*s,0,7);x.fill();});
      (L.portals||[]).forEach(p=>{x.fillStyle='#39f';x.beginPath();x.arc(p[0]*s,p[1]*s,12,0,7);x.fill();x.fillStyle='#f93';x.beginPath();x.arc(p[2]*s,p[3]*s,12,0,7);x.fill();});
      if(L.cup){const [cx,by]=L.cup;ln([cx-9,by-15],[cx-9,by],'#d90',6);ln([cx-9,by],[cx+9,by],'#d90',6);ln([cx+9,by],[cx+9,by-15],'#d90',6);}
      L.sol.forEach(st=>{x.strokeStyle='#90f';x.lineWidth=5;x.beginPath();st.forEach((p,i)=>i?x.lineTo(p[0]*s,p[1]*s):x.moveTo(p[0]*s,p[1]*s));x.stroke();});
      x.fillStyle='rgba(0,120,0,.5)';path.forEach(p=>x.fillRect(p[0]*s-1,p[1]*s-1,2,2));
      (L.stars||[]).forEach(p=>{x.fillStyle='#fc0';x.beginPath();x.arc(p[0]*s,p[1]*s,8,0,7);x.fill();});
      x.fillStyle='#09f';x.beginPath();x.arc(L.ball[0]*s,L.ball[1]*s,9.6,0,7);x.fill();
      x.fillStyle='#000';x.font='bold 16px sans-serif';x.fillText(L.title||'',6,18);
    }""", [L, path])
    pg.locator("#dbg").screenshot(path=fname)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 400, "height": 700}); pg.goto("file://" + HTML); pg.wait_for_timeout(300)
    out, bad = [], 0
    for i, src in enumerate(SRC):
        if src.get("search"):
            found = pg.evaluate(JS_SEARCH, src)
            if found:
                src = dict(src, sol=found["sol"]); print(f"   поиск: вариантов {found['n']}, лучший robust≈{found['rb']:.0%} {found['sol']}")
            else:
                print("   поиск: решение не найдено")
        res = pg.evaluate(JS_BUILD, src)
        if "err" in res:
            bad += 1; print(f"{i+1:2d} ✗ {src.get('title','')}: {res['err']}")
            L = res.get("L") or dict(src, cup=src["cup"] if src["cup"] != "auto" else None)
            if OUT:
                r = pg.evaluate("([L,s])=>__game.simulate(Object.assign({},L,{cup:L.cup||null,stars:[]}),s,true).path", [L, src["sol"]])
                draw_debug(pg, L, r, f"{OUT}/lv{i+1:02d}.png")
            out.append(None); continue
        L = res["L"]; out.append(L)
        flag = "" if res["robust"] >= .5 else "  ← неустойчиво"
        print(f"{i+1:2d} ✓ {src.get('title',''):24s} cup={L['cup']} ink={L['ink']:3d} t={res['time']:.1f}s robust={res['robust']:.0%}{flag} {res['note']}")
        if OUT:
            r = pg.evaluate("([L])=>__game.simulate(L,L.sol,true).path", [L])
            draw_debug(pg, L, r, f"{OUT}/lv{i+1:02d}.png")
    b.close()
print("FAILED:", bad, "of", len(SRC))
if bad == 0:
    keep = ["title", "ball", "cup", "stars", "ink", "walls", "boxes", "tramp", "spikes", "portals", "fans", "saws", "nodraw", "sol"]
    final = [{k: L[k] for k in keep if k in L and L[k] not in (None, [])} for L in out]
    txt = "const LEVELS=" + json.dumps(final, ensure_ascii=False, separators=(",", ":")) + ";"
    html = open(HTML, encoding="utf-8").read()
    html = re.sub(r"/\*LEVELS\*/.*?/\*ENDLEVELS\*/", "/*LEVELS*/\n" + txt.replace("\\", "\\\\") + "\n/*ENDLEVELS*/", html, flags=re.S)
    open(HTML, "w", encoding="utf-8").write(html)
    print("written", len(final), "levels")
