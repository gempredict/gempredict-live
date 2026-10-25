// Explicit test-only catalog snapshots. These are not shipped as product data,
// inferred from Claude, or derived from seller evidence. Variant verification
// remains a separate boundary when the catalog does not specify a treatment.
export const fixtureCatalogRecords = [
  { id: 'mock:pikachu', subject: 'Pikachu', cardNumber: '28/73', year: '2017', brandSet: 'Shining Legends' },
  { id: 'mock:zamazenta', subject: 'Zamazenta', cardNumber: '021/025', year: '2021', brandSet: 'Celebrations' },
  { id: 'mock:happ', subject: 'Ian Happ', cardNumber: '155', year: '2026', brandSet: 'Topps Series 1' },
  { id: 'mock:dragalge', subject: 'Dragalge', cardNumber: '89/197', year: '2023', brandSet: 'Paldea Evolved' },
  { id: 'mock:kid', subject: 'Eustass Captain Kid', cardNumber: 'OP14-014', year: '2026', brandSet: 'One Piece' },
  { id: 'mock:smith', subject: 'Shane Smith', cardNumber: '175', year: '2025', brandSet: 'Topps Chrome' },
];
export function mockCatalog(records = fixtureCatalogRecords) {
  return {
    catalogSource: 'mock-independent-catalog',
    catalogLookup: async ({ subject, cardNumber }) => records.filter(record => record.subject === subject && record.cardNumber === cardNumber),
  };
}
