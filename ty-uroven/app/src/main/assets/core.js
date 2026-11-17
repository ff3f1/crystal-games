/* ТЫ.УРОВЕНЬ — deterministic domain model. All currency is integer kopecks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  else root.LevelCore = api;
})(globalThis, () => {
  "use strict";
  const VERSION = 3,
    SKILLS = ["body", "mind", "care", "wealth"];
  const SKILL_NAMES = {
    body: "Сила",
    mind: "Развитие",
    care: "Забота",
    wealth: "Осознанность",
  };
  const OUTFITS = [
    {
      id: "trail",
      name: "Первый маршрут",
      color: "#8ddbc3",
      price: 0,
      level: 1,
    },
    {
      id: "sunset",
      name: "Тёплый горизонт",
      color: "#e5a174",
      price: 45,
      level: 2,
    },
    {
      id: "night",
      name: "Звёздный странник",
      color: "#a895e3",
      price: 90,
      level: 3,
    },
    {
      id: "summit",
      name: "Хранитель вершин",
      color: "#73accf",
      price: 160,
      level: 5,
    },
  ];
  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const day = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const validDate = (v) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + "T12:00:00")) &&
    day(new Date(v + "T12:00:00")) === v;
  const amount = (v) => {
    const s = String(v).trim().replace(",", ".");
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(s))
      throw Error("Введи сумму с точностью до копейки");
    const n = Math.round(Number(s) * 100);
    if (n <= 0 || n > 100000000000)
      throw Error("Сумма должна быть больше нуля");
    return n;
  };
  const text = (v, max = 120) =>
    String(v ?? "")
      .trim()
      .slice(0, max);
  const requireText = (v, msg, max = 120) => {
    const t = text(v, max);
    if (t.length < 2) throw Error(msg);
    return t;
  };
  const num = (v, min, max, msg) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw Error(msg);
    return n;
  };
  function fresh() {
    return {
      schema: VERSION,
      revision: 0,
      onboard: false,
      profile: {
        name: "Путешественник",
        gender: "neutral",
        body: "regular",
        tone: "#dbac88",
        hair: "#302b34",
        hairstyle: "short",
        face: "soft",
        outfit: "trail",
        accessory: "none",
      },
      settings: {
        theme: "dark",
        music: 0,
        sfx: 0.45,
        haptics: true,
        track: "haven",
        motion: true,
      },
      habits: [
        {
          id: "move",
          name: "Время для движения",
          skill: "body",
          target: 20,
          unit: "мин",
          active: true,
        },
        {
          id: "learn",
          name: "Узнать что-то новое",
          skill: "mind",
          target: 15,
          unit: "мин",
          active: true,
        },
        {
          id: "rest",
          name: "Пауза для себя",
          skill: "care",
          target: 10,
          unit: "мин",
          active: true,
        },
      ],
      entries: [],
      tasks: [],
      goals: [],
      tx: [],
      budgets: [],
      bills: [],
      meals: [],
      workouts: [],
      weights: [],
      rewards: [],
      owned: ["trail"],
      purchases: [],
      legacy: { xp: 0, coins: 0 },
      created: day(),
    };
  }
  function reward(s, key, xp, skill, date) {
    if (s.rewards.some((r) => r.key === key)) return false;
    s.rewards.push({
      key,
      xp,
      coins: Math.max(1, Math.floor(xp / 5)),
      skill,
      date,
    });
    return true;
  }
  const xp = (s) =>
    (s.legacy?.xp || 0) + s.rewards.reduce((a, r) => a + r.xp, 0);
  const coins = (s) =>
    (s.legacy?.coins || 0) +
    s.rewards.reduce((a, r) => a + r.coins, 0) -
    s.purchases.reduce((a, p) => a + p.price, 0);
  function level(s) {
    let n = 1,
      x = xp(s);
    while (x >= n * 100 && n < 100) {
      x -= n * 100;
      n++;
    }
    return {
      n,
      x,
      max: n * 100,
      percent: Math.min(100, (x / (n * 100)) * 100),
    };
  }
  const balance = (s) =>
    s.tx.reduce((a, t) => a + (t.kind === "income" ? t.cents : -t.cents), 0);
  const totals = (s, month = day().slice(0, 7)) =>
    s.tx
      .filter((t) => t.date.startsWith(month))
      .reduce((a, t) => ((a[t.kind] += t.cents), a), { income: 0, expense: 0 });
  const habitDone = (s, id, date = day()) =>
    s.entries.some((e) => e.habitId === id && e.date === date);
  const paid = (s, id, month = day().slice(0, 7)) =>
    s.tx.some((t) => t.billId === id && t.period === month);
  function streak(s, today = day()) {
    const dates = new Set(s.rewards.map((r) => r.date));
    let d = new Date(today + "T12:00:00"),
      n = 0;
    if (!dates.has(day(d))) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 3660; i++) {
      if (!dates.has(day(d))) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function achievements(s, photoCount = 0) {
    return [
      {
        id: "first",
        name: "Первый шаг",
        desc: "Выполнить реальное действие",
        icon: "spark",
        ok: s.rewards.length > 0,
      },
      {
        id: "streak",
        name: "В своём ритме",
        desc: "3 дня с действиями подряд",
        icon: "flame",
        ok: streak(s) >= 3,
      },
      {
        id: "explorer",
        name: "Исследователь",
        desc: "Достичь 3 уровня",
        icon: "compass",
        ok: level(s).n >= 3,
      },
      {
        id: "plan",
        name: "Держу курс",
        desc: "Завершить 3 дела",
        icon: "check",
        ok: s.tasks.filter((t) => t.done).length >= 3,
      },
      {
        id: "money",
        name: "Ясная картина",
        desc: "Записать 5 операций",
        icon: "wallet",
        ok: s.tx.length >= 5,
      },
      {
        id: "memory",
        name: "Моя история",
        desc: "Сохранить 2 фотографии",
        icon: "camera",
        ok: photoCount >= 2,
      },
      {
        id: "move",
        name: "Энергия движения",
        desc: "Записать 5 тренировок",
        icon: "activity",
        ok: s.workouts.length >= 5,
      },
      {
        id: "goal",
        name: "Большой шаг",
        desc: "Завершить цель",
        icon: "flag",
        ok: s.goals.some((g) => g.steps.every((t) => t.done)),
      },
    ];
  }
  function apply(s, action, p = {}, today = day()) {
    if (!validDate(today)) throw Error("Некорректная дата");
    const id = () => uid();
    let result = {};
    switch (action) {
      case "profile": {
        s.profile = {
          ...s.profile,
          ...p,
          name: requireText(p.name, "Как тебя называть?", 32),
        };
        s.onboard = true;
        break;
      }
      case "settings":
        s.settings = { ...s.settings, ...p };
        break;
      case "habitAdd": {
        if (s.habits.filter((h) => h.active).length >= 12)
          throw Error("Можно вести до 12 активных привычек");
        if (!SKILLS.includes(p.skill)) throw Error("Выбери сферу");
        s.habits.push({
          id: id(),
          name: requireText(p.name, "Назови привычку", 65),
          skill: p.skill,
          target: num(p.target, 1, 1440, "Цель: от 1 до 1440"),
          unit: text(p.unit, 12) || "мин",
          active: true,
        });
        break;
      }
      case "habitArchive": {
        const h = s.habits.find((h) => h.id === p.id);
        if (h) h.active = false;
        break;
      }
      case "habitComplete": {
        const h = s.habits.find((h) => h.id === p.id && h.active);
        if (!h) throw Error("Привычка не найдена");
        if (habitDone(s, h.id, today)) throw Error("На сегодня уже записано");
        const value = num(
          p.value,
          h.target,
          100000,
          `Нужно не менее ${h.target} ${h.unit}`,
        );
        s.entries.push({
          id: id(),
          habitId: h.id,
          name: h.name,
          date: today,
          value,
          unit: h.unit,
          note: text(p.note),
          skill: h.skill,
        });
        reward(s, "habit:" + h.id + ":" + today, 20, h.skill, today);
        break;
      }
      case "taskAdd": {
        if (!validDate(p.date)) throw Error("Выбери дату");
        s.tasks.push({
          id: id(),
          name: requireText(p.name, "Назови дело", 100),
          date: p.date,
          skill: SKILLS.includes(p.skill) ? p.skill : "mind",
          done: false,
        });
        break;
      }
      case "taskComplete": {
        const t = s.tasks.find((t) => t.id === p.id);
        if (!t || t.done) throw Error("Дело уже завершено");
        t.note = requireText(p.note, "Кратко запиши результат");
        t.done = true;
        t.completed = today;
        reward(s, "task:" + t.id, 25, t.skill, today);
        break;
      }
      case "taskDelete":
        s.tasks = s.tasks.filter((t) => t.id !== p.id);
        break;
      case "goalDelete":
        s.goals = s.goals.filter((g) => g.id !== p.id);
        break;
      case "goalAdd": {
        const steps = String(p.steps || "")
          .split("\n")
          .map((x) => text(x, 100))
          .filter(Boolean);
        if (!steps.length || steps.length > 20)
          throw Error("Добавь от 1 до 20 этапов, каждый с новой строки");
        s.goals.push({
          id: id(),
          name: requireText(p.name, "Назови цель", 80),
          steps: steps.map((name) => ({ id: id(), name, done: false })),
          date: validDate(p.date) ? p.date : today,
        });
        break;
      }
      case "goalStep": {
        const g = s.goals.find((g) => g.id === p.id),
          t = g?.steps.find((t) => t.id === p.step);
        if (!t || t.done) throw Error("Этап уже завершён");
        t.done = true;
        t.note = requireText(p.note, "Запиши результат этапа");
        t.completed = today;
        reward(s, "goal:" + g.id + ":" + t.id, 30, "mind", today);
        if (g.steps.every((t) => t.done))
          reward(s, "goal:" + g.id, 50, "mind", today);
        break;
      }
      case "txAdd": {
        if (!validDate(p.date) || !["income", "expense"].includes(p.kind))
          throw Error("Проверь дату и вид операции");
        s.tx.push({
          id: id(),
          kind: p.kind,
          cents: amount(p.amount),
          date: p.date,
          category: requireText(p.category, "Укажи категорию", 40),
          note: text(p.note, 100),
        });
        reward(s, "finance:" + today, 10, "wealth", today);
        break;
      }
      case "txEdit": {
        const t = s.tx.find((t) => t.id === p.id);
        if (!t) throw Error("Операция не найдена");
        if (!validDate(p.date) || !["income", "expense"].includes(p.kind))
          throw Error("Проверь дату и вид операции");
        if (t.billId && p.kind !== "expense")
          throw Error("Регулярный платёж должен оставаться расходом");
        Object.assign(t, {
          kind: p.kind,
          cents: amount(p.amount),
          date: p.date,
          category: requireText(p.category, "Укажи категорию", 40),
          note: text(p.note, 100),
        });
        break;
      }
      case "txDelete":
        s.tx = s.tx.filter((t) => t.id !== p.id);
        break;
      case "budget": {
        const cents = amount(p.amount),
          category = text(p.category, 40) || "Все категории",
          month = text(p.month, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
          throw Error("Некорректный месяц");
        s.budgets = s.budgets.filter(
          (b) => b.month !== month || b.category !== category,
        );
        s.budgets.push({ month, category, cents });
        break;
      }
      case "budgetDelete":
        s.budgets = s.budgets.filter(
          (b) => b.month !== p.month || b.category !== p.category,
        );
        break;
      case "billAdd":
        s.bills.push({
          id: id(),
          name: requireText(p.name, "Назови платёж", 60),
          cents: amount(p.amount),
          day: num(p.day, 1, 31, "Число от 1 до 31"),
          category: requireText(p.category, "Укажи категорию", 40),
        });
        break;
      case "billPay": {
        const b = s.bills.find((b) => b.id === p.id),
          period = today.slice(0, 7);
        if (!b) throw Error("Платёж не найден");
        if (paid(s, b.id, period)) throw Error("Уже учтён в этом месяце");
        s.tx.push({
          id: id(),
          kind: "expense",
          cents: b.cents,
          date: today,
          category: b.category,
          note: b.name,
          billId: b.id,
          period,
        });
        reward(s, "finance:" + today, 10, "wealth", today);
        break;
      }
      case "billDelete":
        s.bills = s.bills.filter((b) => b.id !== p.id);
        break;
      case "workout": {
        const minutes = num(
          p.minutes,
          1,
          600,
          "Продолжительность: 1–600 минут",
        );
        s.workouts.push({
          id: id(),
          date: today,
          type: requireText(p.type, "Укажи вид занятия", 60),
          minutes,
          note: text(p.note),
        });
        if (minutes >= 5) reward(s, "workout:" + today, 25, "body", today);
        break;
      }
      case "meal": {
        const kcal =
          p.kcal === "" || p.kcal == null
            ? null
            : num(p.kcal, 1, 10000, "Калорийность: 1–10 000");
        s.meals.push({
          id: id(),
          date: today,
          name: requireText(p.name, "Что было в приёме пищи?", 100),
          kcal,
          type: text(p.type, 30),
        });
        reward(s, "meal:" + today, 10, "care", today);
        break;
      }
      case "weight": {
        const kg = num(
          String(p.kg).replace(",", "."),
          20,
          500,
          "Вес: 20–500 кг",
        );
        s.weights = s.weights.filter((w) => w.date !== today);
        s.weights.push({ id: id(), date: today, kg: Math.round(kg * 10) / 10 });
        break;
      }
      case "healthDelete": {
        if (!["meals", "workouts", "weights"].includes(p.collection))
          throw Error("Нет такой записи");
        s[p.collection] = s[p.collection].filter((x) => x.id !== p.id);
        break;
      }
      case "outfit": {
        const outfit = OUTFITS.find((o) => o.id === p.id);
        if (!outfit) throw Error("Образ не найден");
        if (!s.owned.includes(p.id)) {
          if (level(s).n < outfit.level)
            throw Error("Откроется на уровне " + outfit.level);
          if (coins(s) < outfit.price)
            throw Error("Пока не хватает кристаллов");
          s.purchases.push({
            id: id(),
            outfit: p.id,
            price: outfit.price,
            date: today,
          });
          s.owned.push(p.id);
        }
        s.profile.outfit = p.id;
        break;
      }
      default:
        throw Error("Неизвестное действие");
    }
    return result;
  }
  function migrate(v) {
    if (v?.schema === VERSION) return validate(v);
    if (v?.v !== 2) throw Error("Это не сохранение ТЫ.УРОВЕНЬ");
    const s = fresh();
    s.onboard = !!v.onboard;
    const p = v.profile || {};
    s.profile = {
      ...s.profile,
      name: text(p.name, 32) || s.profile.name,
      gender: ["male", "female"].includes(p.gender) ? p.gender : "neutral",
      body: ["slim", "broad"].includes(p.body) ? p.body : "regular",
      tone: /^#[0-9a-f]{6}$/i.test(p.tone) ? p.tone : s.profile.tone,
      hair: /^#[0-9a-f]{6}$/i.test(p.hair) ? p.hair : s.profile.hair,
    };
    s.legacy = {
      xp: Math.max(0, Math.min(1e8, Number(v.xp) || 0)),
      coins: Math.max(0, Math.min(1e8, Number(v.coins) || 0)),
    };
    s.settings.theme = v.theme === "light" ? "light" : "dark";
    for (const t of v.tx || []) {
      if (
        t.demo ||
        !validDate(t.date) ||
        !["income", "expense"].includes(t.kind) ||
        !(t.amount > 0)
      )
        continue;
      s.tx.push({
        id: /^[a-zA-Z0-9_-]{1,100}$/.test(String(t.id)) ? String(t.id) : uid(),
        kind: t.kind,
        cents: Math.round(t.amount * 100),
        category: text(t.category) || "Другое",
        date: t.date,
        note: text(t.note, 100),
        ...(t.billId
          ? { billId: text(t.billId), period: t.date.slice(0, 7) }
          : {}),
      });
    }
    for (const t of v.tasks || [])
      if (t.name)
        s.tasks.push({
          id: /^[a-zA-Z0-9_-]{1,100}$/.test(String(t.id))
            ? String(t.id)
            : uid(),
          name: text(t.name, 100),
          date: validDate(t.due) ? t.due : day(),
          skill: "mind",
          done: !!t.done,
        });
    for (const h of v.customHabits || [])
      if (h.id && h.name)
        s.habits.push({
          id: text(h.id),
          name: text(h.name),
          skill: "mind",
          target: 1,
          unit: "раз",
          active: true,
        });
    for (const [id, name, skill] of [
      ["food", "Позаботиться о питании", "care"],
      ["finance", "Проверить бюджет", "wealth"],
      ["sleep", "Уделить время отдыху", "care"],
    ])
      s.habits.push({ id, name, skill, target: 1, unit: "раз", active: false });
    for (const [date, ids] of Object.entries(v.logs || {}))
      if (validDate(date) && Array.isArray(ids))
        for (const id of new Set(ids))
          s.entries.push({
            id: uid(),
            habitId: text(id),
            name: s.habits.find((h) => h.id === id)?.name || "Действие из v0.8",
            date,
            value: 1,
            unit: "раз",
            skill: "mind",
            note: "Перенесено из v0.8",
          });
    for (const b of v.bills || [])
      if (b.name && b.amount > 0)
        s.bills.push({
          id: text(b.id) || uid(),
          name: text(b.name),
          cents: Math.round(b.amount * 100),
          day: Math.min(31, Math.max(1, Number(b.day) || 1)),
          category: text(b.category) || "Другое",
        });
    if (v.budget > 0)
      s.budgets.push({
        month: day().slice(0, 7),
        category: "Все категории",
        cents: Math.round(v.budget * 100),
      });
    for (const w of v.healthLog || [])
      if (validDate(w.date) && w.weight >= 20 && w.weight <= 500)
        s.weights.push({ id: uid(), date: w.date, kg: Number(w.weight) });
    return validate(s);
  }
  function validate(v) {
    const s = JSON.parse(JSON.stringify(v));
    if (!s || s.schema !== VERSION || !s.profile || !s.settings)
      throw Error("Неподдерживаемый формат сохранения");
    const arrays = [
      "habits",
      "entries",
      "tasks",
      "goals",
      "tx",
      "budgets",
      "bills",
      "meals",
      "workouts",
      "weights",
      "rewards",
      "owned",
      "purchases",
    ];
    for (const k of arrays)
      if (!Array.isArray(s[k]) || s[k].length > 100000)
        throw Error("Повреждён раздел " + k);
    if (!Number.isSafeInteger(s.revision) || s.revision < 0)
      throw Error("Повреждена версия данных");
    const safeN = (n, max = 1e12) =>
      Number.isSafeInteger(n) && n >= 0 && n <= max;
    for (const t of s.tx)
      if (
        !safeN(t.cents) ||
        !t.cents ||
        !validDate(t.date) ||
        !["income", "expense"].includes(t.kind) ||
        typeof t.category !== "string"
      )
        throw Error("Некорректная финансовая операция");
    for (const b of [...s.budgets, ...s.bills])
      if (!safeN(b.cents) || !b.cents) throw Error("Некорректная сумма");
    if (new Set(s.rewards.map((r) => r.key)).size !== s.rewards.length)
      throw Error("Повторные награды в сохранении");
    for (const r of s.rewards)
      if (
        !safeN(r.xp, 1000) ||
        !safeN(r.coins, 1000) ||
        !SKILLS.includes(r.skill) ||
        !validDate(r.date)
      )
        throw Error("Некорректная награда");
    for (const h of s.habits)
      if (
        typeof h.id !== "string" ||
        typeof h.name !== "string" ||
        !SKILLS.includes(h.skill) ||
        !Number.isFinite(h.target) ||
        h.target < 1 ||
        h.target > 1440
      )
        throw Error("Некорректная привычка");
    for (const g of s.goals)
      if (
        typeof g.name !== "string" ||
        !Array.isArray(g.steps) ||
        !g.steps.length ||
        g.steps.length > 20 ||
        g.steps.some(
          (t) => typeof t.name !== "string" || typeof t.id !== "string",
        )
      )
        throw Error("Некорректная цель");
    for (const t of s.tasks)
      if (
        typeof t.name !== "string" ||
        !validDate(t.date) ||
        !SKILLS.includes(t.skill)
      )
        throw Error("Некорректное дело");
    for (const r of s.purchases)
      if (!safeN(r.price)) throw Error("Некорректная покупка");
    if (
      !s.legacy ||
      !safeN(s.legacy.xp, 1e8) ||
      !safeN(s.legacy.coins, 1e8) ||
      coins(s) < 0
    )
      throw Error("Некорректный игровой баланс");
    if (typeof s.profile.name !== "string" || s.profile.name.length > 32)
      throw Error("Некорректное имя");
    if (
      !["dark", "light", "system"].includes(s.settings.theme) ||
      ["music", "sfx"].some(
        (k) =>
          !Number.isFinite(s.settings[k]) ||
          s.settings[k] < 0 ||
          s.settings[k] > 1,
      )
    )
      throw Error("Некорректные настройки");
    const safeId = (id) =>
      typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
    const string = (v, max = 200) => typeof v === "string" && v.length <= max;
    for (const k of [
      "habits",
      "entries",
      "tasks",
      "goals",
      "tx",
      "bills",
      "meals",
      "workouts",
      "weights",
      "purchases",
    ]) {
      if (
        s[k].some((x) => !x || !safeId(x.id)) ||
        new Set(s[k].map((x) => x.id)).size !== s[k].length
      )
        throw Error("Некорректные идентификаторы: " + k);
    }
    for (const h of s.habits)
      if (
        !string(h.name, 65) ||
        !string(h.unit, 12) ||
        typeof h.active !== "boolean"
      )
        throw Error("Повреждена привычка");
    for (const e of s.entries)
      if (
        !safeId(e.habitId) ||
        !validDate(e.date) ||
        !string(e.name, 120) ||
        !Number.isFinite(e.value) ||
        e.value < 0 ||
        !string(e.unit, 12) ||
        !string(e.note, 120) ||
        !SKILLS.includes(e.skill)
      )
        throw Error("Повреждена запись привычки");
    for (const t of s.tasks)
      if (
        !string(t.name, 120) ||
        typeof t.done !== "boolean" ||
        (t.note !== undefined && !string(t.note, 120))
      )
        throw Error("Повреждено дело");
    for (const g of s.goals)
      if (
        !validDate(g.date) ||
        g.steps.some(
          (t) =>
            !safeId(t.id) ||
            !string(t.name, 100) ||
            typeof t.done !== "boolean" ||
            (t.note !== undefined && !string(t.note, 120)),
        ) ||
        new Set(g.steps.map((t) => t.id)).size !== g.steps.length
      )
        throw Error("Повреждена цель");
    for (const t of s.tx)
      if (
        !string(t.category, 40) ||
        !string(t.note, 100) ||
        (t.billId !== undefined &&
          (!safeId(t.billId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(t.period)))
      )
        throw Error("Повреждена операция");
    for (const b of s.budgets)
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) || !string(b.category, 40))
        throw Error("Повреждён бюджет");
    for (const b of s.bills)
      if (
        !string(b.name, 60) ||
        !string(b.category, 40) ||
        !Number.isInteger(b.day) ||
        b.day < 1 ||
        b.day > 31
      )
        throw Error("Повреждён регулярный платёж");
    for (const m of s.meals)
      if (
        !validDate(m.date) ||
        !string(m.name, 100) ||
        !string(m.type, 30) ||
        (m.kcal !== null &&
          (!Number.isFinite(m.kcal) || m.kcal <= 0 || m.kcal > 10000))
      )
        throw Error("Повреждён приём пищи");
    for (const w of s.workouts)
      if (
        !validDate(w.date) ||
        !string(w.type, 60) ||
        !string(w.note, 120) ||
        !Number.isFinite(w.minutes) ||
        w.minutes < 1 ||
        w.minutes > 600
      )
        throw Error("Повреждена тренировка");
    for (const w of s.weights)
      if (
        !validDate(w.date) ||
        !Number.isFinite(w.kg) ||
        w.kg < 20 ||
        w.kg > 500
      )
        throw Error("Повреждена запись веса");
    for (const r of s.rewards)
      if (!string(r.key, 250)) throw Error("Повреждён ключ награды");
    for (const p of s.purchases)
      if (!validDate(p.date) || !OUTFITS.some((o) => o.id === p.outfit))
        throw Error("Повреждена покупка");
    if (
      !s.owned.includes("trail") ||
      s.owned.some((id) => !OUTFITS.some((o) => o.id === id)) ||
      new Set(s.owned).size !== s.owned.length
    )
      throw Error("Повреждён гардероб");
    if (
      !["haven", "focus", "dawn"].includes(s.settings.track) ||
      typeof s.settings.haptics !== "boolean" ||
      typeof s.settings.motion !== "boolean" ||
      typeof s.onboard !== "boolean"
    )
      throw Error("Повреждены настройки");
    const palette = [
      "#f3d8bb",
      "#e7bd99",
      "#dbac88",
      "#bd8968",
      "#996649",
      "#704936",
      "#493128",
    ];
    if (!palette.includes(s.profile.tone)) s.profile.tone = "#dbac88";
    if (!/^#[0-9a-f]{6}$/i.test(s.profile.hair)) s.profile.hair = "#302b34";
    if (
      !OUTFITS.some((o) => o.id === s.profile.outfit) ||
      !s.owned.includes(s.profile.outfit)
    )
      s.profile.outfit = "trail";
    for (const [key, values] of Object.entries({
      body: ["slim", "regular", "broad"],
      gender: ["neutral", "male", "female"],
      hairstyle: ["short", "crop", "long", "curls", "bald"],
      face: ["soft", "angular", "round"],
      accessory: ["none", "glasses", "earring", "scarf"],
    }))
      if (!values.includes(s.profile[key]))
        s.profile[key] = fresh().profile[key];
    return s;
  }
  return {
    VERSION,
    SKILLS,
    SKILL_NAMES,
    OUTFITS,
    uid,
    day,
    validDate,
    amount,
    fresh,
    apply,
    validate,
    migrate,
    xp,
    coins,
    level,
    balance,
    totals,
    habitDone,
    paid,
    streak,
    achievements,
  };
});
