/**
 * Platformadagi haydovchi log sahifasining manzili.
 * Manzil ko'rinishi manbaga qarab farq qiladi (src/providers.js dagi "source"):
 *   drivehos (Leader/Factor ELD) — oddiy yo'l, sana ISO ko'rinishida;
 *   fiveeld                      — hash-marshrut, sana "DD-MM-YYYY".
 * Bu yerda server tomondagi skrinshot manzillari bilan bir xil qoida ishlaydi
 * (src/screenshot.js) — ikkalasi bir xil sahifani ochadi.
 */
const pad = (n) => String(n).padStart(2, '0');

/** Bugungi kun "DD-MM-YYYY" ko'rinishida (brauzer vaqti bo'yicha). */
function todayDmy() {
  const at = new Date();
  return `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()}`;
}

export function driverLogUrl(driver, provider) {
  if (!provider?.site || !driver?.driverId) return null;

  if (provider.source === 'fiveeld') {
    // Kompaniya uid'i manzilning bir qismi — usiz sahifa ochilmaydi.
    if (!driver.companyId) return null;
    // Bu platforma sanasiz "Data not found" beradi, shuning uchun bugungi kun.
    const qs = new URLSearchParams({ id: driver.driverId, date: todayDmy(), page: 'logs' });
    return `https://${provider.site}/#/company/${driver.companyId}/logs-edit?${qs}`;
  }

  // Sana yozilmaydi — platformaning o'zi joriy kunni ochadi. Ilgari bu yerda
  // sana bor edi va eski kunni ochib, sahifa bo'sh chiqardi.
  const qs = new URLSearchParams({ driverId: driver.driverId, tab: 'grid' });
  if (driver.driverName && driver.driverName !== '—') qs.set('driverName', driver.driverName);
  if (driver.truck && driver.truck !== '—') qs.set('vehicleNumber', driver.truck);
  return `https://${provider.site}/system/hos/graphs?${qs}`;
}
