// Leader ELD va Factor ELD — bitta platformaning (DriveHOS) ikki brendi.
// API bir xil, farqi faqat "tenant_id" sarlavhasida.
export const PROVIDERS = [
  {
    id: 'leadereld',
    name: 'Leader ELD',
    site: 'app.leadereld.com',
    tenantId: 'd0e24f31-1242-416c-a6d6-57a30bdff44d',
  },
  {
    id: 'factoreld',
    name: 'Factor ELD',
    site: 'app.factoreld.com',
    tenantId: '96335ac3-5a93-4a29-af8b-08d874801325',
  },
];

export const DEFAULT_PROVIDER = PROVIDERS[0].id;

export const getProvider = (id) =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
