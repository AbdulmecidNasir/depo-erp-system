import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Cpu,
  Laptop,
  Server,
  HardDrive,
  BatteryCharging,
  Snowflake,
  Box,
  Mouse,
  Headphones,
  Keyboard,
  Mic,
  Printer,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Package,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';

// Fallbacks for icons not existing in some lucide versions
const Icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Computers: Monitor,
  Laptops: Laptop,
  Servers: Server,
  Processors: Cpu,
  RAM: HardDrive,
  Storage: HardDrive,
  'Graphic Cards': Monitor,
  Motherboards: Cpu,
  'Power Supplies': BatteryCharging,
  'Cooling Systems': Snowflake,
  Cases: Box,
  Monitors: Monitor,
  Mice: Mouse,
  Headphones: Headphones,
  Keyboards: Keyboard,
  Microphones: Mic,
  'Mouse Pads': Mouse,
  Printers: Printer,
};

export type CategoryItem = {
  id: string;
  name: string;
};

interface Props {
  title?: string;
  items: CategoryItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  isDark?: boolean;
  products?: any[]; // Products array to extract brands from
  onProductSelect?: (product: any) => void; // Callback when product is selected
}

const CategorySidebarWithBrands: React.FC<Props> = ({
  title = 'CATEGORIES',
  items,
  activeId,
  onSelect,
  isDark,
  products = [],
  onProductSelect,
}) => {
  const { isDark: themeIsDark } = useTheme();
  const darkMode = isDark !== undefined ? isDark : themeIsDark;
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(activeId || null);
  const [categoryBrands, setCategoryBrands] = useState<Record<string, string[]>>({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [modalBrands, setModalBrands] = useState<string[]>([]);
  const [selectedBrandInModal, setSelectedBrandInModal] = useState<string>(''); // Selected brand in modal
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set()); // Selected products in modal
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Add "All Categories" option at the top
  const allCategoriesItem: CategoryItem = { id: '', name: 'Все категории' };
  const categoryItems = [allCategoriesItem, ...items];

  // Extract brands from products for each category
  useEffect(() => {
    if (products.length === 0) return;
    
    const brandsByCategory: Record<string, Set<string>> = {};
    
    products.forEach((product: any) => {
      const category = product.category || '';
      const brand = product.brand || '';
      
      if (category && brand) {
        if (!brandsByCategory[category]) {
          brandsByCategory[category] = new Set();
        }
        brandsByCategory[category].add(brand);
      }
    });

    const brandsMap: Record<string, string[]> = {};
    Object.keys(brandsByCategory).forEach(category => {
      brandsMap[category] = Array.from(brandsByCategory[category]).sort();
    });

    setCategoryBrands(brandsMap);
  }, [products]);


  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === '') {
      // "All Categories" selected - reset everything
      setSelectedCategory(null);
      onSelect && onSelect('');
      return;
    }

    setSelectedCategory(categoryId);
    onSelect && onSelect(categoryId);
  };

  const handleCategoryDoubleClick = async (categoryId: string) => {
    if (categoryId === '') return;
    
    setModalCategory(categoryId);
    setSelectedBrandInModal(''); // Reset brand selection
    setSelectedProducts(new Set()); // Reset selected products
    setProductSearchQuery(''); // Reset search
    setShowProductModal(true);
    
    // Load all products for this category
    await loadFilteredProducts(categoryId, [], 1, false);
  };


  const loadFilteredProducts = async (categoryId: string, brands: string[], page: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingProducts(true);
      setProductPage(1);
    }
    
    try {
      const filters: any = {
        category: categoryId,
        limit: 10000, // Load all products (up to 10000) to show all products for selected brand
        page: page,
      };
      
      // Add brand filter if provided
      if (brands.length > 0) {
        filters.brands = brands;
      }
      
      const response = await api.products.getAll(filters);
      if (response.success && response.data) {
        let productsToShow = response.data;
        
        // If single brand selected in modal, filter by that brand
        if (selectedBrandInModal && productsToShow.length > 0) {
          productsToShow = productsToShow.filter((p: any) => 
            (p.brand || '').toLowerCase() === selectedBrandInModal.toLowerCase()
          );
        }
        
        if (append) {
          // Append new products to existing list
          setFilteredProducts(prev => [...prev, ...productsToShow]);
        } else {
          // Replace with new products
          setFilteredProducts(productsToShow);
        }
        
        // Store total count for pagination
        if (response.pagination) {
          setProductTotal(response.pagination.total || 0);
        }
      }
    } catch (error) {
      console.error('Error loading filtered products:', error);
    } finally {
      setLoadingProducts(false);
      setLoadingMore(false);
    }
  };

  // Load products when brand changes in modal
  useEffect(() => {
    if (showProductModal && modalCategory) {
      loadFilteredProducts(modalCategory, selectedBrandInModal ? [selectedBrandInModal] : [], 1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandInModal, showProductModal, modalCategory]);

  const handleProductSelect = (product: any) => {
    if (onProductSelect) {
      onProductSelect(product);
    }
    setShowProductModal(false);
    setProductSearchQuery('');
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleApplySelectedProducts = () => {
    if (selectedProducts.size === 0) return;
    
    filteredProducts.forEach((product: any) => {
      const productId = product._id || product.id || product.productId;
      if (selectedProducts.has(productId) && onProductSelect) {
        onProductSelect(product);
      }
    });
    
    setShowProductModal(false);
    setSelectedProducts(new Set());
    setProductSearchQuery('');
    setSelectedBrandInModal('');
  };



  const baseText = darkMode ? 'text-gray-200' : 'text-gray-700';
  const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
  const activeBg = 'bg-gradient-to-r from-[#0D47A1] to-[#1565C0] text-white shadow-md';
  const selectedBrandBg = darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800';

  return (
    <div
      className={`rounded-lg border ${
        darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      } w-64`}
    >
      <div className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
        darkMode ? 'text-white' : 'text-gray-900'
      }`}>
        {title}
      </div>
      <div className="px-2 pb-3">
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          {categoryItems.map((c) => {
            const Icon = Icons[c.name] || ChevronRight;
            const active = selectedCategory === c.id;

            return (
              <div key={c.id}>
                <button
                  onClick={() => handleCategoryClick(c.id)}
                  onDoubleClick={() => handleCategoryDoubleClick(c.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
                    active ? activeBg : `${baseText} ${hoverBg}`
                  } ${active ? 'translate-x-0' : 'hover:translate-x-0.5'}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{c.name}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Selection Modal */}
      {showProductModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowProductModal(false)}
        >
          <div
            className={`rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              darkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Выбор товаров
                </h2>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Категория: {items.find(c => c.id === modalCategory)?.name || modalCategory}
                  {selectedProducts.size > 0 && (
                    <span className="ml-2 font-semibold">
                      • Выбрано: {selectedProducts.size}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setSelectedProducts(new Set());
                  setSelectedBrandInModal('');
                }}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Brand Filter and Search Bar */}
            <div className={`px-6 py-4 border-b space-y-3 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
              {/* Brand Selection */}
              {modalCategory && categoryBrands[modalCategory] && categoryBrands[modalCategory].length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Бренд:
                  </label>
                  <select
                    value={selectedBrandInModal}
                    onChange={(e) => setSelectedBrandInModal(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Все бренды</option>
                    {categoryBrands[modalCategory].map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Search Bar */}
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="Поиск товара по названию, модели..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className={`ml-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Загрузка товаров...
                  </span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className={`h-12 w-12 mx-auto mb-4 ${
                    darkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Товары не найдены
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProducts
                    .filter((product: any) => {
                      if (!productSearchQuery) return true;
                      const query = productSearchQuery.toLowerCase();
                      const name = (product.nameRu || product.name || '').toLowerCase();
                      const model = (product.model || '').toLowerCase();
                      const brand = (product.brand || '').toLowerCase();
                      return name.includes(query) || model.includes(query) || brand.includes(query);
                    })
                    .map((product: any) => {
                      const productId = product._id || product.id || product.productId;
                      const isSelected = selectedProducts.has(productId);
                      return (
                        <div
                          key={productId}
                          className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? darkMode
                                ? 'bg-blue-900/30 border-blue-500'
                                : 'bg-blue-50 border-blue-500'
                              : darkMode
                                ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-blue-500'
                                : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-500'
                          }`}
                          onClick={() => toggleProductSelection(productId)}
                        >
                          <div className="flex items-start gap-4">
                            {/* Checkbox space */}
                            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-1">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600'
                                  : darkMode
                                    ? 'border-gray-500'
                                    : 'border-gray-300'
                              }`}>
                                {isSelected && (
                                  <span className="text-white text-xs">✓</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Product Image */}
                            {(() => {
                              // Try different image field formats
                              let imageUrl = null;
                              
                              // First try product.image (single image string)
                              if (product.image && typeof product.image === 'string' && product.image.trim() !== '') {
                                imageUrl = product.image;
                              } 
                              // Then try product.images array
                              else if (product.images) {
                                if (Array.isArray(product.images) && product.images.length > 0) {
                                  // If array of objects with url property
                                  if (typeof product.images[0] === 'object' && product.images[0] !== null) {
                                    imageUrl = (product.images[0] as any).url || (product.images[0] as any).src;
                                  } 
                                  // If array of strings
                                  else if (typeof product.images[0] === 'string') {
                                    imageUrl = product.images[0];
                                  }
                                }
                                // If images is a string (single image)
                                else if (typeof product.images === 'string' && product.images.trim() !== '') {
                                  imageUrl = product.images;
                                }
                              }
                              
                              return imageUrl ? (
                                <>
                                  <img
                                    src={imageUrl}
                                    alt={product.nameRu || product.name}
                                    className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                                    onError={(e) => {
                                      const img = e.target as HTMLImageElement;
                                      img.style.display = 'none';
                                      const placeholder = img.nextElementSibling as HTMLElement;
                                      if (placeholder) {
                                        placeholder.classList.remove('hidden');
                                      }
                                    }}
                                  />
                                  <div className="hidden w-24 h-24 rounded-lg flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-600">
                                    <Package className={`h-10 w-10 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                  </div>
                                </>
                              ) : (
                                <div className={`w-24 h-24 rounded-lg flex-shrink-0 flex items-center justify-center ${
                                  darkMode ? 'bg-gray-600' : 'bg-gray-100'
                                }`}>
                                  <Package className={`h-10 w-10 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                </div>
                              );
                            })()}
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-medium mb-1 text-lg ${
                                darkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                {product.nameRu || product.name}
                              </h3>
                              <p className={`text-sm mb-2 ${
                                darkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {product.brand} {product.model ? `• ${product.model}` : ''}
                              </p>
                              <div className="flex items-center gap-4 text-sm">
                                <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>
                                  ID: {product.productId || product.id?.slice(-6) || '-'}
                                </span>
                                {product.stock !== undefined && (
                                  <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>
                                    Остаток: {product.stock} шт.
                                  </span>
                                )}
                                {product.purchasePrice && (
                                  <span className={`font-semibold ${
                                    darkMode ? 'text-green-400' : 'text-green-600'
                                  }`}>
                                    {product.purchasePrice.toLocaleString()} сум
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              
              {/* Show total count */}
              {!loadingProducts && filteredProducts.length > 0 && (
                <div className={`px-6 py-3 border-t text-center text-sm ${
                  darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
                }`}>
                  Показано: {filteredProducts.length} {productTotal > filteredProducts.length ? `из ${productTotal}` : ''} товаров
                </div>
              )}
            </div>

            {/* Footer with Apply Button */}
            <div className={`px-6 py-4 border-t flex items-center justify-between ${
              darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Выбрано товаров: <span className="font-semibold">{selectedProducts.size}</span>
              </div>
              <button
                onClick={handleApplySelectedProducts}
                disabled={selectedProducts.size === 0}
                className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  selectedProducts.size > 0
                    ? darkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    : darkMode
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Printer className="h-4 w-4" />
                Применить ({selectedProducts.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySidebarWithBrands;

