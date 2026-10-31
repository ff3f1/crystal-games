'use strict';
/**
 * Сервер покупок FishingSim для VK Play.
 *
 * Источник истины для: баланса золота, вечных покупок (entitlements), премиум-аккаунта, выдач расходников.
 * Клиент (игра) ничего не начисляет сам — только спрашивает сервер.
 *
 * Запуск для разработки (без VK Play, с тестовой страницей оплаты):
 *   npm install
 *   npm run dev            -> http://localhost:8080
 *
 * Продакшен: переменные окружения
 *   PORT, PUBLIC_URL (https-адрес сервера), VKPLAY_SECRET, VKPLAY_GAME_ID, VKPLAY_PAYMENT_URL_TEMPLATE, DB_FILE
 *
 * !!! Всё, что помечено "TODO VK PLAY", нужно сверить с документацией в кабинете разработчика VK Play:
 *     имена параметров лаунчера, алгоритм подписи, формат уведомления об оплате и ожидаемый ответ.
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEV_MODE = process.argv.includes('--dev') || process.env.DEV_MODE === '1';

const CONFIG = {
  port: Number(process.env.PORT || 8080),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:8080',
  vkplaySecret: process.env.VKPLAY_SECRET || '',
  vkplayGameId: process.env.VKPLAY_GAME_ID || '',
  // TODO VK PLAY: шаблон ссылки на оплату из документации. Подстановки: {gameId} {orderId} {userId} {amount} {productId}
  vkplayPaymentUrlTemplate: process.env.VKPLAY_PAYMENT_URL_TEMPLATE || '',
  dbFile: process.env.DB_FILE || path.join(__dirname, 'db.json'),
  sessionTtlMs: 7 * 24 * 3600 * 1000,
};

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Простейшее хранилище в JSON-файле. Для продакшена замени на PostgreSQL —
// интерфейс (db.users / db.orders / db.grants) легко перенести.
// ---------------------------------------------------------------------------
let db = { users: {}, sessions: {}, orders: {}, grants: {}, purchases: [] };
if (fs.existsSync(CONFIG.dbFile)) {
  db = { ...db, ...JSON.parse(fs.readFileSync(CONFIG.dbFile, 'utf8')) };
}
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = CONFIG.dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, CONFIG.dbFile);
  }, 100);
}

const newId = (prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function getOrCreateUser(userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      premiumBalance: 0,
      entitlements: [],
      premiumUntil: null,
      boughtOnce: [],
      createdAt: new Date().toISOString(),
    };
  }
  return db.users[userId];
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = { userId, expiresAt: Date.now() + CONFIG.sessionTtlMs };
  saveDb();
  return token;
}

function auth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = db.sessions[token];
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = getOrCreateUser(session.userId);
  next();
}

// ---------------------------------------------------------------------------
// Подписи VK Play
// ---------------------------------------------------------------------------

/**
 * TODO VK PLAY: сверь алгоритм с документацией!
 * Распространённая схема у игровых платформ: sign = md5( отсортированные "key=value" без sign + секрет ).
 * Если в доке другой алгоритм (sha256, HMAC, другой порядок) — поменяй только эту функцию.
 */
function computeSign(params, secret) {
  const base = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'signature')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return crypto.createHash('md5').update(base + secret, 'utf8').digest('hex');
}

function verifySignedParams(params) {
  const sign = params.sign || params.signature;
  if (!sign || !CONFIG.vkplaySecret) return false;
  return safeEqual(computeSign(params, CONFIG.vkplaySecret), String(sign).toLowerCase());
}

/** TODO VK PLAY: имя поля с ID пользователя в параметрах лаунчера. */
function extractUserId(params) {
  return String(params.uid || params.user_id || params.userId || '');
}

function buildPaymentUrl(order) {
  if (DEV_MODE || !CONFIG.vkplayPaymentUrlTemplate) {
    return `${CONFIG.publicUrl}/dev/pay/${order.id}`;
  }
  return CONFIG.vkplayPaymentUrlTemplate
    .replace('{gameId}', encodeURIComponent(CONFIG.vkplayGameId))
    .replace('{orderId}', encodeURIComponent(order.id))
    .replace('{userId}', encodeURIComponent(order.userId))
    .replace('{amount}', encodeURIComponent(order.amountRub))
    .replace('{productId}', encodeURIComponent(order.productId));
}

// ---------------------------------------------------------------------------
// Начисления
// ---------------------------------------------------------------------------

function createGrant(userId, itemId, count, source) {
  const grant = { id: newId('grant'), userId, itemId, count, source, acked: false, createdAt: new Date().toISOString() };
  db.grants[grant.id] = grant;
  return grant;
}

function giveItem(user, itemId, count, permanent, source) {
  if (permanent) {
    if (!user.entitlements.includes(itemId)) user.entitlements.push(itemId);
  } else {
    createGrant(user.id, itemId, count, source);
  }
}

/** Идемпотентно: повторное уведомление по тому же заказу ничего не начислит. */
function fulfillOrder(order, transactionId) {
  if (order.status === 'paid') return;
  const user = getOrCreateUser(order.userId);
  const product = CATALOG.products.find((p) => p.id === order.productId);
  if (!product) throw new Error(`unknown product ${order.productId}`);

  if (product.premiumAmount) user.premiumBalance += product.premiumAmount;
  if (product.premiumDays) {
    const now = Date.now();
    const from = user.premiumUntil && Date.parse(user.premiumUntil) > now ? Date.parse(user.premiumUntil) : now;
    user.premiumUntil = new Date(from + product.premiumDays * 24 * 3600 * 1000).toISOString();
  }
  for (const item of product.items || []) {
    giveItem(user, item.itemId, item.count || 1, !!item.permanent, `order:${order.id}`);
  }
  if (product.oncePerUser && !user.boughtOnce.includes(product.id)) user.boughtOnce.push(product.id);

  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  order.transactionId = transactionId || null;
  db.purchases.push({ type: 'money', orderId: order.id, userId: user.id, productId: product.id, rub: order.amountRub, at: order.paidAt });
  saveDb();
  console.log(`[ORDER PAID] ${order.id} user=${user.id} product=${product.id} ${order.amountRub} RUB`);
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/health', (req, res) => res.json({ ok: true, dev: DEV_MODE }));

// Авторизация через параметры лаунчера VK Play
app.post('/api/auth/vkplay', (req, res) => {
  const params = (req.body && req.body.launchParams) || {};
  if (!verifySignedParams(params)) {
    return res.status(403).json({ error: 'bad_signature' });
  }
  const userId = extractUserId(params);
  if (!userId) return res.status(400).json({ error: 'no_user_id' });
  getOrCreateUser(`vk:${userId}`);
  res.json({ token: createSession(`vk:${userId}`), userId });
});

// Авторизация для разработки (только DEV_MODE)
app.post('/api/auth/dev', (req, res) => {
  if (!DEV_MODE) return res.status(404).json({ error: 'not_found' });
  const deviceId = String((req.body && req.body.deviceId) || 'local');
  const userId = `dev:${deviceId}`;
  getOrCreateUser(userId);
  res.json({ token: createSession(userId), userId });
});

app.get('/api/profile', auth, (req, res) => {
  const user = req.user;
  const grants = Object.values(db.grants)
    .filter((g) => g.userId === user.id && !g.acked)
    .map((g) => ({ id: g.id, itemId: g.itemId, count: g.count }));
  res.json({
    userId: user.id,
    premiumBalance: user.premiumBalance,
    entitlements: user.entitlements,
    premiumUntil: user.premiumUntil,
    grants,
  });
});

app.post('/api/grants/ack', auth, (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  for (const id of ids) {
    const grant = db.grants[id];
    if (grant && grant.userId === req.user.id) grant.acked = true;
  }
  saveDb();
  res.json({ ok: true });
});

app.get('/api/store/products', auth, (req, res) => {
  const user = req.user;
  const products = CATALOG.products
    .filter((p) => !(p.oncePerUser && user.boughtOnce.includes(p.id)))
    .map(({ id, title, description, priceRub, premiumAmount, premiumDays }) => ({
      id, title, description, priceRub, premiumAmount: premiumAmount || 0, premiumDays: premiumDays || 0,
    }));
  res.json({ products, goldPrices: CATALOG.goldPrices });
});

// Создание заказа на реальные деньги
app.post('/api/orders', auth, (req, res) => {
  const productId = String((req.body && req.body.productId) || '');
  const product = CATALOG.products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'unknown_product' });
  if (product.oncePerUser && req.user.boughtOnce.includes(product.id)) {
    return res.status(409).json({ error: 'already_bought' });
  }
  const order = {
    id: newId('ord'),
    userId: req.user.id,
    productId,
    amountRub: product.priceRub,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.orders[order.id] = order;
  saveDb();
  res.json({ orderId: order.id, paymentUrl: buildPaymentUrl(order) });
});

app.get('/api/orders/:id', auth, (req, res) => {
  const order = db.orders[req.params.id];
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'not_found' });
  res.json({ orderId: order.id, status: order.status, productId: order.productId });
});

// Покупка за золото (списание только здесь, на сервере)
app.post('/api/store/buy', auth, (req, res) => {
  const itemId = String((req.body && req.body.itemId) || '');
  const price = CATALOG.goldPrices[itemId];
  if (!price) return res.status(404).json({ error: 'not_for_sale' });
  const user = req.user;
  if (price.permanent && user.entitlements.includes(itemId)) {
    return res.status(409).json({ error: 'already_owned' });
  }
  if (user.premiumBalance < price.gold) {
    return res.status(402).json({ error: 'not_enough_gold', premiumBalance: user.premiumBalance });
  }
  user.premiumBalance -= price.gold;
  giveItem(user, itemId, price.quantity || 1, !!price.permanent, 'gold');
  db.purchases.push({ type: 'gold', userId: user.id, itemId, gold: price.gold, at: new Date().toISOString() });
  saveDb();
  res.json({ ok: true, premiumBalance: user.premiumBalance });
});

// ---------------------------------------------------------------------------
// Уведомление об оплате от VK Play (server-to-server)
// TODO VK PLAY: URL этого обработчика указывается в настройках приложения в кабинете разработчика.
// Сверь: метод (GET/POST), имена полей (ID заказа, сумма, ID транзакции, статус) и формат ответа.
// ---------------------------------------------------------------------------
app.all('/vkplay/callback', express.urlencoded({ extended: false }), (req, res) => {
  const params = { ...req.query, ...(req.body || {}) };

  if (!verifySignedParams(params)) {
    console.warn('[CALLBACK] bad signature', params);
    return res.status(403).json({ status: 'error', error: 'bad_signature' });
  }

  // TODO VK PLAY: имя поля, в котором платформа возвращает наш orderId
  const orderId = String(params.order_id || params.merchant_param || params.custom_data || params.payload || '');
  const order = db.orders[orderId];
  if (!order) {
    console.warn('[CALLBACK] unknown order', orderId);
    return res.status(404).json({ status: 'error', error: 'unknown_order' });
  }

  // Проверяем сумму: нельзя начислить «золото за 899» при оплате 99
  const paidAmount = Number(params.amount || params.price || params.sum || NaN);
  if (!Number.isNaN(paidAmount) && Math.round(paidAmount) !== Math.round(order.amountRub)) {
    console.warn('[CALLBACK] amount mismatch', orderId, paidAmount, order.amountRub);
    return res.status(400).json({ status: 'error', error: 'amount_mismatch' });
  }

  // TODO VK PLAY: поле статуса платежа, если платформа присылает и отмены
  const status = String(params.status || 'paid').toLowerCase();
  if (['canceled', 'cancelled', 'failed', 'refunded'].includes(status)) {
    if (order.status === 'pending') order.status = 'canceled';
    saveDb();
    return res.json({ status: 'ok' });
  }

  try {
    fulfillOrder(order, params.transaction_id || params.txn_id || params.tid);
  } catch (e) {
    console.error('[CALLBACK] fulfill error', e);
    return res.status(500).json({ status: 'error' });
  }
  // TODO VK PLAY: точный формат успешного ответа
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Тестовая оплата (только DEV_MODE) — имитирует окно оплаты и callback
// ---------------------------------------------------------------------------
app.get('/dev/pay/:id', (req, res) => {
  if (!DEV_MODE) return res.status(404).send('not found');
  const order = db.orders[req.params.id];
  if (!order) return res.status(404).send('order not found');
  const product = CATALOG.products.find((p) => p.id === order.productId);
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Тестовая оплата</title>
<style>body{font-family:sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#1c1c1c;padding:32px;border-radius:12px;min-width:320px;text-align:center}
button{font-size:18px;padding:10px 24px;margin:8px;border:0;border-radius:8px;cursor:pointer}
.ok{background:#2c7}.no{background:#555;color:#eee}</style></head><body><div class="card">
<h2>Тестовая оплата</h2><p>${product ? product.title : order.productId}</p><p><b>${order.amountRub} ₽</b></p>
<p>Статус: ${order.status}</p>
<form method="post" action="/dev/pay/${order.id}"><button class="ok" name="result" value="paid">Оплатить</button>
<button class="no" name="result" value="canceled">Отмена</button></form></div></body></html>`);
});

app.post('/dev/pay/:id', express.urlencoded({ extended: false }), (req, res) => {
  if (!DEV_MODE) return res.status(404).send('not found');
  const order = db.orders[req.params.id];
  if (!order) return res.status(404).send('order not found');
  if (req.body.result === 'paid') {
    fulfillOrder(order, 'dev');
  } else if (order.status === 'pending') {
    order.status = 'canceled';
    saveDb();
  }
  res.type('html').send('<meta charset="utf-8"><body style="font-family:sans-serif;background:#111;color:#eee;padding:40px">' +
    `<h2>${order.status === 'paid' ? 'Оплачено! Возвращайтесь в игру.' : 'Оплата отменена.'}</h2></body>`);
});

app.listen(CONFIG.port, () => {
  console.log(`FishingSim backend on :${CONFIG.port} ${DEV_MODE ? '(DEV_MODE: тестовая оплата включена)' : ''}`);
  if (!DEV_MODE && !CONFIG.vkplaySecret) {
    console.warn('ВНИМАНИЕ: VKPLAY_SECRET не задан — авторизация и уведомления VK Play будут отклоняться.');
  }
});
