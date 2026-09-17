import { useCallback, useEffect, useState } from 'react';

/**
 * Serverdagi "update yuborildi" holatini o'qiydi va yozadi.
 * Sanoq jonli bo'lishi uchun har soniyada qayta render qilinadi.
 */
export function useUpdates() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/updates');
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setState(body.state);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const send = useCallback(async (section, driverIds) => {
    setSending(true);
    try {
      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, driverIds }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setState((s) => ({ ...s, [section]: body }));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }, []);

  return { state, error, sending, send, reload: load };
}
