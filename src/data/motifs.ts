// Generates simple embroidery-style motif images (SVG) used as demo
// "reference images" so the order screens look realistic.

const PALETTES = [
  { bg: '#7a1f2b', a: '#e8c36a', b: '#f3e2b0', c: '#c9963b' }, // maroon + gold
  { bg: '#f4ece1', a: '#b8862f', b: '#7a1f2b', c: '#d8b56a' }, // ivory + gold
  { bg: '#16324f', a: '#d9d9d9', b: '#9fb7cc', c: '#e8c36a' }, // navy + silver
  { bg: '#1f4d3a', a: '#e8c36a', b: '#f0d9a8', c: '#c46a7a' }, // bottle green
  { bg: '#f2d7d9', a: '#a33b55', b: '#c9963b', c: '#6b2a3a' }, // blush pink
  { bg: '#2b2b2b', a: '#c9963b', b: '#e9d5a1', c: '#8b6b3e' }, // black + antique
];

export function motifSVG(seed: number): string {
  const p = PALETTES[seed % PALETTES.length];
  const petals = 6 + (seed % 4) * 2;
  const ring2 = petals * 2;
  const parts: string[] = [];
  parts.push(`<rect width="200" height="200" fill="${p.bg}"/>`);
  // fine border
  parts.push(`<rect x="8" y="8" width="184" height="184" fill="none" stroke="${p.c}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
  for (let i = 0; i < ring2; i++) {
    const ang = (360 / ring2) * i;
    parts.push(`<circle cx="100" cy="28" r="3" fill="${p.b}" transform="rotate(${ang} 100 100)"/>`);
  }
  for (let i = 0; i < petals; i++) {
    const ang = (360 / petals) * i;
    parts.push(`<ellipse cx="100" cy="60" rx="11" ry="26" fill="none" stroke="${p.a}" stroke-width="2.2" transform="rotate(${ang} 100 100)"/>`);
    parts.push(`<ellipse cx="100" cy="66" rx="4" ry="12" fill="${p.c}" transform="rotate(${ang} 100 100)"/>`);
  }
  parts.push(`<circle cx="100" cy="100" r="22" fill="none" stroke="${p.b}" stroke-width="2"/>`);
  for (let i = 0; i < petals; i++) {
    const ang = (360 / petals) * i + 180 / petals;
    parts.push(`<circle cx="100" cy="84" r="4" fill="${p.a}" transform="rotate(${ang} 100 100)"/>`);
  }
  parts.push(`<circle cx="100" cy="100" r="9" fill="${p.a}"/><circle cx="100" cy="100" r="4" fill="${p.bg}"/>`);
  // corner sprigs
  for (const [x, y] of [[26, 26], [174, 26], [26, 174], [174, 174]]) {
    parts.push(`<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${p.a}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="2" fill="${p.b}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${parts.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
