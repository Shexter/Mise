/** Validated barcode categories before any lookup or cache write. */
export type BarcodeDisposition = 'product' | 'unread' | 'store_local';

/**
 * Validates EAN-13, EAN-8, UPC-A, and UPC-E. Other camera output is not a
 * product barcode and is treated as an unread scan rather than a remote miss.
 */
export function classifyBarcode(raw: string): BarcodeDisposition {
  const code = raw.replace(/\s/g, '');
  if (!/^\d+$/.test(code) || !hasValidCheckDigit(code)) return 'unread';
  return isRestrictedCirculation(code) ? 'store_local' : 'product';
}

export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  const expanded = code.length === 8 ? expandUpcE(code) ?? code : code;
  return checkDigit(expanded.slice(0, -1)) === Number(expanded.at(-1));
}

/** GS1 prefixes 02 and 20–29 identify retailer-controlled variable items. */
export function isRestrictedCirculation(code: string): boolean {
  return code.length === 13 && (code.startsWith('02') || /^2\d/.test(code));
}

function checkDigit(body: string): number {
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const digit = Number(body[index]);
    sum += digit * ((body.length - 1 - index) % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Converts UPC-E (number system + six digits + check) to its UPC-A form. */
function expandUpcE(code: string): string | null {
  if (code.length !== 8 || !/^\d+$/.test(code)) return null;
  const numberSystem = code[0]!;
  const d1 = code[1]!;
  const d2 = code[2]!;
  const d3 = code[3]!;
  const d4 = code[4]!;
  const d5 = code[5]!;
  const d6 = code[6]!;
  const check = code[7]!;
  if (numberSystem !== '0' && numberSystem !== '1') return null;
  const body = d6 <= '2'
    ? `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`
    : d6 === '3'
      ? `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`
      : d6 === '4'
        ? `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`
        : `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${body}${check}`;
}
