// =====================================================
// EXPORT DOCX — OOXML tanpa library eksternal
// Generate file .docx asli yang bisa dibuka Word/LibreOffice/WPS
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

// ─── CRC32 untuk ZIP ───────────────────────────────
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

// ─── ZIP writer (mode "store") ─────────────────────
interface ZipEntry { name: string; data: Uint8Array; }

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strToU8(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const lhBuf = new ArrayBuffer(30 + nameBytes.length);
    const lh = new Uint8Array(lhBuf);
    const lv = new DataView(lhBuf);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    localParts.push(lh);
    localParts.push(data);

    const chBuf = new ArrayBuffer(46 + nameBytes.length);
    const ch = new Uint8Array(chBuf);
    const cv = new DataView(chBuf);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    centralParts.push(ch);
    offset += lh.length + data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize =
    localParts.reduce((s, p) => s + p.length, 0) + centralSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of localParts) { result.set(p, pos); pos += p.length; }
  for (const p of centralParts) { result.set(p, pos); pos += p.length; }
  result.set(eocd, pos);
  return result;
}

// ═══════════════════════════════════════════════════════
// TIPE BLOK DOKUMEN
// ═══════════════════════════════════════════════════════
export type DOCXAlign = 'left' | 'center' | 'right' | 'justify';

export type DOCXBlock =
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string; italic?: boolean }
  | { type: 'heading'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'label'; text: string }
  | { type: 'paragraph'; text: string; align?: DOCXAlign; bold?: boolean; italic?: boolean }
  | { type: 'spacer'; count?: number }
  | { type: 'divider' }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; headers: string[]; rows: (string | number)[][]; widths?: number[] }
  | { type: 'signature'; signatures: { label: string; name?: string; place?: string; date?: string }[] }
  | { type: 'pagebreak' };

export interface DOCXKopContext {
  schoolName: string;
  schoolAddress: string;
  schoolEmail?: string;
  schoolPhone?: string;
  kerabatKerja?: string;
  className: string;
  academicYear: string;
  logoKiriLabel?: string;
  logoKananLabel?: string;
}

export interface DOCXOptions {
  withKop?: boolean;
  kop?: DOCXKopContext;
}

// ═══════════════════════════════════════════════════════
// XML HELPERS
// ═══════════════════════════════════════════════════════
function run(
  text: string,
  opts: { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: number; color?: string; font?: string; } = {}
): string {
  const rPr: string[] = [];
  if (opts.font) rPr.push(`<w:rFonts w:ascii="${opts.font}" w:hAnsi="${opts.font}"/>`);
  if (opts.bold) rPr.push('<w:b/>');
  if (opts.italic) rPr.push('<w:i/>');
  if (opts.underline) rPr.push('<w:u w:val="single"/>');
  if (opts.color) rPr.push(`<w:color w:val="${opts.color.replace('#', '')}"/>`);
  if (opts.fontSize) rPr.push(`<w:sz w:val="${opts.fontSize}"/><w:szCs w:val="${opts.fontSize}"/>`);

  const rPrXml = rPr.length > 0 ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function para(
  content: string | string[],
  pPr: { align?: DOCXAlign; spacing?: number; indent?: number; borderBottom?: boolean } = {}
): string {
  const pr: string[] = [];
  if (pPr.align) pr.push(`<w:jc w:val="${pPr.align === 'justify' ? 'both' : pPr.align}"/>`);
  if (pPr.spacing !== undefined) {
    pr.push(`<w:spacing w:after="${pPr.spacing}" w:line="276" w:lineRule="auto"/>`);
  }
  if (pPr.indent !== undefined) {
    pr.push(`<w:ind w:left="${pPr.indent}" w:hanging="${pPr.indent > 0 ? 360 : 0}"/>`);
  }
  if (pPr.borderBottom) {
    pr.push('<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/></w:pBdr>');
  }
  const pPrXml = pr.length > 0 ? `<w:pPr>${pr.join('')}</w:pPr>` : '';
  const inner = Array.isArray(content) ? content.join('') : content;
  return `<w:p>${pPrXml}${inner}</w:p>`;
}

function simplePara(text: string, opts: any = {}, pOpts: any = {}): string {
  return para(run(text, opts), pOpts);
}

function buildTable(block: Extract<DOCXBlock, { type: 'table' }>): string {
  const colCount = block.headers.length;
  const totalWidth = 9360;
  const widths = block.widths && block.widths.length === colCount
    ? block.widths
    : Array.from({ length: colCount }, () => Math.floor(totalWidth / colCount));

  const gridCols = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');

  const headerCells = block.headers.map((h, i) =>
    `<w:tc>
      <w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E5E7EB"/></w:tcPr>
      ${para(run(h, { bold: true, fontSize: 20 }), { align: 'center', spacing: 40 })}
    </w:tc>`
  ).join('');

  const bodyRows = block.rows.map(row =>
    `<w:tr>${row.map((cell, i) =>
      `<w:tc>
        <w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/></w:tcPr>
        ${para(run(String(cell ?? ''), { fontSize: 20 }), { spacing: 40 })}
      </w:tc>`
    ).join('')}</w:tr>`
  ).join('');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidth}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="60" w:type="dxa"/>
        <w:left w:w="80" w:type="dxa"/>
        <w:bottom w:w="60" w:type="dxa"/>
        <w:right w:w="80" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    <w:tr>${headerCells}</w:tr>
    ${bodyRows}
  </w:tbl>`;
}

function buildSignature(sigs: Extract<DOCXBlock, { type: 'signature' }>['signatures']): string {
  const cell = (sig: any) => {
    const lines: string[] = [];
    if (sig.place || sig.date) {
      lines.push(para(run(`${sig.place || ''}${sig.place && sig.date ? ', ' : ''}${sig.date || ''}`, { fontSize: 20 })));
    }
    const labelLines = String(sig.label || '').split('\n');
    labelLines.forEach((l: string) => {
      lines.push(para(run(l, { fontSize: 20 })));
    });
    lines.push(para('', { spacing: 0 }));
    lines.push(para('', { spacing: 0 }));
    lines.push(para('', { spacing: 0 }));
    lines.push(para('', { spacing: 0 }));
    lines.push(para(run(sig.name || '...........................', { fontSize: 20, underline: true }), { align: 'center' }));
    return `<w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>${lines.join('')}</w:tc>`;
  };

  const cells = sigs.map(cell).join('');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9360" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
        <w:insideH w:val="none"/><w:insideV w:val="none"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="4680"/><w:gridCol w:w="4680"/></w:tblGrid>
    <w:tr>${cells}</w:tr>
  </w:tbl>`;
}

// ═══════════════════════════════════════════════════════
// BUILD DOCUMENT BODY
// ═══════════════════════════════════════════════════════
function buildDocumentBody(blocks: DOCXBlock[]): string {
  const out: string[] = [];

  blocks.forEach(b => {
    switch (b.type) {
      case 'title':
        out.push(simplePara(b.text, { bold: true, fontSize: 32 }, { align: 'center', spacing: 200 }));
        break;
      case 'subtitle':
        out.push(simplePara(b.text, { fontSize: 24, italic: b.italic }, { align: 'center', spacing: 120 }));
        break;
      case 'heading':
        out.push(simplePara(b.text, { bold: true, fontSize: 28 }, { spacing: 200 }));
        break;
      case 'subheading':
        out.push(simplePara(b.text, { bold: true, fontSize: 24 }, { spacing: 160 }));
        break;
      case 'label':
        out.push(simplePara(b.text, { bold: true, fontSize: 22 }, { spacing: 60 }));
        break;
      case 'paragraph':
        out.push(simplePara(
          b.text,
          { bold: b.bold, italic: b.italic, fontSize: 22 },
          { align: b.align || 'justify', spacing: 120 }
        ));
        break;
      case 'spacer':
        for (let i = 0; i < (b.count || 1); i++) out.push(para('', { spacing: 0 }));
        break;
      case 'divider':
        out.push(para('', { spacing: 0, borderBottom: true }));
        break;
      case 'bullets':
        b.items.forEach(item => {
          out.push(para(run(`•  ${item}`, { fontSize: 22 }), { spacing: 60, indent: 360 }));
        });
        break;
      case 'numbered':
        b.items.forEach((item, i) => {
          out.push(para(run(`${i + 1}.  ${item}`, { fontSize: 22 }), { spacing: 60, indent: 360 }));
        });
        break;
      case 'table':
        out.push(buildTable(b));
        out.push(para('', { spacing: 0 }));
        break;
      case 'signature':
        out.push(para('', { spacing: 0 }));
        out.push(buildSignature(b.signatures));
        break;
      case 'pagebreak':
        out.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
        break;
    }
  });

  return out.join('');
}

// ═══════════════════════════════════════════════════════
// KOP SURAT
// ═══════════════════════════════════════════════════════
function buildHeaderXML(ctx: DOCXKopContext): string {
  const logoKiri = ctx.logoKiriLabel || '[ LOGO SEKOLAH ]';
  const logoKanan = ctx.logoKananLabel || '[ LOGO KERABAT ]';

  const cellLogoKiri = `<w:tc>
    <w:tcPr>
      <w:tcW w:w="1800" w:type="dxa"/>
      <w:vAlign w:val="center"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tcBorders>
    </w:tcPr>
    ${para(run(logoKiri, { bold: true, fontSize: 18, color: '888888' }), { align: 'center', spacing: 40 })}
    ${para(run('(ganti dengan gambar)', { italic: true, fontSize: 14, color: '999999' }), { align: 'center', spacing: 40 })}
  </w:tc>`;

  const cellInfo = `<w:tc>
    <w:tcPr>
      <w:tcW w:w="5760" w:type="dxa"/>
      <w:vAlign w:val="center"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tcBorders>
    </w:tcPr>
    ${para(run(ctx.schoolName.toUpperCase(), { bold: true, fontSize: 28 }), { align: 'center', spacing: 20 })}
    ${para(run(ctx.schoolAddress, { fontSize: 18 }), { align: 'center', spacing: 20 })}
    ${(ctx.schoolEmail || ctx.schoolPhone)
      ? para(run(
          [ctx.schoolEmail && `Email: ${ctx.schoolEmail}`, ctx.schoolPhone && `Telp: ${ctx.schoolPhone}`]
            .filter(Boolean).join(' | '),
          { fontSize: 16, italic: true }
        ), { align: 'center', spacing: 20 })
      : ''}
  </w:tc>`;

  const cellLogoKanan = `<w:tc>
    <w:tcPr>
      <w:tcW w:w="1800" w:type="dxa"/>
      <w:vAlign w:val="center"/>
      <w:tcBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/>
      </w:tcBorders>
    </w:tcPr>
    ${para(run(logoKanan, { bold: true, fontSize: 18, color: '888888' }), { align: 'center', spacing: 40 })}
    ${para(run('(ganti dengan gambar)', { italic: true, fontSize: 14, color: '999999' }), { align: 'center', spacing: 40 })}
  </w:tc>`;

  const table1 = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9360" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
        <w:insideH w:val="none"/><w:insideV w:val="none"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="1800"/>
      <w:gridCol w:w="5760"/>
      <w:gridCol w:w="1800"/>
    </w:tblGrid>
    <w:tr>${cellLogoKiri}${cellInfo}${cellLogoKanan}</w:tr>
  </w:tbl>`;

  const kerabatLine = ctx.kerabatKerja
    ? para(run(ctx.kerabatKerja.toUpperCase(), { bold: true, fontSize: 22, color: '8B0000' }), { align: 'center', spacing: 40 })
    : '';

  const kelasLine = para(
    run(`Kelas ${ctx.className} — Tahun Ajaran ${ctx.academicYear}`, { italic: true, fontSize: 20 }),
    { align: 'center', spacing: 40 }
  );

  const doubleLine = para('', { spacing: 0, borderBottom: true });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${table1}
  ${kerabatLine}
  ${kelasLine}
  ${doubleLine}
  ${para('', { spacing: 0 })}
</w:hdr>`;
}

// ═══════════════════════════════════════════════════════
// DOCUMENT.XML
// ═══════════════════════════════════════════════════════
function buildDocumentXML(blocks: DOCXBlock[], opts: DOCXOptions): string {
  const body = buildDocumentBody(blocks);

  const sectPr = opts.withKop
    ? `<w:sectPr>
        <w:headerReference w:type="default" r:id="rId1"/>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
        <w:cols w:space="708"/>
        <w:docGrid w:linePitch="360"/>
      </w:sectPr>`
    : `<w:sectPr>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
        <w:cols w:space="708"/>
        <w:docGrid w:linePitch="360"/>
      </w:sectPr>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    ${sectPr}
  </w:body>
</w:document>`;
}

function buildStylesXML(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="id-ID"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;
}

function buildContentTypes(withHeader: boolean): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  ${withHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}
</Types>`;
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocumentRels(withHeader: boolean): string {
  const headerRel = withHeader
    ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${headerRel}
  <Relationship Id="rId${withHeader ? '2' : '1'}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

// ═══════════════════════════════════════════════════════
// FUNGSI UTAMA
// ═══════════════════════════════════════════════════════
export function downloadDOCX(
  filename: string,
  blocks: DOCXBlock[],
  options: DOCXOptions = {}
): void {
  const withKop = !!options.withKop && !!options.kop;

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: strToU8(buildContentTypes(withKop)) },
    { name: '_rels/.rels', data: strToU8(buildRootRels()) },
    { name: 'word/document.xml', data: strToU8(buildDocumentXML(blocks, options)) },
    { name: 'word/_rels/document.xml.rels', data: strToU8(buildDocumentRels(withKop)) },
    { name: 'word/styles.xml', data: strToU8(buildStylesXML()) },
  ];

  if (withKop && options.kop) {
    entries.push({
      name: 'word/header1.xml',
      data: strToU8(buildHeaderXML(options.kop)),
    });
  }

  const zipBytes = createZip(entries);

  const baseName = filename.replace(/\.(docx?|rtf)$/i, '');
  const finalName = `${baseName}.docx`;

  const blob = new Blob([zipBytes.slice()], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function todayLongID(): string {
  return new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}
