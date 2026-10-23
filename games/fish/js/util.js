/* Общие помощники: случайные числа с зерном, математика, форматирование, даты */
window.FZ = window.FZ || {};
(function (FZ) {
  "use strict";
  const U = {};

  U.hash = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.rng = function (seed) {
    let a = (typeof seed === "string" ? U.hash(seed) : seed) >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.normal = () => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return f;
  };
  U.rand = U.rng(Date.now() ^ (Math.random() * 1e9));

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  U.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
  U.weighted = function (list, r) { // list: [[item, weight], ...]
    let s = 0; for (const it of list) s += Math.max(0, it[1]);
    if (s <= 0) return null;
    let x = (r === undefined ? U.rand() : r) * s;
    for (const it of list) { x -= Math.max(0, it[1]); if (x <= 0) return it[0]; }
    return list[list.length - 1][0];
  };
  // Функция распределения стандартной нормали (для процентилей веса)
  U.ncdf = function (x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  };

  U.mix = function (c1, c2, t) { // цвета "#rrggbb"
    const a = U.hex(c1), b = U.hex(c2);
    return U.rgb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  };
  U.hex = function (c) {
    if (c[0] === "#") { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const m = c.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
  };
  U.rgb = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  U.rgba = function (c, a) { const x = U.hex(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + a + ")"; };
  U.shade = (c, k) => (k >= 0 ? U.mix(c, "#ffffff", k) : U.mix(c, "#000000", -k));

  // Вес: 0,34 кг → «340 г», 1.234 → «1,23 кг»
  U.kg = function (w) {
    if (w < 1) return Math.round(w * 1000) + " г";
    if (w < 10) return w.toFixed(2).replace(".", ",") + " кг";
    if (w < 100) return w.toFixed(1).replace(".", ",") + " кг";
    return Math.round(w) + " кг";
  };
  U.money = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
  U.num = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  U.plural = function (n, f1, f2, f5) {
    n = Math.abs(n) % 100; const n1 = n % 10;
    if (n > 10 && n < 20) return f5; if (n1 > 1 && n1 < 5) return f2; if (n1 === 1) return f1; return f5;
  };

  // Дата по местному времени: «2026-10-23»
  U.dayKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  U.dayNum = function (d) { d = d || new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  U.dateRu = function (d) {
    d = d || new Date();
    const m = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    return d.getDate() + " " + m[d.getMonth()];
  };
  U.seasonOf = function (d) {
    const m = (d || new Date()).getMonth();
    if (m === 11 || m <= 1) return "winter";
    if (m <= 4) return "spring";
    if (m <= 7) return "summer";
    return "autumn";
  };

  U.$ = (id) => document.getElementById(id);
  U.el = function (tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  U.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  FZ.U = U;
})(window.FZ);
