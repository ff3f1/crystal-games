/* Большое контентное расширение: новые регионы и виды рыб. */
(function (FZ) {
  "use strict";
  const species = [
    { id:"chekhon", n:"Чехонь", lat:"Pelecus cultratus", en:"sabrefish", kind:"pred", rar:2, min:.15, med:.65, trophy:2.1, max:4.5, refL:38, refW:.55, price:210,
      methods:{spin:1.1,float:1,feeder:.8}, baits:{maggot:1.1,worm:.8,grasshopper:1.2,spinner:1,spoon:1.1}, depth:{top:1.4,mid:1,bottom:.2}, time:{dawn:1.2,day:1.1,dusk:1.3,night:.2}, season:{spring:1.2,summer:1.3,autumn:.8,winter:.1}, bite:"slide", fight:{power:.9,stamina:.8,runs:.7,jump:.2,shake:.2}, look:{h:.2,back:"#465b60",side:"#b9c9c8",belly:"#edf0e8",fin:"#9c7a65",eye:"#d8c48a",head:"small"}, desc:"Стройная серебристая рыба с саблевидным телом. Держится в верхних слоях воды, охотится на малька и берёт на лёгкие приманки." },
    { id:"rybets", n:"Рыбец", lat:"Vimba vimba", en:"vimba bream", kind:"peace", rar:3, min:.2, med:.9, trophy:2.8, max:5, refL:42, refW:.8, price:290,
      methods:{feeder:1.3,float:.8}, baits:{worm:1.2,maggot:1,barley:1.1,crawler:1.2,bread:.6}, depth:{top:.1,mid:.6,bottom:1.4}, time:{dawn:1.2,day:.8,dusk:1.2,night:.6}, season:{spring:1.4,summer:1,autumn:1.1,winter:.2}, bite:"twitch", fight:{power:.9,stamina:.8,runs:.45,jump:.05,shake:.2}, look:{h:.25,back:"#3d4b4a",side:"#aebbb5",belly:"#e9e9df",fin:"#bd755b",eye:"#d6bf82",pat:"scales"}, desc:"Речная рыба с вытянутым телом и характерным носом. Весной идёт на нерест вверх по течению, летом кормится у каменистого дна." },
    { id:"nelma", n:"Нельма", lat:"Stenodus leucichthys nelma", en:"nelma", kind:"pred", rar:5, min:1, med:4.5, trophy:14, max:35, refL:82, refW:4.2, price:1250,
      methods:{spin:1.3,feeder:.2,float:.4}, baits:{spoon:1.3,wobbler:1.2,spinner:1.1,livebait:1}, depth:{top:.8,mid:1.3,bottom:.6}, time:{dawn:1.3,day:1,dusk:1.2,night:.4}, season:{spring:.8,summer:1.2,autumn:1.2,winter:.4}, bite:"drag", fight:{power:1.5,stamina:1.35,runs:1,jump:.1,shake:.45}, look:{h:.22,back:"#46565c",side:"#c4d0d0",belly:"#f0f2ec",fin:"#8b9a9c",eye:"#d8c88c",pat:"scales",head:"asp"}, desc:"Крупный северный сиговый хищник. Нельма держится в холодных реках и озёрах, охотится на малька и проверяет снасть длинными рывками." },
    { id:"muksun", n:"Муксун", lat:"Coregonus muksun", en:"muksun", kind:"peace", rar:4, min:.4, med:1.8, trophy:5.5, max:10, refL:58, refW:1.6, price:920,
      methods:{float:1,feeder:.9,ice:1.1}, baits:{amphipod:1.4,bloodworm:1,maggot:.8,mormy:1.1}, depth:{top:.2,mid:1,bottom:1.1}, time:{dawn:1.2,day:.9,dusk:1.2,night:.5}, season:{spring:.8,summer:.8,autumn:1.2,winter:1.3}, bite:"slide", fight:{power:1,stamina:1.1,runs:.55,jump:.05,shake:.2}, look:{h:.24,back:"#46575b",side:"#b7c5c5",belly:"#edf0e8",fin:"#8d9b96",eye:"#d8c88c",pat:"scales"}, desc:"Ценная северная рыба с серебристым телом. Любит холодную чистую воду, зимой подходит к ямам и берёт на бокоплава." },
    { id:"chir", n:"Чир", lat:"Coregonus nasus", en:"broad whitefish", kind:"peace", rar:4, min:.5, med:2.4, trophy:7, max:14, refL:62, refW:2.1, price:1050,
      methods:{float:.8,feeder:1,ice:1.2}, baits:{amphipod:1.3,bloodworm:1,worm:.7,mormy:1.1}, depth:{top:.1,mid:.7,bottom:1.4}, time:{dawn:1.1,day:.8,dusk:1.2,night:.7}, season:{spring:.8,summer:.7,autumn:1.1,winter:1.4}, bite:"drag", fight:{power:1.2,stamina:1.2,runs:.5,jump:.02,shake:.25}, look:{h:.25,back:"#45565a",side:"#aebfc0",belly:"#edf0e8",fin:"#7d9294",eye:"#d8c88c",pat:"scales"}, desc:"Широкотелый северный сиг. Держится у дна в холодной воде, зимой становится активнее и способен нагрузить лёгкую снасть." }
  ];
  species.forEach(function (s) {
    if (FZ.SP[s.id]) return;
    s.sigma = Math.log(s.trophy / s.med) / 2.05;
    s.lwA = s.refW / Math.pow(s.refL, 3);
    s.look.pat = s.look.pat || "none";
    s.look.head = s.look.head || "normal";
    s.look.dorsal = s.look.dorsal || "normal";
    s.look.tail = s.look.tail || "fork";
    FZ.SPECIES.push(s);
    FZ.SP[s.id] = s;
  });
  const locations = [
    { id:"don", n:"Донские плёсы", reg:"Ростовская область", lvl:22, fee:0, zfar:165, depth:[1.5,12], current:.48, style:"delta",
      desc:"Широкие донские плёсы, песчаные косы и глубокие русловые ямы. На поверхности охотится чехонь, у дна держится рыбец.",
      fish:{chekhon:18,rybets:16,asp:10,zander:10,bream:12,catfish:5,sterlet:2,pike:7} },
    { id:"polar", n:"Полярная река", reg:"Ямало-Ненецкий автономный округ", lvl:28, fee:0, zfar:190, depth:[2,14], current:.9, style:"taiga",
      desc:"Холодная северная река среди тундры. Здесь охотится нельма, а в глубоких ямах держатся муксун и чир.",
      fish:{nelma:12,muksun:18,chir:16,whitefish:10,grayling:8,burbot:8,pike:3} }
  ];
  locations.forEach(function (l) {
    if (FZ.LOC[l.id]) return;
    FZ.LOCATIONS.push(l);
    FZ.LOC[l.id] = l;
  });
})(window.FZ);
