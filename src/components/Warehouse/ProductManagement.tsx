import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  MapPin,
  Package,
  AlertTriangle,
  QrCode
} from 'lucide-react';
import { ExtendedProduct } from '../../types/warehouse';
import { exportProductsToExcel } from '../../utils/excelExport';
import { formatUZS } from '../../utils/currency';
import { useTheme } from '../../contexts/ThemeContext';
import { useSearch } from '../../contexts/SearchContext';
import AdvancedSearchModal from '../Search/AdvancedSearchModal';
import ProductFilterDropdown from '../Search/ProductFilterDropdown';

interface ProductManagementProps {
  products: ExtendedProduct[];
  onEditProduct?: (product: ExtendedProduct) => void;
  onDeleteProduct?: (productId: string, reason?: string) => void;
  categories: Record<string, string>;
}

const ProductManagement: React.FC<ProductManagementProps> = ({
  products,
  onEditProduct,
  onDeleteProduct,
  categories
}) => {
  // ... (rest of the component)

  console.log('ProductManagement loaded with products:', products);
  const { isDark } = useTheme();
  const { getActiveFilterCount, productFilters } = useSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const parseRuToDate = (val?: string): Date | null => {
    if (!val) return null;
    const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredProducts = products.filter(product => {
    const productId = product.productId || product.id.slice(-6);

    // Search query filter
    const matchesSearch = searchQuery === '' ||
      productId.includes(searchQuery) ||
      product.barcode.includes(searchQuery) ||
      product.nameRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((product.alternativeLocations || []).some(loc => loc.toLowerCase().includes(searchQuery.toLowerCase())));

    // Advanced filters
    const matchesName = !productFilters.name ||
      product.nameRu.toLowerCase().includes(productFilters.name.toLowerCase());

    const matchesProductId = !productFilters.productId ||
      productId.includes(productFilters.productId);

    const matchesBarcode = !productFilters.sku ||
      product.barcode.includes(productFilters.sku);

    const matchesCategory = !productFilters.category ||
      product.category === productFilters.category;

    const matchesSupplier = !productFilters.supplier || (() => {
      const supplierId = (product as any).supplierId || (product as any).supplier?.id || (product as any).supplier?._id || undefined;
      const supplierName = ((product as any).supplierName || (product as any).supplier?.name || '').toString().toLowerCase();
      const filterVal = productFilters.supplier?.toString().toLowerCase();
      return supplierId === productFilters.supplier || (!!filterVal && supplierName.includes(filterVal));
    })();

    const matchesPriceRange = (!productFilters.minPrice || product.salePrice >= Number(productFilters.minPrice)) &&
      (!productFilters.maxPrice || product.salePrice <= Number(productFilters.maxPrice));

    const matchesStockStatus = !productFilters.stockStatus || productFilters.stockStatus === 'all' ||
      (productFilters.stockStatus === 'inStock' && product.stock > product.minStock) ||
      (productFilters.stockStatus === 'lowStock' && product.stock <= product.minStock && product.stock > 0) ||
      (productFilters.stockStatus === 'outOfStock' && product.stock === 0);

    // Date range filter (createdAt between from..to inclusive)
    const productCreatedAt = new Date(product.createdAt);
    const from = parseRuToDate(productFilters.createdFrom);
    const to = parseRuToDate(productFilters.createdTo);
    const startOk = !from || productCreatedAt.getTime() >= new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const endOk = !to || productCreatedAt.getTime() <= new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();

    return matchesSearch && matchesName && matchesProductId && matchesBarcode &&
      matchesCategory && matchesSupplier && matchesPriceRange && matchesStockStatus && startOk && endOk;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    return a.nameRu.localeCompare(b.nameRu);
  });

  // Debug filters
  console.log('ProductFilters:', productFilters);
  console.log('Filtered products count:', filteredProducts.length);
  console.log('Total products count:', products.length);
  if (filteredProducts.length > 0) {
    console.log('First filtered product:', filteredProducts[0].nameRu);
  }

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportToExcel = async () => {
    try {
      setExportLoading(true);
      setExportError(null);

      await exportProductsToExcel(filteredProducts, categories, 'products');

      console.log('✅ Warehouse products exported to Excel successfully');
    } catch (error: any) {
      console.error('❌ Export failed:', error);
      setExportError(error.message || 'Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdvancedSearchModal />
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
            }`}>Управление товарами</h2>
          <div className={`mt-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
            <p>Всего товаров: <span className="font-semibold text-blue-600">{filteredProducts.length}</span></p>
            <p className="text-xs mt-1">
              в наличии: {filteredProducts.filter(p => p.isActive !== false).length} •
              Низкий остаток: {filteredProducts.filter(p => p.stock < p.minStock).length} •
              Нет в наличии: {filteredProducts.filter(p => p.stock === 0).length}
            </p>
          </div>
        </div>
        <div className="flex space-x-3 mt-4 lg:mt-0">
          <button
            onClick={exportToExcel}
            disabled={exportLoading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportLoading ? 'Экспорт...' : 'Экспорт'}
          </button>
        </div>
      </div>

      {/* Export Error Display */}
      {exportError && (
        <div className={`rounded-lg p-4 border transition-all duration-300 ${isDark
          ? 'bg-red-900/20 border-red-800'
          : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className={`transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-800'
              }`}>{exportError}</span>
          </div>
        </div>
      )}

      {/* Modern Search Section */}
      <div className={`rounded-xl shadow-lg p-6 transition-all duration-300 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
        <div className="relative max-w-2xl">
          <div className={`relative flex items-center rounded-xl border-2 transition-all duration-300 search-expand ${searchFocused
            ? `${isDark ? 'border-blue-500 shadow-glow' : 'border-blue-500 shadow-lg'}`
            : `${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`
            }`}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Поиск товаров по ID, названию, бренду, штрихкоду..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className={`flex-1 px-4 py-4 text-sm font-medium rounded-xl focus:outline-none transition-all duration-300 search-input-glow ${isDark
                ? 'bg-gray-700 text-white placeholder-gray-400'
                : 'bg-white text-gray-900 placeholder-gray-500'
                }`}
            />

            {/* Right Side Icons Container */}
            <div className="absolute right-3 flex items-center space-x-2">
              {/* Search Icon */}
              <div className={`flex items-center transition-all duration-300 ${searchFocused ? 'scale-110 search-icon-bounce' : 'scale-100'
                }`}>
                <Search className={`h-5 w-5 transition-colors duration-300 ${searchFocused
                  ? 'text-blue-500'
                  : isDark ? 'text-gray-500' : 'text-gray-400'
                  }`} />
              </div>

              {/* Filter Dropdown */}
              <ProductFilterDropdown />
            </div>
          </div>

          {/* Search Hint */}
          {searchFocused && (
            <div className={`mt-2 text-xs transition-all duration-300 animate-fade-in ${isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
              💡 Нажмите на иконку фильтра справа для расширенного поиска
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className={`rounded-lg shadow-md overflow-hidden transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y transition-colors duration-300 ${isDark ? 'divide-gray-700' : 'divide-gray-200'
            }`}>
            <thead className={`transition-colors duration-300 ${isDark ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  ID
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Товар
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Категория
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Локации
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Остаток (всего)
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Цены
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  ID / Штрихкод
                </th>
                {(onEditProduct || onDeleteProduct) && (
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y transition-colors duration-300 ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'
              }`}>
              {sortedProducts.map((product) => (
                <tr
                  key={product.id}
                  className={`transition-colors duration-200 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                        ID: {product.productId || product.id.slice(-6)}
                      </div>
                      <div className={`text-xs transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        #{product.barcode || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src={product.images[0]}
                        alt={product.nameRu}
                        className="h-12 w-12 rounded-lg object-cover mr-4"
                      />
                      <div>
                        <div
                          className={`text-sm font-medium transition-colors duration-300 cursor-pointer hover:underline ${isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          onClick={() => onEditProduct && onEditProduct(product)}
                          title={onEditProduct ? "Редактировать товар" : "Просмотр товара"}
                        >
                          {product.nameRu}
                        </div>
                        <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          {product.brand} • {product.model}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transition-colors duration-300 ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'
                      }`}>
                      {categories[product.category] || product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      <MapPin className={`h-4 w-4 mr-1 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const entries = Object.entries(((product as any).locationStock || {}) as Record<string, number>)
                            .filter(([name, qty]) => (name && (qty as any) > 0))
                            .slice(0, 4);
                          if (entries.length === 0) {
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {product.location}
                              </span>
                            );
                          }
                          return entries.map(([name, qty]) => (
                            <span key={name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-700'
                              }`}>
                              {name}: {qty}
                            </span>
                          ));
                        })()}
                        {Object.entries(((product as any).locationStock || {}) as Record<string, number>).filter(([name, qty]) => (name && (qty as any) > 0)).length > 4 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                            }`}>+{Object.entries(((product as any).locationStock || {}) as Record<string, number>).filter(([name, qty]) => (name && (qty as any) > 0)).length - 4}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${product.stock === 0 ? 'text-red-600' :
                          product.stock <= product.minStock ? 'text-orange-600' : 'text-gray-500'
                          }`}>
                          {product.stock} шт.
                        </span>
                        <span className="text-xs text-gray-500">
                          мин: {product.minStock}
                        </span>
                      </div>
                      {product.stock <= product.minStock && (
                        <AlertTriangle className="h-4 w-4 text-orange-500 ml-2" />
                      )}
                    </div>
                    {/* Per-location breakdown removed by request; show only total */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="text-gray-500">
                        Закупка: {formatUZS(product.purchasePrice)}
                      </div>
                      {((product as any).wholesalePrice ?? 0) > 0 && (
                        <div className="text-gray-500">
                          Опт: {formatUZS((product as any).wholesalePrice)}
                        </div>
                      )}
                      <div className="font-medium text-gray-500">
                        Продажа: {formatUZS(product.salePrice)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <QrCode className="h-4 w-4 mr-1" />
                      {product.barcode}
                    </div>
                  </td>
                  {(onEditProduct || onDeleteProduct) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {onEditProduct && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Редактировать"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {onDeleteProduct && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const productName = product.nameRu || product.name || 'этот товар';
                              const confirmed = window.confirm(`Вы уверены, что хотите удалить «${productName}»?`);
                              if (!confirmed) return;
                              const reason = window.prompt('Пожалуйста, укажите причину удаления (обязательно):');
                              if (!reason || reason.trim() === '') {
                                alert('Удаление отменено: причина не указана.');
                                return;
                              }
                              const doubleConfirmed = window.confirm('Подтвердите удаление. Вы действительно хотите удалить товар?');
                              if (!doubleConfirmed) return;
                              onDeleteProduct(product.id, reason.trim());
                            }}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Товары не найдены</h3>
            <p className="mt-1 text-sm text-gray-500">
              Попробуйте изменить параметры поиска или добавить новый товар.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManagement;