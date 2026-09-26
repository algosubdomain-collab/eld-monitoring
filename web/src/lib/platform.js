/**
 * Platformadagi haydovchi log sahifasining manzili.
 * Manzil ko'rinishi manbaga qarab farq qiladi (src/providers.js dagi "source"):
 *   drivehos (Leader/Factor ELD) — oddiy yo'l, sana ISO ko'rinishida;
 *   fiveeld                      — hash-marshrut, sana "DD-MM-YYYY".
 * Bu yerda server tomondagi skrinshot manzillari bilan bir xil qoida ishlaydi
 * (src/screenshot.js) — ikkalasi bir xil sahifani ochadi.
 */
const pad = (n) => String(n).padStart(2, '0');

const isoZ = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Bugungi kun "DD-MM-YYYY" ko'rinishida. */
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

  // Leader/Factor ELD (drivehos) log sahifasi. Bu aniq to'plam sinovdan o'tgan —
  // barcha haydovchilarda ochiladi. Muhim nuqtalar:
  //  • tab=list;
  //  • vehicleId (mashina UUID'i, truck raqami emas);
  //  • startDate/endDate — oxirgi 8 kunlik oyna (04:00Z / 03:59:59Z);
  //  • vehicleNumber JSON qatori bo'lishi kerak (qo'shtirnoq bilan).
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - 8);
  const end = new Date(now); end.setDate(end.getDate() + 1);

  const qs = new URLSearchParams({ driverId: driver.driverId, tab: 'list' });
  if (driver.driverName && driver.driverName !== '—') qs.set('driverName', driver.driverName);
  if (driver.vehicleId) qs.set('vehicleId', driver.vehicleId);
  qs.set('startDate', `${isoZ(start)}T04:00:00Z`);
  qs.set('endDate', `${isoZ(end)}T03:59:59Z`);
  if (driver.truck && driver.truck !== '—') qs.set('vehicleNumber', JSON.stringify(driver.truck));

  return `https://${provider.site}/system/hos/graphs?${qs}`;
}
