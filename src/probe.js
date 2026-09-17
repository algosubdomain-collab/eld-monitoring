// Tekshiruv vositasi: API bilan aloqani sinaydi va javob tuzilishini ko'rsatadi.
// Ishga tushirish:  npm run probe
// Maxfiy ma'lumot (token, parol) ekranga chiqarilmaydi.

const BASE      = process.env.ELD_BASE_URL  ?? 'https://api.drivehos.app/api';
const TENANT_ID = process.env.ELD_TENANT_ID ?? 'd0e24f31-1242-416c-a6d6-57a30bdff44d';
const PATHS = (process.env.ELD_PROBE_PATHS ?? '/v1/drivers,/drivers,/v1/hos,/v1/users').split(',');

let token = process.env.ELD_ACCESS_TOKEN ?? '';

async function tryLogin() {
  const email = process.env.ELD_EMAIL, password = process.env.ELD_PASSWORD;
  if (!email || !password) return null;

  for (const path of ['/v1/auth/sign-in', '/v1/auth/login', '/v1/sessions', '/auth/login']) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', tenant_id: TENANT_ID },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (!res) continue;

    const text = await res.text();
    console.log(`  POST ${path} -> ${res.status}`);
    if (res.ok) {
      const body = JSON.parse(text);
      const t = body?.data?.access_token ?? body?.access_token ?? body?.data?.token;
      if (t) { console.log(`  ✓ Login ishladi: ${path}`); return t; }
      console.log(`  javob kalitlari: ${Object.keys(body?.data ?? body).join(', ')}`);
    } else if (/captcha/i.test(text)) {
      console.log('  ⚠ reCAPTCHA talab qilinyapti — ELD_ACCESS_TOKEN ishlating.');
      return null;
    }
  }
  return null;
}

const shape = (v, d = 0) =>
  Array.isArray(v) ? `Array(${v.length})` + (v.length && d < 2 ? ` of ${shape(v[0], d + 1)}` : '')
  : v && typeof v === 'object' ? `{ ${Object.keys(v).slice(0, 25).join(', ')} }`
  : typeof v;

console.log(`Base: ${BASE}`);

if (!token) { console.log('Token yo\'q — login sinab ko\'rilyapti…'); token = await tryLogin(); }
if (!token) { console.log('\n❌ Token olinmadi. .env faylni to\'ldiring.'); process.exit(1); }
console.log('✓ Token bor\n');

for (const path of PATHS) {
  const res = await fetch(BASE + path.trim(), {
    headers: { Accept: 'application/json', tenant_id: TENANT_ID, Authorization: `Bearer ${token}` },
  }).catch((e) => ({ ok: false, status: 0, statusText: e.message }));

  if (!res.ok) { console.log(`${path} -> ${res.status} ${res.statusText ?? ''}`); continue; }

  const body = await res.json();
  const list = [body, body?.data, body?.data?.items, body?.items, body?.content, body?.rows]
    .find(Array.isArray);
  console.log(`${path} -> 200`);
  console.log(`  tuzilishi: ${shape(body)}`);
  if (list) {
    console.log(`  soni: ${list.length}`);
    console.log(`  1-yozuv: ${JSON.stringify(list[0], null, 2).slice(0, 900)}`);
  }
  console.log();
}
