import { createContext, useContext } from 'react';

/**
 * Tanlangan kompaniya (companyId yoki '' — hammasi). Barcha sahifalar shu
 * bittadan foydalanadi, shuning uchun bir sahifada tanlangan kompaniya
 * boshqasiga o'tganda ham saqlanib qoladi.
 */
export const CompanyContext = createContext({ value: '', set: () => {} });

export const useCompany = () => useContext(CompanyContext);

/** Haydovchilardan takrorlanmas kompaniyalar (soni bilan), nom bo'yicha. */
export function companiesOf(drivers) {
  const byId = new Map();
  for (const d of drivers) {
    if (!d.companyId) continue;
    const c = byId.get(d.companyId) ?? { id: d.companyId, name: d.company, drivers: 0 };
    c.drivers += 1;
    byId.set(d.companyId, c);
  }
  return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Tanlangan kompaniya bo'yicha filtrlaydi ('' — hammasi). */
export function byCompany(drivers, companyId) {
  return companyId ? drivers.filter((d) => d.companyId === companyId) : drivers;
}
