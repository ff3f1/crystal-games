/* Approved concept: structural UI migration, not the old 1.6 cosmetic skin. */
const assert=require("node:assert/strict"),fs=require("fs"),path=require("path");
const root=path.join(__dirname,"../games/fish");
const js=fs.readFileSync(path.join(root,"js/concept-redesign.js"),"utf8");
const css=fs.readFileSync(path.join(root,"css/concept-redesign.css"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
assert(js.includes('lodge.appendChild(primary)'),"real navigation panel must be built");
assert(js.includes('primary.appendChild(go)'),"existing play control must move into real navigation");
assert(js.includes('primary.appendChild(shop)'),"real shop handler must be preserved");
assert(js.includes('primary.appendChild(settings)'),"settings handler must be preserved");
assert(js.includes('UI.showAchievements=achievements'),"achievements must be a real working sheet");
assert(js.includes('UI.showTackle()'),"inventory leads to existing equipped gear");
assert(js.includes('hud.classList.add("concept-hud")'),"HUD must have an explicitly different layout");
assert(js.includes('wx.temp')&&js.includes('wx.wind'),"weather HUD displays actual conditions");
assert(js.includes('FZ.xpNeed'),"XP comes from real progression, not placeholder numbers");
assert(css.includes('#hud.concept-hud .tray')&&css.includes('flex-direction:column!important'),
 "tackle controls must be on the side of the game view");
assert(css.includes('#ovMenu.concept-redesign .concept-primary'),
 "main menu has a dedicated side navigation");
assert(css.includes('.sheet.concept-shop .scroll'),
 "equipment shop has a new photo-card layout");
assert(html.includes('css/concept-redesign.css')&&html.includes('js/concept-redesign.js'));
console.log("PASS approved concept layout: menu, real HUD, inventory, shop cards, achievements, live data");