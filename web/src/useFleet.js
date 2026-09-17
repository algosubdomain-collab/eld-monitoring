import { useCallback, useEffect, useRef, useState } from 'react';

/** Serverdan ma'lumot oladi, avto-yangilashni boshqaradi. */
export function useFleet({
  auto, provider = '', enabled = true, intervalMs = 60_000,
  onUnauthorized, onNotConnected,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const mounted = useRef(true);

  const load = useCallback(async (force = false) => {
    // Token talab qilinadi-yu hali kiritilmagan bo'lsa — so'rov yubormaymiz,
    // aks holda foydalanuvchi hech narsa qilmasdan xato ko'rardi.
    if (!enabled) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams({ provider });
      if (force) qs.set('refresh', '1');

      const res = await fetch(`/api/drivers?${qs}`);
      const body = await res.json();
      if (!mounted.current) return;

      // Sessiya tugagan — kirish oynasiga qaytamiz.
      if (res.status === 401 && body.needsLogin) return onUnauthorized?.();
      // Platforma hali ulanmagan — sozlash ekraniga.
      if (res.status === 409 || body.notConnected) return onNotConnected?.();
      if (res.status === 401 || body.tokenInvalid) return onNotConnected?.();
      if (body.error && !body.drivers) throw new Error(body.error);
      setData(body);
      setError(body.error ?? null);
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [enabled, provider, onUnauthorized, onNotConnected]);

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, [load]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => load(true), intervalMs);
    return () => clearInterval(id);
  }, [auto, intervalMs, load]);

  // "5m ago" kabi yozuvlar joyida qotib qolmasin.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return { data, error, busy, reload: () => load(true) };
}
