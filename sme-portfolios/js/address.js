/**
 * @typedef {Object} AddressParts
 * @property {string} streetName
 * @property {string} streetNumber
 * @property {string} flat
 * @property {string} area
 * @property {string} location
 * @property {string} postcode
 */

/**
 * @param {AddressParts} parts
 * @returns {boolean}
 */
export function hasAddressParts(parts) {
  return Boolean(
    parts.streetName ||
      parts.streetNumber ||
      parts.flat ||
      parts.area ||
      parts.location ||
      parts.postcode,
  );
}

/**
 * UK-style single-line address.
 * @param {AddressParts} parts
 * @returns {string}
 */
export function formatUkAddress(parts) {
  const segments = [];

  const flat = parts.flat.trim();
  if (flat) {
    const flatLabel = /^flat\b/i.test(flat) ? flat : `Flat ${flat}`;
    segments.push(flatLabel);
  }

  const line = [parts.streetNumber, parts.streetName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
  if (line) segments.push(line);

  const area = parts.area.trim();
  const location = parts.location.trim();
  if (area && location && area !== location) {
    segments.push(`${area}, ${location}`);
  } else if (area) {
    segments.push(area);
  } else if (location) {
    segments.push(location);
  }

  const postcode = parts.postcode.trim().toUpperCase();
  if (postcode) segments.push(postcode);

  return segments.join(', ');
}
