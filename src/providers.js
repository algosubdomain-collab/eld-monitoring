// Ulash mumkin bo'lgan ELD platformalari.
//
// Leader ELD va Factor ELD — bitta platformaning (DriveHOS) ikki brendi:
// API bir xil, farqi faqat "tenant_id" sarlavhasida.
// Five ELD — boshqa platforma, o'z API'si bilan (src/sources/fiveeld.js).
export const PROVIDERS = [
  {
    id: 'leadereld',
    name: 'Leader ELD',
    site: 'app.leadereld.com',
    source: 'drivehos',
    tenantId: 'd0e24f31-1242-416c-a6d6-57a30bdff44d',
  },
  {
    id: 'factoreld',
    name: 'Factor ELD',
    site: 'app.factoreld.com',
    source: 'drivehos',
    tenantId: '96335ac3-5a93-4a29-af8b-08d874801325',
  },
  {
    id: 'fiveeld',
    name: 'Five ELD',
    site: 'app.fiveeld.com',
    source: 'fiveeld',
  },
];

export const DEFAULT_PROVIDER = PROVIDERS[0].id;

export const getProvider = (id) =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

/** Manba fayllarining takrorlanmas ro'yxati. */
export const SOURCE_NAMES = [...new Set(PROVIDERS.map((p) => p.source))];
