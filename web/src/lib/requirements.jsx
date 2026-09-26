import { createContext, useContext } from 'react';

/**
 * Kompaniya eslatmalari: { [companyId]: note } va ularni saqlash funksiyasi.
 * Jadval hujayralari va bo'lim qatorlari shu kontekstdan o'qiydi — har biriga
 * alohida uzatib yurish shart emas.
 */
export const RequirementsContext = createContext({ map: {}, save: async () => {} });

export const useRequirements = () => useContext(RequirementsContext);

/** Haydovchi ostidagi kichik eslatma — kompaniyasiga yozilgan bo'lsa. */
export function CompanyNote({ companyId }) {
  const { map } = useRequirements();
  const note = companyId ? map[companyId] : null;
  if (!note) return null;
  return <span className="req" title={note}>📌 {note}</span>;
}
