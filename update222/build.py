import copy
import hashlib
import struct
import sys
from pathlib import Path
from zipfile import ZipFile
from tempfile import TemporaryDirectory

source, dest = map(Path, sys.argv[1:])
assert hashlib.sha256(source.read_bytes()).hexdigest() == "432a7253de4bfb21900add3d0c0ba0d6477173c840eb249d668b3ba3892e7344"
with TemporaryDirectory() as tmp, ZipFile(source) as original:
    root = Path(tmp)
    def patch(name, transform):
        old=original.read(name).decode("utf-8")
        new=transform(old)
        assert old!=new, name
        return new.encode("utf-8")
    def replace(s,a,b):
        assert s.count(a)==1, (a,s.count(a))
        return s.replace(a,b,1)
    def main(s):
        s=replace(s,'if (!FZ.Dive.render(r,s,t,dt)) Sc.render(v, dt);','if (G.state().settings.underwaterView !== true || !FZ.Dive.render(r,s,t,dt)) Sc.render(v, dt);')
        return s
    def ui(s):
        anchor='  UI.buildHud = function () {'
        code="""  UI.underwaterView = () => G.state().settings.underwaterView === true;
  UI.updateViewButton = function () {
    const b = $("bView"); if (!b) return;
    const on = UI.underwaterView();
    b.textContent = on ? "Под водой" : "С берега";
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Классический вид с берега" : "Включить подводный обзор");
    b.classList.toggle("on", on);
  };
  UI.setUnderwaterView = function (on) {
    G.state().settings.underwaterView = on === true;
    G.save(true); UI.updateViewButton();
  };
"""
        s=replace(s,anchor,code+anchor)
        a="""      '<button class="pill round film" id="bFilm" aria-label="Режим съёмки">' + ic("cam") + "</button>" +"""
        s=replace(s,a,a+"""
      '<button class="pill view-switch" id="bView" type="button" aria-pressed="false">С берега</button>' +""")
        a='    hudBuilt = true;'
        s=replace(s,a,a+"""
    $("bView").addEventListener("pointerdown", e => e.stopPropagation());
    $("bView").onclick = () => { UI.setUnderwaterView(!UI.underwaterView()); FZ.Sound.click(); UI.toast(UI.underwaterView() ? "Подводный обзор включён" : "Классическая рыбалка"); };
    UI.updateViewButton();""")
        a='sw("vibro", "Вибрация")'
        s=replace(s,a,a+' + sw("underwaterView", "Подводный обзор (выкл. — классика)")')
        a='S[k] = !S[k]; b.classList.toggle("on", S[k]);'
        s=replace(s,a,a+' if (k === "underwaterView") UI.updateViewButton();')
        return s
    def renewal(s):
        s=replace(s,"else if(r.hunt && r.hunt.shy>.1)html='Отходит · дай приманке успокоиться';","else if(UI.underwaterView() && r.hunt && r.hunt.shy>.1)html='Отходит · дай приманке успокоиться';")
        s=replace(s,"else if(r.hunt && r.idleT<4)html='Шевельни наживку и дай рыбе подойти';","else if(r.hunt && r.idleT<4)html=UI.underwaterView()?'Шевельни наживку и дай рыбе подойти':s.mode==='feeder'?'Следи за вершинкой удилища':'Следи за поплавком';")
        a="['Дождись потяжки'"
        s=replace(s,a,"['Выбери обзор','По умолчанию вид с берега: ориентируйся по снасти. Кнопка «С берега» включает подводный обзор, повторное нажатие возвращает классический вид. Настройка сохраняется.'],\n "+a)
        return s
    def scene(s):
        # Surface wake and jumping fish remain, but submerged fish are invisible in classic mode.
        a='if(!f.jump && f.Z>=9)return;'
        s=replace(s,a,a+'\n    if(FZ.Game.state().settings.underwaterView !== true && !f.jump && f.surface < .6)return;')
        a='const lineEnd = fishPose || liftPose ? FZ.Art.mouth(v.fish.s,fishPose || liftPose) : floatOnWater ? floatSurface(target, tk, t) : target;'
        s=replace(s,a,'const hiddenFish = fishPose && FZ.Game.state().settings.underwaterView !== true && !v.fish.jump && v.fish.surface < .6;\n    const lineEnd = (fishPose && !hiddenFish) || liftPose ? FZ.Art.mouth(v.fish.s,fishPose || liftPose) : floatOnWater ? floatSurface(target, tk, t) : target;')
        # Optional under-ice silhouette: exact old branch differs from packaged APK, so guard the known predicate if present.
        a='if (f && f.depth != null && f.depth < 1.6 && !f.out) {'
        if a in s: s=replace(s,a,'if (FZ.Game.state().settings.underwaterView === true && f && f.depth != null && f.depth < 1.6 && !f.out) {')
        return s
    def css(s):
        return s+"""
/* 2.2.2 — optional underwater camera, not a simulation mode */
.view-switch{position:absolute;right:10px;top:calc(100px + var(--safe-t));min-height:40px;min-width:84px;padding:7px 10px;font-size:11px;font-weight:700;pointer-events:auto;border:1px solid #b7d5c777}
.view-switch.on{background:#254c4c;color:#e4f6eb;border-color:#a2d5c9}
body.filming .view-switch{opacity:0;pointer-events:none!important}
@media(max-height:480px){.view-switch{top:calc(54px + var(--safe-t));right:58px;min-height:34px}}
"""
    updates={
        'assets/js/main.js':patch('assets/js/main.js',main),
        'assets/js/ui.js':patch('assets/js/ui.js',ui),
        'assets/js/renewal.js':patch('assets/js/renewal.js',renewal),
        'assets/js/scene.js':patch('assets/js/scene.js',scene),
        'assets/css/style.css':patch('assets/css/style.css',css),
    }
    manifest=original.read('AndroidManifest.xml')
    for old,new in [('2.2.1'.encode('utf-16le'),'2.2.2'.encode('utf-16le')),(struct.pack('<I',2201),struct.pack('<I',2202))]:
        assert manifest.count(old)==1,(old,manifest.count(old))
        manifest=manifest.replace(old,new)
    with ZipFile(dest,'w') as output:
        for entry in original.infolist():
            n=entry.filename
            if n.startswith('META-INF/') and n.upper().endswith(('.RSA','.SF','.DSA','.EC','MANIFEST.MF')): continue
            data=manifest if n=='AndroidManifest.xml' else updates.get(n,original.read(n))
            output.writestr(copy.copy(entry),data)
    with ZipFile(dest) as result:
        for n in original.namelist():
            if n=='AndroidManifest.xml' or n in updates or n not in result.NameToInfo: continue
            assert original.read(n)==result.read(n), n
    print('Verified unchanged simulation, saves, resources and native code; five presentation files patched.')
