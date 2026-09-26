import { useCompany, companiesOf } from '../lib/company.jsx';

/**
 * Kompaniya bo'yicha filtr — ochiladigan ro'yxat. Tanlansa, faqat o'sha
 * kompaniya haydovchilari ko'rsatiladi. Kompaniyalar joriy ro'yxatdan olinadi.
 */
export default function CompanyFilter({ drivers }) {
  const { value, set } = useCompany();
  const companies = companiesOf(drivers);
  if (!companies.length) return null;

  // Tanlangan kompaniya bu ro'yxatda bo'lmasa (platforma almashsa) — "hammasi".
  const current = companies.some((c) => c.id === value) ? value : '';

  return (
    <div className="csel">
      <select value={current} onChange={(e) => set(e.target.value)} aria-label="Filter by company">
        <option value="">All companies · {companies.length}</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name} · {c.drivers}</option>
        ))}
      </select>
    </div>
  );
}
