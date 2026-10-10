// App-ikon (H-monogram med bold). Samme motiv og farver som mærket i appen: src/components/ui/BrandMark.tsx
// (Graphite-temaets primærfarve med mørkt H).
// rounded: favicon og manifest "any" · square: iOS (afrunder selv) · maskable: Android med motiv i safe-zonen.
const TILE = "#72a9fa";
const INK = "#10151c";

function build({ radius, scale }: { radius: number; scale: number }): string {
  const offset = (1024 * (1 - scale)) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    `<rect width="1024" height="1024" rx="${radius}" fill="${TILE}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">` +
    `<g transform="skewX(-12) translate(104 0)" fill="${INK}">` +
    `<rect x="250" y="220" width="160" height="584" rx="34"/>` +
    `<rect x="614" y="220" width="160" height="584" rx="34"/>` +
    `<rect x="380" y="462" width="264" height="100"/></g>` +
    `<circle cx="512" cy="512" r="176" fill="${TILE}"/>` +
    `<circle cx="512" cy="512" r="140" fill="${INK}"/>` +
    `<g stroke="${TILE}" stroke-width="18" stroke-linecap="round">` +
    `<line x1="512" y1="462" x2="512" y2="383"/><line x1="560" y1="496" x2="634" y2="472"/>` +
    `<line x1="542" y1="553" x2="588" y2="616"/><line x1="482" y1="553" x2="436" y2="616"/>` +
    `<line x1="464" y1="496" x2="390" y2="472"/></g>` +
    `<polygon points="512,462 560,496 542,553 482,553 464,496" fill="${TILE}" stroke="${TILE}" stroke-width="14" stroke-linejoin="round"/>` +
    `</g></svg>`
  );
}

export const brandIconSvg = build({ radius: 232, scale: 1 });
export const brandIconSvgSquare = build({ radius: 0, scale: 1 });
export const brandIconSvgMaskable = build({ radius: 0, scale: 0.8 });
