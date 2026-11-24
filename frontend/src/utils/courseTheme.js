// Each course gets a stable accent colour (derived from its id) so cards,
// chips and headers for the same course always match across pages.
const ACCENTS = [
  { hex: '#2D6A4F', soft: '#e3f1ea' },
  { hex: '#4361EE', soft: '#e6ebfd' },
  { hex: '#8a4fd6', soft: '#f0e6fb' },
  { hex: '#d97706', soft: '#fdf0dc' },
  { hex: '#0e8aa8', soft: '#dff3f8' },
  { hex: '#c2410c', soft: '#fbe7de' },
];

export function courseAccent(id) {
  const n = Math.abs(Number(id) || 0);
  return ACCENTS[n % ACCENTS.length];
}
