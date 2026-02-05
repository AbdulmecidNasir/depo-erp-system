import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import CategorySidebarWithBrands from '../Common/CategorySidebarWithBrands';
import { ArrowLeft, Search, Check, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

// Helper function for direct API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    console.error('API Error:', response.status, errorData);
    throw new Error(errorData.message || 'Request failed');
  }

  return response.json();
}

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
  barcode?: string;
}

interface Location {
  _id?: string;
  id?: string;
  name: string;
  code: string;
  zone?: string;
}

interface MovementItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  notes: string;
  fromLocation: string;
  toLocation: string;
  movementType: 'out' | 'transfer';
}

const AddMovementPage: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [movementItems, setMovementItems] = useState<MovementItem[]>([]);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftBatchNumber, setDraftBatchNumber] = useState<string | null>(null);
  const [movementStatus, setMovementStatus] = useState<'draft' | 'completed'>('draft');
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showCategoriesMobile, setShowCategoriesMobile] = useState(false);

  // Sidebar
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // New state for location-first workflow
  const [selectedFromLocation, setSelectedFromLocation] = useState<string>('');
  const [selectedToLocation, setSelectedToLocation] = useState<string>('');
  const [movementId, setMovementId] = useState<string>('');

  useEffect(() => {
    fetchProducts();
    fetchLocations();
    fetchCategories();

    // Check if draft data was passed via navigation state (from handleEditDraft)
    const state = location.state as any;
    if (state?.draftData) {
      const { items, fromLocation, toLocation, batchNumber, status } = state.draftData;
      setMovementItems(Array.isArray(items) ? items : []);
      setSelectedFromLocation(fromLocation || '');
      setSelectedToLocation(toLocation || '');
      setMovementId(batchNumber || '');
      setIsEditingDraft(true);
      setDraftBatchNumber(batchNumber);
      setMovementStatus(status || 'draft');
      const statusText = status === 'completed' ? 'перемещения' : 'черновика';
      setSuccess(`Редактирование ${statusText} № ${batchNumber}`);
      // Clear the state to prevent reloading on refresh
      window.history.replaceState({}, document.title);
      return;
    }

    // Load draft by ID if provided in URL (?draft=ID or ?batch=ID)
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get('draft') || params.get('batch') || '';
    if (draftId) {
      fetchDraftFromApi(draftId);
    }
  }, [location.state]);

  const fetchDraftFromApi = async (batchId: string) => {
    try {
      const response = await api.stockMovements.getAll({
        search: batchId,
        type: 'transfer',
        limit: 100
      } as any);

      if (response.success && response.data.length > 0) {
        const draftItems = response.data.filter((m: any) =>
          String(m.batchNumber) === batchId || String(m.movementId) === batchId
        );

        if (draftItems.length > 0) {
          setDraftBatchNumber(batchId);
          setMovementId(batchId);

          if (draftItems[0].fromLocation) setSelectedFromLocation(draftItems[0].fromLocation);
          if (draftItems[0].toLocation) setSelectedToLocation(draftItems[0].toLocation);

          const mappedItems: MovementItem[] = draftItems.map((m: any) => ({
            id: m._id || m.id || Math.random().toString(),
            productId: typeof m.productId === 'object' ? m.productId._id : m.productId,
            product: typeof m.productId === 'object' ? m.productId : { _id: m.productId, nameRu: 'Unknown', brand: '', model: '', category: '', stock: 0, purchasePrice: 0, salePrice: 0, location: '' },
            quantity: m.quantity,
            notes: m.notes || '',
            fromLocation: m.fromLocation,
            toLocation: m.toLocation,
            movementType: 'transfer'
          }));

          setMovementItems(mappedItems);
          setMovementStatus('draft');
          setSuccess(`Черновик загружен: ${batchId}`);
        }
      }
    } catch (err) {
      console.error('Error loading draft from API:', err);
      setError('Не удалось загрузить черновик');
    }
  };

  // Auto-clear location selection error once both locations are chosen
  useEffect(() => {
    if (selectedFromLocation && selectedToLocation) {
      setError((prev) => {
        if (!prev) return prev;
        const p = String(prev).toLowerCase();
        return p.includes('локац') ? null : prev;
      });
    }
  }, [selectedFromLocation, selectedToLocation]);

  // Auto-open categories on mobile once both locations are selected (first time)
  useEffect(() => {
    if (selectedFromLocation && selectedToLocation) {
      if (typeof window !== 'undefined' && window.innerWidth < 768 && !showCategoriesMobile && movementItems.length === 0) {
        setShowCategoriesMobile(true);
      }
    }
  }, [selectedFromLocation, selectedToLocation]);

  const fetchProducts = async (search: string = '') => {
    try {
      const params: any = { limit: 100 };
      if (search) params.search = search;
      // if (category) params.category = category; // Decoupled: Search is global

      const response = await api.products.getAll(params);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchCategoryProducts = async (categoryId: string) => {
    try {
      const response = await api.products.getAll({
        limit: 100,
        category: categoryId
      });
      setCategoryProducts(response.data);
    } catch (error) {
      console.error('Error fetching category products:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.locations.getAll();
      setLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      // Use the same canonical source as the rest of the app
      const res = await api.products.getCategories();
      if (res.success && res.data) {
        const items = Object.entries(res.data as Record<string, string>).map(([slug, name]) => ({
          id: slug,
          name
        }));
        setCategories(items);
        return;
      }

      // Fallback to categories service (array shape) if needed
      const fallback = await api.categories.getAll();
      if (fallback.success) {
        const arr = (fallback.categories || fallback.data || []) as Array<any>;
        const items = arr
          .map(c => ({
            id: c.slug || c.id,
            name: c.nameRu || c.name
          }))
          .filter(c => c.id && c.name);
        setCategories(items);
        return;
      }

      // Final minimal fallback: empty list
      setCategories([]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.nameRu.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.model.toLowerCase().includes(productSearch.toLowerCase()) ||
      (product.productId && product.productId.includes(productSearch)) ||
      (product.barcode && product.barcode.includes(productSearch));

    // const matchesCategory = selectedCategory ? product.category === selectedCategory : true; // Decoupled

    return matchesSearch;
  });

  const addProductToMovement = (product: Product) => {
    if (!selectedFromLocation || !selectedToLocation) {
      setError('Сначала выберите локации (Откуда и Куда)');
      return;
    }

    const pid = product._id || product.id || '';

    setMovementItems(prev => {
      const index = prev.findIndex(item => item.productId === pid);
      if (index !== -1) {
        const updated = [...prev];
        const currentQty = Number(updated[index].quantity || 0);
        updated[index] = { ...updated[index], quantity: currentQty + 1 };
        return updated;
      }

      const newItem: MovementItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: pid,
        product,
        quantity: 1,
        notes: '',
        fromLocation: selectedFromLocation,
        toLocation: selectedToLocation,
        movementType: 'transfer'
      };
      return [...prev, newItem];
    });
    setProductSearch('');
    setShowProductSearch(false);
  };

  const removeItem = (id: string) => {
    setMovementItems(movementItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof MovementItem, value: any) => {
    const updatedItems = movementItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setMovementItems(updatedItems);
  };

  const handleSubmit = async () => {
    if (movementItems.length === 0) {
      setError('Добавьте хотя бы один товар');
      return;
    }

    // Validate all items
    for (const item of movementItems) {
      if (!item.fromLocation || !item.toLocation) {
        setError(`Укажите обе локации (Откуда и Куда) для товара: ${item.product.nameRu}`);
        return;
      }
      if (item.fromLocation === item.toLocation) {
        setError(`Локации Откуда и Куда не должны совпадать для товара: ${item.product.nameRu}`);
        return;
      }
      if (item.quantity <= 0) {
        setError(`Укажите количество больше 0 для товара: ${item.product.nameRu}`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const generatedId = movementId || Math.floor(100000 + Math.random() * 900000).toString();
      setMovementId(generatedId);

      const movements = movementItems.map(item => ({
        productId: item.productId,
        type: 'transfer' as const,
        quantity: item.quantity,
        fromLocation: item.fromLocation,
        toLocation: item.toLocation,
        reason: item.notes || 'Перемещение товара',
        timestamp: new Date().toISOString(),
        batchNumber: generatedId,
        notes: item.notes
      }));

      console.log('Sending movements with batchNumber:', generatedId, movements);
      const response = await apiRequest('/stock-movements/bulk', {
        method: 'POST',
        body: JSON.stringify({ movements })
      });
      console.log('Response:', response);

      setSuccess(`Успешно создано ${movements.length} движений с группой: ${generatedId}`);
      setMovementItems([]);

      setTimeout(() => {
        navigate('/movements');
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Ошибка при создании движений');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save current form as draft to API and optionally navigate away
  const saveDraft = async (navigateAfterSave: boolean = false) => {
    try {
      const generatedBatch = movementId || Math.floor(100000 + Math.random() * 900000).toString();
      setMovementId(generatedBatch);

      // If we are updating an existing draft, delete old items first to avoid duplicates
      if (draftBatchNumber) {
        await apiRequest(`/stock-movements/batch/${draftBatchNumber}`, {
          method: 'DELETE'
        });
      }

      const movements = movementItems.map(item => ({
        productId: item.productId,
        type: 'transfer' as const,
        quantity: item.quantity,
        fromLocation: item.fromLocation,
        toLocation: item.toLocation,
        reason: item.notes || 'Перемещение товара (Черновик)',
        timestamp: new Date().toISOString(),
        batchNumber: generatedBatch,
        notes: item.notes,
        status: 'draft' as const
      }));

      const response = await api.stockMovements.bulk(movements);

      if (response.success) {
        setSuccess(`Сохранен черновик № ${generatedBatch}`);
        setDraftBatchNumber(generatedBatch);
        if (navigateAfterSave) {
          setShowLeaveConfirm(false);
          // Navigate back to movements list
          navigate('/movements');
        }
      }
    } catch (e: any) {
      console.error(e);
      setError('Не удалось сохранить черновик: ' + (e.message || 'Unknown error'));
    }
  };

  // Complete draft or update existing movement
  const completeDraft = async () => {
    if (!draftBatchNumber) {
      setError('Номер перемещения не найден');
      return;
    }

    if (movementItems.length === 0) {
      setError('Добавьте хотя бы один товар');
      return;
    }

    // Validate all items
    for (const item of movementItems) {
      if (!item.fromLocation || !item.toLocation) {
        setError(`Укажите обе локации (Откуда и Куда) для товара: ${item.product.nameRu}`);
        return;
      }
      if (item.fromLocation === item.toLocation) {
        setError(`Локации Откуда и Куда не должны совпадать для товара: ${item.product.nameRu}`);
        return;
      }
      if (item.quantity <= 0) {
        setError(`Укажите количество больше 0 для товара: ${item.product.nameRu}`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (movementStatus === 'draft') {
        // Complete draft movements
        const response = await apiRequest(`/stock-movements/batch/${draftBatchNumber}/complete`, {
          method: 'PUT'
        });

        if (response) {
          setSuccess(`Черновик № ${draftBatchNumber} успешно завершен`);
          setMovementItems([]);
          setIsEditingDraft(false);
          setDraftBatchNumber(null);

          setTimeout(() => {
            navigate('/movements');
          }, 2000);
        }
      } else {
        // Update completed movements - delete old and create new
        // First delete the old batch
        await apiRequest(`/stock-movements/batch/${draftBatchNumber}`, {
          method: 'DELETE'
        });

        // Then create new movements
        const movements = movementItems.map(item => ({
          productId: item.productId,
          type: 'transfer' as const,
          quantity: item.quantity,
          fromLocation: item.fromLocation,
          toLocation: item.toLocation,
          reason: item.notes || 'Перемещение товара',
          timestamp: new Date().toISOString(),
          batchNumber: draftBatchNumber,
          notes: item.notes,
          status: 'completed' as const
        }));

        const response = await apiRequest('/stock-movements/bulk', {
          method: 'POST',
          body: JSON.stringify({ movements })
        });

        if (response) {
          setSuccess(`Перемещение № ${draftBatchNumber} успешно обновлено`);
          setMovementItems([]);
          setIsEditingDraft(false);
          setDraftBatchNumber(null);

          setTimeout(() => {
            navigate('/movements');
          }, 2000);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка при сохранении изменений');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle back navigation with confirm if there are unsaved changes
  const handleBackClick = () => {
    const hasUnsaved = movementItems.length > 0;
    if (!hasUnsaved) {
      navigate('/movements');
      return;
    }
    setShowLeaveConfirm(true);
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
                onClick={handleBackClick}
                className={`p-2 rounded-lg transition-colors duration-300 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600'
                  }`}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                  Добавить движение товара
                </h1>
                <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  Создание перемещений товаров между складами
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {movementId && (
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('draft', movementId);
                    navigator.clipboard?.writeText(url.toString()).catch(() => { });
                    setSuccess(`Ссылка на черновик скопирована: ${movementId}`);
                  }}
                  className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                  title="Скопировать ссылку на черновик"
                >
                  ID: {movementId}
                </button>
              )}
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Товаров: {movementItems.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowLeaveConfirm(false)}>
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
                onClick={() => { setShowLeaveConfirm(false); navigate('/movements'); }}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
              >
                Не сохранять
              </button>
              <button
                onClick={() => saveDraft(true)}
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
        {(selectedFromLocation && selectedToLocation) && (
          <aside className={`w-80 flex-shrink-0 border-r overflow-y-auto transition-colors duration-300 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
            }`}>
            <div className="p-4">
              <CategorySidebarWithBrands
                title="CATEGORIES"
                items={categories}
                activeId={selectedCategory || undefined}
                onSelect={(id) => {
                  setSelectedCategory(id);
                  fetchCategoryProducts(id);
                }}
                isDark={isDark}
                products={categoryProducts}
                onProductSelect={(product) => addProductToMovement(product)}
              />
            </div>
          </aside>
        )}

        {/* Main Content Area - Frame 676 */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Step 1: Location Selection */}
              <div
                className={`rounded-lg shadow-md p-6 h-fit ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Выберите склады (Откуда и Куда)
                  </h2>
                </div>
                <div className="space-y-4">
                  {/* From Location */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Откуда (Nereden)
                    </label>
                    <select
                      value={selectedFromLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedFromLocation(val);
                        if (selectedToLocation === val) {
                          setSelectedToLocation('');
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                        }`}
                      required
                    >
                      <option value="">Выберите локацию</option>
                      {locations.map((location) => (
                        <option key={location._id || location.id || location.code} value={location.code}>
                          {location.name} ({location.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* To Location */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Куда (Nereye)
                    </label>
                    <select
                      value={selectedToLocation}
                      onChange={(e) => setSelectedToLocation(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                        }`}
                      required
                      disabled={!selectedFromLocation}
                    >
                      <option value="">Выберите локацию</option>
                      {locations
                        .filter((location) => location.code !== selectedFromLocation)
                        .map((location) => (
                          <option key={location._id || location.id || location.code} value={location.code}>
                            {location.name} ({location.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 2: Product Search */}
              <div className={`rounded-lg shadow-md p-6 h-fit ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Выберите товары для перемещения
                  </h2>
                </div>

                <div className="relative mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        disabled={!selectedFromLocation || !selectedToLocation}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductSearch(true);
                          fetchProducts(e.target.value);
                        }}
                        placeholder={(!selectedFromLocation || !selectedToLocation) ? "Сначала выберите склады (Откуда и Куда)" : "Поиск товара..."}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                          ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  {/* Product Dropdown Results */}
                  {showProductSearch && (productSearch || selectedCategory) && (
                    <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}>
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <button
                            key={product._id || product.id || product.barcode || `${product.nameRu}`}
                            onClick={() => addProductToMovement(product)}
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

            {/* Movement Items List */}
            {movementItems.length > 0 && (
              <div className={`rounded-lg shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Товары для перемещения ({movementItems.length})
                  </h2>
                  <button
                    onClick={() => setMovementItems([])}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Очистить все
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <tr>
                        <th className={`px-3 py-2 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Товар</th>
                        <th className={`px-3 py-2 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>ID/ШК</th>
                        <th className={`px-3 py-2 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Кол-во</th>
                        <th className={`px-3 py-2 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Примечания</th>
                        <th className={`px-3 py-2 text-center text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementItems.map((item) => (
                        <tr key={item.id} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <td className="px-3 py-2">
                            <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {item.product.nameRu}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {item.product.brand} {item.product.model}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              <div>ID: {item.product.productId || item.product._id}</div>
                              <div>ШК: {item.product.barcode || 'N/A'}</div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.product.stock}
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                              className={`w-16 px-2 py-1 text-sm border rounded ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                              placeholder="..."
                              className={`w-full px-2 py-1 text-xs border rounded ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 rounded hover:bg-red-50"
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                }`}>
                <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-800'}`}>
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                }`}>
                <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                  {success}
                </p>
              </div>
            )}

            {/* Submit Button Area - Now at bottom of content */}
            <div className="mt-6 flex justify-end">
              {isEditingDraft ? (
                <button
                  onClick={completeDraft}
                  disabled={movementItems.length === 0 || isSubmitting}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{movementStatus === 'completed' ? 'Обновление...' : 'Завершение...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{movementStatus === 'completed' ? 'Сохранить изменения' : 'Завершить черновик'}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={movementItems.length === 0 || isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Создание...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Создать движения</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AddMovementPage;
