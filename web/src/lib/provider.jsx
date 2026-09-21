import { createContext, useContext } from 'react';

/**
 * Ayni damda ko'rilayotgan platforma (id, name, site, source).
 * Jadvaldagi ism havolasi shu ma'lumotga qarab to'g'ri manzilni yasaydi —
 * aks holda har bir sahifaga alohida uzatib yurish kerak bo'lardi.
 */
export const ProviderContext = createContext(null);

export const useProvider = () => useContext(ProviderContext);
