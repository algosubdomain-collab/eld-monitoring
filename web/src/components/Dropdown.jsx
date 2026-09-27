import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const colorVar = (c) => (c ? `var(--${c})` : 'var(--ink-3)');

/**
 * Notion uslubidagi ochiladigan ro'yxat. Tanlangan qiymat rangli badge bo'lib
 * ko'rinadi, bosilganda variantlar menyusi silliq ochiladi. Menyu tananing
 * oxiriga (body) chiqariladi — jadval kataklari uni kesib qo'ymaydi.
 *
 * Klaviatura: Enter/Space/↓ ochadi, ↑↓ variantlar bo'ylab yuradi,
 * Enter tanlaydi, Escape yopadi va fokusni tugmaga qaytaradi.
 */
export default function Dropdown({
  value, options, placeholder = 'Set…', hint, onChange, clearLabel, emptyHint, onEmptyAction,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [cursor, setCursor] = useState(-1);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const cur = options.find((o) => o.label === value);
  // Qiymat bor, lekin ro'yxatdan olib tashlangan — jimgina yo'qolib
  // qolmasin: so'niq ko'rinishda ko'rsatamiz, tozalash mumkin bo'lsin.
  const orphan = !cur && value ? String(value) : null;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Pastda joy yetmasa menyuni tugmaning ustida ochamiz.
    const below = window.innerHeight - r.bottom;
    const flip = below < 220 && r.top > below;
    setPos({
      left: Math.min(r.left, window.innerWidth - 200),
      top: flip ? undefined : r.bottom + 6,
      bottom: flip ? window.innerHeight - r.top + 6 : undefined,
      minWidth: r.width,
    });
    setCursor(options.findIndex((o) => o.label === value));
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    // Fokus menyudan tashqarida bo'lsa ham Escape yopsin.
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const pick = (label) => {
    onChange(label);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((i) => (i + 1) % Math.max(options.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter' && cursor >= 0 && options[cursor]) {
      e.preventDefault();
      pick(options[cursor].label);
    }
  };

  return (
    <>
      <button
        ref={btnRef} type="button"
        className={`ddbtn ${cur ? '' : 'empty'} ${orphan ? 'orphan' : ''} ${open ? 'active' : ''}`}
        style={cur ? { '--c': colorVar(cur.color) } : undefined}
        aria-haspopup="listbox" aria-expanded={open}
        title={orphan ? `“${orphan}” is no longer in the list` : cur ? undefined : hint}
        onKeyDown={onKeyDown}
        onClick={() => setOpen((v) => !v)}
      >
        {cur ? <><i />{cur.label}</> : orphan ? <><i />{orphan}</> : placeholder}
        <svg className="ddcaret" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && pos && (
        <div ref={menuRef} className="ddmenu" role="listbox" onKeyDown={onKeyDown}
          style={{
            left: pos.left, top: pos.top, bottom: pos.bottom,
            minWidth: Math.max(pos.minWidth, 180),
          }}>
          {options.map((o, i) => (
            <button key={o.label} type="button" role="option" aria-selected={o.label === value}
              className={`ddopt ${o.label === value ? 'sel' : ''} ${i === cursor ? 'cursor' : ''}`}
              style={{ '--c': colorVar(o.color) }}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(o.label)}>
              <i /><span className="ddlabel">{o.label}</span>
              {o.label === value && (
                <svg className="ddtick" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg>
              )}
            </button>
          ))}

          {/* Ro'yxat bo'sh bo'lsa — nima qilish kerakligini aytamiz, boshi berk
              menyu qolmasin. */}
          {!options.length && (
            onEmptyAction
              ? (
                <button type="button" className="ddopt ddempty"
                  onClick={() => { setOpen(false); onEmptyAction(); }}>
                  {emptyHint ?? 'Nothing to pick yet'}
                </button>
              )
              : <div className="ddopt ddempty as-text">{emptyHint ?? 'Nothing to pick yet'}</div>
          )}

          {orphan && (
            <div className="ddopt ddempty as-text">“{orphan}” is no longer in the list</div>
          )}

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
