/* Restore the existing high-detail game art instead of simplistic SVG placeholders.
 * Review branch only: no APK, no changes to player progress, mechanics or ads.
 * All paths below already exist in games/fish/assets.
 */
(function(FZ){
  'use strict';
  if(!FZ || !FZ.Art || !FZ.UI)return;
  const equipment=id=>'assets/equipment/'+id+'.png';
  const items=id=>'assets/items/'+id+'.webp';
  const R={
    // The existing 2.0.1 art contains materially different real-world rod models.
    f1:equipment('rod_float_entry'), f2:equipment('rod_float_mid'),
    f3:equipment('rod_match'),d1:equipment('rod_feeder_mid'),
    d2:equipment('rod_feeder_heavy'),d3:equipment('rod_carp'),
    s1:equipment('rod_spin_entry'),s2:equipment('rod_spin_mid'),
    s3:equipment('rod_casting'),s4:equipment('rod_sea_light'),
    d4:equipment('rod_sea_heavy'),
    i1:equipment('rod_ice'),i2:equipment('rod_ice'),i3:equipment('rod_ice'),
    // Real spool photos, not graphic stand-ins.
    l1:equipment('line'),l2:equipment('line'),l3:equipment('line'),l4:equipment('line'),
    l5:equipment('braid'),l6:equipment('braid'),l7:equipment('braid'),l8:equipment('braid'),
    h1:equipment('hook'),h2:equipment('hook'),h3:equipment('hook'),
    h4:equipment('hook'),h5:equipment('hook'),
    worm:equipment('worm'),bread:items('bread'),maggot:equipment('maggot'),
    bloodworm:equipment('bloodworm'),dough:equipment('dough'),
    corn:equipment('corn'),barley:items('barley'),livebait:equipment('livebait'),
    grasshopper:equipment('grasshopper'),boilie:equipment('gb'),
    crawler:items('crawler'),amphipod:equipment('amphipod'),
    // Silhouettes consistent with actual lure type; spoon has a true hammered body.
    spinner:equipment('spinner'),spoon:equipment('spoon'),wobbler:equipment('wobbler'),
    jig:equipment('jig'),mouse:items('mouse'),
    balancer:items('balancer'),icespoon:items('spoon'),mormy:equipment('mormy'),
    sea_wobbler:items('wobbler'),salmon_spinner:items('spinner'),
    deep_jig:items('jig'),gb:equipment('gb'),
    float:equipment('float_round'),line:equipment('line'),hook:equipment('hook'),
    feeder:equipment('feeder')
  };
  const floatArt={
    classic:equipment('float_round'),
    forest:equipment('float_pear'),
    match:equipment('float_waggler')
  };
  function floatName(){
    const st=FZ.Game&&FZ.Game.state();
    const id=st&&st.settings&&st.settings.cozyFloatSkin;
    return floatArt[id]?id:'classic';
  }
  function icon(id){
    if(id==='float')return floatArt[floatName()];
    return R[id]||null;
  }
  function scene(id){
    if(id.startsWith('float_'))return floatArt[id.slice(6)]||null;
    if(id.startsWith('bait_'))return R[id.slice(5)]||null;
    return icon(id);
  }
  const prior=FZ.Art.icon;
  FZ.Art.icon=function(id,size){return icon(id)||prior.call(this,id,size)};
  const previousTackle=FZ.UI.showTackle;
  FZ.UI.showTackle=function(){
    const result=previousTackle.apply(this,arguments);
    document.querySelectorAll('#ovSheet .cozy-skins [data-cozy]').forEach(btn=>{
      const pic=btn.querySelector('img'),id=btn.getAttribute('data-cozy');
      if(pic&&floatArt[id])pic.src=floatArt[id];
    });
    return result;
  };
  FZ.CozyRealArt={icon,scene,float:id=>floatArt[id],mapping:R};
})(window.FZ);
