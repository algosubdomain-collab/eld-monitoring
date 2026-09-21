// Platformadagi haydovchi sahifasidan skrinshot.
//
// Yashirin Chrome (kompyuterdagi Google Chrome, alohida brauzer yuklanmaydi)
// foydalanuvchining tokeni bilan platformani ochadi va haydovchi kartochkasini
// rasmga oladi.
//
// XAVFSIZLIK: sahifa hech narsani O'ZGARTIRA OLMAYDI. API'ga GET'dan boshqa
// har qanday so'rov bloklanadi — "Open session" / "Take Control" kabi amallar
// boshqa dispetcherni nazoratdan chiqarib yuborishi mumkin edi.
import { createRequire } from 'node:module';
import { getProvider } from './providers.js';

const require = createRequire(import.meta.url);
const API = 'https://api.drivehos.app/api';

let browserPromise = null;
// Profil (rol va ruxsatlar) — platforma sahifasi busiz login'ga qaytaradi.
const profileCache = new Map();

async function getBrowser() {
  if (!browserPromise) {
    const { chromium } = require('playwright-core');
    browserPromise = chromium.launch({ channel: 'chrome', headless: true })
      .catch((err) => { browserPromise = null; throw err; });
  }
  return browserPromise;
}

async function getProfile(token, tenantId) {
  const cached = profileCache.get(token);
  if (cached) return cached;

  const res = await fetch(`${API}/v1/users/profile`, {
    headers: { Authorization: `Bearer ${token}`, tenant_id: tenantId },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data) throw new Error(`profile ${res.status}`);

  profileCache.set(token, body.data);
  return body.data;
}

/**
 * Haydovchi kartochkasini PNG sifatida qaytaradi (Buffer).
 * Ma'lumot yuklanmasa null — xabar rasmsiz yuboriladi.
 */
export async function captureDriver({ token, providerId, driver }) {
  const provider = getProvider(providerId);
  return provider.source === 'fiveeld'
    ? captureFive({ token, provider, driver })
    : captureDriveHos({ token, provider, driver });
}

/**
 * Sahifa qaysi kunni ochadi. Doim bugungi kun (server vaqti bo'yicha):
 * haydovchining oxirgi signali kechagi bo'lsa, o'sha kun grafigi bo'sh
 * ochilib, kartochkada hech narsa ko'rinmay qolardi.
 */
function today() {
  const at = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    iso: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    dmy: `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()}`,
  };
}

/**
 * Five ELD: token localStorage'da "token" kalitida turadi, sahifa manzili esa
 * hash-marshrut: #/company/<kompaniya uid>/logs-edit?id=<haydovchi uid>.
 * driver.companyId — o'sha kompaniya uid'i (src/sources/fiveeld.js).
 */
async function captureFive({ token, provider, driver }) {
  if (!driver.companyId) return null;
  const browser = await getBrowser();

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    await ctx.addInitScript(([site, t]) => {
      if (location.hostname === site) {
        localStorage.setItem('token', t);
        localStorage.setItem('tokenDate', new Date().toISOString());
      }
    }, [provider.site, token]);

    const page = await ctx.newPage();
    // XAVFSIZLIK: sahifa hech narsani o'zgartira olmaydi — GET'dan boshqasi bloklanadi.
    await page.route('https://*.fiveeld.com/**', (route) =>
      route.request().method() === 'GET' ? route.continue() : route.abort()
    );

    const url = `https://${provider.site}/#/company/${driver.companyId}/logs-edit?`
      + new URLSearchParams({ id: driver.driverId, date: today().dmy, page: 'logs' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const firstWord = String(driver.driverName ?? '').trim().split(/\s+/)[0].toLowerCase();
    const loaded = await page.waitForFunction(
      (name) => document.body.innerText.toLowerCase().includes(name),
      firstWord, { timeout: 25000 }
    ).then(() => true).catch(() => false);
    if (!loaded || page.url().includes('/login')) return null;

    // "Driver Inactiveness Warning" kabi oyna kartochkani to'sib qo'yadi.
    await page.getByRole('button', { name: /^(ok|close)$/i }).first()
      .click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Chap menyu (270px) kesiladi: ism, holat va Break/Drive/Shift/Cycle qoladi.
    return await page.screenshot({ clip: { x: 270, y: 0, width: 1170, height: 560 } });
  } finally {
    await ctx.close();
  }
}

async function captureDriveHos({ token, provider, driver }) {
  const profile = await getProfile(token, provider.tenantId);
  const browser = await getBrowser();

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    await ctx.addInitScript(([site, t, info]) => {
      if (location.hostname === site) {
        localStorage.setItem('access_token', t);
        localStorage.setItem('userInfo', info);
      }
    }, [provider.site, token, JSON.stringify(profile)]);

    const page = await ctx.newPage();
    await page.route('https://api.drivehos.app/**', (route) =>
      route.request().method() === 'GET' ? route.continue() : route.abort()
    );

    const url = `https://${provider.site}/system/hos/graphs?` + new URLSearchParams({
      driverId: driver.driverId,
      tab: 'grid',
      // Router qiymatlarni JSON sifatida o'qiydi — sana satr bo'lib qolsin.
      activeDate: JSON.stringify(today().iso),
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Haydovchi ismi chiqquncha kutamiz — shunda kartochka to'lgan bo'ladi.
    // Katta-kichik harfga qaramaymiz: API "JOSE RICARDO" beradi, platforma esa
    // "Jose Ricardo" deb ko'rsatadi — aks holda sahifa ochilgan bo'lsa ham
    // "yuklanmadi" deb hisoblanardi.
    const firstWord = String(driver.driverName ?? '').trim().split(/\s+/)[0].toLowerCase();
    const loaded = await page.waitForFunction(
      (name) => document.body.innerText.toLowerCase().includes(name),
      firstWord, { timeout: 25000 }
    ).then(() => true).catch(() => false);
    if (!loaded || page.url().includes('/login')) return null;

    await page.waitForTimeout(1200);
    // Kartochka qismi: ism, holat, truck, Break/Drive/Shift/Cycle.
    return await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 250 } });
  } finally {
    await ctx.close();
  }
}

export async function closeBrowser() {
  if (browserPromise) (await browserPromise).close().catch(() => {});
  browserPromise = null;
}
