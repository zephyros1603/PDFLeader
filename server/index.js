const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

// Arial Unicode MS supports ₹ and all Unicode characters
const ARIAL_UNICODE_PATH = '/Library/Fonts/Arial Unicode.ttf';
const hasUnicodeFont = fs.existsSync(ARIAL_UNICODE_PATH);
const arialUnicodeBytes = hasUnicodeFont ? fs.readFileSync(ARIAL_UNICODE_PATH) : null;

const app = express();
const PORT = 3001;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files allowed'), false);
}});

// POST /api/upload
app.post('/api/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename, originalName: req.file.originalname });
});

// GET /api/pdf/:filename
app.get('/api/pdf/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// POST /api/export - embed annotations into PDF
app.post('/api/export', async (req, res) => {
  try {
    const { filename, annotations } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    const existingBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(existingBytes);
    const pages = pdfDoc.getPages();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const ann of annotations) {
      const pageIndex = ann.pageIndex || 0;
      if (pageIndex >= pages.length) continue;
      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      if (ann.type === 'text') {
        const x = ann.x * pageWidth;
        const pdfY = pageHeight - (ann.y * pageHeight);
        const colorHex = ann.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;
        page.drawText(ann.text || '', {
          x, y: pdfY - (ann.fontSize || 16),
          size: ann.fontSize || 16,
          font: helvetica,
          color: rgb(r, g, b)
        });
      } else if (ann.type === 'rect') {
        const x = ann.x * pageWidth;
        const pdfY = pageHeight - (ann.y * pageHeight) - (ann.h * pageHeight);
        const w = ann.w * pageWidth;
        const h = ann.h * pageHeight;
        const colorHex = ann.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;
        page.drawRectangle({ x, y: pdfY, width: w, height: h, borderColor: rgb(r, g, b), borderWidth: ann.lineWidth || 2 });
      } else if (ann.type === 'ellipse') {
        const cx = ann.cx * pageWidth;
        const cy = pageHeight - (ann.cy * pageHeight);
        const rx = ann.rx * pageWidth;
        const ry = ann.ry * pageHeight;
        const colorHex = ann.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;
        page.drawEllipse({ x: cx, y: cy, xScale: rx, yScale: ry, borderColor: rgb(r, g, b), borderWidth: ann.lineWidth || 2 });
      } else if (ann.type === 'highlight') {
        const x = ann.x * pageWidth;
        const pdfY = pageHeight - (ann.y * pageHeight) - (ann.h * pageHeight);
        const w = ann.w * pageWidth;
        const h = ann.h * pageHeight;
        page.drawRectangle({ x, y: pdfY, width: w, height: h, color: rgb(1, 1, 0), opacity: 0.3 });
      } else if (ann.type === 'drawing' || ann.type === 'highlighter') {
        if (!ann.points || ann.points.length < 2) continue;
        const colorHex = ann.color || '#000000';
        let r = parseInt(colorHex.slice(1, 3), 16) / 255;
        let g = parseInt(colorHex.slice(3, 5), 16) / 255;
        let b = parseInt(colorHex.slice(5, 7), 16) / 255;
        const opacity = ann.type === 'highlighter' ? 0.4 : 1;
        for (let i = 0; i < ann.points.length - 1; i++) {
          const p1 = ann.points[i];
          const p2 = ann.points[i + 1];
          page.drawLine({
            start: { x: p1.x * pageWidth, y: pageHeight - (p1.y * pageHeight) },
            end: { x: p2.x * pageWidth, y: pageHeight - (p2.y * pageHeight) },
            thickness: ann.lineWidth || 2,
            color: rgb(r, g, b),
            opacity
          });
        }
      } else if (ann.type === 'line') {
        const colorHex = ann.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;
        page.drawLine({
          start: { x: ann.x1 * pageWidth, y: pageHeight - (ann.y1 * pageHeight) },
          end: { x: ann.x2 * pageWidth, y: pageHeight - (ann.y2 * pageHeight) },
          thickness: ann.lineWidth || 2,
          color: rgb(r, g, b)
        });
      } else if (ann.type === 'arrow') {
        const colorHex = ann.color || '#000000';
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;
        const x1 = ann.x1 * pageWidth;
        const y1 = pageHeight - (ann.y1 * pageHeight);
        const x2 = ann.x2 * pageWidth;
        const y2 = pageHeight - (ann.y2 * pageHeight);
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: ann.lineWidth || 2, color: rgb(r, g, b) });
        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 12;
        const ax1 = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
        const ay1 = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
        const ax2 = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
        const ay2 = y2 - arrowSize * Math.sin(angle + Math.PI / 6);
        page.drawLine({ start: { x: x2, y: y2 }, end: { x: ax1, y: ay1 }, thickness: ann.lineWidth || 2, color: rgb(r, g, b) });
        page.drawLine({ start: { x: x2, y: y2 }, end: { x: ax2, y: ay2 }, thickness: ann.lineWidth || 2, color: rgb(r, g, b) });
      } else if (ann.type === 'signature') {
        try {
          const base64Data = ann.imageData.replace(/^data:image\/\w+;base64,/, '');
          const imgBytes = Buffer.from(base64Data, 'base64');
          const embeddedImg = await pdfDoc.embedPng(imgBytes);
          const x = ann.x * pageWidth;
          const pdfY = pageHeight - (ann.y * pageHeight) - (ann.h * pageHeight);
          const w = ann.w * pageWidth;
          const h = ann.h * pageHeight;
          page.drawImage(embeddedImg, { x, y: pdfY, width: w, height: h });
        } catch (e) {
          console.error('Signature embed error:', e);
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="exported.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/merge
app.post('/api/merge', upload.array('pdfs'), async (req, res) => {
  try {
    const mergedPdf = await PDFDocument.create();
    for (const file of req.files) {
      const bytes = fs.readFileSync(file.path);
      const doc = await PDFDocument.load(bytes);
      const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach(p => mergedPdf.addPage(p));
    }
    const pdfBytes = await mergedPdf.save();
    // cleanup temp files
    req.files.forEach(f => fs.unlinkSync(f.path));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Merge error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/split
app.post('/api/split', async (req, res) => {
  try {
    const { filename, pageIndex } = req.body; // pageIndex: extract one page; omit for all
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const bytes = fs.readFileSync(filePath);
    const srcDoc = await PDFDocument.load(bytes);
    const indices = (pageIndex != null) ? [pageIndex] : Array.from({ length: srcDoc.getPageCount() }, (_, i) => i);
    const pages = [];
    for (const i of indices) {
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(copiedPage);
      const pageBytes = await newDoc.save();
      pages.push({ page: i + 1, data: Buffer.from(pageBytes).toString('base64') });
    }
    res.json({ pages });
  } catch (err) {
    console.error('Split error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crop
app.post('/api/crop', async (req, res) => {
  try {
    const { filename, pageIndex, x, y, width, height } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const pdfDoc = await PDFDocument.load(fs.readFileSync(filePath));
    const pages = pdfDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) return res.status(400).json({ error: 'Invalid page index' });
    const page = pages[pageIndex];
    const { width: pw, height: ph } = page.getSize();
    const cx = Math.max(0, Math.min(x, pw));
    const cy = Math.max(0, Math.min(y, ph));
    const cw = Math.max(1, Math.min(width,  pw - cx));
    const ch = Math.max(1, Math.min(height, ph - cy));
    page.setCropBox(cx, cy, cw, ch);
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);
    res.json({ success: true });
  } catch (err) {
    console.error('Crop error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compress
app.post('/api/compress', async (req, res) => {
  try {
    const { filename } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Compress error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/add-page-numbers
app.post('/api/add-page-numbers', async (req, res) => {
  try {
    const { filename, position } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const text = `${i + 1}`;
      const fontSize = 12;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      let x, y;
      const pos = position || 'bottom-center';
      if (pos === 'bottom-center') { x = (width - textWidth) / 2; y = 20; }
      else if (pos === 'top-center') { x = (width - textWidth) / 2; y = height - 30; }
      else if (pos === 'bottom-right') { x = width - textWidth - 20; y = 20; }
      else if (pos === 'bottom-left') { x = 20; y = 20; }
      else { x = (width - textWidth) / 2; y = 20; }
      page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    });
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="numbered.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Page numbers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rotate
app.post('/api/rotate', async (req, res) => {
  try {
    const { filename, pageIndex, angle } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    if (pageIndex === -1) {
      pages.forEach(p => p.setRotation({ type: 'degrees', angle: ((p.getRotation().angle || 0) + angle) % 360 }));
    } else if (pageIndex >= 0 && pageIndex < pages.length) {
      const page = pages[pageIndex];
      const currentAngle = page.getRotation().angle || 0;
      page.setRotation({ type: 'degrees', angle: (currentAngle + angle) % 360 });
    }
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);
    res.json({ success: true });
  } catch (err) {
    console.error('Rotate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delete-page
app.post('/api/delete-page', async (req, res) => {
  try {
    const { filename, pageIndex } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const bytes = fs.readFileSync(filePath);
    const srcDoc = await PDFDocument.load(bytes);
    const newDoc = await PDFDocument.create();
    const indices = srcDoc.getPageIndices().filter(i => i !== pageIndex);
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach(p => newDoc.addPage(p));
    const pdfBytes = await newDoc.save();
    fs.writeFileSync(filePath, pdfBytes);
    res.json({ success: true, pageCount: newDoc.getPageCount() });
  } catch (err) {
    console.error('Delete page error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/update-text — cover original text with white rect, draw new text, save in-place
app.post('/api/update-text', async (req, res) => {
  try {
    const { filename, changes } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Register fontkit so we can embed custom TTF fonts
    pdfDoc.registerFontkit(fontkit);

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    // Embed Arial Unicode once — it handles ₹ and all Unicode characters
    const unicodeFont = arialUnicodeBytes
      ? await pdfDoc.embedFont(arialUnicodeBytes)
      : null;

    const pages = pdfDoc.getPages();
    let applied = 0;

    // Returns true if str has any character outside WinAnsiEncoding (0x20–0xFF)
    const needsUnicode = (str) => /[^\x20-\xFF]/.test(str);

    // Safe fallback when Arial Unicode is not available
    const WINANSI_MAP = Object.fromEntries([
      [0x20B9, 'Rs.'],  // Indian Rupee sign
      [0x20AC, 'EUR'],  // Euro sign
      [0x2013, '-'],    // en dash
      [0x2014, '--'],   // em dash
      [0x2018, "'"],    // left single quotation mark
      [0x2019, "'"],    // right single quotation mark
      [0x201C, '"'],    // left double quotation mark
      [0x201D, '"'],    // right double quotation mark
    ].map(([cp, val]) => [String.fromCodePoint(cp), val]));
    const toWinAnsi = (str) => str.replace(/[^\x20-\xFF]/g, (ch) => WINANSI_MAP[ch] !== undefined ? WINANSI_MAP[ch] : '');

    for (const change of changes) {
      const { pageIndex, pdfX, pdfY, pdfWidth, pdfFontSize, originalStr, newStr } = change;
      if (originalStr === newStr) continue;
      const page = pages[pageIndex];
      if (!page) continue;

      try {
        const fontSize = Math.max(Number(pdfFontSize) || 10, 1);
        const totalW   = Number(pdfWidth) > 0 ? Number(pdfWidth) : fontSize * (originalStr.length || 1) * 0.58;
        const descent  = fontSize * 0.22;
        const ascent   = fontSize * 0.73;

        // If original starts with a currency symbol (e.g. "₹571.00"), preserve it.
        // Only erase/write the numeric portion — the original ₹ stays rendered by the PDF's own font.
        const currencyMatch = (originalStr || '').match(/^([₹$€£]\s*)/);
        let drawX  = pdfX;
        let eraseW = totalW;
        let textToWrite = newStr.trim();
        if (currencyMatch) {
          const prefixRatio = currencyMatch[1].length / (originalStr.length || 1);
          const xOffset = totalW * prefixRatio;
          drawX  = pdfX + xOffset;
          eraseW = totalW - xOffset;
          // Strip currency prefix from the new value too — user may have typed "₹1399" or just "1399"
          textToWrite = newStr.trim().replace(/^[₹$€£]\s*/, '');
        }

        page.drawRectangle({ x: drawX - 1, y: pdfY - descent, width: eraseW + 2, height: ascent + descent, color: rgb(1, 1, 1) });

        // Use Helvetica (WinAnsi) — currency symbol is now handled by keeping the original
        const textToDraw = toWinAnsi(textToWrite);
        if (textToDraw) {
          page.drawText(textToDraw, { x: drawX, y: pdfY, size: fontSize, font: helveticaFont, color: rgb(0, 0, 0) });
        }
        applied++;
      } catch (changeErr) {
        console.warn(`Skipping change for "${originalStr}":`, changeErr.message);
      }
    }

    const modifiedBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, modifiedBytes);
    res.json({ success: true, applied });
  } catch (err) {
    console.error('Update text error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Automator ─────────────────────────────────────────────────────────────────

const AUTOMATOR_MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const AUTOMATOR_MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const AUTO_ASCENDER  = 0.73;
const AUTO_DESCENDER = 0.22;

// System TTF font paths (macOS) — used for embedding real fonts via fontkit
const SYSTEM_FONT_PATHS = {
  'TimesNewRoman':          '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
  'TimesNewRomanBold':      '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf',
  'TimesNewRomanItalic':    '/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf',
  'TimesNewRomanBoldItalic':'/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf',
  'Arial':                  '/Library/Fonts/Arial.ttf',
  'ArialBold':              '/Library/Fonts/Arial Bold.ttf',
};

// Map a raw/actual PDF font name to our font key
function mapActualFontToKey(actualName) {
  if (!actualName) return 'TimesNewRoman';
  const n = actualName.toLowerCase().replace(/[^a-z]/g,'');
  // LiberationSerif = metric-compatible Times New Roman
  if (n.includes('liberation') || n.includes('timesnew') || n.includes('times') || n.includes('roman')) {
    if (n.includes('bold') && n.includes('italic')) return 'TimesNewRomanBoldItalic';
    if (n.includes('bold'))   return 'TimesNewRomanBold';
    if (n.includes('italic')) return 'TimesNewRomanItalic';
    return 'TimesNewRoman';
  }
  if (n.includes('opensans') || n.includes('arial') || n.includes('helvetica') || n.includes('sans')) {
    if (n.includes('bold')) return 'ArialBold';
    return 'Arial';
  }
  // Unknown — default to Times New Roman (matches Rapido receipts)
  return 'TimesNewRoman';
}

// Embed a font by key; falls back to StandardFonts if the TTF isn't on disk
async function embedAutoFont(pdfDoc, fontKey, SF) {
  const ttfPath = SYSTEM_FONT_PATHS[fontKey];
  if (ttfPath && fs.existsSync(ttfPath)) {
    pdfDoc.registerFontkit(fontkit);
    try {
      return await pdfDoc.embedFont(fs.readFileSync(ttfPath), { subset: true });
    } catch { /* fall through to standard fonts */ }
  }
  // Fallback to nearest pdf-lib standard font
  const fallbackMap = {
    TimesNewRoman:           SF.TimesRoman,
    TimesNewRomanBold:       SF.TimesRomanBold,
    TimesNewRomanItalic:     SF.TimesRomanItalic,
    TimesNewRomanBoldItalic: SF.TimesRomanBoldItalic,
    Arial:                   SF.Helvetica,
    ArialBold:               SF.HelveticaBold,
  };
  return await pdfDoc.embedFont(fallbackMap[fontKey] || SF.TimesRoman);
}

function autoToWinAnsi(str) {
  const map = { '₹':'Rs','€':'EUR','–':'-','—':'--','‘':"'",'’':"'",'“':'"','”':'"' };
  return str.replace(/[^\x20-\xFF]/g, ch => map[ch] ?? '');
}

function getAvailableDates(year, month, excludeWeekdays, excludedDateStrs) {
  const dates = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (excludeWeekdays && dow >= 1 && dow <= 5) continue;
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if ((excludedDateStrs || []).includes(dateStr)) continue;
    dates.push(date);
  }
  return dates;
}

function detectDateFormat(str) {
  const s = str.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return 'DD/MM/YYYY';
  if (/^\d{2}-\d{2}-\d{4}$/.test(s))   return 'DD-MM-YYYY';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))   return 'YYYY-MM-DD';
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(s)) return 'DD MMM YYYY';
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(s)) return 'MMM DD YYYY';
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) return 'DD/MM/YY';
  // Rapido format: "May 1st 2026, 10:22 AM"
  if (/^[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)\s+\d{4},\s*\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(s)) return 'MMM Dord YYYY, Time';
  return null;
}

function getOrdinal(d) {
  if (d >= 11 && d <= 13) return 'th';
  switch (d % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

// "HH:MM" (24h) → minutes from midnight
function parseHHMM(str) {
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

// minutes from midnight → "H:MM AM/PM"
function minsTo12h(mins) {
  const h      = Math.floor(mins / 60) % 24;
  const m      = mins % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

// returns "H:MM AM/PM" string, or null if range invalid
function randomTimeInRange(startHHMM, endHHMM) {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  if (s === null || e === null || s > e) return null;
  return minsTo12h(s + Math.floor(Math.random() * (e - s + 1)));
}

function formatDateForPDF(date, format, originalStr, assignedTime) {
  const d   = String(date.getDate()).padStart(2,'0');
  const m   = String(date.getMonth() + 1).padStart(2,'0');
  const y   = date.getFullYear();
  const yy  = String(y).slice(2);
  const mon  = AUTOMATOR_MONTHS[date.getMonth()];
  const monF = AUTOMATOR_MONTHS_FULL[date.getMonth()];
  switch (format) {
    case 'DD/MM/YYYY': return `${d}/${m}/${y}`;
    case 'DD-MM-YYYY': return `${d}-${m}-${y}`;
    case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
    case 'DD MMM YYYY': return `${d} ${mon} ${y}`;
    case 'MMM DD YYYY': return `${mon} ${d}, ${y}`;
    case 'DD/MM/YY': return `${d}/${m}/${yy}`;
    case 'MMM Dord YYYY, Time': {
      const ord = getOrdinal(date.getDate());
      // Use assigned time if provided, otherwise preserve original
      let timePart;
      if (assignedTime) {
        timePart = `, ${assignedTime}`;
      } else {
        const tm = (originalStr || '').match(/,\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        timePart = tm ? `, ${tm[1]}` : '';
      }
      return `${monF} ${date.getDate()}${ord} ${y}${timePart}`;
    }
    default: return `${d}/${m}/${y}`;
  }
}

async function extractAutoItems(pdfPath, pdfjsLib) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc  = await pdfjsLib.getDocument({ data, useWorkerFetch:false, isEvalSupported:false, useSystemFonts:true, disableFontFace:true }).promise;
  try {
    const page = await doc.getPage(1);
    const tc   = await page.getTextContent();

    // Resolve internal font names (g_d0_f1, ...) to actual PostScript names
    const actualFontNames = {};
    const uniqueFonts = [...new Set(tc.items.map(i => i.fontName).filter(Boolean))];
    await Promise.all(uniqueFonts.map(fn =>
      new Promise(res => {
        const t = setTimeout(() => { actualFontNames[fn] = null; res(); }, 200);
        try {
          page.commonObjs.get(fn, d => {
            clearTimeout(t);
            actualFontNames[fn] = (d && d.name) ? d.name : null;
            res();
          });
        } catch { clearTimeout(t); actualFontNames[fn] = null; res(); }
      })
    ));

    return tc.items.filter(i => i.str && i.str.trim()).map((i, idx) => {
      const [a, b, , , pdfX, pdfY] = i.transform;
      const actualName = actualFontNames[i.fontName] || null;
      return {
        idx, str: i.str, pdfX, pdfY, pdfWidth: i.width || 0,
        pdfFontSize: Math.max(Math.sqrt(a*a+b*b), 1),
        fontName: i.fontName || null,
        actualFontName: actualName,
        suggestedFontKey: mapActualFontToKey(actualName),
      };
    });
  } finally {
    try { doc.destroy(); } catch {}
  }
}

// Detect the dominant font key from a PDF (for UI pre-selection)
async function detectDominantFontKey(pdfPath, pdfjsLib) {
  try {
    const items = await extractAutoItems(pdfPath, pdfjsLib);
    const counts = {};
    items.forEach(i => { counts[i.suggestedFontKey] = (counts[i.suggestedFontKey]||0) + 1; });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    return { fontKey: sorted[0]?.[0] || 'TimesNewRoman', breakdown: Object.fromEntries(sorted) };
  } catch { return { fontKey: 'TimesNewRoman', breakdown: {} }; }
}

// ── Universal field detection ──────────────────────────────────────────────

function classifyFieldType(value, labelHint) {
  const v = (value || '').trim();
  const l = (labelHint || '').toLowerCase().replace(/:$/, '').trim();
  if (!v || v.length > 200) return null;

  if (detectDateFormat(v)) return 'date';
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(v)) return 'time';

  // ID patterns: vehicle plates, ride/order IDs, long alphanumeric codes
  if (/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(v)) return 'id';
  if (/^[A-Z]{2,6}\d{8,20}$/.test(v)) return 'id';
  if (/^[A-Z0-9]{8,30}$/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)) return 'id';
  if (/\b(id|order|booking|ref|receipt|invoice|trip|ride|txn|transaction|voucher|serial|no\.?|number|#)\b/i.test(l) && /^[A-Z0-9\-_]{4,30}$/.test(v)) return 'id';

  // Price: 2–5 digit number, optionally with decimal and/or a leading currency symbol
  const vNum = v.replace(/^[₹$€£]\s*/, '');
  if (/^\d{2,5}(\.\d{1,2})?$/.test(vNum)) {
    if (/\b(price|amount|fare|total|cost|fee|charge|bill|payment|rate|subtotal|net|gross|mrp|rs\.?|inr)\b/i.test(l)) return 'price';
    return 'price';
  }

  if (/^\+?\d{10,13}$/.test(v)) return 'phone';

  // Name: by label hint or "First Last" pattern
  if (/\b(name|customer|passenger|user|client|driver|merchant|by|from)\b/i.test(l) && /^[A-Za-z\s.\'-]{2,60}$/.test(v)) return 'name';
  if (/^[A-Z][a-z]{1,20}(\s[A-Z][a-z]{1,20}){1,3}$/.test(v)) return 'name';
  if (/^[A-Z][a-z]{2,20}$/.test(v) && /\b(name|customer|passenger)\b/i.test(l)) return 'name';

  if (/^(Auto|Bike|Car|Bus|Cab|Taxi|Scooter|E-Scooter|Two Wheeler|Three Wheeler)$/i.test(v)) return null;

  if (v.length >= 2 && v.length <= 100 && l && !/^[₹$€£%]/.test(v)) return 'text';
  return null;
}

async function analyzeFields(pdfPath, pdfjsLib) {
  const items = await extractAutoItems(pdfPath, pdfjsLib);
  const fields = [];
  const usedIdxs = new Set();

  // Sort top-to-bottom (PDF Y decreases going down), left-to-right
  const sorted = [...items].sort((a, b) => b.pdfY - a.pdfY || a.pdfX - b.pdfX);

  // Pass 1: label → value to the RIGHT on same row
  for (const lbl of sorted) {
    if (usedIdxs.has(lbl.idx)) continue;
    const lStr = lbl.str.trim().replace(/:$/, '').trim();
    if (!lStr || lStr.length > 45 || /^\d/.test(lStr) || detectDateFormat(lStr) || /^[₹$€£]/.test(lStr)) continue;

    const right = sorted.filter(it =>
      !usedIdxs.has(it.idx) && it.idx !== lbl.idx &&
      Math.abs(it.pdfY - lbl.pdfY) < 8 && it.pdfX > lbl.pdfX + 5 &&
      it.str.trim().length > 0 && !/^[₹$€£]$/.test(it.str.trim())
    ).sort((a, b) => a.pdfX - b.pdfX);
    if (!right.length) continue;

    const vi = right[0];
    const type = classifyFieldType(vi.str.trim(), lStr);
    if (!type) continue;

    usedIdxs.add(lbl.idx); usedIdxs.add(vi.idx);
    fields.push({ id: `f${fields.length}`, label: lStr, value: vi.str.trim(), type, confidence: 0.9,
      pdfX: vi.pdfX, pdfY: vi.pdfY, pdfWidth: vi.pdfWidth, pdfFontSize: vi.pdfFontSize,
      fontName: vi.fontName, suggestedFontKey: vi.suggestedFontKey,
      locator: { strategy: 'by-label', labelText: lStr } });
  }

  // Pass 2: label → numeric value BELOW (within 80 pts) — for price fields only.
  // Restricted to numeric values to avoid label-like text (e.g. "Selected Price")
  // being incorrectly matched as a "name" value for a label above it.
  for (const lbl of sorted) {
    if (usedIdxs.has(lbl.idx)) continue;
    const lStr = lbl.str.trim().replace(/:$/, '').trim();
    if (!lStr || lStr.length > 45 || /^\d/.test(lStr) || detectDateFormat(lStr) || /^[₹$€£]/.test(lStr)) continue;

    const below = sorted.filter(it =>
      !usedIdxs.has(it.idx) && it.idx !== lbl.idx &&
      it.pdfY < lbl.pdfY && it.pdfY > lbl.pdfY - 80 &&
      /^[₹$€£]?\s*\d{2,5}(\.\d{1,2})?$/.test(it.str.trim())  // number, optionally currency-prefixed
    ).sort((a, b) => b.pdfY - a.pdfY);
    if (!below.length) continue;

    const vi = below[0];
    const type = classifyFieldType(vi.str.trim(), lStr);
    if (type !== 'price') continue;

    usedIdxs.add(lbl.idx); usedIdxs.add(vi.idx);
    fields.push({ id: `f${fields.length}`, label: lStr, value: vi.str.trim(), type: 'price', confidence: 0.85,
      pdfX: vi.pdfX, pdfY: vi.pdfY, pdfWidth: vi.pdfWidth, pdfFontSize: vi.pdfFontSize,
      fontName: vi.fontName, suggestedFontKey: vi.suggestedFontKey,
      locator: { strategy: 'by-label-below', labelText: lStr } });
  }

  // Pass 3: standalone dates and numbers not yet paired
  for (const item of items) {
    if (usedIdxs.has(item.idx)) continue;
    const v = item.str.trim();
    if (!v || /^[₹$€£]$/.test(v)) continue;
    let type = null;
    let locator = null;
    if (detectDateFormat(v)) { type = 'date'; locator = { strategy: 'by-pattern', pattern: 'date' }; }
    else if (/^\d{2,5}$/.test(v)) { type = 'price'; locator = { strategy: 'by-value', exactValue: v }; }
    if (type) {
      usedIdxs.add(item.idx);
      fields.push({ id: `f${fields.length}`, label: null, value: v, type, confidence: 0.7,
        pdfX: item.pdfX, pdfY: item.pdfY, pdfWidth: item.pdfWidth, pdfFontSize: item.pdfFontSize,
        fontName: item.fontName, suggestedFontKey: item.suggestedFontKey, locator });
    }
  }

  return fields.sort((a, b) => b.pdfY - a.pdfY || a.pdfX - b.pdfX);
}

function findFieldByLocator(items, locator) {
  if (!locator) return null;
  if (locator.strategy === 'by-label' || locator.strategy === 'by-label-below') {
    const lText = (locator.labelText || '').toLowerCase().replace(/:$/, '').trim();
    const lbl = items.find(i => i.str.trim().replace(/:$/, '').toLowerCase() === lText);
    if (!lbl) return null;
    if (locator.strategy === 'by-label') {
      const r = items.filter(i => Math.abs(i.pdfY - lbl.pdfY) < 8 && i.pdfX > lbl.pdfX + 5 &&
        i.str.trim().length > 0 && i.idx !== lbl.idx && !/^[₹$€£]$/.test(i.str.trim())
      ).sort((a, b) => a.pdfX - b.pdfX);
      return r[0] || null;
    }
    const b = items.filter(i => i.pdfY < lbl.pdfY && i.pdfY > lbl.pdfY - 80 &&
      i.str.trim().length > 0 && i.idx !== lbl.idx &&
      !/^[₹$€£]$/.test(i.str.trim()) &&  // skip bare currency symbol (separate item)
      /^[₹$€£]?\s*\d{2,5}(\.\d{1,2})?$/.test(i.str.trim())  // must be a number (with optional currency prefix)
    ).sort((a, b) => b.pdfY - a.pdfY);
    return b[0] || null;
  }
  if (locator.strategy === 'by-pattern') {
    if (locator.pattern === 'date') return items.find(i => detectDateFormat(i.str.trim())) || null;
  }
  if (locator.strategy === 'by-value') {
    return items.find(i => i.str.trim() === locator.exactValue) || null;
  }
  return null;
}

async function applyAutoChange(page, font, { pdfX, pdfY, pdfWidth, pdfFontSize, newStr, originalStr }, { rgb }) {
  const fs_ = Math.max(pdfFontSize, 1);
  const totalW = pdfWidth > 0 ? pdfWidth : fs_ * ((originalStr || newStr).length || newStr.length) * 0.60;

  // If original text starts with a currency symbol (e.g. "₹571.00"), preserve it:
  // only erase and rewrite the numeric part so the original ₹ rendering stays intact.
  const currencyMatch = (originalStr || '').match(/^([₹$€£]\s*)/);
  let drawX = pdfX;
  let eraseW = totalW;
  if (currencyMatch) {
    const prefixRatio = currencyMatch[1].length / (originalStr.length || 1);
    const xOffset = totalW * prefixRatio;
    drawX  = pdfX + xOffset;
    eraseW = totalW - xOffset;
  }

  page.drawRectangle({ x: drawX - 1, y: pdfY - fs_ * AUTO_DESCENDER, width: eraseW + 2, height: fs_ * (AUTO_ASCENDER + AUTO_DESCENDER), color: rgb(1,1,1) });
  const safe = autoToWinAnsi(newStr.trim());
  if (safe) page.drawText(safe, { x: drawX, y: pdfY, size: fs_, font, color: rgb(0,0,0) });
}

async function runAutomatorOnPDF(inputPath, outputPath, { fieldConfigs, assignedDate, assignedTime, fontKey, pdfjsLib, PDFDoc, rgbFn, SF }) {
  const items  = await extractAutoItems(inputPath, pdfjsLib);
  const pdfDoc = await PDFDoc.load(fs.readFileSync(inputPath));
  const page   = pdfDoc.getPages()[0];

  const fontCache = {};
  async function getFont(item) {
    const key = fontKey === 'auto' ? (item?.suggestedFontKey || 'TimesNewRoman') : (fontKey || 'TimesNewRoman');
    if (!fontCache[key]) fontCache[key] = await embedAutoFont(pdfDoc, key, SF);
    return fontCache[key];
  }

  let dateChanged = false, priceChanged = false, nameChanged = false;
  const changedFields = [];

  for (const fc of (fieldConfigs || [])) {
    if (!fc.enabled) continue;
    const item = findFieldByLocator(items, fc.locator);
    if (!item) continue;

    let newStr;
    if (fc.type === 'date') {
      const fmt = detectDateFormat(item.str.trim()) || 'DD/MM/YYYY';
      newStr = formatDateForPDF(assignedDate, fmt, item.str.trim(), assignedTime);
      dateChanged = true;
    } else if (fc.type === 'price') {
      const mn = Number(fc.min ?? 80), mx = Number(fc.max ?? 120);
      newStr = String(Math.floor(Math.random() * (mx - mn + 1)) + mn);
      priceChanged = true;
    } else if (fc.type === 'name' || fc.type === 'text') {
      newStr = (fc.value || '').trim() || item.str.trim();
      if (fc.type === 'name') nameChanged = true;
    } else {
      continue;
    }

    await applyAutoChange(page, await getFont(item), { ...item, newStr, originalStr: item.str }, { rgb: rgbFn });
    changedFields.push({ label: fc.label, type: fc.type, from: item.str.trim(), to: newStr });
  }

  fs.writeFileSync(outputPath, await pdfDoc.save());
  return { nameChanged, priceChanged, dateChanged, changedFields };
}

// POST /api/automator/list-files
app.post('/api/automator/list-files', async (req, res) => {
  try {
    const { inputFolder } = req.body;
    if (!inputFolder || !fs.existsSync(inputFolder)) return res.json({ count: 0, exists: false });
    const files = fs.readdirSync(inputFolder).filter(f => f.toLowerCase().endsWith('.pdf'));

    let detectedFontKey = null;
    let detectedFontName = null;
    if (files.length > 0) {
      try {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc = false;
        const firstPDF = path.join(inputFolder, files[0]);
        const { fontKey, breakdown } = await detectDominantFontKey(firstPDF, pdfjsLib);
        detectedFontKey  = fontKey;
        // Human-readable name of the detected key
        const labelMap = {
          'TimesNewRoman':          'Times New Roman',
          'TimesNewRomanBold':      'Times New Roman Bold',
          'TimesNewRomanItalic':    'Times New Roman Italic',
          'TimesNewRomanBoldItalic':'Times New Roman Bold Italic',
          'Arial':                  'Arial / Open Sans',
          'ArialBold':              'Arial Bold / Open Sans Bold',
        };
        detectedFontName = labelMap[fontKey] || fontKey;
      } catch { /* font detection optional */ }
    }

    res.json({ count: files.length, exists: true, detectedFontKey, detectedFontName });
  } catch (err) {
    res.json({ count: 0, exists: false, error: err.message });
  }
});

// POST /api/automator/analyze — scan first PDF and return detected fields
app.post('/api/automator/analyze', async (req, res) => {
  try {
    const { inputFolder } = req.body;
    if (!inputFolder || !fs.existsSync(inputFolder)) return res.json({ fields: [] });
    const files = fs.readdirSync(inputFolder).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) return res.json({ fields: [] });
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = false;
    const fields = await analyzeFields(path.join(inputFolder, files[0]), pdfjsLib);
    res.json({ fields, sampleFile: files[0] });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ fields: [], error: err.message });
  }
});

// POST /api/automator/run
app.post('/api/automator/run', async (req, res) => {
  try {
    const { inputFolder, outputFolder, config = {} } = req.body;
    const {
      fieldConfigs = [],
      excludeWeekdays = true, excludedDates = [], year, month,
      timeRange1 = null,
      timeRange2 = null,
      fontKey = 'auto',
    } = config;

    if (!inputFolder) return res.status(400).json({ error: 'inputFolder is required' });
    if (!fs.existsSync(inputFolder)) return res.status(400).json({ error: `Input folder not found: ${inputFolder}` });

    const outFolder = outputFolder && outputFolder.trim() ? outputFolder.trim() : path.join(inputFolder, 'output');
    fs.mkdirSync(outFolder, { recursive: true });

    const files = fs.readdirSync(inputFolder).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    if (!files.length) return res.json({ results: [], totalFiles: 0, outputFolder: outFolder, message: 'No PDF files found' });

    const hasDateField = fieldConfigs.some(fc => fc.enabled && fc.type === 'date');
    const now = new Date();
    const targetYear  = (year  != null) ? year  : now.getFullYear();
    const targetMonth = (month != null) ? month : now.getMonth();

    const availableDates = hasDateField
      ? getAvailableDates(targetYear, targetMonth, excludeWeekdays, excludedDates)
      : [new Date()]; // placeholder — not used
    if (hasDateField && !availableDates.length) return res.status(400).json({ error: 'No available dates. Please uncheck some exclusions.' });

    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = false;

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const assignedDate    = availableDates[i % availableDates.length];
      const occurrenceIndex = Math.floor(i / availableDates.length);
      const activeRange     = occurrenceIndex >= 1 ? timeRange2 : timeRange1;
      const assignedTime    = (activeRange && activeRange.start && activeRange.end)
        ? randomTimeInRange(activeRange.start, activeRange.end)
        : null;

      const inputPath = path.join(inputFolder, f);
      const outPath   = path.join(outFolder, f);
      try {
        const r = await runAutomatorOnPDF(inputPath, outPath, {
          fieldConfigs, assignedDate, assignedTime, fontKey,
          pdfjsLib, PDFDoc: PDFDocument, rgbFn: rgb, SF: StandardFonts,
        });
        const dd = hasDateField
          ? `${String(assignedDate.getDate()).padStart(2,'0')}/${String(assignedDate.getMonth()+1).padStart(2,'0')}/${assignedDate.getFullYear()}`
          : null;
        results.push({ file: f, ok: true, date: dd, time: assignedTime, occurrence: occurrenceIndex + 1, ...r });
      } catch (err) {
        results.push({ file: f, ok: false, error: err.message });
      }
    }

    res.json({
      results, totalFiles: files.length, outputFolder: outFolder,
      availableDates: hasDateField
        ? availableDates.map(d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`)
        : [],
    });
  } catch (err) {
    console.error('Automator run error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`PDF Leader server running on http://localhost:${PORT}`);
});
