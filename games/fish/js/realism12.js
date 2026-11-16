/* Рыбалка: Клюёт! — расширение 1.2, данные мира и рыболовная аналитика. */
(function (FZ) {
  "use strict";
  const G = FZ.Game, UI = FZ.UI, W = FZ.World;
  const kinds = {
    micro: { power:.65,stamina:.6,runs:.38,jump:.03,shake:.25 },
    sprint: { power:1.12,stamina:1.18,runs:.78,jump:.25,shake:.45 },
    tank: { power:1.45,stamina:1.55,runs:.4,jump:.02,shake:.23 },
    hunter: { power:1.3,stamina:1.1,runs:.85,jump:.22,shake:.55 },
    marine: { power:1.52,stamina:1.48,runs:.65,jump:.1,shake:.55 },
    eel: { power:.95,stamina:1.35,runs:.58,jump:0,shake:.82 }
  };

  // Each row: id, name, latin, reference fish, min, common, trophy, maximum,
  // reference length in cm, rarity, fight profile, portrait tint, ecology.
  const additions = [
    ["gudgeon","Пескарь","Gobio gobio","dace",.025,.07,.16,.27,14,1,"micro","#baa16e","Мелкая донная рыба с усиками. Ищите на песчаных перекатах, используйте червя."],
    ["minnow","Гольян","Phoxinus phoxinus","bleak",.008,.023,.055,.11,10,1,"micro","#6caa8c","Стайный обитатель холодных ручьёв. Активен в светлое время."],
    ["eel","Речной угорь","Anguilla anguilla","burbot",.25,1.1,2.6,4.9,76,4,"eel","#8e8a6e","Сумеречный охотник, умеющий уходить под коряги и резко менять натяжение."],
    ["silvercarp","Толстолобик","Hypophthalmichthys molitrix","grasscarp",1,5.1,16,36,75,4,"tank","#d6e3da","Мощный обитатель тёплых вод. Рывок тяжелой рыбы проверит фрикцион."],
    ["vendace","Ряпушка","Coregonus albula","smelt",.03,.11,.27,.5,18,2,"micro","#bccbd9","Холодноводная стайная рыба озёр и северных заливов, берёт на мелкую насадку."],
    ["peled","Пелядь","Coregonus peled","whitefish",.18,.95,2.4,4.6,40,3,"sprint","#c4d1bf","Озёрный сиг. Выходит кормиться на бровки, осторожно берёт у дна."],
    ["pinksalmon","Горбуша","Oncorhynchus gorbuscha","coho",.7,1.9,3.6,6.1,55,3,"sprint","#d0b9c4","Проходной тихоокеанский лосось. На быстром течении борется особенно энергично."],
    ["chumsalmon","Кета","Oncorhynchus keta","chinook",1.4,4.7,9.3,16,78,4,"hunter","#b4cac3","Сильный дальневосточный лосось с длинными встречными рывками."],
    ["flounder","Камбала","Platichthys flesus","halibut",.1,.65,2,4.3,38,3,"tank","#b3a887","Донная рыба морских заливов. Упирается в грунт и медленно набирает глубину."],
    ["cod","Треска","Gadus morhua","burbot",.65,4.2,12,31,72,4,"marine","#a2a591","Холодное море, сильная донная потяжка и частые серии рывков."],
    ["navaga","Навага","Eleginus nawaga","smelt",.1,.4,1.1,2.2,30,2,"sprint","#a8bb9f","Северная донная рыба. Особенно активна в холодной воде."],
    ["sculpin","Подкаменщик","Cottus gobio","rotan",.025,.09,.22,.42,12,2,"micro","#8d8270","Прячется под камнями на быстром течении. Берёт короткими осторожными толчками."],
    ["marinka","Маринка","Schizothorax intermedius","lenok",.4,1.5,3.7,7.2,44,4,"sprint","#9ba58b","Горная рыба с мощным корпусом и резкой реакцией на течение."],
    ["osman","Осман","Diptychus maculatus","grayling",.18,.8,2.7,5.8,34,4,"sprint","#b8b99f","Холодные горные потоки, сильные перекаты и короткие быстрые рывки."],
    ["amurpike","Амурская щука","Esox reichertii","pike",.7,2.7,8.2,17,73,4,"hunter","#a8b684","Пятнистый дальневосточный хищник. Атакует возле коряг и заводит снасть в траву."],
    ["redmullet","Барабуля","Mullus barbatus","ruffe",.08,.25,.65,1.2,25,2,"micro","#cd9486","Донная черноморская рыба с усиками, активна на песчаных площадках."],
    ["blackseagoby","Бычок-кругляк","Neogobius melanostomus","rotan",.035,.13,.36,.82,18,2,"micro","#918e74","Каменистые волнорезы и тихие заводи. Берёт со дна без длинных проводок."]
  ];
  const extraMethods = {
    eel:{float:1.2,feeder:1.4,spin:.1,ice:.1},
    silvercarp:{float:1,feeder:1.4,spin:0,ice:0},
    vendace:{float:.7,feeder:.3,spin:.15,ice:1.6},
    peled:{float:.8,feeder:1.2,spin:.25,ice:1.25},
    pinksalmon:{float:.2,feeder:.1,spin:1.55,ice:.1},
    chumsalmon:{float:.25,feeder:.2,spin:1.65,ice:.05},
    flounder:{float:.3,feeder:1.3,spin:1.05,ice:.2},
    cod:{float:.1,feeder:1.2,spin:1.4,ice:.45},
    navaga:{float:.55,feeder:1.1,spin:.5,ice:1.35},
    redmullet:{float:.7,feeder:1.45,spin:.1,ice:0},
    blackseagoby:{float:.95,feeder:1.3,spin:.2,ice:.1},
    amurpike:{float:.2,feeder:.15,spin:1.7,ice:1.2}
  };
  const extraBaits = {
    eel:{crawler:1.6,worm:1.1,livebait:.9},
    silvercarp:{boilie:1.1,bread:1.4,corn:1,barley:.8},
    vendace:{mormy:1.5,bloodworm:1.4,amphipod:1.2,maggot:.8},
    peled:{mormy:1.2,bloodworm:1.1,amphipod:1.5},
    pinksalmon:{salmon_spinner:1.5,spoon:1.3,spinner:1.2,sea_wobbler:1.1},
    chumsalmon:{salmon_spinner:1.6,sea_wobbler:1.4,spoon:1.2},
    flounder:{deep_jig:1.5,crawler:1.15,livebait:1.2},
    cod:{deep_jig:1.6,sea_wobbler:.8,livebait:1.35},
    navaga:{amphipod:1.35,mormy:1.15,deep_jig:1.3},
    redmullet:{worm:1.25,maggot:1.4,crawler:1.1},
    blackseagoby:{worm:1.3,maggot:1.15,crawler:1.3}
  };
  additions.forEach(function (x) {
    if (FZ.SP[x[0]]) return;
    const s = JSON.parse(JSON.stringify(FZ.SP[x[3]]));
    s.id=x[0]; s.n=x[1]; s.lat=x[2]; s.en=x[2];
    s.min=x[4]; s.med=x[5]; s.trophy=x[6]; s.max=x[7];
    s.refL=x[8]; s.refW=x[5]; s.rar=x[9];
    s.fight=Object.assign({},kinds[x[10]]);
    s.assetAlias=x[3]; s.assetTint=x[11]; s.desc=x[12];
    s.methods=Object.assign({},s.methods,extraMethods[s.id]||{});
    s.baits=Object.assign({},s.baits,extraBaits[s.id]||{});
    if(s.id==="eel"){s.time={dawn:.7,day:.4,dusk:1.4,night:1.6};s.bite="drag";}
    if(s.id==="navaga"||s.id==="vendace"){s.season.winter=1.65;s.season.summer=.35;}
    if(s.id==="pinksalmon"||s.id==="chumsalmon"){s.season.summer=1.4;s.season.autumn=1.25;}
    if(s.id==="cod"||s.id==="flounder"||s.id==="redmullet"||s.id==="blackseagoby")s.depth={top:.08,mid:.42,bottom:1.55};
    s.sigma=Math.log(s.trophy/s.med)/2.05;
    s.lwA=s.refW/Math.pow(s.refL,3);
    FZ.SPECIES.push(s);FZ.SP[s.id]=s;
  });

  const waters = [
    {id:"seliger",n:"Озеро Селигер",reg:"Тверская область",lvl:5,fee:0,zfar:100,depth:[1,15],current:.05,style:"lake",photo:"ladoga",desc:"Сосновые острова, прозрачные заливы и песчаные косы. Ловите на бровке и у тростника.",fish:{gudgeon:15,minnow:12,vendace:9,perch:18,pike:8,bream:10,roach:16,tench:7,carp:4}},
    {id:"onega",n:"Онежское озеро",reg:"Карелия",lvl:14,fee:0,zfar:185,depth:[2,45],current:.12,style:"lake",photo:"baikal",desc:"Северный простор, глубокие луды и холодные ветра. Пелядь и ряпушка требуют тонкой снасти.",fish:{vendace:22,peled:15,whitefish:15,smelt:8,perch:12,pike:9,zander:5,grayling:4}},
    {id:"katun",n:"Катунские пороги",reg:"Республика Алтай",lvl:20,fee:0,zfar:135,depth:[1,11],current:1.1,style:"taiga",photo:"taiga",desc:"Изумрудная вода и сильные перекаты у подножия гор. Рыба использует течение против рыболова.",fish:{marinka:16,osman:12,minnow:10,sculpin:12,grayling:17,lenok:13,taimen:4,trout:8}},
    {id:"kola",n:"Река Тулома",reg:"Мурманская область",lvl:24,fee:0,zfar:150,depth:[2,24],current:.75,style:"taiga",photo:"oka",desc:"Лососёвые плёсы Кольского полуострова. Осенний ветер и ледяная вода меняют поведение рыбы.",fish:{pinksalmon:14,navaga:7,vendace:12,grayling:12,whitefish:13,pike:8,burbot:9,trout:10}},
    {id:"amur",n:"Амурская протока",reg:"Хабаровский край",lvl:27,fee:0,zfar:180,depth:[2,20],current:.65,style:"delta",photo:"akhtuba",desc:"Широкие островные протоки, коряги и сильный вечерний клёв дальневосточных хищников.",fish:{amurpike:14,silvercarp:17,catfish:8,grasscarp:12,carp:10,ide:12,zander:7,perch:10}},
    {id:"blacksea",n:"Чёрное море",reg:"Краснодарский край",lvl:29,fee:0,zfar:200,depth:[2,30],current:.35,style:"coast",photo:"volga",desc:"Каменистый берег, прибой и солёная глубина. Донные насадки и морские приманки.",fish:{redmullet:26,blackseagoby:24,flounder:16,terpug:3,smelt:5,rybets:7}},
    {id:"barents",n:"Баренцево море",reg:"Мурманская область",lvl:36,fee:0,zfar:220,depth:[5,65],current:.85,style:"coast",photo:"baikal",desc:"Суровые полярные воды с треской и морскими трофеями. Глубина требует мощного шнура.",fish:{cod:25,navaga:23,flounder:14,halibut:9,smelt:10,whitefish:3}}
  ];
  // Ensure legacy expedition waters also have genuine raster backdrops.
  [["northstream","oka"],["mountainlake","baikal"]].forEach(function(pair){
    const images=FZ.Assets.manifest.images,wl=FZ.Assets.tuning.waterline;
    FZ.SEASON_ORDER.forEach(function(season){
      const key="bg/"+pair[0]+"_"+season;
      if(!images[key])images[key]="bg/"+pair[1]+"_"+season+".webp";
      if(wl[key]==null)wl[key]=wl["bg/"+pair[1]+"_"+season]||.5;
    });
  });
  waters.forEach(function(l) {
    if(FZ.LOC[l.id])return;
    FZ.LOCATIONS.push(l);
    FZ.LOC[l.id]=l;
    // Real raster photography is reused with distinct light and water treatments
    // until each location receives its own original photographic background.
    const images=FZ.Assets.manifest.images,wl=FZ.Assets.tuning.waterline;
    FZ.SEASON_ORDER.forEach(function(season){
      const key="bg/"+l.id+"_"+season;
      if(!images[key])images[key]="bg/"+l.photo+"_"+season+".webp";
      if(wl[key]==null)wl[key]=wl["bg/"+l.photo+"_"+season]||.5;
    });
  });

  // The bite table also reflects currents and habitat, not simply species weights.
  // Existing tidal, season, groundbait and weather modifiers are preserved.
  const oldBite = G.biteTable;
  G.biteTable=function() {
    const list=oldBite.apply(this,arguments),s=G.sess();
    if(!s || !s.loc)return list;
    const current=s.loc.current||0,wx=s.wx;
    return list.map(function(row){
      const fish=row[0];let k=1;
      const powerful=fish.kind==="pred"||fish.fight.power>1.3;
      if(current>.7)k*=powerful?1.16:.91;
      if(wx.wind>=7 && s.loc.style==="lake")k*=fish.depth.bottom>1?1.2:.78;
      if(wx.temp<1)k*=fish.season.winter>1.1?1.16:.88;
      if(s.period==="dawn" && (fish.id==="trout"||fish.id==="grayling"||fish.id==="osman"))k*=1.15;
      if(s.loc.id==="blacksea"||s.loc.id==="barents")k*=s.hour>=5&&s.hour<=9?1.25:1;
      return [fish,row[1]*k];
    });
  };
  G.waterReport=function(){
    const s=G.sess(),w=s.wx;
    const loc=s.loc;
    const active=Object.keys(loc.fish).map(function(id){
      const f=FZ.SP[id];
      return {fish:f,rate:loc.fish[id]*f.season[s.season]*f.time[s.period]*(f.kind==="pred"?w.pred:w.peace)};
    }).sort(function(a,b){return b.rate-a.rate;});
    return {loc,active:active.slice(0,8),wind:w.wind,pressure:w.pressure,sky:w.sky,
      temp:w.temp,hour:s.hour,season:s.season,period:s.period};
  };

  // In-game practical guide, integrated without replacing existing menu actions.
  UI.showWaterReport=function(){
    const p=G.waterReport();
    let html='<h2>Гид по клёву</h2><div class="sub">'+p.loc.n+' · '+FZ.SEASONS[p.season]+
      '</div><div class="scroll"><div class="waterreport">'+
      '<div class="waterreport-summary"><b>'+p.temp+'°</b><span>Ветер '+p.wind+' м/с<br>Давление '+p.pressure+' мм рт. ст.</span></div>'+
      '<h3>Кого стоит искать сейчас</h3>';
    p.active.forEach(function(item,i){
      const f=item.fish,method=Object.keys(f.methods).sort(function(a,b){return f.methods[b]-f.methods[a];})[0];
      html+='<div class="waterreport-row"><span class="waterreport-num">'+(i+1)+'</span><img src="'+FZ.Art.fishURL(f,92,false)+'" alt=""><div><b>'+f.n+'</b><small>'+FZ.METHODS[method].n+' · '+(f.depth.bottom>=f.depth.top?'у дна':'у поверхности')+'</small></div></div>';
    });
    html+='<p class="waterreport-tip">Оценка основана на водоёме, сезоне, времени суток и текущей погоде. На реальный клёв также влияют наживка, глубина и выбранная точка.</p></div></div>';
    UI.sheet(html);
  };
  const oldMenu=UI.showMenu;
  UI.showMenu=function(){
    oldMenu.apply(this,arguments);
    const parent=document.querySelector("#ovMenu .grid");
    if(!parent || document.getElementById("mWaterReport"))return;
    const btn=document.createElement("button");btn.id="mWaterReport";btn.className="tile";
    btn.innerHTML='<svg class="i" viewBox="0 0 24 24"><path d="M2 16l5-6 4 3 5-8 6 5M2 21h20"/></svg>Гид по клёву';
    btn.onclick=function(){UI.showWaterReport();};
    parent.appendChild(btn);
    const go=document.getElementById("mGo");
    if(go && !go.dataset.realism){go.dataset.realism="1";go.innerHTML='На рыбалку<small>'+G.sess().loc.n+'</small>';}
    const logo=document.querySelector("#ovMenu .logo .w1");
    if(logo)logo.setAttribute("data-release","1.2");
  };

  W.ACHIEVEMENTS.push(
    {id:"atlas_50",n:"Коллекционер",d:"Открыть 50 видов рыб в атласе",stat:"species",need:50,reward:6000},
    {id:"atlas_60",n:"Знаток ихтиофауны",d:"Открыть 60 видов рыб",stat:"species",need:60,reward:12000},
    {id:"total_500",n:"Пятьсот поклёвок",d:"Поймать 500 рыб",stat:"total",need:500,reward:5000},
    {id:"weight_500",n:"Полтонны",d:"Наловить в общей сложности 500 кг",stat:"kg",need:500,reward:8500}
  );
  FZ.REALISM_VERSION="1.2";
  FZ.REALISM_CONTENT={species:FZ.SPECIES.length,waters:FZ.LOCATIONS.length};
})(window.FZ);
