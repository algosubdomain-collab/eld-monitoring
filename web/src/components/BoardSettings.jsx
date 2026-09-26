import { useState } from 'react';
import { colorVar } from './Dropdown.jsx';

const PALETTE = ['lime', 'amber', 'violet', 'slate', 'red', 'sky'];

/**
 * Board sozlamalari — Status va Update ustunlaridagi variantlarni moslash.
 * Har bir variant: nom + rang. Qo'shish, o'chirish, rangni almashtirish.
 */
export default function BoardSettings({ config, onSave, onClose }) {
  const [statuses, setStatuses] = useState(config.statuses ?? []);
  const [updates, setUpdates] = useState(config.updates ?? []);

  return (
    <div className="modal" onMouseDown={onClose}>
      <div className="modalcard card" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modalhead">
          <h2>Board settings</h2>
          <button className="iconbtn" onClick={onClose} title="Close">✕</button>
        </header>

        <div className="modalbody">
          <OptionList title="Status options" list={statuses} setList={setStatuses}
            placeholder="e.g. Need to check" />
          <OptionList title="Update options" list={updates} setList={setUpdates}
            placeholder="e.g. Disconnect update" />
        </div>

        <footer className="modalfoot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn lime" onClick={() => onSave({ statuses, updates })}>Save changes</button>
        </footer>
      </div>
    </div>
  );
}

function OptionList({ title, list, setList, placeholder }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    setList([...list, { label, color: 'slate' }]);
    setDraft('');
  };
  const edit = (i, part) => setList(list.map((o, j) => (j === i ? { ...o, ...part } : o)));
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const cycleColor = (i) => {
    const cur = PALETTE.indexOf(list[i].color);
    edit(i, { color: PALETTE[(cur + 1) % PALETTE.length] });
  };

  return (
    <div className="optset">
      <div className="fl" style={{ gap: 8 }}>{title}</div>
      <div className="optlist">
        {list.map((o, i) => (
          <div className="optrow" key={i}>
            <button className="swatch" style={{ background: colorVar(o.color) }}
              onClick={() => cycleColor(i)} title="Change color" />
            <input className="gateinput" value={o.label} maxLength={60}
              onChange={(e) => edit(i, { label: e.target.value })} />
            <button className="iconbtn sm" onClick={() => remove(i)} title="Remove">✕</button>
          </div>
        ))}
        {!list.length && <div className="tierempty">No options yet.</div>}
      </div>
      <div className="optadd">
        <input className="gateinput" value={draft} placeholder={placeholder} maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button className="btn" onClick={add}>Add</button>
      </div>
    </div>
  );
}
