import { config } from '../config.js';
import { PROVIDERS, SOURCE_NAMES, getProvider } from '../providers.js';

/**
 * Manbani nomi bo'yicha yuklaydi: ELD_SOURCE=sample -> src/sources/sample.js
 * Har bir manba fayli quyidagini eksport qilishi kerak:
 *   export const meta = { name: string, live: boolean }
 *   export async function fetchDrivers(): Promise<Driver[]>
 */
export async function loadSource(name = config.source) {
  try {
    const mod = await import(`./${name}.js`);
    if (typeof mod.fetchDrivers !== 'function') {
      throw new Error(`"${name}" manbasida fetchDrivers() funksiyasi yo'q`);
    }
    return {
      name,
      meta: mod.meta ?? { name, live: true },
      fetchDrivers: mod.fetchDrivers,
      // Ixtiyoriy: dam oluvchilarni aniqlash uchun (src/resting.js).
      fetchLatestStatuses: mod.fetchLatestStatuses ?? null,
    };
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Manba topilmadi: src/sources/${name}.js`);
    }
    throw err;
  }
}

/**
 * Har bir platforma o'z manbasidan o'qiydi (src/providers.js dagi "source"):
 * Leader/Factor ELD — drivehos, Five ELD — fiveeld.
 * ELD_SOURCE=sample bo'lsa, hammasi namuna ma'lumot bilan ishlaydi.
 */
export async function loadSources() {
  if (config.source === 'sample') {
    const demo = await loadSource('sample');
    return { demo: true, label: `${demo.meta.name} (sample)`, for: () => demo };
  }

  const loaded = new Map(
    await Promise.all(SOURCE_NAMES.map(async (name) => [name, await loadSource(name)]))
  );
  const label = PROVIDERS.map((p) => `${p.name} → ${loaded.get(p.source).meta.name}`).join(', ');

  return {
    demo: false,
    label,
    for: (providerId) => loaded.get(getProvider(providerId).source),
  };
}
