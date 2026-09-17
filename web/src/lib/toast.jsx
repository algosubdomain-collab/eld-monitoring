import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext({ notify: () => {}, copy: () => {} });
export const useToast = () => useContext(ToastContext);

/**
 * Clipboard API birinchi navbatda, lekin u ko'p hollarda rad etadi:
 * hujjat fokusda bo'lmasa, sahifa xavfsiz kontekstda bo'lmasa yoki
 * brauzer ruxsat bermasa. Shuning uchun xatoda ham eski usulga tushamiz.
 */
async function writeClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // pastdagi zaxira usulga o'tamiz
  }

  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
  document.body.appendChild(box);
  box.select();
  box.setSelectionRange(0, text.length);

  const ok = document.execCommand('copy');
  box.remove();
  if (!ok) throw new Error('copy rejected');
}

/** Qisqa bildirishnomalar: nusxalash, saqlash va boshqa amallar uchun. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((toastState) => {
    setToast(toastState);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const notify = useCallback((text, ok = true) => show({ ok, text }), [show]);

  const copy = useCallback(async (text) => {
    try {
      await writeClipboard(text);
      show({ ok: true, label: 'Copied', text });
    } catch {
      show({ ok: false, text: 'Could not copy' });
    }
  }, [show]);

  return (
    <ToastContext.Provider value={{ notify, copy }}>
      {children}
      {toast && (
        <div className={`toast ${toast.ok ? '' : 'bad'}`} role="status">
          {toast.label ? <>{toast.label} <b>{toast.text}</b></> : toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}
