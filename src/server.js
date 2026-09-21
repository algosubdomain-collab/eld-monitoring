import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { loadSources } from './sources/index.js';
import { summarize } from './normalize.js';
import { getUpdates, markSent } from './updates.js';
import { PROVIDERS, getProvider, DEFAULT_PROVIDER } from './providers.js';
import { onFleetUpdate } from './notifier.js';
import { pruneResting, refreshRestingIfDue } from './resting.js';
import { getBot, getChat, listChats, sendMessage } from './telegram.js';
import {
  hasUsers, createUser, verifyUser, ensureDefaultUser, getUser,
  listUsers, setPassword, deleteUser,
  createSession, getSession, destroySession, SESSION_COOKIE, cookieMaxAge,
  DEFAULT_LOGIN, DEFAULT_PASSWORD,
} from './auth.js';
import {
  getConnections, getConnectionStatus, setProviderToken, setTelegram,
  noteProviderError, markProviderExpired, updateProviderTokens, allConnections,
  deleteConnections,
} from './connections.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Har bir platforma o'z manbasidan o'qiydi: sources.for(providerId).
const sources = await loadSources();

// ---------------------------------------------------------------- ma'lumot

// Kesh foydalanuvchi + provayder bo'yicha.
const caches = new Map();
// Ayni damda ketayotgan yig'ishlar — bir nechta so'rov bitta yig'ishga qo'shiladi.
const inFlight = new Map();

async function getData({ login, provider, force = false }) {
  const key = `${login}:${provider}`;
  const cache = caches.get(key) ?? { at: 0, payload: null, error: null };
  caches.set(key, cache);

  // Fon yangilanishi keshni har aylanishda o'zi yangilaydi. Oyna ikki
  // aylanishga teng: fon yig'ishi cho'zilgan paytda dashboard so'rovi
  // platformaga ikkinchi to'liq yig'ishni boshlab yubormasin.
  const fresh = Date.now() - cache.at < config.refreshSeconds * 2000;
  if (!force && fresh && cache.payload) return cache.payload;

  const running = inFlight.get(key);
  if (running) return running;

  const task = refresh(login, provider, cache).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

async function refresh(login, provider, cache) {
  const conn = await getConnections(login);
  const entry = conn.providers?.[provider];
  const token = entry?.expiredAt ? null : entry?.token;
  if (!token) {
    const err = new Error('This platform is not connected yet');
    err.notConnected = true;
    throw err;
  }

  const source = sources.for(provider);

  try {
    const result = await source.fetchDrivers({
      token,
      refreshToken: entry.refreshToken ?? null,
      provider,
      // Token o'zi yangilanganda saqlab qo'yamiz.
      onTokens: (t) => updateProviderTokens(login, provider, t),
    });
    const drivers = Array.isArray(result) ? result : result.drivers;
    if (!drivers.length) {
      // Bo'sh ro'yxatda uzilishlar tekshirilmaydi — jimgina o'tib ketmasin.
      const r = Array.isArray(result) ? null : result.restricted;
      console.warn(`[fon] ${login}/${provider}: platforma 0 ta haydovchi qaytardi` +
        (r ? ` (${r.count}/${r.totalCompanies} kompaniyaga ruxsat yo'q)` : ''));
    }

    cache.at = Date.now();
    cache.error = null;
    cache.payload = {
      source: { ...source.meta, ...(result.provider ? { name: result.provider.name } : {}) },
      fetchedAt: new Date().toISOString(),
      summary: summarize(drivers),
      incomplete: Array.isArray(result) ? null : result.incomplete ?? null,
      restricted: Array.isArray(result) ? null : result.restricted ?? null,
      drivers,
    };

    // Dam oluvchi statusini o'zgartirgan bo'lsa — xabar tekshiruvidan oldin chiqaramiz.
    await pruneResting(`${login}:${provider}`, drivers).catch((err) => console.warn(`[resting] ${err.message}`));

    onFleetUpdate({
      login, providerId: provider, drivers, telegram: conn.telegram,
      // Skrinshot paytida eng yangi token (u o'zi yangilangan bo'lishi mumkin).
      getToken: async () => (await getConnections(login)).providers?.[provider]?.token ?? null,
    })
      .catch((err) => console.warn(`[telegram] ${err.message}`));
  } catch (err) {
    cache.error = err.message;
    if (err.tokenInvalid) await noteProviderError(login, provider, err.message);
    // Eski ma'lumot bo'lsa saqlab qolamiz — dashboard bo'sh qolmasin.
    if (!cache.payload) throw err;
  }
  return { ...cache.payload, error: cache.error };
}

// ------------------------------------------------------- fon yangilanishi

/**
 * Xabarnoma brauzerga bog'liq bo'lmasligi kerak: dashboard yopiq bo'lsa ham
 * uzilishlar sezilishi lozim. Shuning uchun server ulangan har bir
 * foydalanuvchi uchun o'zi yangilab turadi.
 */
function startBackgroundRefresh() {
  const everyMs = Math.max(60, config.refreshSeconds) * 1000;
  let cycling = false;

  setInterval(async () => {
    // Aylanish cho'zilsa (ko'p foydalanuvchi, 429) keyingisi ustiga tushmasin.
    if (cycling) return;
    cycling = true;
    const startedAt = Date.now();
    try {
      await backgroundCycle();
      const took = Date.now() - startedAt;
      // Aylanish oralig'idan uzoq cho'zilsa — uzilishlar kechroq sezila boshlaydi.
      if (took > everyMs) console.warn(`[fon] aylanish ${Math.round(took / 1000)}s davom etdi`);
    } catch (err) {
      console.warn(`[fon] ${err.message}`);
    } finally {
      cycling = false;
    }
  }, everyMs).unref?.();
}

async function backgroundCycle() {
  for (const conn of await allConnections()) {
    for (const [providerId, entry] of Object.entries(conn.providers ?? {})) {
      if (entry.expiredAt) continue;
      try {
        const data = await getData({ login: conn.login, provider: providerId, force: true });
        if (data.error) {
          // Eski ma'lumot qaytdi — bu aylanishda uzilishlar tekshirilmadi.
          console.warn(`[fon] ${conn.login}/${providerId}: yangilanmadi — ${data.error}`);
        } else {
          scheduleRestingCheck(conn.login, providerId, data.drivers);
        }
      } catch (err) {
        if (!err.tokenInvalid) {
          console.warn(`[fon] ${conn.login}/${providerId}: ${err.message}`);
          continue;
        }
        console.log(`[fon] ${conn.login}/${providerId}: token eskirgan — ${err.message}`);
        if (!(await markProviderExpired(conn.login, providerId, err.message))) continue;

        // Guruhga aytamiz — aks holda "xabar yo'q = hammasi joyida" deb
        // o'ylashadi, aslida kuzatuv butunlay to'xtagan bo'ladi.
        if (conn.telegram) {
          sendMessage(conn.telegram,
            '<b>⚠️ Disconnect alerts paused</b>\n\n' +
            `The ${getProvider(providerId).name} access token has expired. ` +
            'Open the dashboard and paste a fresh token to resume monitoring.'
          ).catch((e) => console.warn(`[telegram] ${e.message}`));
        }
      }
    }
  }
}

/**
 * 12 soatda bir: dam oluvchilar ro'yxatini qayta tuzish. Kutmaymiz —
 * yuzlab so'rov bir necha daqiqa oladi, uzilish tekshiruvi to'xtamasin.
 */
function scheduleRestingCheck(login, provider, drivers) {
  const source = sources.for(provider);
  if (!source.fetchLatestStatuses) return;

  const fetchLatest = async (candidates) => {
    const entry = (await getConnections(login)).providers?.[provider];
    return source.fetchLatestStatuses({
      drivers: candidates,
      token: entry?.token,
      refreshToken: entry?.refreshToken ?? null,
      provider,
      onTokens: (t) => updateProviderTokens(login, provider, t),
    });
  };
  refreshRestingIfDue({ key: `${login}:${provider}`, drivers, fetchLatest });
}

/** Owner paneli uchun: har bir akkaunt nimani ulagan (tokenlarsiz). */
async function usersWithStatus() {
  return Promise.all((await listUsers()).map(async (u) => {
    const status = await getConnectionStatus(u.login);
    return {
      ...u,
      platforms: status.providers.filter((p) => p.connected).map((p) => p.name),
      expired: status.providers.filter((p) => p.expired).map((p) => p.name),
      telegram: status.telegram.connected ? (status.telegram.chatTitle ?? 'Group') : null,
    };
  }));
}

// ------------------------------------------------------------------ HTTP

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const json = (res, status, data, headers) =>
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(data), headers);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) { req.destroy(); reject(new Error('So\'rov juda katta')); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Yaroqsiz JSON')); }
    });
    req.on('error', reject);
  });
}

function readCookie(req, name) {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const sessionCookie = (id) =>
  `${SESSION_COOKIE}=${id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${cookieMaxAge}`;
const clearCookie = () => `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

// Login urinishlarini cheklash — parolni ketma-ket terishga qarshi.
const attempts = new Map();
function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.at > 15 * 60_000) { attempts.delete(ip); return false; }
  return rec.count >= 10;
}
function noteAttempt(ip, ok) {
  if (ok) return attempts.delete(ip);
  const rec = attempts.get(ip) ?? { count: 0, at: Date.now() };
  attempts.set(ip, { count: rec.count + 1, at: Date.now() });
}

async function serveStatic(req, res) {
  const rel = req.url === '/' ? 'index.html'
    : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'text/plain', 'Forbidden');

  try {
    const body = await fs.readFile(file);
    return send(res, 200, MIME[path.extname(file)] ?? 'application/octet-stream', body);
  } catch {
    // SPA fallback: /c/driving kabi manzillar diskda fayl emas.
    if (!path.extname(file)) {
      try {
        return send(res, 200, MIME['.html'], await fs.readFile(path.join(PUBLIC_DIR, 'index.html')));
      } catch { /* build qilinmagan */ }
    }
    send(res, 404, 'text/plain', 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (!p.startsWith('/api/')) return serveStatic(req, res);

  try {
    // ---------- ochiq yo'llar ----------
    if (p === '/api/auth/status') {
      const session = await getSession(readCookie(req, SESSION_COOKIE));
      return json(res, 200, {
        needsSetup: !(await hasUsers()),
        user: session ? await getUser(session.login) : null,
        providers: PROVIDERS.map(({ id, name, site, source }) => ({ id, name, site, source })),
      });
    }

    if (p === '/api/auth/setup' && req.method === 'POST') {
      if (await hasUsers()) return json(res, 409, { error: 'An account already exists' });
      const { login, password } = await readJson(req);
      const user = await createUser(login, password);
      const sid = await createSession(user.login);
      return json(res, 200, { user }, { 'Set-Cookie': sessionCookie(sid) });
    }

    if (p === '/api/auth/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress ?? '?';
      if (tooManyAttempts(ip)) {
        return json(res, 429, { error: 'Too many attempts — wait 15 minutes' });
      }
      const { login, password } = await readJson(req);
      const user = await verifyUser(login, password);
      noteAttempt(ip, Boolean(user));

      if (!user) return json(res, 401, { error: 'Wrong login or password' });
      const sid = await createSession(user.login);
      return json(res, 200, { user }, { 'Set-Cookie': sessionCookie(sid) });
    }

    if (p === '/api/auth/logout' && req.method === 'POST') {
      await destroySession(readCookie(req, SESSION_COOKIE));
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
    }

    // ---------- shundan keyin sessiya majburiy ----------
    const session = await getSession(readCookie(req, SESSION_COOKIE));
    if (!session) return json(res, 401, { error: 'Not signed in', needsLogin: true });
    const login = session.login;

    // Owner — alohida panel: faqat foydalanuvchilarni boshqaradi,
    // dashboard va ulanishlar oddiy foydalanuvchilar uchun.
    const isOwner = (await getUser(login))?.role === 'owner';

    if (p === '/api/users' || p.startsWith('/api/users/')) {
      if (!isOwner) return json(res, 403, { error: 'Only the owner can manage users' });

      if (p === '/api/users') {
        if (req.method === 'GET') return json(res, 200, { users: await usersWithStatus() });
        if (req.method === 'POST') {
          const { login: newLogin, password } = await readJson(req);
          await createUser(newLogin, password);
          return json(res, 200, { users: await usersWithStatus() });
        }
        return json(res, 405, { error: 'Method not allowed' });
      }

      const target = decodeURIComponent(p.slice('/api/users/'.length)).toLowerCase();
      if (req.method === 'PATCH') {
        const { password } = await readJson(req);
        await setPassword(target, password);
        return json(res, 200, { users: await usersWithStatus() });
      }
      if (req.method === 'DELETE') {
        await deleteUser(target);
        await deleteConnections(target);
        caches.forEach((_, key) => key.startsWith(`${target}:`) && caches.delete(key));
        return json(res, 200, { users: await usersWithStatus() });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (isOwner && p !== '/api/health') {
      return json(res, 403, { error: 'The owner account only manages users' });
    }

    if (p === '/api/connections' && req.method === 'GET') {
      return json(res, 200, await getConnectionStatus(login));
    }

    if (p === '/api/connections/provider' && req.method === 'PUT') {
      const { provider, token, refreshToken } = await readJson(req);
      const id = getProvider(provider).id;

      if (token) {
        // Saqlashdan oldin tokenni sinab ko'ramiz — yaroqsizini qabul qilmaymiz.
        await sources.for(id).fetchDrivers({ token, provider: id, probeOnly: true });
      }
      await setProviderToken(login, id, token ?? null, refreshToken ?? null);
      caches.delete(`${login}:${id}`);
      return json(res, 200, await getConnectionStatus(login));
    }

    if (p === '/api/connections/telegram/chats' && req.method === 'POST') {
      const { botToken, chatId } = await readJson(req);
      const bot = await getBot(botToken);
      // ID qo'lda berilgan bo'lsa — to'g'ridan-to'g'ri tekshiramiz.
      const chats = chatId ? [await getChat(botToken, chatId)] : await listChats(botToken);
      return json(res, 200, {
        bot: { username: bot.username, name: bot.first_name, privacy: !bot.can_read_all_group_messages },
        chats,
      });
    }

    if (p === '/api/connections/telegram' && req.method === 'PUT') {
      const body = await readJson(req);
      if (body.botToken && body.chatId) {
        // Foydalanuvchi javobni kutib turibdi — qayta urinmasdan darhol xatoni ko'rsatamiz.
        await sendMessage(body, '<b>ELD Monitoring</b>\nConnected — disconnect alerts are on.', { retries: 0 });
        await setTelegram(login, body);
      } else {
        await setTelegram(login, null);
      }
      return json(res, 200, await getConnectionStatus(login));
    }

    if (p === '/api/drivers') {
      const provider = getProvider(String(url.searchParams.get('provider') ?? '')).id;
      try {
        const data = await getData({
          login, provider, force: url.searchParams.get('refresh') === '1',
        });
        return json(res, 200, data);
      } catch (err) {
        const status = err.tokenInvalid ? 401 : err.notConnected ? 409 : 502;
        return json(res, status, {
          error: err.message,
          tokenInvalid: !!err.tokenInvalid,
          notConnected: !!err.notConnected,
        });
      }
    }

    if (p === '/api/updates') {
      if (req.method === 'GET') return json(res, 200, await getUpdates());
      if (req.method === 'POST') {
        const body = await readJson(req);
        return json(res, 200, await markSent(body.section, body.driverIds));
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (p === '/api/health') {
      return json(res, 200, { ok: true, source: sources.label, user: login });
    }

    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    return json(res, 400, { error: err.message });
  }
});

startBackgroundRefresh();

if (await ensureDefaultUser()) {
  console.log(`Standart akkaunt yaratildi: login "${DEFAULT_LOGIN}", parol "${DEFAULT_PASSWORD}"`);
}

server.listen(config.port, config.host, () => {
  console.log(`ELD dashboard: http://localhost:${config.port}`);
  for (const ip of lanAddresses()) console.log(`  tarmoqda:    http://${ip}:${config.port}`);
  console.log(`Manba: ${sources.label} — har ${config.refreshSeconds}s yangilanadi`);
});

/** Bir tarmoqdagi qurilmalar uchun manzillar. */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}
