import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const required = [
  '<!DOCTYPE html>',
  '<title>CTZ Studio',
  'id="btnSaveProject"',
  'data-export-all="model1"',
  'data-export-all="model2"',
  'html2canvas.min.js',
  '@caiocreatorize',
  '@creatorizebrasil'
];

const missing = required.filter((value) => !html.includes(value));
if (missing.length) {
  console.error(`Build invalido. Elementos ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

if (/V[eé]rtice|verticepatrimonial/i.test(html)) {
  console.error('Build invalido. Ainda existem referencias ao branding anterior.');
  process.exit(1);
}

console.log('CTZ Studio validado para deploy estatico.');
