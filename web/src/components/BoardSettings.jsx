import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colorVar } from './Dropdown.jsx';

const PALETTE = ['lime', 'amber', 'violet', 'slate', 'red', 'sky'];

const TABS = [
  { id: 'columns', label: 'Columns' },
  { id: 'people', label: 'Responsible' },
  { id: 'boards', label: 'Boards' },
];

/** Yangi board uchun id — serverda ham tekshiriladi, bu shunchaki boshlang'ich. */
const newId = () => Math.random().toString(36).slice(2, 10);

/** Fokusni modal ichida ushlab turish uchun. */
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Board sozlamalari:
 *   Columns     — Status va Update ustunlaridagi variantlar (nom + rang);
 *   Responsible — mas'ullar ro'yxati va "men kimman" (ommaviy biriktirish uchun);
 *   Boards      — kompaniyalarni board'larga bo'lish.
 */
export default function BoardSettings({ config, companies = [], initialTab = 'columns', onSave, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [statuses, setStatuses] = useState(config.statuses ?? []);
  const [profileForms, setProfileForms] = useState(config.profileForms ?? []);
  const [responsibles, setResponsibles] = useState(config.responsibles ?? []);
  const [me, setMe] = useState(config.me ?? '');
  const [boards, setBoards] = useState(config.boards ?? []);
  const [askClose, setAskClose] = useState(false);

  const cardRef = useRef(null);
  const returnTo = useRef(null);

  const draft = useMemo(
    () => ({ statuses, profileForms, responsibles, me, boards }),
    [statuses, profileForms, responsibles, me, boards]
  );

  // Saqlanmagan o'zgarish bormi — yopishdan oldin so'rash uchun.
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify({
    statuses: config.statuses ?? [], profileForms: config.profileForms ?? [],
    responsibles: config.responsibles ?? [], me: config.me ?? '', boards: config.boards ?? [],
  }), [draft, config]);

  const tryClose = useCallback(() => {
    if (!dirty) return onClose();
    setAskClose(true);
    return undefined;
  }, [dirty, onClose]);

  // Ochilganda fokusni modalga olamiz, yopilganda qaytaramiz. Fokus faol
  // bo'limga tushadi — yopish tugmasiga emas, aks holda Enter modalni yopardi.
  useEffect(() => {
    returnTo.current = document.activeElement;
    const target = cardRef.current?.querySelector('[role="tab"][aria-selected="true"]')
      ?? cardRef.current?.querySelector(FOCUSABLE);
    target?.focus();
    return () => returnTo.current?.focus?.();
  }, []);

  // Escape yopadi; Tab fokusni modal ichida aylantiradi.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); tryClose(); return; }
      if (e.key !== 'Tab') return;
      const items = [...(cardRef.current?.querySelectorAll(FOCUSABLE) ?? [])]
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tryClose]);

  // Bo'limlar orasida ←/→ bilan yurish. Fokus tanlangan bo'lim bilan birga
  // ko'chadi (roving tabindex) — aks holda halqa eski tabda qolib ketadi.
  const goTab = (i) => {
    const next = TABS[(i + TABS.length) % TABS.length];
    setTab(next.id);
    requestAnimationFrame(() => {
      cardRef.current?.querySelectorAll('[role="tab"]')[(i + TABS.length) % TABS.length]?.focus();
    });
  };

  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowRight') { e.preventDefault(); goTab(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTab(i - 1); }
    if (e.key === 'Home') { e.preventDefault(); goTab(0); }
    if (e.key === 'End') { e.preventDefault(); goTab(TABS.length - 1); }
  };

  return (
    <div className="modal" onMouseDown={tryClose}>
      <div ref={cardRef} className="modalcard card wide" role="dialog" aria-modal="true"
        aria-labelledby="bs-title" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modalhead">
          <h2 id="bs-title">Board settings</h2>
          <button className="iconbtn" onClick={tryClose} title="Close (Esc)" aria-label="Close settings">✕</button>
        </header>

        <nav className="stabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
              className={`stab ${tab === t.id ? 'on' : ''}`}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        <div className="modalbody" role="tabpanel">
          {tab === 'columns' && (
            <>
              <OptionList title="Status options" list={statuses} setList={setStatuses}
                hint="Shown in the Status column of every row."
                placeholder="e.g. Need to check" />
              <OptionList title="Profile Form options" list={profileForms} setList={setProfileForms}
                hint="Shown in the Profile Form column of every row."
                placeholder="e.g. Needs update" />
            </>
          )}

          {tab === 'people' && (
            <>
              <OptionList title="Responsible people" list={responsibles} setList={setResponsibles}
                hint="These are the only names the Responsible column offers."
                placeholder="e.g. Aziz" empty="No people yet — add the first one below." />

              <div className="optset">
                <div className="fl">Your name</div>
                <p className="shint">
                  Picks who you are. “Assign me” then fills the Responsible column for every
                  driver on the current board, and your name is recorded when you tick one off.
                </p>
                {responsibles.length ? (
                  <select className="gateinput" value={me} aria-label="Your name"
                    onChange={(e) => setMe(e.target.value)}>
                    <option value="">Not set</option>
                    {responsibles.map((r) => (
                      <option key={r.label} value={r.label}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="shint warn">Add yourself to the list above first.</p>
                )}
                {me && !responsibles.some((r) => r.label === me) && (
                  <p className="shint warn">
                    “{me}” is no longer in the list above — pick another name or add it back.
                  </p>
                )}
              </div>
            </>
          )}

          {tab === 'boards' && (
            <BoardList boards={boards} setBoards={setBoards} companies={companies} />
          )}
        </div>

        <footer className="modalfoot">
          {askClose ? (
            <>
              <span className="footnote">Discard your changes?</span>
              <button className="btn" onClick={() => setAskClose(false)}>Keep editing</button>
              <button className="btn danger" onClick={onClose}>Discard</button>
            </>
          ) : (
            <>
              {dirty && <span className="footnote">Unsaved changes</span>}
              <button className="btn" onClick={tryClose}>Cancel</button>
              <button className="btn lime" disabled={!dirty} onClick={() => onSave(draft)}>
                Save changes
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function OptionList({ title, hint, list, setList, placeholder, empty }) {
  const [draft, setDraft] = useState('');
  const [dupe, setDupe] = useState(false);

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    if (list.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      setDupe(true);
      return;
    }
    setList([...list, { label, color: PALETTE[list.length % PALETTE.length] }]);
    setDraft('');
    setDupe(false);
  };
  const edit = (i, part) => setList(list.map((o, j) => (j === i ? { ...o, ...part } : o)));
  const remove = (i) => setList(list.filter((_, j) => j !== i));
  const cycleColor = (i) => {
    const cur = PALETTE.indexOf(list[i].color);
    edit(i, { color: PALETTE[(cur + 1) % PALETTE.length] });
  };

  return (
    <div className="optset">
      <div className="fl">{title}</div>
      {hint && <p className="shint">{hint}</p>}
      <div className="optlist">
        {list.map((o, i) => (
          <div className="optrow" key={i}>
            <button className="swatch" style={{ background: colorVar(o.color) }}
              onClick={() => cycleColor(i)} title="Change colour"
              aria-label={`Change colour of ${o.label}`} />
            <input className="gateinput" value={o.label} maxLength={60} aria-label={`${title} name`}
              onChange={(e) => edit(i, { label: e.target.value })} />
            <button className="iconbtn sm" onClick={() => remove(i)}
              title={`Remove ${o.label}`} aria-label={`Remove ${o.label}`}>✕</button>
          </div>
        ))}
        {!list.length && <div className="tierempty sm">{empty ?? 'No options yet.'}</div>}
      </div>
      <div className="optadd">
        <input className="gateinput" value={draft} placeholder={placeholder} maxLength={60}
          aria-label={`Add to ${title}`}
          onChange={(e) => { setDraft(e.target.value); setDupe(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn" disabled={!draft.trim()} onClick={add}>Add</button>
      </div>
      {dupe && <p className="shint warn">“{draft.trim()}” is already in the list.</p>}
    </div>
  );
}

/** Board'lar ro'yxati — har biri nom + biriktirilgan kompaniyalar. */
function BoardList({ boards, setBoards, companies }) {
  const [open, setOpen] = useState(null);   // ochiq board id
  const [draft, setDraft] = useState('');

  // Hech bir boardga tushmagan kompaniyalar — faqat "All" da ko'rinadi.
  const unassigned = useMemo(() => {
    const taken = new Set(boards.flatMap((b) => b.companies));
    return companies.filter((c) => !taken.has(c.id));
  }, [boards, companies]);

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    const board = { id: newId(), name, companies: [] };
    setBoards([...boards, board]);
    setDraft('');
    setOpen(board.id);
  };
  const edit = (id, part) => setBoards(boards.map((b) => (b.id === id ? { ...b, ...part } : b)));
  const remove = (id) => setBoards(boards.filter((b) => b.id !== id));

  return (
    <div className="optset">
      <div className="fl">Boards</div>
      <p className="shint">
        Split companies across boards. Each board becomes a tab above the table and shows
        only the companies you tick. A board is a view, not a separate list — a driver keeps
        the same values wherever you look at them.
      </p>

      {!companies.length && (
        <p className="shint warn">
          No companies loaded yet. Open the dashboard once so the fleet is fetched, then come back.
        </p>
      )}

      <div className="bdlist">
        {boards.map((b) => (
          <BoardRow key={b.id} board={b} companies={companies}
            open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)}
            onEdit={(part) => edit(b.id, part)} onRemove={() => remove(b.id)} />
        ))}
        {!boards.length && (
          <div className="tierempty sm">No boards yet — every company shows on one list.</div>
        )}
      </div>

      <div className="optadd">
        <input className="gateinput" value={draft} placeholder="e.g. Night shift" maxLength={40}
          aria-label="New board name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn" disabled={!draft.trim() || !companies.length} onClick={add}>Add board</button>
      </div>

      {Boolean(boards.length && companies.length) && (
        <p className="shint">
          {unassigned.length
            ? `Only on “All”: ${unassigned.map((c) => c.name).join(', ')}`
            : 'Every company belongs to a board.'}
        </p>
      )}
    </div>
  );
}

function BoardRow({ board, companies, open, onToggle, onEdit, onRemove }) {
  const [q, setQ] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const picked = new Set(board.companies);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? companies.filter((c) => c.name.toLowerCase().includes(t)) : companies;
  }, [companies, q]);

  const drivers = useMemo(
    () => companies.filter((c) => picked.has(c.id)).reduce((n, c) => n + c.drivers, 0),
    [companies, board.companies] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggle = (id) => {
    const next = picked.has(id)
      ? board.companies.filter((c) => c !== id)
      : [...board.companies, id];
    onEdit({ companies: next });
  };

  return (
    <div className={`bdrow ${open ? 'open' : ''}`}>
      <div className="bdhead">
        <button className="iconbtn sm bdcaret" onClick={onToggle}
          aria-expanded={open} title={open ? 'Collapse' : 'Pick companies'}>{open ? '▾' : '▸'}</button>
        <input className="gateinput" value={board.name} maxLength={40} aria-label="Board name"
          onChange={(e) => onEdit({ name: e.target.value })} />
        <span className="bdcount">
          {board.companies.length}/{companies.length} · {drivers} drivers
        </span>
        {confirmDel ? (
          <>
            <button className="btn sm" onClick={() => setConfirmDel(false)}>Keep</button>
            <button className="btn sm danger" onClick={onRemove}>Delete</button>
          </>
        ) : (
          <button className="iconbtn sm" onClick={() => setConfirmDel(true)}
            title={`Remove ${board.name}`} aria-label={`Remove board ${board.name}`}>✕</button>
        )}
      </div>

      {open && (
        <div className="bdpick">
          {companies.length > 8 && (
            <input className="gateinput" value={q} placeholder="Filter companies…"
              aria-label="Filter companies" onChange={(e) => setQ(e.target.value)} />
          )}
          <div className="bdacts">
            <button className="linkbtn" onClick={() => onEdit({ companies: companies.map((c) => c.id) })}>
              Select all
            </button>
            <button className="linkbtn" disabled={!board.companies.length}
              onClick={() => onEdit({ companies: [] })}>Clear</button>
          </div>
          <div className="bdcos">
            {shown.map((c) => (
              <label className="bdco" key={c.id}>
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="bdconame">{c.name}</span>
                <span className="bdcocount">{c.drivers}</span>
              </label>
            ))}
            {!shown.length && <div className="tierempty sm">No companies match “{q}”.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
