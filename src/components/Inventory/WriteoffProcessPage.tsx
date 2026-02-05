import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import {
  ArrowLeft,
  Search,
  Check,
  X,
  Save,
  MapPin
} from 'lucide-react';

import CategorySidebarWithBrands from '../Common/CategorySidebarWithBrands';

interface Product {
  _id?: string;
  id?: string;
  productId?: string;
  nameRu: string;
  brand: string;
  model: string;
  category: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  location: string;
}

interface Location {
  _id: string;
  name: string;
  code: string;
}

interface WriteoffItem {
  productId: string;
  product: Product;
  quantity: number;
  notes: string;
  fromLocation: string;
}

const WriteoffProcessPage: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const draftBatchId = searchParams.get('batch');
  const [items, setItems] = useState<WriteoffItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categories sidebar
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');


  const [selectedFromLocation, setSelectedFromLocation] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [generalNote, setGeneralNote] = useState<string>('');

  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showCategoriesMobile, setShowCategoriesMobile] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchCategories();


    if (draftBatchId) {
      fetchDraftFromApi(draftBatchId);
    }
  }, [draftBatchId]);

  const fetchDraftFromApi = async (batchId: string) => {
    try {
      const response = await api.stockMovements.getAll({
        search: batchId,
        type: 'out',
        limit: 100
      } as any);

      if (response.success && response.data.length > 0) {
        const draftItems = response.data.filter((m: any) =>
          String(m.batchNumber) === batchId || String(m.movementId) === batchId
        );

        if (draftItems.length > 0) {
          setBatchNumber(batchId);
          setSelectedFromLocation(draftItems[0].fromLocation || '');

          const mappedItems: WriteoffItem[] = draftItems.map((m: any) => ({
            productId: typeof m.productId === 'object' ? m.productId._id : m.productId,
            product: typeof m.productId === 'object' ? m.productId : { _id: m.productId, nameRu: 'Unknown' },
            quantity: m.quantity,
            notes: m.notes || '',
            fromLocation: m.fromLocation
          }));

          setItems(mappedItems);
          // Set general note from the first item if available
          if (draftItems[0].notes) {
            setGeneralNote(draftItems[0].notes);
          }
        }
      }
    } catch (err) {
      console.error('Error loading draft from API:', err);
      setError('Не удалось загрузить черновик');
    }
  };

  const fetchCategories = async () => {
    try {
      const mapRes: any = await api.products.getCategories();
      if (mapRes?.success && mapRes.data) {
        setCategoriesMap(mapRes.data as Record<string, string>);
        return;
      }
    } catch { }
    try {
      const categoriesRes: any = await api.categories.getAll();
      if (categoriesRes?.success) {
        const arr = (categoriesRes.categories || categoriesRes.data || []) as Array<any>;
        const mapped = arr.reduce((acc: Record<string, string>, c: any) => {
          const key = c.slug || c.id;
          const val = c.nameRu || c.name;
          if (key && val) acc[key] = val;
          return acc;
        }, {});
        setCategoriesMap(mapped);
      }
    } catch { }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.locations.getAll();
      if (response.success) {
        setLocations(response.data);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchProducts = async (search: string) => {
    try {
      const productIdParam = /^\d{6}$/.test((search || '').trim()) ? (search || '').trim() : undefined;
      const response = await api.products.getAll({
        page: 1,
        limit: 100,
        search,
        productId: productIdParam,
        // category: selectedCategory || undefined // Decoupled: Search is global
      });
      if (response.success) {
        const items = Array.isArray(response.data) ? response.data : [];
        const normalized = items.map((p: any, idx: number) => ({
          ...p,
          _id: p._id || p.id || p.productId || `p_${idx}_${Date.now()}`
        }));
        setProducts(normalized);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Re-fetch products when category changes - REMOVED for separation
  // useEffect(() => {
  //   if (selectedCategory) {
  //     fetchProducts(productSearch);
  //     setShowProductSearch(true);
  //   }
  // }, [selectedCategory]);

  const fetchCategoryProducts = async (categoryId: string) => {
    try {
      const response = await api.products.getAll({
        page: 1,
        limit: 100,
        category: categoryId
      });
      if (response.success) {
        const items = Array.isArray(response.data) ? response.data : [];
        const normalized = items.map((p: any, idx: number) => ({
          ...p,
          _id: p._id || p.id || p.productId || `p_${idx}_${Date.now()}`
        }));
        setCategoryProducts(normalized);
      }
    } catch (err) {
      console.error('Error fetching category products:', err);
    }
  };

  const addProduct = (product: Product) => {
    const productId = (product as any)._id || (product as any).id || (product as any).productId;
    if (!productId) return;

    setItems(prev => {
      const existingItem = prev.find(i => i.productId === productId);
      if (existingItem) {
        // If item exists, increment quantity
        return prev.map(i =>
          i.productId === productId
            ? { ...i, quantity: (i.quantity || 0) + 1 }
            : i
        );
      }
      // If item does not exist, add new item
      return [...prev, {
        productId,
        product,
        quantity: 1, // Start with 1 instead of 0 for better UX
        notes: '',
        fromLocation: selectedFromLocation
      }];
    });
    setShowProductSearch(false);
    setProductSearch('');
  };

  const removeItem = (productId: string) => setItems(prev => prev.filter(i => i.productId !== productId));
  const updateItem = (productId: string, field: keyof WriteoffItem, value: any) => {
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, [field]: value } : i));
  };

  const saveDraft = async () => {
    if (!selectedFromLocation) {
      setError('Выберите локацию перед сохранением');
      return;
    }

    if (items.length === 0) {
      setError('Нет товаров для сохранения');
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedBatch = batchNumber || Math.floor(100000 + Math.random() * 900000).toString();
      setBatchNumber(generatedBatch);

      const movements = items.map(i => ({
        productId: i.productId,
        type: 'out' as const,
        quantity: i.quantity,
        reason: 'Списание товара (Не завершено)',
        notes: generalNote, // Use general note for all items
        fromLocation: i.fromLocation || selectedFromLocation,
        batchNumber: generatedBatch,
        timestamp: new Date().toISOString(),
        status: 'draft' as const
      }));

      // Attach supplierId from product
      const movementsWithSupplier = movements.map((m) => {
        const prod = items.find((it) => it.productId === m.productId)?.product as any;
        return {
          ...m,
          supplierId: prod?.supplierId || prod?.supplier || undefined,
          supplierName: prod?.supplierName || prod?.supplier?.name || undefined,
        };
      });

      const res = await api.stockMovements.bulk(movementsWithSupplier as any);
      if (res.success) {
        alert(`Сохранено как "Не завершено". Группа: #${generatedBatch}`);
        alert(`Сохранено как "Не завершено". Группа: #${generatedBatch}`);
        navigate('/outgoing');
      }
    } catch (err: any) {
      console.error('Ошибка сохранения черновика:', err);
      const errorMsg = err.errors && Array.isArray(err.errors)
        ? err.errors.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ')
        : err.message || 'Не удалось сохранить черновик';
      setError(`Ошибка сохранения: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async () => {
    const valid = items.filter(i => i.quantity > 0);
    if (valid.length === 0) {
      setError('Укажите количество больше 0 для хотя бы одного товара');
      return;
    }
    setIsSubmitting(true);
    try {
      const generatedBatch = batchNumber || Math.floor(100000 + Math.random() * 900000).toString();
      setBatchNumber(generatedBatch);
      const movements = valid.map(i => ({
        productId: i.productId,
        type: 'out' as const,
        quantity: i.quantity,
        reason: 'Списание товара',
        notes: generalNote, // Use general note for all items
        fromLocation: i.fromLocation,
        batchNumber: generatedBatch,
        timestamp: new Date().toISOString(),
        status: 'completed' as const
      }));
      // Attach supplierId from product to reduce supplier debt accurately
      const movementsWithSupplier = movements.map((m) => {
        const prod = items.find((it) => it.productId === m.productId)?.product as any;
        return {
          ...m,
          supplierId: prod?.supplierId || prod?.supplier || undefined,
          supplierName: prod?.supplierName || prod?.supplier?.name || undefined,
        };
      });
      const res = await api.stockMovements.bulk(movementsWithSupplier as any);
      if (res.success) {
        // Real-time notify suppliers page to decrease debt
        try {
          movementsWithSupplier.forEach((m) => {
            const prod: any = items.find((it) => it.productId === m.productId)?.product || {};
            const amount = Math.max(0, Number((prod as any).purchasePrice || 0) * Number(m.quantity || 0));
            window.dispatchEvent(new CustomEvent('stock-movement:created', {
              detail: {
                type: 'out',
                supplierId: (m as any).supplierId,
                supplierName: (m as any).supplierName,
                qty: m.quantity,
                amount,
                date: new Date().toISOString(),
                product: {
                  name: (prod as any).nameRu,
                  brand: (prod as any).brand,
                  model: (prod as any).model,
                  purchasePrice: (prod as any).purchasePrice
                }
              }
            }));
          });
        } catch (e) { /* noop */ }

        alert(`Списание создано. Группа: #${generatedBatch}. Записей: ${valid.length}`);
        alert(`Списание создано. Группа: #${generatedBatch}. Записей: ${valid.length}`);
        navigate('/outgoing');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ошибка при создании списания');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (items.length > 0 || selectedFromLocation) {
      setShowExitConfirmation(true);
    } else {
      navigate('/outgoing');
    }
  };

  const handleExitWithoutSave = () => {
    setShowExitConfirmation(false);
    navigate('/outgoing');
  };

  const handleSaveAndExit = async () => {
    await saveDraft();
    setShowExitConfirmation(false);
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header Area - Frame 679 - Now Full Width at Top */}
      <header className={`flex-shrink-0 border-b transition-colors duration-300 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
        }`}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={goBack}
                className={`p-2 rounded-lg transition-colors duration-300 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600'
                  }`}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                  Списание товаров
                </h1>
                <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  Создание списания со склада
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Exit Confirmation Modal */}
      {showExitConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowExitConfirmation(false)}>
          <div
            className={`rounded-lg shadow-xl w-full max-w-md overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Сохранить изменения?</h3>
              <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                У вас есть несохраненные изменения. Сохранить как черновик перед уходом?
              </p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-3">
              <button
                onClick={handleExitWithoutSave}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
              >
                Не сохранять
              </button>
              <button
                onClick={handleSaveAndExit}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Сохранить и выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area - Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Area - Frame 675 */}
        {selectedFromLocation && (
          <aside className={`w-80 flex-shrink-0 border-r overflow-y-auto transition-colors duration-300 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
            }`}>
            <div className="p-4">
              <CategorySidebarWithBrands
                title="CATEGORIES"
                items={(Object.entries(categoriesMap).length ? Object.entries(categoriesMap).map(([id, name]) => ({ id, name })) : [
                  'Computers', 'Laptops', 'Servers', 'Processors', 'RAM', 'Storage', 'Graphic Cards', 'Motherboards', 'Power Supplies', 'Cooling Systems', 'Cases', 'Monitors', 'Mice', 'Headphones', 'Keyboards', 'Microphones', 'Mouse Pads', 'Printers'
                ].map((n, i) => ({ id: String(i), name: n }))) as any}
                activeId={selectedCategory}
                onSelect={(id) => {
                  setSelectedCategory(id);
                  fetchCategoryProducts(id);
                }}
                isDark={isDark}
                products={categoryProducts}
                onProductSelect={(product) => addProduct(product)}
              />
            </div>
          </aside>
        )}

        {/* Main Content Area - Frame 676 */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Step 1: Location Selection */}
              <div className={`rounded-lg shadow-md p-6 h-fit ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Выберите склад
                  </h2>
                  {/* Mobile trigger to open categories (only when location selected) */}
                  {selectedFromLocation && (
                    <button
                      type="button"
                      onClick={() => setShowCategoriesMobile(true)}
                      className={`md:hidden px-3 py-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                    >
                      Категории
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {/* From Location */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="inline-flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        Локация (Откуда списываем)
                      </span>
                    </label>
                    <select
                      value={selectedFromLocation}
                      onChange={(e) => setSelectedFromLocation(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-300 ${isDark
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                        }`}
                      required
                    >
                      <option key="select-location" value="">Выберите локацию</option>
                      {locations.map((location, index) => {
                        const key = `location-${String((location as any).code || (location as any)._id || (location as any).id || index)}`;
                        const value = String((location as any).code || (location as any)._id || (location as any).id || '');
                        const labelCode = (location as any).code || (location as any)._id || (location as any).id || '';
                        return (
                          <option key={key} value={value}>
                            {location.name} {labelCode ? `(${labelCode})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 2: Product Search */}
              <div className={`rounded-lg shadow-md p-6 h-fit ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Выберите товары для списания
                  </h2>
                </div>

                <div className="relative mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => {
                          const q = e.target.value;
                          setProductSearch(q);
                          setShowProductSearch(true);
                          if ((q || '').trim().length > 0) {
                            fetchProducts(q);
                          } else {
                            setProducts([]);
                          }
                        }}
                        disabled={!selectedFromLocation}
                        placeholder={selectedFromLocation ? "Поиск товара..." : "Выберите локацию..."}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${isDark
                          ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                          } ${!selectedFromLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Product Dropdown Results */}
                  {showProductSearch && (productSearch || selectedCategory) && (
                    <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}>
                      {products.length > 0 ? (
                        products.map((product) => (
                          <button
                            key={product._id || product.id || `${product.nameRu}`}
                            onClick={() => addProduct(product)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-b ${isDark ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-200'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{product.nameRu}</div>
                                <div className="text-sm text-gray-500">
                                  {product.brand} {product.model}
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                Остаток: {product.stock}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Товары не найдены
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Categories Overlay */}
            {showCategoriesMobile && selectedFromLocation && (
              <div
                className="md:hidden fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                onClick={() => setShowCategoriesMobile(false)}
              >
                <div
                  className={`rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Категории</h3>
                    <button
                      onClick={() => setShowCategoriesMobile(false)}
                      className={`px-2 py-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                      Закрыть
                    </button>
                  </div>
                  <div className="p-3 overflow-y-auto max-h-[80vh]">
                    <CategorySidebarWithBrands
                      title="CATEGORIES"
                      items={(Object.entries(categoriesMap).length ? Object.entries(categoriesMap).map(([id, name]) => ({ id, name })) : [
                        'Computers', 'Laptops', 'Servers', 'Processors', 'RAM', 'Storage', 'Graphic Cards', 'Motherboards', 'Power Supplies', 'Cooling Systems', 'Cases', 'Monitors', 'Mice', 'Headphones', 'Keyboards', 'Microphones', 'Mouse Pads', 'Printers'
                      ].map((n, i) => ({ id: String(i), name: n }))) as any}
                      activeId={selectedCategory}
                      onSelect={(id) => {
                        setSelectedCategory(id);
                        fetchProducts(productSearch);
                        setShowCategoriesMobile(false);
                      }}
                      isDark={isDark}
                      products={products}
                      onProductSelect={(product) => {
                        addProduct(product);
                        setShowCategoriesMobile(false);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Selected Items List */}
            {items.length > 0 && (
              <div className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`${isDark ? 'text-white' : 'text-gray-900'} text-base font-medium`}>Выбранные товары ({items.length})</h3>
                  <button onClick={() => setItems([])} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md">Удалить все</button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.productId || `it-${idx}`} className={`p-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className={`${isDark ? 'text-white' : 'text-gray-900'} text-sm font-medium`}>{it.product.nameRu}</div>
                          <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs`}>{it.product.brand} • {it.product.model}</div>
                        </div>
                        <button onClick={() => removeItem(it.productId)} className="text-red-600 hover:text-red-800"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={`${isDark ? 'text-gray-300' : 'text-gray-700'} block text-xs font-medium mb-1`}>Количество</label>
                          <input type="number" min="0" value={it.quantity === 0 ? '' : it.quantity} placeholder="0" onChange={(e) => updateItem(it.productId, 'quantity', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Note Field */}
                <div className="mt-4">
                  <label className={`${isDark ? 'text-gray-300' : 'text-gray-700'} block text-sm font-medium mb-1`}>
                    Общие примечания
                  </label>
                  <textarea
                    value={generalNote}
                    onChange={(e) => setGeneralNote(e.target.value)}
                    placeholder="Добавьте примечание ко всему списанию..."
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    rows={2}
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={submit} disabled={isSubmitting || items.every(i => i.quantity === 0)} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {isSubmitting ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Создание...</>) : (<><Check className="h-4 w-4" /> Создать списание</>)}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className={`rounded-lg p-4 border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                <div className={`${isDark ? 'text-red-400' : 'text-red-800'} text-sm`}>{error}</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default WriteoffProcessPage;
