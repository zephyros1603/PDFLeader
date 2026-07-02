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
    const { filename } = req.body;
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const bytes = fs.readFileSync(filePath);
    const srcDoc = await PDFDocument.load(bytes);
    const pages = [];
    for (let i = 0; i < srcDoc.getPageCount(); i++) {
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
      [0x20B9, ‘Rs.’],  // Indian Rupee sign
      [0x20AC, ‘EUR’],  // Euro sign
      [0x2013, ‘-’],    // en dash
      [0x2014, ‘--’],   // em dash
      [0x2018, “’”],    // left single quotation mark
      [0x2019, “’”],    // right single quotation mark
      [0x201C, ‘”’],    // left double quotation mark
      [0x201D, ‘”’],    // right double quotation mark
    ].map(([cp, val]) => [String.fromCodePoint(cp), val]));
    const toWinAnsi = (str) => str.replace(/[^\x20-\xFF]/g, (ch) => WINANSI_MAP[ch] !== undefined ? WINANSI_MAP[ch] : ‘’);

    for (const change of changes) {
      const { pageIndex, pdfX, pdfY, pdfWidth, pdfFontSize, originalStr, newStr } = change;
      if (originalStr === newStr) continue;
      const page = pages[pageIndex];
      if (!page) continue;

      try {
        const fontSize = Math.max(Number(pdfFontSize) || 10, 1);
        const actualW  = Number(pdfWidth) > 0 ? Number(pdfWidth) : fontSize * (originalStr.length || 1) * 0.58;

        // Tight bounding box — Helvetica metrics (ascender 0.73, descender 0.22)
        const descent = fontSize * 0.22;
        const ascent  = fontSize * 0.73;
        const coverW  = actualW + 2;

        // Erase original text with a white rectangle
        page.drawRectangle({
          x: pdfX - 1,
          y: pdfY - descent,
          width: coverW,
          height: ascent + descent,
          color: rgb(1, 1, 1),
        });

        // Pick font: Arial Unicode when text has ₹ / emoji / etc., Helvetica otherwise
        const useUnicode = needsUnicode(newStr) && unicodeFont;
        const chosenFont = useUnicode ? unicodeFont : helveticaFont;
        const textToDraw = useUnicode ? newStr.trim() : toWinAnsi(newStr.trim());

        if (textToDraw) {
          page.drawText(textToDraw, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font: chosenFont,
            color: rgb(0, 0, 0),
          });
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

app.listen(PORT, () => {
  console.log(`PDF Leader server running on http://localhost:${PORT}`);
});
