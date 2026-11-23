import type { DB } from '../types';
import { downloadBlob } from './files';

/** Builds the month-end workbook and saves it. The Excel library is loaded only when needed. */
export async function downloadMonthExcel(db: DB, month: string) {
  const { buildMonthWorkbook, exportFileName } = await import('./monthExport');
  const wb = await buildMonthWorkbook(db, month);
  const buf = await wb.xlsx.writeBuffer();
  const name = exportFileName(db, month);
  downloadBlob(name, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  return name;
}
