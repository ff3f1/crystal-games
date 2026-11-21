/* Рыбалка: Клюёт! — approved 3×3 lakeside menu, November 2026.
 * The artwork is sliced from the player's actual approved concept.
 * No screenshot stats are ever used as game data; existing button instances keep their handlers.
 */
(function (FZ) {
  'use strict';
  if (!FZ || !FZ.UI || !FZ.Game) return;
  const UI = FZ.UI, G = FZ.Game;
  const menu = document.getElementById('ovMenu');
  if (!menu) return;
  const oldShow = UI.showMenu;
  const ids = ['mMap', 'mShop', 'mAtlas', 'mJourney', 'mJournal', 'mQuests', 'mTour', 'mForecast', 'mSet'];
  const names = ['Водоёмы', 'Снасти', 'Атлас рыб', 'Экспедиции', 'Дневник', 'Задания', 'Турнир дня', 'Гид по клёву', 'Настройки'];
  const number = n => Number(n || 0).toLocaleString('ru-RU');
  function playerStats() {
    const st = G.state(), level = Math.max(1, Number(st.lvl) || 1);
    const xp = Math.max(0, Number(st.xp) || 0);
    const goal = FZ.xpNeed ? Math.max(1, FZ.xpNeed(level)) : Math.max(1, xp || 1);
    const best = Math.max(0, Number(st.stats && st.stats.best && st.stats.best.w) || 0,
      ...Object.values(st.records || {}).map(r => Number(r && r.w) || 0));
    const title = FZ.titleOf ? FZ.titleOf(level) : 'Рыбак';
    return {level, title, xp, goal, percent: Math.min(100, Math.round(xp / goal * 100)),
      best: best.toFixed(2).replace('.', ','), money: number(st.money)};
  }
  function profileHtml(st) {
    return '<div class="ref-level" aria-hidden="true"><span class="ref-level-wreath">❧</span><strong>' + st.level + '</strong></div>' +
      '<div class="ref-experience"><b>' + st.title + '</b><small>Уровень ' + st.level + '</small>' +
      '<div class="ref-xp-numbers">' + number(st.xp) + ' / ' + number(st.goal) + '</div>' +
      '<div class="ref-xp-track"><i style="width:' + st.percent + '%"></i></div></div>' +
      '<button type="button" class="ref-record" aria-label="Достижения и рекорды"><span aria-hidden="true">🏆</span><span><small>Рекорд</small><b>' + st.best + ' кг</b></span></button>' +
      '<div class="ref-wealth"><span aria-hidden="true">🪙</span><b>' + st.money + '</b></div>';
  }
  function move(id, destination) {
    const el = menu.querySelector('#' + id);
    if (el && destination) destination.appendChild(el);
    return el;
  }
  function prepareButton(button, label) {
    if (!button) return;
    button.setAttribute('aria-label', label);
    button.classList.add('ref-interactive');
  }
  UI.showMenu = function () {
    const result = oldShow.apply(this, arguments);
    const lodge = menu.querySelector('.lodge');
    const grid = lodge && lodge.querySelector('.lodge-grid');
    const footer = lodge && lodge.querySelector('.lodge-footer');
    const bottom = lodge && lodge.querySelector('.lodge-bottom');
    const profile = lodge && lodge.querySelector('.lodge-profile');
    if (!lodge || !grid || !footer || !bottom || !profile) return result;

    menu.classList.add('reference-menu-v4');
    lodge.classList.add('reference-layout');
    const previousHero = lodge.querySelector('.reference-hero');
    if (previousHero) previousHero.remove();
    const hero = document.createElement('div');
    hero.className = 'reference-hero';
    hero.setAttribute('role', 'img');
    hero.setAttribute('aria-label', 'Рыбалка: Клюёт! — уютный рассвет над озером, снасти на деревянном причале');
    hero.innerHTML = '<span class="reference-golden-glow" aria-hidden="true"></span><span class="reference-mist" aria-hidden="true"></span>';
    lodge.insertBefore(hero, lodge.firstChild);

    // Reconstitute the nine original, fully functioning cards, in the agreed order.
    ids.forEach((id, i) => {
      const item = move(id, grid);
      if (item) {
        item.dataset.refIndex = String(i + 1);
        prepareButton(item, names[i]);
      }
    });
    const go = move('mGo', bottom);
    if (go) {
      bottom.insertBefore(go, grid);
      prepareButton(go, G.rig().state === 'idle' ? 'На рыбалку' : 'Продолжить рыбалку');
    }
    const originalDuel = move('mDuel', footer);
    if (originalDuel) originalDuel.textContent = '3 заброса';
    const bag = move('mInventory', footer);
    if (bag) bag.textContent = 'Рюкзак';
    const achievements = move('mAchievements', footer);
    if (achievements) achievements.textContent = 'Награды';
    const help = move('mHelp', footer);
    const skills = move('mSkills', footer);
    const rate = move('mRate', footer);
    if (help) help.textContent = 'Как играть';
    if (skills) skills.textContent = (G.skillPoints && G.skillPoints() ? 'Навыки · ' + G.skillPoints() : 'Навыки');
    if (rate) rate.textContent = '★ Оценить';
    // Never hide additional functionality in an unscrollable strip: all six small tools remain available.
    [originalDuel, bag, achievements, skills, help, rate].forEach(el => {
      if (el) prepareButton(el, el.textContent.trim());
    });
    ['.concept-primary', '.concept-secondary-label', '.concept-lakeside', '.concept-player-detail', '#conceptMoreSections']
      .forEach(selector => lodge.querySelectorAll(selector).forEach(el => el.remove()));
    const status = playerStats();
    profile.innerHTML = profileHtml(status);
    profile.setAttribute('aria-label', 'Рыбак, уровень ' + status.level + ', опыт ' + status.xp + ' из ' + status.goal + ', рекорд ' + status.best + ' килограмма, монеты ' + status.money);
    const recordButton = profile.querySelector('.ref-record');
    if (recordButton) recordButton.onclick = () => {
      if (FZ.Sound && FZ.Sound.click) FZ.Sound.click();
      if (UI.showAchievements) UI.showAchievements();
    };
    const title = lodge.querySelector('.lodge-title');
    if (title) title.setAttribute('aria-hidden', 'true');
    const dupe = lodge.querySelector('.cozy-menu-scene');
    if (dupe) dupe.setAttribute('aria-hidden', 'true');
    return result;
  };

  // The pointer-down feedback happens before the click handler changes the screen.
  // Deliberately reuse the game's existing real button handlers, so save/ads/catches work.
  menu.addEventListener('pointerdown', e => {
    const button = e.target.closest && e.target.closest('button.ref-interactive');
    if (!button || !menu.contains(button)) return;
    if (FZ.Sound && FZ.Sound.unlock) FZ.Sound.unlock();
    if (FZ.Sound && FZ.Sound.click) FZ.Sound.click();
    button.classList.add('ref-pressed');
  }, {passive:true});
  const endPress = e => {
    const button = e.target.closest && e.target.closest('button.ref-interactive');
    if (!button) return;
    button.classList.remove('ref-pressed');
    button.classList.add('ref-rebound');
    window.setTimeout(() => button.classList.remove('ref-rebound'), 240);
  };
  menu.addEventListener('pointerup', endPress, {passive:true});
  menu.addEventListener('pointercancel', endPress, {passive:true});
  menu.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('button.ref-interactive')) {
      e.target.classList.add('ref-rebound');
      window.setTimeout(() => e.target.classList.remove('ref-rebound'), 240);
    }
  });
  FZ.ApprovedMenu = {version: 4, ids: ids.slice()};
})(window.FZ);