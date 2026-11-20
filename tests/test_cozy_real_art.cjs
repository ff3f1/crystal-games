/* Verify art integrity in the real source tree; no mock images or builds. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../games/fish');
function has(p){return fs.existsSync(path.join(root,p))}
const script=fs.readFileSync(path.join(root,'js/cozy-realistic-art.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const p of ['js/cozy-realistic-art.js','js/cozy-inventory.js','js/cozy-gear.js',
 'css/cozy-realistic-art.css','css/cozy-inventory.css',
 'assets/equipment/spoon.png','assets/equipment/spinner.png','assets/equipment/wobbler.png',
 'assets/equipment/jig.png','assets/equipment/float_round.png',
 'assets/equipment/float_pear.png','assets/equipment/float_waggler.png',
 'assets/items/mouse.webp','assets/items/balancer.webp','assets/items/jig.webp']) {
 assert(has(p),'missing crucial art or code: '+p);
}
const order=['js/cozy-gear.js','js/cozy-inventory.js','js/cozy-realistic-art.js']
 .map(x=>index.indexOf('<script src="'+x+'"></script>'));
assert(order.every(x=>x>=0),'missing script load');
assert(order[0]<order[1] && order[1]<order[2],
 'real-art overrides must load after earlier art mappings');
assert(script.includes("spoon:equipment('spoon')"),'real hammered spoon retained');
assert(script.includes("f1:equipment('rod_float_entry')"),'original detailed rod family retained');
assert(script.includes("FZ.Art.icon=function"),'art mapping override registered');
assert(index.includes('cozy-clean-rod'),'rod transparency cleanup filter defined');
console.log('PASS: paths, real metal lure, rod sources, load order and alpha filter');
