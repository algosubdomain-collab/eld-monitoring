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

  // Callback'lar har renderda yangi funksiya bo'lib keladi. Ular load'ning
  // dependency'siga tushsa, har render yangi so'rov yuboradi — cheksiz tsikl.
  const handlers = useRef({ onUnauthorized, onNotConnected });
  handlers.current = { onUnauthorized, onNotConnected };

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
      if (res.status === 401 && body.needsLogin) return handlers.current.onUnauthorized?.();
      // Platforma hali ulanmagan — sozlash ekraniga.
      if (res.status === 409 || body.notConnected) return handlers.current.onNotConnected?.();
      if (res.status === 401 || body.tokenInvalid) return handlers.current.onNotConnected?.();
      if (body.error && !body.drivers) throw new Error(body.error);
      setData(body);
      setError(body.error ?? null);
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [enabled, provider]);

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, [load]);

  // Server fonda o'zi har daqiqada yangilab turadi — avto-yangilash tayyor
  // keshni o'qiydi. force bo'lsa har ochiq oyna platformaga qo'shimcha to'liq
  // yig'ish yuborib, API kvotasini (429) tugatardi.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => load(false), intervalMs);
    return () => clearInterval(id);
  }, [auto, intervalMs, load]);

  // "5m ago" kabi yozuvlar joyida qotib qolmasin.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return { data, error, busy, reload: () => load(true) };
}
