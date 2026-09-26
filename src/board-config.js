// Update board sozlamalari — foydalanuvchi o'zi moslashtiradigan variantlar:
// Status va Update ustunlaridagi tanlovlar (nom + rang).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'board-config.json'
);

// Ruxsat etilgan ranglar (web styles.css dagi o'zgaruvchilar).
const COLORS = ['lime', 'amber', 'violet', 'slate', 'red', 'sky'];

const DEFAULTS = {
  statuses: [
    { label: 'All good', color: 'lime' },
    { label: 'Need to check', color: 'amber' },
    { label: 'Check profile form', color: 'violet' },
    { label: 'Offline', color: 'slate' },
  ],
  updates: [
    { label: 'Disconnect update', color: 'sky' },
    { label: 'Cycle update', color: 'amber' },
    { label: 'Load update', color: 'violet' },
    { label: 'Empty update', color: 'slate' },
    { label: 'BOL update', color: 'lime' },
  ],
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

export async function getConfig(login) {
  const all = await load();
  const cfg = all[login] ?? {};
  return {
    statuses: cfg.statuses ?? DEFAULTS.statuses,
    updates: cfg.updates ?? DEFAULTS.updates,
  };
}

export async function setConfig(login, input) {
  const all = await load();
  const cur = all[login] ?? {};
  const statuses = cleanList(input?.statuses);
  const updates = cleanList(input?.updates);

  all[login] = {
    statuses: statuses ?? cur.statuses ?? DEFAULTS.statuses,
    updates: updates ?? cur.updates ?? DEFAULTS.updates,
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
