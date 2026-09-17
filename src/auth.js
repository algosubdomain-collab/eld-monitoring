// Ilovaning o'z foydalanuvchilari: login/parol, sessiyalar.
//
// Parol hech qachon ochiq saqlanmaydi — scrypt bilan xeshlanadi (Node'ning
// o'zida bor, qo'shimcha paket kerak emas). Har parolning o'z tuzi bor.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const USERS_FILE = path.join(DIR, 'users.json');
const SESSIONS_FILE = path.join(DIR, 'sessions.json');

const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? 30);

// Standart akkaunt — birinchi ishga tushishda yaratiladi.
export const DEFAULT_LOGIN = process.env.DEFAULT_ADMIN_LOGIN ?? 'admin';
export const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin12345';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * Rol saqlanmaydi — standart akkaunt yagona owner (foydalanuvchilarni faqat
 * u yaratadi), qolganlari oddiy foydalanuvchi.
 */
const roleOf = (user) => (user.login === DEFAULT_LOGIN ? 'owner' : 'user');
const publicUser = (user) => ({ login: user.login, role: roleOf(user), createdAt: user.createdAt ?? null });

let users = null;
let sessions = null;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Har safar fayldan o'qiladi (fayllar kichik): `npm run user:reset` bilan
// qilingan o'zgarish serverni qayta ishga tushirmasdan kuchga kirsin.
const loadUsers = async () => (users = await readJson(USERS_FILE, {}));
const loadSessions = async () => (sessions = await readJson(SESSIONS_FILE, {}));

function hash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT.keylen, SCRYPT, (err, key) =>
      err ? reject(err) : resolve(key.toString('hex'))
    );
  });
}

/** Parollarni taqqoslash — vaqt bo'yicha hujumdan himoya bilan. */
function sameHash(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function hasUsers() {
  return Object.keys(await loadUsers()).length > 0;
}

/**
 * Standart akkaunt yo'q bo'lsa yaratadi — boshqa akkauntlar bor-yo'qligidan
 * qat'i nazar. Avval faqat umuman akkaunt bo'lmaganda yaratilardi va
 * allaqachon o'rnatilgan serverlarda README'dagi login ishlamay qolardi.
 * Mavjud admin'ning paroliga tegilmaydi.
 * Yaratilgan bo'lsa true qaytaradi (server logga yozish uchun).
 */
export async function ensureDefaultUser() {
  const all = await loadUsers();
  if (all[DEFAULT_LOGIN]) return false;

  const salt = crypto.randomBytes(16).toString('hex');
  all[DEFAULT_LOGIN] = {
    login: DEFAULT_LOGIN,
    salt,
    hash: await hash(DEFAULT_PASSWORD, salt),
    createdAt: new Date().toISOString(),
  };
  await writeJson(USERS_FILE, all);
  return true;
}

export async function getUser(login) {
  const user = (await loadUsers())[login];
  return user ? { login: user.login, role: roleOf(user) } : null;
}

export async function listUsers() {
  return Object.values(await loadUsers())
    .map(publicUser)
    .sort((a, b) => a.login.localeCompare(b.login));
}

function checkPassword(password) {
  if (String(password ?? '').length < 8) throw new Error('Password must be at least 8 characters');
}

export async function createUser(login, password) {
  const all = await loadUsers();
  const id = String(login ?? '').trim().toLowerCase();

  if (!id) throw new Error('Login is required');
  if (id.length < 3) throw new Error('Login must be at least 3 characters');
  if (!/^[a-z0-9._-]+$/.test(id)) throw new Error('Login may only contain letters, digits, . _ -');
  if (all[id]) throw new Error('That login is already taken');
  checkPassword(password);

  const salt = crypto.randomBytes(16).toString('hex');
  all[id] = {
    login: id,
    salt,
    hash: await hash(password, salt),
    createdAt: new Date().toISOString(),
  };
  await writeJson(USERS_FILE, all);
  return publicUser(all[id]);
}

/** Parolni o'zgartirish — eski sessiyalar bekor bo'ladi. */
export async function setPassword(login, password) {
  const all = await loadUsers();
  const user = all[login];
  if (!user) throw new Error('User not found');
  checkPassword(password);

  user.salt = crypto.randomBytes(16).toString('hex');
  user.hash = await hash(password, user.salt);
  await writeJson(USERS_FILE, all);
  await destroyUserSessions(login);
  return publicUser(user);
}

export async function deleteUser(login) {
  const all = await loadUsers();
  if (!all[login]) throw new Error('User not found');
  if (roleOf(all[login]) === 'owner') throw new Error('The owner account cannot be deleted');

  delete all[login];
  await writeJson(USERS_FILE, all);
  await destroyUserSessions(login);
}

export async function verifyUser(login, password) {
  const all = await loadUsers();
  const user = all[String(login ?? '').trim().toLowerCase()];
  if (!user) return null;

  const attempt = await hash(String(password ?? ''), user.salt);
  return sameHash(attempt, user.hash) ? { login: user.login, role: roleOf(user) } : null;
}

// ---------- Sessiyalar ----------

export async function createSession(login) {
  const all = await loadSessions();
  const id = crypto.randomBytes(32).toString('hex');

  all[id] = {
    login,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DAYS * 86_400_000,
  };
  await writeJson(SESSIONS_FILE, all);
  return id;
}

export async function getSession(id) {
  if (!id) return null;
  const all = await loadSessions();
  const s = all[id];

  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    delete all[id];
    await writeJson(SESSIONS_FILE, all);
    return null;
  }
  // O'chirilgan akkauntning sessiyasi ham yaroqsiz.
  if (!(await loadUsers())[s.login]) return null;
  return { login: s.login };
}

export async function destroySession(id) {
  const all = await loadSessions();
  if (all[id]) {
    delete all[id];
    await writeJson(SESSIONS_FILE, all);
  }
}

async function destroyUserSessions(login) {
  const all = await loadSessions();
  let changed = false;
  for (const [id, s] of Object.entries(all)) {
    if (s.login === login) { delete all[id]; changed = true; }
  }
  if (changed) await writeJson(SESSIONS_FILE, all);
}

export const SESSION_COOKIE = 'eld_session';
export const cookieMaxAge = SESSION_DAYS * 86_400;
