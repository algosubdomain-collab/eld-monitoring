// Update board sozlamalari — foydalanuvchi o'zi moslashtiradigan qismlar:
//   statuses/profileForms — Status va Profile Form ustunlaridagi tanlovlar;
//   responsibles     — Responsible ustunidagi odamlar ro'yxati;
//   me               — shu foydalanuvchining o'z ismi ("hammasiga o'zimni qo'y");
//   boards           — kompaniyalarni bo'lib ishlatish uchun board'lar.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'board-config.json'
);

// Ruxsat etilgan ranglar (web styles.css dagi o'zgaruvchilar).
const COLORS = ['lime', 'amber', 'violet', 'slate', 'red', 'sky'];

const MAX_BOARDS = 20;
const MAX_BOARD_COMPANIES = 400;

const DEFAULTS = {
  statuses: [
    { label: 'All good', color: 'lime' },
    { label: 'Need to check', color: 'amber' },
    { label: 'Check profile form', color: 'violet' },
    { label: 'Offline', color: 'slate' },
  ],
  profileForms: [
    { label: 'Filled', color: 'lime' },
    { label: 'Needs update', color: 'amber' },
    { label: 'Sent to driver', color: 'sky' },
    { label: 'No response', color: 'slate' },
  ],
  responsibles: [],
  me: '',
  boards: [],
};

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

/** Bitta ro'yxatni tozalaydi: nom majburiy, rang ruxsat etilganlardan. */
function cleanList(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const label = String(item?.label ?? '').trim().slice(0, 60);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ label, color: COLORS.includes(item?.color) ? item.color : 'slate' });
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * Board'lar ro'yxatini tozalaydi. Har biri: {id, name, companies:[companyId]}.
 * Bitta kompaniya bir nechta boardda bo'lishi mumkin — bu cheklanmaydi.
 */
function cleanBoards(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seenId = new Set();
  for (const item of list) {
    const name = String(item?.name ?? '').trim().slice(0, 40);
    if (!name) continue;

    let id = String(item?.id ?? '').trim().slice(0, 40);
    if (!id || seenId.has(id)) id = randomUUID().slice(0, 8);
    seenId.add(id);

    const companies = Array.isArray(item?.companies)
      ? [...new Set(item.companies.map((c) => String(c ?? '').trim()).filter(Boolean))]
        .slice(0, MAX_BOARD_COMPANIES)
      : [];

    out.push({ id, name, companies });
    if (out.length >= MAX_BOARDS) break;
  }
  return out;
}

export async function getConfig(login) {
  const all = await load();
  const cfg = all[login] ?? {};
  return {
    statuses: cfg.statuses ?? DEFAULTS.statuses,
    profileForms: cfg.profileForms ?? DEFAULTS.profileForms,
    responsibles: cfg.responsibles ?? DEFAULTS.responsibles,
    me: cfg.me ?? DEFAULTS.me,
    boards: cfg.boards ?? DEFAULTS.boards,
  };
}

export async function setConfig(login, input) {
  const all = await load();
  const cur = all[login] ?? {};

  // Berilmagan bo'limlar tegilmaydi — sozlamalar qismlab saqlanishi mumkin.
  const statuses = cleanList(input?.statuses);
  const profileForms = cleanList(input?.profileForms);
  const responsibles = cleanList(input?.responsibles);
  const boards = cleanBoards(input?.boards);
  const me = input?.me === undefined
    ? undefined
    : String(input.me ?? '').trim().slice(0, 60);

  all[login] = {
    statuses: statuses ?? cur.statuses ?? DEFAULTS.statuses,
    profileForms: profileForms ?? cur.profileForms ?? DEFAULTS.profileForms,
    responsibles: responsibles ?? cur.responsibles ?? DEFAULTS.responsibles,
    me: me ?? cur.me ?? DEFAULTS.me,
    boards: boards ?? cur.boards ?? DEFAULTS.boards,
  };
  cache = all;
  await persist();
  return getConfig(login);
}

export async function deleteConfig(login) {
  const all = await load();
  if (!all[login]) return;
  delete all[login];
  await persist();
}
