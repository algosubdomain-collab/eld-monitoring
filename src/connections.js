// Har bir foydalanuvchining ulanishlari: ELD platformalari tokenlari va
// Telegram sozlamalari.
//
// Tokenlar serverda saqlanadi (avval brauzerda edi) — chunki xabarnoma
// brauzer yopiq bo'lganda ham ishlashi kerak.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './providers.js';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'connections.json'
);

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
}

const empty = () => ({ providers: {}, telegram: null });

export async function getConnections(login) {
  const all = await load();
  return all[login] ?? empty();
}

/** Interfeysga tokenning o'zi emas, faqat holati yuboriladi. */
export async function getConnectionStatus(login) {
  const conn = await getConnections(login);

  return {
    providers: PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      site: p.site,
      connected: Boolean(conn.providers?.[p.id]?.token) && !conn.providers?.[p.id]?.expiredAt,
      expired: Boolean(conn.providers?.[p.id]?.expiredAt),
      connectedAt: conn.providers?.[p.id]?.connectedAt ?? null,
      refreshedAt: conn.providers?.[p.id]?.refreshedAt ?? null,
      autoRenew: Boolean(conn.providers?.[p.id]?.refreshToken),
      lastError: conn.providers?.[p.id]?.lastError ?? null,
    })),
    telegram: conn.telegram
      ? { chatId: conn.telegram.chatId, chatTitle: conn.telegram.chatTitle ?? null, connected: true }
      : { connected: false },
  };
}

export async function setProviderToken(login, providerId, token, refreshToken = null) {
  if (!PROVIDERS.some((p) => p.id === providerId)) throw new Error('Unknown provider');

  const all = await load();
  const conn = all[login] ?? empty();

  conn.providers = { ...conn.providers };
  if (token) {
    conn.providers[providerId] = {
      token,
      refreshToken,
      connectedAt: new Date().toISOString(),
      refreshedAt: null,
      lastError: null,
    };
  } else {
    delete conn.providers[providerId];
  }

  all[login] = conn;
  cache = all;
  await persist();
}

/** Token o'zi yangilanganda yangisini saqlaymiz. */
export async function updateProviderTokens(login, providerId, { token, refreshToken }) {
  const all = await load();
  const entry = all[login]?.providers?.[providerId];
  if (!entry) return;

  entry.token = token;
  if (refreshToken) entry.refreshToken = refreshToken;
  entry.refreshedAt = new Date().toISOString();
  entry.lastError = null;
  await persist();
}

/**
 * Token ham, refresh ham rad etildi. Ulanishni o'chirmaymiz — tokenlar va
 * sabab qoladi, faqat kuzatuv to'xtaydi. Qaytadan ulanganda
 * setProviderToken yozuvni butunlay yangilaydi.
 * Birinchi marta belgilanganda true qaytaradi (xabarni bir marta yuborish uchun).
 */
export async function markProviderExpired(login, providerId, message) {
  const all = await load();
  const entry = all[login]?.providers?.[providerId];
  if (!entry || entry.expiredAt) return false;

  entry.expiredAt = new Date().toISOString();
  entry.lastError = message;
  await persist();
  return true;
}

/** Token ishlamay qolganda sababini eslab qolamiz — interfeysda ko'rsatish uchun. */
export async function noteProviderError(login, providerId, message) {
  const all = await load();
  const entry = all[login]?.providers?.[providerId];
  if (!entry) return;

  entry.lastError = message;
  await persist();
}

export async function setTelegram(login, config) {
  const all = await load();
  const conn = all[login] ?? empty();

  conn.telegram = config
    ? {
        botToken: config.botToken,
        chatId: String(config.chatId),
        chatTitle: config.chatTitle ?? null,
        connectedAt: new Date().toISOString(),
      }
    : null;

  all[login] = conn;
  cache = all;
  await persist();
}

/** Akkaunt o'chirilganda: tokenlari qolib, fonda so'rov yuborib yurmasin. */
export async function deleteConnections(login) {
  const all = await load();
  if (!all[login]) return;
  delete all[login];
  await persist();
}

/** Xabarnoma uchun: kimda sozlangan ulanish bor. */
export async function allConnections() {
  const all = await load();
  return Object.entries(all).map(([login, conn]) => ({ login, ...conn }));
}
