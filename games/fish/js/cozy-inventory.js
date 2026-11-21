/* Cozy Inventory: real gear-model artwork, shelf previews and bait guidance.
 * Reuses the original shop/equipment handlers, purchases and saves unchanged.
 */
(function(FZ){
 "use strict";
 const UI=FZ.UI,G=FZ.Game,Art=FZ.Art,U=FZ.U;
 if(!UI||!G||!Art||!U)return;
 const esc=U.esc;
 const data={
  rod:()=>FZ.RODS.map(x=>({id:x.id,kind:"rod",item:x})),
  line:()=>FZ.LINES.map(x=>({id:x.id,kind:"line",item:x})),
  hook:()=>FZ.HOOKS.map(x=>({id:x.id,kind:"hook",item:x})),
  bait:()=>FZ.BAITS.filter(x=>!x.lure).map(x=>({id:x.id,kind:"bait",item:x})).concat([{id:"gb",kind:"gb",item:FZ.GROUNDBAIT}]),
  lure:()=>FZ.BAITS.filter(x=>!!x.lure).map(x=>({id:x.id,kind:"bait",item:x})),
  extra:()=>Object.keys(FZ.EXTRAS).map(id=>({id,kind:"extra",item:FZ.EXTRAS[id]}))
 };
 function icon(id){return Art.icon(id,112)}
 function owned(entry){
  return entry.kind==="bait"?G.baitLeft(entry.id)>0:
    entry.kind==="gb"?(G.state().inv.gb||0)>0:G.owned(entry.kind,entry.id);
 }
 function equipped(entry){
  const loads=Object.values(G.state().load||{});
  return loads.some(l=>l && (
    entry.kind==="rod"&&l.rod===entry.id||
    entry.kind==="line"&&l.line===entry.id||
    entry.kind==="hook"&&l.hook===entry.id||
    entry.kind==="bait"&&l.bait===entry.id
  ));
 }
 function info(entry){
  const x=entry.item||{};
  if(entry.kind==="rod")return (x.cast?"Заброс до "+x.cast+" м · ":"")+"Мощность до "+x.power+" кг · Чувствительность ×"+x.sens;
  if(entry.kind==="line")return "Разрывная нагрузка "+x.test+" кг · Заметность "+["минимальная","низкая","средняя","выше средней","высокая","очень высокая"][x.vis];
  if(entry.kind==="hook")return x.note||"Крючок для оснастки";
  if(entry.kind==="extra")return x.note||"Дополнительное снаряжение";
  if(entry.kind==="gb")return "Прикормка для мирной рыбы · 5 порций";
  if(x.lure){
    const names={spin:"спиннинга",ice:"зимней рыбалки",feeder:"фидера",float:"поплавочной ловли"};
    return "Приманка для "+x.m.map(mode=>names[mode]||"рыбалки").join(", ");
  }
  return "Натуральная наживка · "+x.pack+" шт. в упаковке";
 }
 function tag(entry){
  if(equipped(entry))return "На снасти";
  if(owned(entry))return "В ящике";
  if(G.state().lvl<(entry.item.lvl||1))return "С "+entry.item.lvl+" уровня";
  return "Доступно";
 }
 function itemCount(section){const list=data[section]&&data[section]();return list?list.filter(owned).length:0}
 function card(entry){
  return '<img src="'+icon(entry.id)+'" alt="" decoding="async">'+
   '<div><small class="cozy-eyebrow">'+esc(tag(entry))+'</small><strong>'+esc(entry.item.n)+'</strong>'+
   '<span>'+esc(info(entry))+'</span></div>';
 }
 const oldShop=UI.showShop;
 UI.showShop=function(){
  const result=oldShop.apply(this,arguments);
  const sh=document.querySelector('#ovSheet .sheet');
  const scroll=sh&&sh.querySelector('.scroll');
  const selected=sh&&sh.querySelector('.tabs .tab.on');
  const section=selected&&selected.dataset.tab;
  if(!scroll||!data[section])return result;
  // Make the hidden remaining shop categories discoverable on small phones.
  const tabs=sh.querySelector('.tabs');
  if(tabs){
    const strip=document.createElement('div');strip.className='cozy-tab-strip';
    tabs.parentNode.insertBefore(strip,tabs);strip.appendChild(tabs);
    const arrow=document.createElement('button');arrow.type='button';arrow.className='cozy-tab-next';
    strip.appendChild(arrow);
    const update=()=>{
      const overflow=tabs.scrollWidth>tabs.clientWidth+3;
      const atEnd=tabs.scrollLeft>=tabs.scrollWidth-tabs.clientWidth-3;
      arrow.hidden=!overflow;
      arrow.textContent=atEnd?'‹':'›';
      arrow.setAttribute('aria-label',atEnd?'Показать первые вкладки':'Показать остальные вкладки');
    };
    arrow.addEventListener('click',()=>{
      const current=tabs.scrollLeft,max=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
      const atEnd=current>=max-3;
      // Snap to a WHOLE category label. A fixed pixel offset used to leave
      // clipped Cyrillic letter fragments at the left of the shop bar.
      const frame=tabs.getBoundingClientRect();
      const starts=[...tabs.querySelectorAll('.tab')].map(tab=>
        tab.getBoundingClientRect().left-frame.left+current);
      const next=starts.find(x=>x>current+Math.max(40,tabs.clientWidth*.53));
      tabs.scrollLeft=atEnd?0:Math.min(max,next==null?max:next);
      update();
    });
    tabs.addEventListener('scroll',update,{passive:true});
    requestAnimationFrame(update);
  }
  const list=data[section]();
  const rows=[...scroll.children].filter(e=>e.classList&&e.classList.contains('row'));
  if(rows.length!==list.length){console.warn("Cozy inventory: list mismatch",section,rows.length,list.length);return result}
  const banner=document.createElement('div');banner.className="cozy-shelf-summary";
  banner.innerHTML='<span>МОЙ РЫБОЛОВНЫЙ ЯЩИК</span><strong>'+itemCount('rod')+' удилищ · '+itemCount('line')+
    ' лесок · '+itemCount('lure')+' приманок</strong>';
  // Tabs live inside a scroll strip; the shelf summary must stay ABOVE it,
  // not become a flex child overlapping the category buttons.
  (sh.querySelector('.cozy-tab-strip')||sh.querySelector('.tabs')).insertAdjacentElement('beforebegin',banner);
  const preview=document.createElement('div');preview.className="cozy-preview";
  preview.setAttribute("aria-live","polite");
  scroll.insertAdjacentElement('beforebegin',preview);
  function choose(entry,row){
   preview.innerHTML=card(entry);
   rows.forEach(e=>e.classList.toggle("cozy-focused",e===row));
  }
  rows.forEach((row,i)=>{
   const ent=list[i],pic=row.querySelector('.pic');
   if(pic)pic.innerHTML='<img loading="lazy" alt="" src="'+icon(ent.id)+'">';
   row.classList.add('cozy-catalog-row');
   row.dataset.cozyId=ent.id;
   row.tabIndex=0;
   row.setAttribute("aria-label","Посмотреть: "+ent.item.n);
   const title=row.querySelector(".body .t");
   if(title){
    const status=document.createElement('small');status.className="cozy-mini-status";status.textContent=tag(ent);
    title.appendChild(status);
   }
   row.addEventListener('click',event=>{
     if(event.target.closest('button'))return;
     choose(ent,row);
   });
   row.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){
      event.preventDefault();choose(ent,row);
    }
   });
  });
  const initial=rows.find(r=>r.querySelector('.cozy-mini-status')?.textContent==='На снасти')||rows[0];
  if(initial)choose(list[rows.indexOf(initial)],initial);
  return result;
 };
 const oldTackle=UI.showTackle;
 UI.showTackle=function(){
  const result=oldTackle.apply(this,arguments);
  const sh=document.querySelector('#ovSheet .sheet'),sc=sh&&sh.querySelector('.scroll.picker');
  const sess=G.sess();
  if(!sc||!sess)return result;
  const mode=sess.mode,L=G.loadout(mode);
  for(const [kind,key] of [['rod','rod'],['line','line'],['hook','hook']]){
   sc.querySelectorAll('[data-'+kind+']').forEach(row=>{
     const id=row.getAttribute('data-'+kind);
     if(!id)return;
     row.querySelectorAll('.cozy-gear-mini').forEach(e=>e.remove());
     let pic=row.querySelector('.pic');if(!pic){pic=document.createElement('div');pic.className='pic';row.insertBefore(pic,row.firstChild)}
     pic.innerHTML='<img loading="lazy" alt="" src="'+icon(id)+'">';
     row.classList.add("cozy-equipped-row");
   });
  }
  const slots=[['Удилище',L.rod],['Леска',L.line],[mode==='spin'?'Приманка':'Крючок',mode==='spin'?L.bait:L.hook]];
  if(mode==='float')slots.push(['Поплавок','float']);
  const panel=document.createElement('div');panel.className="cozy-loadout";
  panel.innerHTML='<strong>МОЯ ОСНАСТКА</strong><div>'+slots.map(([label,id])=>
    '<div class="cozy-slot"><img alt="" src="'+icon(id||'hook')+'"><small>'+esc(label)+'</small></div>').join('')+'</div>';
  sc.insertAdjacentElement('afterbegin',panel);
  return result;
 };
 function baitScore(b,s,mode){
  if(!b||!s||!b.m.includes(mode))return{score:0,fish:0};
  let score=0,fish=0;
  for(const [id,pop] of Object.entries(s.loc.fish||{})){
   const sp=FZ.SP[id];
   if(!sp || !(sp.baits[b.id]>0) || !(sp.methods[mode]>0))continue;
   const value=pop*sp.baits[b.id]*sp.methods[mode]*
      (sp.season[s.season]||0)*(sp.time[s.period]||0);
   if(value<=0.04)continue;
   score+=value;fish++;
  }
  return{score,fish};
 }
 const oldBait=UI.showBait;
 UI.showBait=function(){
  const result=oldBait.apply(this,arguments),sess=G.sess();
  const sh=document.querySelector('#ovSheet .sheet'),sc=sh&&sh.querySelector('.scroll.picker');
  if(!sc||!sess)return result;
  const rows=[...sc.querySelectorAll('[data-b]')];
  const scores=rows.map(row=>{
   const b=FZ.BAIT[row.dataset.b];
   const score=baitScore(b,sess,sess.mode);
   const available=G.baitLeft(row.dataset.b)>0;
   return{row,score,available,selected:G.loadout(sess.mode).bait===row.dataset.b};
  });
  scores.sort((a,b)=>Number(b.selected)-Number(a.selected)||
    Number(b.available)-Number(a.available)||b.score.score-a.score.score);
  const max=Math.max(...scores.map(x=>x.score.score),0);
  for(const c of scores){
   const row=c.row,txt=row.querySelector('.body .d');
   if(txt){
    const line=document.createElement('span');
    line.className="cozy-bait-advice"+(c.score.score>0&&c.score.score>=max*.75?' best':'');
    line.textContent=c.score.fish?(
      c.score.score>=max*.75&&c.score.score>0?'★ Хорошо подходит сейчас · '+c.score.fish+' видов':
      'Подходит сейчас · '+c.score.fish+' видов'):"Нет подходящей активной рыбы сейчас";
    txt.appendChild(line);
   }
   const iconEl=row.querySelector('.pic');
   if(iconEl)iconEl.innerHTML='<img loading="lazy" alt="" src="'+icon(row.dataset.b)+'">';
   sc.appendChild(row);
  }
  const note=document.createElement('div');note.className="cozy-bait-note";
  note.textContent='Подсказки учитывают водоём, время и сезон. Глубина, место заброса и проводка всё ещё важны.';
  sc.insertAdjacentElement('afterbegin',note);
  return result;
 };
 FZ.CozyInventory={icon,baitScore,itemCount,items:(tab)=>data[tab]?data[tab]():[]};
})(window.FZ);
