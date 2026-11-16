/* Дополнительные долгосрочные цели для опытных рыбаков. */
(function (FZ) {
  "use strict";
  FZ.World.ACHIEVEMENTS.push(
    { id:"quarter_thousand", n:"Настоящий рыбак", d:"Поймать 250 рыб", stat:"total", need:250, reward:1800 },
    { id:"hundred_kg", n:"Тяжёлый улов", d:"Наловить суммарно 100 кг", stat:"kg", need:100, reward:2200 },
    { id:"release_master", n:"Рыба будет жить", d:"Отпустить 50 рыб", stat:"released", need:50, reward:1600 },
    { id:"atlas_30", n:"Большая энциклопедия", d:"Открыть 30 видов в атласе", stat:"species", need:30, reward:2500 },
    { id:"arctic_master", n:"Хозяин Полярья", d:"Открыть 5 северных видов", stat:"species", need:35, reward:3000 }
  );
})(window.FZ);
