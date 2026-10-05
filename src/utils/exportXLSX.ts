// ===================================================
// HELPER EXPORT XLSX MULTI-SHEET
// Tanpa library — pakai format XML Spreadsheet 2003
// File .xls bisa dibuka di Excel, LibreOffice, Google Sheets
// ===================================================

export interface XLSXSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export function exportMultiSheetXLSX(filename: string, sheets: XLSXSheet[]) {
  const escapeXml = (str: string | number) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const buildSheet = (sheet: XLSXSheet) => {
    const headerRow = `<Row>${sheet.headers
      .map(h => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
      .join('')}</Row>`;

    const dataRows = sheet.rows
      .map(row => {
        const cells = row
          .map(cell => {
            const type = typeof cell === 'number' && !isNaN(cell as number) ? 'Number' : 'String';
            return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
          })
          .join('');
        return `<Row>${cells}</Row>`;
      })
      .join('');

    return `<Worksheet ss:Name="${escapeXml(sheet.name)}">
      <Table>
        ${headerRow}
        ${dataRows}
      </Table>
    </Worksheet>`;
  };

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="sHeader">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
  </Styles>
  ${sheets.map(buildSheet).join('')}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
