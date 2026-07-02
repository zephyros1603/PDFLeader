#!/usr/bin/env node
// pdfjs-dist writes canvas-polyfill warnings directly to process.stderr — filter them
;(function() {
  const _write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    if (typeof chunk === 'string' && chunk.includes('polyfill')) return true;
    return _write(chunk, ...rest);
  };
})();
'use strict';

/**
 * PDF Batch Automator — Rapido receipts
 *
 * Usage:
 *   node index.js <input-folder> [output-folder]
 *
 * What it does for every .pdf in <input-folder>:
 *   • Replaces the Customer Name value with "Sanjan"
 *   • Replaces the Selected Price number with a random value 88–95
 *   • Saves the result to <output-folder> (default: <input-folder>/output/)
 */

const path = require('path');
const fs   = require('fs');

// ─── Config ────────────────────────────────────────────────────────────────
const NEW_NAME      = 'Sanjan';
const PRICE_MIN     = 88;
const PRICE_MAX     = 95;

// Helvetica metrics (fraction of font-size)
const ASCENDER  = 0.73;
const DESCENDER = 0.22;
// ───────────────────────────────────────────────────────────────────────────

function randPrice() {
  return Math.floor(Math.random() * (PRICE_MAX - PRICE_MIN + 1)) + PRICE_MIN;
}

// Strip characters outside WinAnsiEncoding so pdf-lib doesn't throw
function toWinAnsi(str) {
  const map = { '₹': 'Rs', '€': 'EUR', '–': '-', '—': '--',
                '‘': "'", '’': "'", '“': '"', '”': '"' };
  return str.replace(/[^\x20-\xFF]/g, ch => map[ch] ?? '');
}

// ── Text extraction ─────────────────────────────────────────────────────────
async function extractItems(pdfPath, pdfjsLib) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc  = await pdfjsLib.getDocument({
    data,
    useWorkerFetch:  false,
    isEvalSupported: false,
    useSystemFonts:  true,
    disableFontFace: true,
  }).promise;

  const page     = await doc.getPage(1);
  const tc       = await page.getTextContent();

  return tc.items
    .filter(i => i.str && i.str.trim())
    .map((i, idx) => {
      const [a, b, , , pdfX, pdfY] = i.transform;
      return {
        idx,
        str:         i.str,
        pdfX,
        pdfY,
        pdfWidth:    i.width  || 0,
        pdfFontSize: Math.max(Math.sqrt(a * a + b * b), 1),
      };
    });
}

// ── Field detection ─────────────────────────────────────────────────────────

/**
 * Find the Customer Name VALUE item.
 * Strategy: locate the "Customer Name" label, then find the rightmost item
 * on the same horizontal baseline (±4 PDF units in Y).
 * Fallback: any short title-case word at the extreme right of the page.
 */
function findNameItem(items) {
  const label = items.find(i =>
    /customer\s*name/i.test(i.str)
  );

  if (label) {
    const sameRow = items.filter(i =>
      Math.abs(i.pdfY - label.pdfY) < 5 &&
      i.pdfX > label.pdfX + 30 &&
      i.str.trim().length > 0
    );
    if (sameRow.length) return sameRow.reduce((a, b) => a.pdfX > b.pdfX ? a : b);
  }

  // Fallback – rightmost short title-case token
  const candidates = items.filter(i => /^[A-Z][a-z]{2,15}$/.test(i.str.trim()));
  if (candidates.length) return candidates.reduce((a, b) => a.pdfX > b.pdfX ? a : b);

  return null;
}

/**
 * Find the Selected Price NUMBER item (e.g. "58", "88").
 * Strategy: locate "Selected Price" label, then find the nearest numeric-only
 * item below it (lower pdfY in PDF space = lower on the visual page).
 * We look within a 70-point window below the label.
 */
function findPriceItem(items) {
  const label = items.find(i => /selected\s*price/i.test(i.str));

  if (label) {
    const below = items.filter(i =>
      i.pdfY < label.pdfY &&
      i.pdfY > label.pdfY - 80 &&
      /^\d{2,4}$/.test(i.str.trim())
    );
    if (below.length) return below.sort((a, b) => b.pdfY - a.pdfY)[0]; // closest
  }

  // Fallback – standalone 2-3 digit number
  const nums = items.filter(i => /^\d{2,3}$/.test(i.str.trim()));
  if (nums.length) return nums[0];

  return null;
}

// ── PDF modification ────────────────────────────────────────────────────────
async function applyChange(page, font, { pdfX, pdfY, pdfWidth, pdfFontSize, newStr }, { rgb }) {
  const fs_ = Math.max(pdfFontSize, 1);
  const w   = pdfWidth > 0 ? pdfWidth : fs_ * newStr.length * 0.60;

  // Erase original — tight bounding box using real font metrics
  page.drawRectangle({
    x:      pdfX - 1,
    y:      pdfY - fs_ * DESCENDER,
    width:  w + 2,
    height: fs_ * (ASCENDER + DESCENDER),
    color:  rgb(1, 1, 1),
  });

  const safe = toWinAnsi(newStr.trim());
  if (safe) {
    page.drawText(safe, {
      x:    pdfX,
      y:    pdfY,
      size: fs_,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

// ── Per-file processing ─────────────────────────────────────────────────────
async function processPDF(inputPath, outputPath, { newName, newPrice, pdfjsLib, PDFDocument, rgb, StandardFonts }) {
  const items     = await extractItems(inputPath, pdfjsLib);
  const nameItem  = findNameItem(items);
  const priceItem = findPriceItem(items);

  const pdfDoc = await PDFDocument.load(fs.readFileSync(inputPath));
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page   = pdfDoc.getPages()[0];

  if (nameItem) {
    await applyChange(page, font, {
      ...nameItem, newStr: newName
    }, { rgb });
  }

  if (priceItem) {
    await applyChange(page, font, {
      ...priceItem, newStr: String(newPrice)
    }, { rgb });
  }

  fs.writeFileSync(outputPath, await pdfDoc.save());
  return { nameChanged: !!nameItem, priceChanged: !!priceItem };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const inputFolder  = process.argv[2];
  const outputFolder = process.argv[3] ?? path.join(inputFolder ?? '.', 'output');

  if (!inputFolder) {
    console.error(`
Usage:  node index.js <input-folder> [output-folder]

Example:
  node index.js ~/Downloads/receipts
  node index.js ~/Downloads/receipts ~/Desktop/modified
`);
    process.exit(1);
  }

  if (!fs.existsSync(inputFolder)) {
    console.error(`Input folder not found: ${inputFolder}`);
    process.exit(1);
  }

  fs.mkdirSync(outputFolder, { recursive: true });

  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;

  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

  const files = fs.readdirSync(inputFolder)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (!files.length) {
    console.log('No PDF files found in:', inputFolder);
    return;
  }

  const bar = '─'.repeat(60);
  console.log(`\n${bar}`);
  console.log(' PDF Batch Automator  —  Rapido Receipts');
  console.log(bar);
  console.log(` Input  : ${inputFolder}`);
  console.log(` Output : ${outputFolder}`);
  console.log(` Files  : ${files.length} PDF(s)`);
  console.log(` Rule   : name → "${NEW_NAME}"  |  price → random ${PRICE_MIN}–${PRICE_MAX}`);
  console.log(`${bar}\n`);

  const results = [];

  for (let i = 0; i < files.length; i++) {
    const f         = files[i];
    const newPrice  = randPrice();
    const inputPath = path.join(inputFolder, f);
    const outPath   = path.join(outputFolder, f);

    process.stdout.write(` [${String(i + 1).padStart(3)}/${files.length}] ${f.slice(0, 45).padEnd(46)}`);

    try {
      const r = await processPDF(inputPath, outPath, {
        newName: NEW_NAME,
        newPrice,
        pdfjsLib,
        PDFDocument,
        rgb,
        StandardFonts,
      });

      const tag = [
        r.nameChanged  ? `name→"${NEW_NAME}"` : 'name:MISS',
        r.priceChanged ? `price→${newPrice}`  : 'price:MISS',
      ].join('  ');

      console.log(`✓  ${tag}`);
      results.push({ f, ok: true, newPrice, ...r });
    } catch (err) {
      console.log(`✗  ${err.message}`);
      results.push({ f, ok: false, err: err.message });
    }
  }

  const ok   = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  const miss = results.filter(r => r.ok && (!r.nameChanged || !r.priceChanged));

  console.log(`\n${bar}`);
  console.log(` ✓ Success : ${ok}`);
  if (fail) console.log(` ✗ Failed  : ${fail}`);
  if (miss.length) {
    console.log(` ⚠ Partial (field not found in PDF):`);
    miss.forEach(r => console.log(`     ${r.f}`));
  }
  console.log(`\n Output saved to: ${outputFolder}`);
  console.log(`${bar}\n`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
