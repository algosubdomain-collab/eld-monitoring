// Har bir kompaniya uchun qisqa "requirement" (eslatma/talab).
// Foydalanuvchi kompaniyaga yozib qo'ygan matn o'sha kompaniyaning barcha
// haydovchilari ostida dashboard'da kichik yozuv bo'lib chiqadi.
//
// Har bir foydalanuvchiga tegishli (login bo'yicha), kompaniya esa companyId
// bilan belgilanadi — nomi o'zgarsa ham eslatma yo'qolmaydi.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'requirements.json'
);

const MAX_LEN = 280;
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

/** { [companyId]: note } — shu foydalanuvchi uchun. */
export async function getRequirements(login) {
  const all = await load();
  return all[login] ?? {};
}

/** Bo'sh matn eslatmani o'chiradi. */
export async function setRequirement(login, companyId, note) {
  if (!companyId) throw new Error('companyId required');
  const all = await load();
  const forUser = { ...(all[login] ?? {}) };

  const text = String(note ?? '').trim().slice(0, MAX_LEN);
  if (text) forUser[String(companyId)] = text;
  else delete forUser[String(companyId)];

  all[login] = forUser;
  cache = all;
  await persist();
  return forUser;
}

/** Akkaunt o'chirilganda eslatmalari ham o'chsin. */
export async function deleteRequirements(login) {
  const all = await load();
  if (!all[login]) return;
  delete all[login];
  await persist();
}
