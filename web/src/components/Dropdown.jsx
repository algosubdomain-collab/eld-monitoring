import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const colorVar = (c) => (c ? `var(--${c})` : 'var(--ink-3)');

/**
 * Notion uslubidagi ochiladigan ro'yxat. Tanlangan qiymat rangli badge bo'lib
 * ko'rinadi, bosilganda variantlar menyusi silliq ochiladi. Menyu tananing
 * oxiriga (body) chiqariladi — jadval kataklari uni kesib qo'ymaydi.
 */
export default function Dropdown({ value, options, placeholder = 'Set…', onChange, clearLabel }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const cur = options.find((o) => o.label === value);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6, minWidth: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const pick = (label) => { onChange(label); setOpen(false); };

  return (
    <>
      <button
        ref={btnRef} type="button"
        className={`ddbtn ${cur ? '' : 'empty'} ${open ? 'active' : ''}`}
        style={cur ? { '--c': colorVar(cur.color) } : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {cur ? <><i />{cur.label}</> : placeholder}
        <svg className="ddcaret" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && pos && (
        <div ref={menuRef} className="ddmenu"
          style={{ left: pos.left, top: pos.top, minWidth: Math.max(pos.minWidth, 180) }}>
          {options.map((o) => (
            <button key={o.label} type="button"
              className={`ddopt ${o.label === value ? 'sel' : ''}`}
              style={{ '--c': colorVar(o.color) }} onClick={() => pick(o.label)}>
              <i /><span className="ddlabel">{o.label}</span>
              {o.label === value && (
                <svg className="ddtick" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg>
              )}
            </button>
          ))}
          {value && (
            <button type="button" className="ddopt ddclear" onClick={() => pick('')}>
              {clearLabel ?? 'Clear'}
            </button>
          )}
        </div>
      )}
    </>
  );
}
