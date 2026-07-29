/**
 * Print Studio page formats. Dimensions are in millimetres; margins keep
 * content inside typical printable areas.
 */

export interface PrintFormat {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  cssSize: string; // value for the @page size descriptor
}

export const PRINT_FORMATS: PrintFormat[] = [
  { id: 'a4-portrait', label: 'A4 portrait', widthMm: 210, heightMm: 297, marginMm: 12, cssSize: 'A4 portrait' },
  { id: 'a4-landscape', label: 'A4 landscape', widthMm: 297, heightMm: 210, marginMm: 12, cssSize: 'A4 landscape' },
  { id: 'letter-portrait', label: 'US Letter portrait', widthMm: 215.9, heightMm: 279.4, marginMm: 12, cssSize: 'letter portrait' },
  { id: 'letter-landscape', label: 'US Letter landscape', widthMm: 279.4, heightMm: 215.9, marginMm: 12, cssSize: 'letter landscape' },
  { id: 'a5', label: 'A5', widthMm: 148, heightMm: 210, marginMm: 10, cssSize: 'A5 portrait' },
  { id: 'print-4x6', label: '4 × 6 in', widthMm: 101.6, heightMm: 152.4, marginMm: 5, cssSize: '101.6mm 152.4mm' },
  { id: 'print-5x7', label: '5 × 7 in', widthMm: 127, heightMm: 177.8, marginMm: 5, cssSize: '127mm 177.8mm' },
  { id: 'print-8x10', label: '8 × 10 in', widthMm: 203.2, heightMm: 254, marginMm: 8, cssSize: '203.2mm 254mm' },
  { id: 'square', label: 'Square print', widthMm: 210, heightMm: 210, marginMm: 10, cssSize: '210mm 210mm' },
  { id: 'postcard', label: 'Postcard', widthMm: 148, heightMm: 105, marginMm: 6, cssSize: '148mm 105mm' },
  { id: 'contact-sheet', label: 'Contact sheet (A4)', widthMm: 210, heightMm: 297, marginMm: 12, cssSize: 'A4 portrait' },
];

/** Printable image area for a format, in millimetres. */
export function printableAreaMm(f: PrintFormat): { widthMm: number; heightMm: number } {
  return { widthMm: f.widthMm - 2 * f.marginMm, heightMm: f.heightMm - 2 * f.marginMm };
}

/**
 * Scale an image (w×h px) to fit the printable area, preserving aspect.
 * Returns millimetre dimensions.
 */
export function fitImageToPage(
  imgW: number,
  imgH: number,
  f: PrintFormat,
  reservedMm = 0,
): { widthMm: number; heightMm: number } {
  const area = printableAreaMm(f);
  const availH = area.heightMm - reservedMm;
  const scale = Math.min(area.widthMm / imgW, availH / imgH);
  return { widthMm: imgW * scale, heightMm: imgH * scale };
}
