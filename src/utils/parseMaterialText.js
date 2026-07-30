// Extracts a trailing "<quantity> <unit>" pair from a free-text material
// name/description. Mirrors frontend_v2/src/utils/parseMaterialText.js —
// the two repos don't share a package, so this is intentionally
// duplicated rather than imported cross-repo.
//
// Exists because the manual RFQ/product forms let a user type
// quantity+unit straight into a free-text Description/Specs field (e.g.
// "TMT Reinforcement Bars - 2 MT") instead of using the dedicated
// Quantity and Unit inputs, leaving Product.items[].quantity empty. This
// matters here specifically because createBid derives the seller's
// charged total from productItem.quantity server-side (the client's own
// total is never trusted) — a blank quantity previously silently fell
// back to 1, undercharging/overcharging real money whenever this
// happened.

const UNIT_ALIASES = {
  mt: 'MT',
  ton: 'Ton', tons: 'Tons',
  kg: 'kg', kgs: 'kg',
  g: 'g', gm: 'g',
  bag: 'bags', bags: 'bags',
  nos: 'Nos', no: 'Nos',
  pcs: 'PCS', pc: 'PCS', piece: 'PCS', pieces: 'PCS',
  box: 'Box', boxes: 'Box',
  roll: 'Roll', rolls: 'Roll',
  bundle: 'Bundle', bundles: 'Bundle',
  sheet: 'Sheet', sheets: 'Sheet',
  litre: 'Litre', litres: 'Litre', liter: 'Litre', liters: 'Litre', l: 'Litre',
  m: 'm', mtr: 'm', mtrs: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  mm: 'mm',
  cm: 'cm',
  ft: 'ft', feet: 'ft',
  'sq.ft': 'sq.ft', sqft: 'sq.ft',
  'sq.m': 'sq.m', sqm: 'sq.m',
  'cu.m': 'cu.m', cum: 'cu.m',
  set: 'Set', sets: 'Set',
  pair: 'Pair', pairs: 'Pair',
  packet: 'Packet', packets: 'Packet',
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map(u => u.replace(/\./g, '\\.'))
  .join('|');

const TRAILING_QTY_UNIT_RE = new RegExp(
  `[\\s,\\-–—]+(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\.?\\s*$`,
  'i'
);

export function extractQuantityAndUnit(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(TRAILING_QTY_UNIT_RE);
  if (!match) return null;

  const [fullMatch, quantity, rawUnit] = match;
  const unit = UNIT_ALIASES[rawUnit.toLowerCase()] || rawUnit;
  const cleanedText = text.slice(0, text.length - fullMatch.length).trim();

  if (!cleanedText) return null;

  return { cleanedText, quantity, unit };
}

// Resolves the real quantity for a Product.items[] entry, falling back to
// a quantity embedded in its description when the dedicated field is
// empty. Never silently return 0 -- callers use this to derive money.
export function resolveItemQuantity(productItem) {
  if (productItem?.quantity) return Number(productItem.quantity) || 1;
  // Product.items[] has no itemDescription/itemName fields on the schema
  // (Mongoose silently drops them on save) -- typeOfProduct/model are the
  // real persisted free-text fields, so they're checked too, matching the
  // same fallback order the frontend's materials display already uses.
  const parsed = extractQuantityAndUnit(
    productItem?.itemDescription ||
      productItem?.description ||
      productItem?.typeOfProduct ||
      productItem?.model ||
      ''
  );
  return parsed ? Number(parsed.quantity) || 1 : 1;
}
