// Update board — har bir haydovchi uchun support xodimi to'ldiradigan maydonlar
// (status, profile form, responsible, tekshirildi belgisi, certify vaqti).
//
// Jonli ma'lumot (ism, truck, ELD holati) fleet'dan keladi; bu yerda faqat
// qo'lda kiritiladigan qiymatlar saqlanadi. Har bir foydalanuvchiga tegishli
// (login), haydovchi companyId+driverId bilan emas, faqat driverId bilan.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'board.json'
);

// Tahrirlanadigan ustunlar va turlari.
const BOOL_FIELDS = [];
const TEXT_FIELDS = {
  status: 60, profileForm: 60, certified: 30, responsible: 60, suggFixed: 40,
  // Tekshirildi belgisi — qachon va kim qo'ygani. Belgi qo'lda olinmaguncha
  // turadi (avtomatik tozalanmaydi), shuning uchun vaqti bilan saqlanadi.
  checkedAt: 30, checkedBy: 60,
};

// Bitta so'rovda nechta qatorni o'zgartirish mumkin (ommaviy amallar uchun).
const MAX_BULK = 2000;

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  dropRetiredFields(cache);
  return cache;
}

/**
 * Endi ishlatilmaydigan ustunlarning eski qiymatlari. "update" ustuni
 * "profileForm" bilan almashtirildi — qiymatlari mazmunan boshqa narsa
 * ("Disconnect update" kabi), shuning uchun ko'chirilmaydi, tashlanadi.
 */
const RETIRED = ['update'];

function dropRetiredFields(all) {
  for (const rows of Object.values(all)) {
    for (const [id, row] of Object.entries(rows)) {
      for (const key of RETIRED) {
        if (key in row) delete row[key];
      }
      if (!Object.keys(row).length) delete rows[id];
    }
  }
}

async function persist() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
}

/** Bitta qatorga patch qo'llaydi (faqat ruxsat etilgan ustunlar). */
function applyPatch(row, patch = {}) {
  const next = { ...row };
  for (const [k, v] of Object.entries(patch)) {
    if (BOOL_FIELDS.includes(k)) {
      next[k] = Boolean(v);
    } else if (k in TEXT_FIELDS) {
      const text = String(v ?? '').trim().slice(0, TEXT_FIELDS[k]);
      if (text) next[k] = text; else delete next[k];
    }
  }
  return next;
}

/** Qator butunlay bo'sh bo'lsa saqlamaymiz (fayl kichik qolsin). */
function put(forUser, driverId, row) {
  const empty = Object.keys(row).every((k) => !row[k]);
  if (empty) delete forUser[driverId];
  else forUser[driverId] = row;
}

/** { [driverId]: {status, profileForm, ...} } — shu foydalanuvchi uchun. */
export async function getBoard(login) {
  const all = await load();
  return all[login] ?? {};
}

/** Bitta haydovchi qatoriga qiymat yozadi. */
export async function patchRow(login, driverId, patch = {}) {
  if (!driverId) throw new Error('driverId required');
  const all = await load();
  const forUser = { ...(all[login] ?? {}) };

  put(forUser, driverId, applyPatch(forUser[driverId] ?? {}, patch));

  all[login] = forUser;
  cache = all;
  await persist();
  return forUser[driverId] ?? {};
}

/**
 * Bir nechta haydovchiga bitta patch — "hammasiga o'zimni responsible qilib
 * qo'y" va "belgilarni tozala" kabi amallar uchun. Bitta yozuv bilan saqlaydi.
 * Qaytaradi: o'zgargan qatorlar { [driverId]: row }.
 */
export async function patchRows(login, driverIds, patch = {}) {
  if (!Array.isArray(driverIds)) throw new Error('driverIds required');

  const ids = [...new Set(driverIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length > MAX_BULK) throw new Error(`Too many drivers (max ${MAX_BULK})`);
  if (!ids.length) return {};

  const all = await load();
  const forUser = { ...(all[login] ?? {}) };

  const changed = {};
  for (const id of ids) {
    put(forUser, id, applyPatch(forUser[id] ?? {}, patch));
    changed[id] = forUser[id] ?? {};
  }

  all[login] = forUser;
  cache = all;
  await persist();
  return changed;
}

/** Akkaunt o'chirilganda board ham o'chsin. */
export async function deleteBoard(login) {
  const all = await load();
  if (!all[login]) return;
  delete all[login];
  await persist();
}
