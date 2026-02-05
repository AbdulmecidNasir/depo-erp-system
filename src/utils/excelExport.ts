import ExcelJS from 'exceljs';
import { Product } from '../types';
import { ExtendedProduct } from '../types/warehouse';

// Professional Excel formatting configuration
const excelFormatting = {
  headers: {
    font: { 
      bold: true, 
      color: { argb: 'FFFFFFFF' },
      size: 10,
      name: 'Arial'
    },
    fill: { 
      type: 'pattern' as const, 
      pattern: 'solid' as const, 
      fgColor: { argb: 'FF4472C4' } // Professional blue
    },
    alignment: { 
      horizontal: 'center' as const, 
      vertical: 'middle' as const 
    },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    }
  },
  dataRows: {
    font: { 
      size: 10, 
      name: 'Arial' 
    },
    alignment: { 
      horizontal: 'left' as const, 
      vertical: 'middle' as const 
    },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } }
    }
  },
  alternatingRow: {
    fill: { 
      type: 'pattern' as const, 
      pattern: 'solid' as const, 
      fgColor: { argb: 'FFF8F9FA' } // Light gray
    }
  }
};

// Column definitions for different export types
const columnDefinitions = {
  products: [
    { key: 'productId', header: 'Product ID / ID товара', width: 12, alignment: 'center' },
    { key: 'nameRu', header: 'Product Name / Название товара', width: 35, alignment: 'left' },
    { key: 'brand', header: 'Brand / Бренд', width: 20, alignment: 'left' },
    { key: 'model', header: 'Model / Модель', width: 20, alignment: 'left' },
    { key: 'variant', header: 'Variant / Вариант', width: 15, alignment: 'left' },
    { key: 'category', header: 'Category / Категория', width: 20, alignment: 'left' },
    { key: 'subCategory', header: 'Sub Category / Подкатегория', width: 20, alignment: 'left' },
    { key: 'barcode', header: 'Barcode / Штрихкод', width: 18, alignment: 'left' },
    { key: 'qrCode', header: 'QR Code / QR код', width: 15, alignment: 'left' },
    { key: 'location', header: 'Main Location / Основное расположение', width: 20, alignment: 'left' },
    { key: 'alternativeLocations', header: 'Alternative Locations / Альтернативные расположения', width: 30, alignment: 'left' },
    { key: 'stock', header: 'Stock / Остаток', width: 12, alignment: 'center', type: 'number' },
    { key: 'minStock', header: 'Min Stock / Мин. остаток', width: 12, alignment: 'center', type: 'number' },
    { key: 'maxStock', header: 'Max Stock / Макс. остаток', width: 12, alignment: 'center', type: 'number' },
    { key: 'reservedStock', header: 'Reserved Stock / Зарезервированный остаток', width: 18, alignment: 'center', type: 'number' },
    { key: 'purchasePrice', header: 'Purchase Price / Цена закупки', width: 18, alignment: 'right', type: 'currency' },
    { key: 'salePrice', header: 'Sale Price / Цена продажи', width: 18, alignment: 'right', type: 'currency' },
    { key: 'supplierId', header: 'Supplier / Поставщик', width: 25, alignment: 'left' },
    { key: 'warrantyPeriod', header: 'Warranty Period / Гарантийный период', width: 18, alignment: 'center' },
    { key: 'isActive', header: 'Status / Статус', width: 12, alignment: 'center' },
    { key: 'createdAt', header: 'Date Added / Дата добавления', width: 18, alignment: 'center', type: 'date' },
    { key: 'updatedAt', header: 'Last Updated / Последнее обновление', width: 18, alignment: 'center', type: 'date' }
  ],
  warehouse: [
    { key: 'productId', header: 'Product ID / ID товара', width: 12, alignment: 'center' },
    { key: 'nameRu', header: 'Product Name / Название товара', width: 40, alignment: 'left' },
    { key: 'brand', header: 'Brand / Бренд', width: 20, alignment: 'left' },
    { key: 'model', header: 'Model / Модель', width: 20, alignment: 'left' },
    { key: 'barcode', header: 'Barcode / Штрихкод', width: 18, alignment: 'left' },
    { key: 'location', header: 'Main Location / Основное расположение', width: 20, alignment: 'left' },
    { key: 'alternativeLocations', header: 'Alternative Locations / Альтернативные расположения', width: 30, alignment: 'left' },
    { key: 'stock', header: 'Stock / Остаток', width: 12, alignment: 'center', type: 'number' },
    { key: 'minStock', header: 'Min Stock / Мин. остаток', width: 12, alignment: 'center', type: 'number' },
    { key: 'purchasePrice', header: 'Purchase Price / Цена закупки', width: 18, alignment: 'right', type: 'currency' },
    { key: 'salePrice', header: 'Sale Price / Цена продажи', width: 18, alignment: 'right', type: 'currency' },
    { key: 'supplierId', header: 'Supplier / Поставщик', width: 25, alignment: 'left' }
  ]
};

// Helper function to get cell alignment
const getAlignment = (alignment: string): 'left' | 'center' | 'right' => {
  switch (alignment) {
    case 'center': return 'center';
    case 'right': return 'right';
    default: return 'left';
  }
};

// Helper function to format cell value based on type
const formatCellValue = (value: any, type?: string): any => {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'currency':
      return typeof value === 'number' ? value : parseFloat(value) || 0;
    case 'number':
      return typeof value === 'number' ? value : parseInt(value) || 0;
    case 'date':
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;
      }
      return value;
    default:
      return value;
  }
};

// Main export function for products
export const exportProductsToExcel = async (
  products: (Product | ExtendedProduct)[],
  categories: Record<string, string> = {},
  exportType: 'products' | 'warehouse' = 'products'
): Promise<void> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product Inventory', {
      properties: { tabColor: { argb: 'FF4472C4' } }
    });

    const columns = columnDefinitions[exportType];
    
    // Set up columns
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width,
      style: {
        alignment: { horizontal: getAlignment(col.alignment) }
      }
    }));

    // Add header row with professional styling
    const headerRow = worksheet.getRow(1);
    headerRow.values = columns.map(col => col.header);
    headerRow.font = excelFormatting.headers.font;
    headerRow.fill = excelFormatting.headers.fill;
    headerRow.alignment = excelFormatting.headers.alignment;
    headerRow.border = excelFormatting.headers.border;
    headerRow.height = 22;

    // Add data rows with professional formatting
    products.forEach((product, index) => {
      const row = worksheet.addRow(
        columns.map(col => {
          let value = (product as any)[col.key];
          
          // Handle category mapping
          if (col.key === 'category' && categories[value]) {
            value = categories[value];
          }
          
          // Handle status based on stock
          if (col.key === 'isActive') {
            value = product.isActive ? 'Active / Активен' : 'Inactive / Неактивен';
          }
          
          // Handle arrays (like alternativeLocations)
          if (Array.isArray(value)) {
            value = value.join(', ');
          }
          
          return formatCellValue(value, col.type);
        })
      );

      // Apply alternating row colors
      if (index % 2 === 0) {
        row.fill = excelFormatting.alternatingRow.fill;
      }

      // Apply data row formatting
      row.font = excelFormatting.dataRows.font;
      row.alignment = excelFormatting.dataRows.alignment;
      row.border = excelFormatting.dataRows.border;
      row.height = 18;

      // Apply specific formatting based on column type
      columns.forEach((col, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        
        switch (col.type) {
          case 'currency':
            // Uzbek so'm, Cyrillic: сўм (Excel custom literal)
            cell.numFmt = '#,##0" сўм"';
            cell.alignment = { horizontal: 'right' };
            break;
          case 'number':
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'center' };
            break;
          case 'date':
            cell.numFmt = 'dd/mm/yyyy';
            cell.alignment = { horizontal: 'center' };
            break;
        }
      });
    });

    // Add filters to header row
    worksheet.autoFilter = {
      from: 'A1',
      to: `${String.fromCharCode(65 + columns.length - 1)}1`
    };

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add summary information
    worksheet.addRow([]);
    worksheet.addRow([]);
    const summaryRow3 = worksheet.addRow([
      'Export Summary:',
      `Total Products: ${products.length}`,
      `Export Date: ${new Date().toLocaleDateString('en-GB')}`,
      `Export Time: ${new Date().toLocaleTimeString()}`
    ]);
    
    summaryRow3.font = { bold: true, size: 10 };
    summaryRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Products_Export_${exportType}_${timestamp}.xlsx`;

    // Download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Excel export completed: ${filename}`);
    
  } catch (error) {
    console.error('❌ Excel export failed:', error);
    throw new Error('Failed to export Excel file. Please try again.');
  }
};

// Specialized export for warehouse dashboard
export const exportWarehouseToExcel = async (
  products: ExtendedProduct[],
  categories: Record<string, string> = {}
): Promise<void> => {
  return exportProductsToExcel(products, categories, 'warehouse');
};

// Export with custom options
export const exportToExcelWithOptions = async (
  data: any[],
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    alignment?: 'left' | 'center' | 'right';
    type?: 'text' | 'number' | 'currency' | 'date';
  }>,
  filename: string,
  sheetName: string = 'Data Export'
): Promise<void> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName, {
      properties: { tabColor: { argb: 'FF4472C4' } }
    });

    // Set up columns
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
      style: {
        alignment: { horizontal: getAlignment(col.alignment || 'left') }
      }
    }));

    // Add header row
    const headerRow = worksheet.getRow(1);
    headerRow.values = columns.map(col => col.header);
    headerRow.font = excelFormatting.headers.font;
    headerRow.fill = excelFormatting.headers.fill;
    headerRow.alignment = excelFormatting.headers.alignment;
    headerRow.border = excelFormatting.headers.border;
    headerRow.height = 22;

    // Add data rows
    data.forEach((item, index) => {
      const row = worksheet.addRow(
        columns.map(col => formatCellValue(item[col.key], col.type))
      );

      if (index % 2 === 0) {
        row.fill = excelFormatting.alternatingRow.fill;
      }

      row.font = excelFormatting.dataRows.font;
      row.alignment = excelFormatting.dataRows.alignment;
      row.border = excelFormatting.dataRows.border;
      row.height = 18;

      // Apply column-specific formatting
      columns.forEach((col, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        
        switch (col.type) {
          case 'currency':
            cell.numFmt = '#,##0" сўм"';
            cell.alignment = { horizontal: 'right' };
            break;
          case 'number':
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'center' };
            break;
          case 'date':
            cell.numFmt = 'dd/mm/yyyy';
            cell.alignment = { horizontal: 'center' };
            break;
        }
      });
    });

    // Add filters and freeze header
    worksheet.autoFilter = {
      from: 'A1',
      to: `${String.fromCharCode(65 + columns.length - 1)}1`
    };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Custom Excel export completed: ${filename}`);
    
  } catch (error) {
    console.error('❌ Custom Excel export failed:', error);
    throw new Error('Failed to export Excel file. Please try again.');
  }
};
