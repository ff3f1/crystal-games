/* Карточка улова 1080×1920 для сторис, VK и Telegram */
(function (FZ) {
  "use strict";
  const U = FZ.U;
  const Sh = {};

  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function fitText(g, text, maxW, size, weight, family) {
    let s = size; g.font = weight + " " + s + "px " + family;
    while (g.measureText(text).width > maxW && s > 20) { s -= 2; g.font = weight + " " + s + "px " + family; }
    return s;
  }

  // r — результат улова (как в карточке), extra — {tour}
  Sh.card = function (r) {
    const W = 1080, H = 1920;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    const s = r.s, loc = FZ.LOC[r.loc];
    // фон: снимок сцены, размытый
    const snap = FZ.Scene.snapshot();
    try {
      const sc = Math.max(W / snap.width, H / snap.height);
      g.filter = "blur(10px) saturate(1.15)";
      g.drawImage(snap, (W - snap.width * sc) / 2, (H - snap.height * sc) / 2, snap.width * sc, snap.height * sc);
      g.filter = "none";
    } catch (e) { g.fillStyle = "#1f4a55"; g.fillRect(0, 0, W, H); }
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "rgba(8,22,28,0.72)"); shade.addColorStop(0.45, "rgba(8,22,28,0.35)"); shade.addColorStop(1, "rgba(8,22,28,0.88)");
    g.fillStyle = shade; g.fillRect(0, 0, W, H);

    // шапка
    g.textAlign = "center"; g.fillStyle = "#fff";
    g.font = "800 64px Rubik, sans-serif"; g.fillText("РЫБАЛКА", W / 2, 150);
    g.font = "700 92px Caveat, cursive"; g.fillStyle = "#ffb23a"; g.fillText("Клюёт!", W / 2, 240);
    // поплавок-значок
    g.save(); g.translate(W / 2 + 230, 120); g.rotate(0.25);
    g.fillStyle = "#ff3d12"; roundRect(g, -10, -40, 20, 40, 10); g.fill(); g.fillStyle = "#fff"; roundRect(g, -10, -2, 20, 30, 10); g.fill(); g.restore();

    // плашки
    const badges = [];
    if (r.trophy) badges.push(["ТРОФЕЙ", "#f2a71b"]);
    if (r.record && !r.newSpecies) badges.push(["ЛИЧНЫЙ РЕКОРД", "#3d9be9"]);
    if (r.newSpecies) badges.push(["НОВЫЙ ВИД", "#5cbf6a"]);
    if (r.tier) badges.push(["ТУРНИР ДНЯ · " + r.tier.n.toUpperCase(), r.tier.id === "gold" ? "#f2c21a" : r.tier.id === "silver" ? "#c8d0d8" : "#d8955a"]);
    g.font = "800 40px Rubik, sans-serif";
    let total = 0; badges.forEach((b) => (total += g.measureText(b[0]).width + 70));
    let bx = W / 2 - total / 2 + 10;
    badges.forEach(function (b) {
      const w = g.measureText(b[0]).width + 50;
      g.fillStyle = b[1]; roundRect(g, bx, 330, w, 70, 35); g.fill();
      g.fillStyle = "#14262c"; g.textAlign = "left"; g.fillText(b[0], bx + 25, 380);
      bx += w + 20;
    });
    g.textAlign = "center";

    // рыба
    const glow = g.createRadialGradient(W / 2, 760, 40, W / 2, 760, 520);
    glow.addColorStop(0, "rgba(255,220,150,0.35)"); glow.addColorStop(1, "rgba(255,220,150,0)");
    g.fillStyle = glow; g.fillRect(0, 300, W, 900);
    g.save(); g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 40; g.shadowOffsetY = 20;
    FZ.Art.drawFish(g, s, W / 2, 760, 900, { amp: 0.12, phase: 1.2, roll: -0.06 });
    g.restore();

    // вес и вид
    g.fillStyle = "#fff";
    const wt = U.kg(r.w);
    fitText(g, wt, W - 120, 210, "800", "Rubik, sans-serif");
    g.fillText(wt, W / 2, 1210);
    fitText(g, s.n, W - 160, 96, "700", "Rubik, sans-serif");
    g.fillStyle = "#e9f2f0"; g.fillText(s.n, W / 2, 1320);
    g.font = "700 64px Caveat, cursive"; g.fillStyle = "#cfe3e6";
    g.fillText(r.len + " см · " + loc.n + " · " + U.dateRu(new Date(r.date + "T12:00:00")), W / 2, 1405);
    // процентиль — честная статистика по виду
    g.font = "700 46px Rubik, sans-serif"; g.fillStyle = "#ffcf6a";
    g.fillText("Крупнее " + Math.floor(r.pct) + "% рыб этого вида", W / 2, 1490);

    // низ: призыв
    g.fillStyle = "rgba(255,255,255,0.12)"; roundRect(g, 90, 1580, W - 180, 230, 40); g.fill();
    g.fillStyle = "#fff"; g.font = "800 58px Rubik, sans-serif"; g.fillText("Поймаешь больше?", W / 2, 1670);
    g.font = "500 44px Rubik, sans-serif"; g.fillStyle = "#cfe3e6"; g.fillText("Ищи «Рыбалка: Клюёт!» в RuStore", W / 2, 1750);
    return c;
  };

  Sh.text = function (r) {
    const s = r.s;
    let t = "Поймал " + s.n.toLowerCase() + " на " + U.kg(r.w) + " (" + r.len + " см)!";
    if (r.trophy) t += " Трофей!";
    if (r.tier) t += " Турнир дня: " + r.tier.n.toLowerCase() + ".";
    return t + " А ты сможешь больше? 🎣";
  };

  Sh.share = async function (r) {
    const c = Sh.card(r);
    return FZ.Platform.shareImage(c, Sh.text(r));
  };

  FZ.Share = Sh;
})(window.FZ);
