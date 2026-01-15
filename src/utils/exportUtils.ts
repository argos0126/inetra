import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ExportColumn {
  key: string;
  label: string;
}

interface ExportOptions {
  filename: string;
  title?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
}

// Helper to flatten nested objects for export
const flattenValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value instanceof Date) return format(value, 'yyyy-MM-dd HH:mm');
    // Handle nested objects with display_name or name property
    if (value.display_name) return value.display_name;
    if (value.name) return value.name;
    if (value.location_name) return value.location_name;
    if (value.transporter_name) return value.transporter_name;
    if (value.vehicle_number) return value.vehicle_number;
    if (value.trip_code) return value.trip_code;
    return JSON.stringify(value);
  }
  return String(value);
};

// Extract data for export based on columns
const extractExportData = (data: Record<string, any>[], columns: ExportColumn[]): string[][] => {
  return data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return flattenValue(value);
    })
  );
};

// Export to Excel
export const exportToExcel = ({ filename, title, columns, data }: ExportOptions): void => {
  const headers = columns.map(col => typeof col.label === 'string' ? col.label : col.key);
  const rows = extractExportData(data, columns);
  
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  const colWidths = columns.map((col, index) => {
    const maxLength = Math.max(
      headers[index].length,
      ...rows.map(row => (row[index] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title || 'Data');
  
  const exportFilename = `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, exportFilename);
};

// Export to PDF
export const exportToPDF = ({ filename, title, columns, data }: ExportOptions): void => {
  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Add title
  if (title) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${format(new Date(), 'PPpp')}`, 14, 22);
  }
  
  const headers = columns.map(col => typeof col.label === 'string' ? col.label : col.key);
  const rows = extractExportData(data, columns);
  
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 28 : 15,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    didDrawPage: (data) => {
      // Add page numbers
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    },
  });
  
  const exportFilename = `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(exportFilename);
};

// Export to CSV
export const exportToCSV = ({ filename, columns, data }: ExportOptions): void => {
  const headers = columns.map(col => typeof col.label === 'string' ? col.label : col.key);
  const rows = extractExportData(data, columns);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};
