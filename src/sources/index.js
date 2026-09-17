import { config } from '../config.js';

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
