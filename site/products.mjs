// The catalogue. IDs are stable: they are part of the page addresses (/product/<ID>).
export const PRODUCTS = [
  { id: "SKY-100", name: "Skyward 100 Refractor", category: "Telescopes", price: 349, color: "#2f5d8a", tube: 0.8 },
  { id: "SKY-130", name: "Skyward 130 Reflector", category: "Telescopes", price: 529, color: "#1f3b57", tube: 1.0 },
  { id: "TRV-70", name: "Traveller 70 Compact", category: "Telescopes", price: 179, color: "#5a8f6b", tube: 0.6 },
  { id: "DOB-200", name: "Deep Sky 200 Dobsonian", category: "Telescopes", price: 899, color: "#3d2f57", tube: 1.25 },
  { id: "BIN-1050", name: "Field 10x50 Binoculars", category: "Binoculars", price: 139, color: "#6b4f2f", tube: 0.5 },
  { id: "BIN-842", name: "Pocket 8x42 Binoculars", category: "Binoculars", price: 229, color: "#4f6b2f", tube: 0.45 },
  { id: "EYE-KIT", name: "Eyepiece Starter Kit", category: "Accessories", price: 89, color: "#8a5a2f", tube: 0.3 },
  { id: "FLT-SUN", name: "Solar Filter 100 mm", category: "Accessories", price: 59, color: "#c08a1f", tube: 0.25 },
  { id: "MNT-EQ3", name: "EQ3 Tracking Mount", category: "Accessories", price: 459, color: "#4a4a4a", tube: 0.9 },
  { id: "BK-ATLAS", name: "Night Sky Atlas", category: "Books", price: 29, color: "#7a2f3d", tube: 0.2 },
];

/** A simple product picture: a stand, a tube and a lens, in the product's colour. */
export function productSvg(p) {
  const w = 400, h = 300;
  const len = 90 + p.tube * 130;
  const x0 = (w - len) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#f4f1ea"/>
  <circle cx="${w - 60}" cy="55" r="18" fill="#e8d9a8"/>
  <g transform="rotate(-18 ${w / 2} ${h / 2})">
    <rect x="${x0}" y="${h / 2 - 22}" width="${len}" height="44" rx="10" fill="${p.color}"/>
    <rect x="${x0 + len - 14}" y="${h / 2 - 28}" width="22" height="56" rx="6" fill="#222"/>
    <circle cx="${x0 + len + 8}" cy="${h / 2}" r="16" fill="#9cc4e8" stroke="#222" stroke-width="4"/>
  </g>
  <line x1="${w / 2}" y1="${h / 2 + 10}" x2="${w / 2 - 50}" y2="${h - 30}" stroke="#333" stroke-width="6"/>
  <line x1="${w / 2}" y1="${h / 2 + 10}" x2="${w / 2 + 50}" y2="${h - 30}" stroke="#333" stroke-width="6"/>
  <line x1="${w / 2}" y1="${h / 2 + 10}" x2="${w / 2}" y2="${h - 25}" stroke="#333" stroke-width="6"/>
  <text x="20" y="${h - 14}" font-family="Arial, sans-serif" font-size="16" fill="#555">${p.id}</text>
</svg>`;
}
