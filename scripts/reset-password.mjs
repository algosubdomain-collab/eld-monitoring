// Parolni o'rnatish yoki tiklash:
//   npm run user:reset -- <login>              → parol standartga qaytadi
//   npm run user:reset -- <login> <yangi-parol> → shu parol o'rnatiladi
// Login ko'rsatilmasa — mavjud akkauntlar ro'yxati chiqadi.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PASSWORD } from '../src/auth.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'users.json');
const login = (process.argv[2] ?? '').trim().toLowerCase();
const password = process.argv[3] ?? DEFAULT_PASSWORD;

let users = {};
try { users = JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { /* hali yo'q */ }

if (!login) {
  const names = Object.keys(users);
  console.log(names.length ? `Akkauntlar: ${names.join(', ')}` : 'Hali akkaunt yo\'q.');
  console.log('Foydalanish: npm run user:reset -- <login> [yangi-parol]');
  process.exit(0);
}

const user = users[login];
if (!user) {
  console.error(`"${login}" topilmadi. Mavjud: ${Object.keys(users).join(', ') || '—'}`);
  process.exit(1);
}
if (password.length < 8) {
  console.error('Parol kamida 8 belgi bo\'lishi kerak.');
  process.exit(1);
}

user.salt = crypto.randomBytes(16).toString('hex');
user.hash = await new Promise((resolve, reject) =>
  crypto.scrypt(password, user.salt, 64, { N: 16384, r: 8, p: 1 },
    (err, key) => (err ? reject(err) : resolve(key.toString('hex'))))
);
delete user.mustChangePassword;
await fs.writeFile(FILE, JSON.stringify(users, null, 2));

// Eski sessiyalar bekor qilinadi.
const SESS = path.join(path.dirname(FILE), 'sessions.json');
try {
  const sessions = JSON.parse(await fs.readFile(SESS, 'utf8'));
  for (const [id, s] of Object.entries(sessions)) if (s.login === login) delete sessions[id];
  await fs.writeFile(SESS, JSON.stringify(sessions, null, 2));
} catch { /* sessiya yo'q */ }

console.log(`"${login}" uchun parol o'rnatildi${process.argv[3] ? '' : `: ${DEFAULT_PASSWORD}`}.`);
