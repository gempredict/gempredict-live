const required = ['subject', 'cardNumber', 'year', 'brandSet'];
const absent = /^(?:unknown(?: card| set| subject| identity| player)?(?: from image)?|invalid|missing|unspecified|unverified|unidentified|unrecognized|null|none|undefined|nan|n\/?a|not (?:known|specified|available|applicable)|tbd)$/i;
const usable = value => typeof value === 'string' && !!value.trim() && !absent.test(value.trim()) && !/[\u0000-\u001f\u007f]/.test(value);

export function invalidCatalogIdentityFields(card) {
  return required.filter(field => {
    const value = card?.[field];
    if (!usable(value)) return true;
    if (field === 'year') return !/^(?:19|20)\d{2}$/.test(value.trim());
    if (field === 'cardNumber') {
      const id = value.trim().replace(/^#\s*/, '').replace(/\s+/g, '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/i.test(id) || !/\d/.test(id)) return true;
      if (card?.provider === 'tcgdex' && !id.includes('/')) return true;
      return id.includes('/') && /^0+$/.test(id.split('/')[1]);
    }
    return !(field === 'subject' ? /\p{L}/u : /[\p{L}\p{N}]/u).test(value);
  });
}

export function validCatalogReference(catalog) {
  return usable(catalog?.source) && usable(catalog?.referenceId);
}
