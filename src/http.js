// Haqiqiy saytdan ma'lumot olish uchun yordamchi funksiyalar.
// Node 20+ da fetch built-in, shuning uchun qo'shimcha paket kerak emas.
import { config } from './config.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Autentifikatsiya sarlavhalari bilan so'rov yuboradi. */
export async function request(url, options = {}) {
  const { apiKey, cookie } = config.credentials;
  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers, redirect: 'follow' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${url}\n${body.slice(0, 300)}`);
  }
  return res;
}

export async function getJson(url, options) {
  return (await request(url, options)).json();
}

export async function getHtml(url, options) {
  return (await request(url, options)).text();
}

/**
 * Ko'p saytlar ma'lumotni HTML ichida JSON bo'lib joylashtiradi
 * (__NEXT_DATA__, window.__INITIAL_STATE__ va h.k.). Shuni sug'urib oladi.
 */
export function extractEmbeddedJson(html, marker = '__NEXT_DATA__') {
  const patterns = [
    new RegExp(`id="${marker}"[^>]*>([\\s\\S]*?)</script>`),
    new RegExp(`${marker}\\s*=\\s*([\\s\\S]*?);?\\s*</script>`),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) { try { return JSON.parse(m[1].trim()); } catch { /* keyingisini sinaymiz */ } }
  }
  return null;
}

/** Oddiy HTML jadvalni massivga aylantiradi (thead bo'lsa kalitlar bilan). */
export function parseHtmlTable(html, tableIndex = 0) {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  const table = tables[tableIndex];
  if (!table) return [];

  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) =>
    [...m[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    )
  ).filter((r) => r.length);

  if (!rows.length) return [];
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((h, i) => [h || `col${i}`, cells[i] ?? '']))
  );
}
