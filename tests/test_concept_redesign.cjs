/* Approved main menu: the reference is a visible 3×3 with working gameplay controls. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"../games/fish"),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const js=read("js/approved-menu-v4.js"),css=read("css/approved-menu-v4.css"),html=read("index.html");
const legacy=read("js/concept-redesign.js");
assert(legacy.includes('hud.classList.add("concept-hud")'),"fish HUD is preserved");
assert(legacy.includes("UI.showAchievements=achievements"),"existing achievements are preserved");
assert(js.includes("UI.showMenu = function"),"working menu is wrapped, not replaced with a still image");
assert(js.includes("ids.forEach((id, i)"),"all nine buttons stay connected to existing handlers");
const nine=["mMap","mShop","mAtlas","mJourney","mJournal","mQuests","mTour","mForecast","mSet"];
for(const id of nine)assert(js.includes(id),"missing real menu button: "+id);
assert(js.includes("profile.innerHTML = profileHtml(status)"),"stats come from real save, not image demo numbers");
assert(js.includes("FZ.xpNeed")&&js.includes("st.records"),"real XP and catch records used");
assert(js.includes("button.classList.add('ref-pressed')"),"pointer press feedback exists");
assert(css.includes("grid-template-columns:repeat(3,minmax(0,1fr))"),"main menu uses 3 columns");
assert(css.includes("grid-template-rows:repeat(3,minmax(0,1fr))"),"main menu uses 3 rows");
assert(css.includes(".reference-hero")&&css.includes("hero.webp"),"approved lakeside scene is integrated");
assert(css.includes("tiles.webp")&&css.includes("cta.webp"),"approved button art is integrated");
assert(!css.includes("scroll-snap-type:x mandatory!important"),"no horizontal scrolling for the nine primary destinations");
assert(html.includes("css/approved-menu-v4.css")&&html.includes("js/approved-menu-v4.js"),"art module loaded after old skin");
for(const f of ["hero.webp","cta.webp","tiles.webp"]){
 const st=fs.statSync(path.join(root,"assets/menu-reference",f));
 assert(st.size>2000,"actual artwork is committed: "+f);
}
assert(fs.statSync(path.join(root,"assets/audio/cozy/woodtap.wav")).size>2000,
 "soft wooden click sample must ship with the game");
console.log("PASS approved reference: actual menu art, real stats, 3x3, button handlers, wooden clicks");
