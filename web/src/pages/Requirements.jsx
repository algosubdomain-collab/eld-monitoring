import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Back } from '../components/Icons.jsx';
import { useRequirements } from '../lib/requirements.jsx';

/**
 * Har bir kompaniya uchun qisqa eslatma (requirement). Bu yerda yozilgan matn
 * o'sha kompaniyaning barcha haydovchilari ostida kichik yozuv bo'lib chiqadi.
 * Kompaniyalar joriy platforma ma'lumotidan olinadi.
 */
export default function Requirements({ data }) {
  const { map, save } = useRequirements();

  // Takrorlanmas kompaniyalar + haydovchilar soni.
  const companies = useMemo(() => {
    const byId = new Map();
    for (const d of data.drivers) {
      if (!d.companyId) continue;
      const c = byId.get(d.companyId) ?? { id: d.companyId, name: d.company, drivers: 0 };
      c.drivers += 1;
      byId.set(d.companyId, c);
    }
    return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [data]);

  return (
    <div className="page">
      <div className="masthead">
        <Link className="logo back" to="/" title="Back to dashboard"><Back /></Link>
        <h1>Company requirements</h1>
        <span style={{ flex: 1 }} />
        <span className="beat off"><i />{companies.length} companies</span>
      </div>

      <p className="setuplead">
        Add a short note for a company. It shows under every driver of that
        company across the dashboard. Leave it empty to remove.
      </p>

      <div className="card">
        {companies.length ? (
          <div className="tierlist">
            {companies.map((c) => (
              <CompanyRow key={c.id} company={c} note={map[c.id] ?? ''} onSave={save} />
            ))}
          </div>
        ) : (
          <div className="tierempty">No companies in the current fleet.</div>
        )}
      </div>
    </div>
  );
}

function CompanyRow({ company, note, onSave }) {
  const [text, setText] = useState(note);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = text.trim() !== note.trim();

  const submit = async () => {
    setBusy(true);
    await onSave(company.id, text);
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="reqrow">
      <div className="reqmeta">
        <span className="nm">{company.name}</span>
        <span className="id">{company.drivers} driver{company.drivers === 1 ? '' : 's'}</span>
      </div>
      <input
        className="gateinput" value={text} maxLength={280}
        placeholder="e.g. Call dispatch before any reset"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) submit(); }}
      />
      <button className="btn lime" disabled={busy || !dirty} onClick={submit}>
        {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
