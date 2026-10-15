// ===================================================
// EXPORT XLSX MULTI-SHEET — PURE JAVASCRIPT
// 100% tanpa library eksternal. Generate file .xlsx asli (OOXML)
// yang kompatibel dengan Excel 2016+, Google Sheets, WPS, LibreOffice.
//
// Cara kerja:
// 1. Bangun semua XML internal yang dibutuhkan XLSX
// 2. Bungkus jadi ZIP pakai ZIP writer mini (mode "store", tanpa kompresi)
// 3. Trigger download via Blob
// ===================================================

export interface XLSXSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

// =====================================================
// 1. UTILITAS ENCODING
// =====================================================
const encoder = new TextEncoder();

function strToU8(s: string): Uint8Array {
  return encoder.encode(s);
}

function escapeXml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(n: number): string {
  let s = '';
  n = n + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = (name || `Sheet${index + 1}`)
    .replace(/[:\\/?*\[\]]/g, '_')
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

// =====================================================
// 2. CRC32 (untuk ZIP)
// =====================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// =====================================================
// 3. ZIP WRITER (mode "store", tanpa kompresi)
// =====================================================
interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strToU8(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    // ---- Local file header (30 bytes + name) ----
    const lhBuf = new ArrayBuffer(30 + nameBytes.length);
    const lh = new Uint8Array(lhBuf);
    const lv = new DataView(lhBuf);
    lv.setUint32(0, 0x04034b50, true);          // signature
    lv.setUint16(4, 20, true);                  // version needed
    lv.setUint16(6, 0, true);                   // flags
    lv.setUint16(8, 0, true);                   // method = 0 (store)
    lv.setUint16(10, 0, true);                  // mod time
    lv.setUint16(12, 0, true);                  // mod date
    lv.setUint32(14, crc, true);                // crc32
    lv.setUint32(18, size, true);               // compressed size
    lv.setUint32(22, size, true);               // uncompressed size
    lv.setUint16(26, nameBytes.length, true);   // filename length
    lv.setUint16(28, 0, true);                  // extra field length
    lh.set(nameBytes, 30);

    localParts.push(lh);
    localParts.push(data);

    // ---- Central directory header (46 bytes + name) ----
    const chBuf = new ArrayBuffer(46 + nameBytes.length);
    const ch = new Uint8Array(chBuf);
    const cv = new DataView(chBuf);
    cv.setUint32(0, 0x02014b50, true);          // signature
    cv.setUint16(4, 20, true);                  // version made by
    cv.setUint16(6, 20, true);                  // version needed
    cv.setUint16(8, 0, true);                   // flags
    cv.setUint16(10, 0, true);                  // method
    cv.setUint16(12, 0, true);                  // mod time
    cv.setUint16(14, 0, true);                  // mod date
    cv.setUint32(16, crc, true);                // crc32
    cv.setUint32(20, size, true);               // compressed size
    cv.setUint32(24, size, true);               // uncompressed size
    cv.setUint16(28, nameBytes.length, true);   // filename length
    cv.setUint16(30, 0, true);                  // extra length
    cv.setUint16(32, 0, true);                  // comment length
    cv.setUint16(34, 0, true);                  // disk number
    cv.setUint16(36, 0, true);                  // internal attrs
    cv.setUint32(38, 0, true);                  // external attrs
    cv.setUint32(42, offset, true);             // local header offset
    ch.set(nameBytes, 46);

    centralParts.push(ch);
    offset += lh.length + data.length;
  }

  // ---- End of Central Directory Record (22 bytes) ----
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);            // signature
  ev.setUint16(4, 0, true);                     // disk number
  ev.setUint16(6, 0, true);                     // disk start
  ev.setUint16(8, entries.length, true);        // entries on disk
  ev.setUint16(10, entries.length, true);       // total entries
  ev.setUint32(12, centralSize, true);          // central dir size
  ev.setUint32(16, offset, true);               // central dir offset
  ev.setUint16(20, 0, true);                    // comment length

  // ---- Concat semua ----
  const totalSize =
    localParts.reduce((s, p) => s + p.length, 0) +
    centralSize +
    eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of localParts) { result.set(p, pos); pos += p.length; }
  for (const p of centralParts) { result.set(p, pos); pos += p.length; }
  result.set(eocd, pos);

  return result;
}

// =====================================================
// 4. BUILDER XML UNTUK XLSX
// =====================================================

// [Content_Types].xml
function buildContentTypes(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetOverrides}
</Types>`;
}

// _rels/.rels
function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

// xl/workbook.xml
function buildWorkbook(sheetNames: string[]): string {
  const sheets = sheetNames.map((name, i) =>
    `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets}</sheets>
</workbook>`;
}

// xl/_rels/workbook.xml.rels
function buildWorkbookRels(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels}
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

// xl/styles.xml
// Dua style:
//   s="0" → default (untuk data)
//   s="1" → header: bold, putih, background gelap
function buildStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
</styleSheet>`;
}

// xl/worksheets/sheetN.xml
function buildSheet(sheet: XLSXSheet): string {
  const rowsXml: string[] = [];

  // Header row — pakai style s="1" (bold putih + background gelap)
  const headerCells = sheet.headers.map((h, i) => {
    const ref = `${colLetter(i)}1`;
    return `<c r="${ref}" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(h)}</t></is></c>`;
  }).join('');
  rowsXml.push(`<row r="1">${headerCells}</row>`);

  // Data rows
  sheet.rows.forEach((row, rowIdx) => {
    const r = rowIdx + 2;
    const cells = row.map((cell, colIdx) => {
      const ref = `${colLetter(colIdx)}${r}`;
      const num = typeof cell === 'number' ? cell : Number(cell);
      const isNumeric = typeof cell === 'number'
        ? !isNaN(cell)
        : (typeof cell === 'string' && cell.trim() !== '' && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(cell.trim()));

      if (isNumeric) {
        return `<c r="${ref}"><v>${num}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
    }).join('');
    rowsXml.push(`<row r="${r}">${cells}</row>`);
  });

  // Auto column width
  const cols = sheet.headers.map((h, i) => {
    const headerLen = String(h ?? '').length;
    const maxDataLen = sheet.rows.reduce((m, row) => {
      return Math.max(m, String(row[i] ?? '').length);
    }, 0);
    const width = Math.min(Math.max(headerLen, maxDataLen, 10) + 2, 50);
    return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rowsXml.join('')}</sheetData>
</worksheet>`;
}

// =====================================================
// 5. FUNGSI UTAMA — EXPORT XLSX
// =====================================================
export function exportMultiSheetXLSX(filename: string, sheets: XLSXSheet[]) {
  try {
    if (!sheets || sheets.length === 0) {
      throw new Error('Tidak ada sheet untuk diekspor.');
    }

    // Siapkan nama sheet unik
    const usedNames = new Set<string>();
    const sheetNames: string[] = sheets.map((s, i) => {
      let base = sanitizeSheetName(s.name, i);
      let candidate = base;
      let suffix = 1;
      while (usedNames.has(candidate)) {
        const suffixStr = `_${suffix}`;
        candidate = base.slice(0, 31 - suffixStr.length) + suffixStr;
        suffix++;
      }
      usedNames.add(candidate);
      return candidate;
    });

    // Bangun semua file internal ZIP
    const entries: ZipEntry[] = [];

    entries.push({
      name: '[Content_Types].xml',
      data: strToU8(buildContentTypes(sheets.length)),
    });
    entries.push({
      name: '_rels/.rels',
      data: strToU8(buildRootRels()),
    });
    entries.push({
      name: 'xl/workbook.xml',
      data: strToU8(buildWorkbook(sheetNames)),
    });
    entries.push({
      name: 'xl/_rels/workbook.xml.rels',
      data: strToU8(buildWorkbookRels(sheets.length)),
    });
    entries.push({
      name: 'xl/styles.xml',
      data: strToU8(buildStyles()),
    });

    sheets.forEach((sheet, i) => {
      entries.push({
        name: `xl/worksheets/sheet${i + 1}.xml`,
        data: strToU8(buildSheet(sheet)),
      });
    });

    // Bungkus jadi ZIP
    const zipBytes = createZip(entries);

    // Trigger download
    const baseName = filename.replace(/\.(xlsx?|csv)$/i, '');
    const finalName = `${baseName}.xlsx`;

    // Blob — pakai slice supaya buffer ter-copy dengan aman
    const blob = new Blob([zipBytes.slice()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Beri waktu browser untuk memproses download sebelum revoke
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    return { success: true, filename: finalName };
  } catch (err: any) {
    console.error('exportMultiSheetXLSX error:', err);
    throw new Error('Gagal membuat file Excel: ' + (err?.message || 'Unknown error'));
  }
}

// =====================================================
// 6. BONUS — EXPORT CSV (fallback paling aman)
// =====================================================
export function exportToCSV(filename: string, sheet: XLSXSheet) {
  const escape = (v: any) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    sheet.headers.map(escape).join(','),
    ...sheet.rows.map(row => row.map(escape).join(',')),
  ];

  // BOM di awal supaya Excel mendeteksi UTF-8 dengan benar
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.(xlsx?|csv)$/i, '') + '.csv';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
