/** Bir nechta ELD platformasi ulangan bo'lsa — ular orasida almashish. */
export default function ProviderSwitcher({ providers, value, onChange }) {
  if (!providers || providers.length < 2) return null;
  return (
    <div className="providers">
      <div className="segs">
        {providers.map((p) => (
          <button
            key={p.id}
            className={`seg ${p.id === value ? 'on' : ''}`}
            onClick={() => onChange(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
