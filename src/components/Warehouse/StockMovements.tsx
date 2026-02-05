import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightCircle,
  Settings,
  Calendar,
  User,
  Package,
  MapPin,
  AlertCircle,
  Trash2,
  Clock,
  X,
  Hash,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Check,
  Download
} from 'lucide-react';
import { StockMovement } from '../../types/warehouse';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { exportToExcelWithOptions } from '../../utils/excelExport';

interface StockMovementsProps {
  movements?: StockMovement[];
  onAddMovement?: (movement: any) => void;
}

const StockMovements: React.FC<StockMovementsProps> = ({ movements: propMovements, onAddMovement }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovement[]>(propMovements || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('transfer');
  // Установка дефолтных дат: сегодня
  const getDefaultTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };
  const [dateRange, setDateRange] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>(getDefaultTodayDate());
  const [endDate, setEndDate] = useState<string>(getDefaultTodayDate());
  const [showAddForm, setShowAddForm] = useState(false);
  // Month selector for 'month' period
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const goPrevMonth = () => {
    setSelectedMonth((m) => {
      if (m === 0) {
        setSelectedYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setSelectedMonth((m) => {
      if (m === 11) {
        setSelectedYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const goPrevYear = () => setSelectedYear((y) => y - 1);
  const goNextYear = () => setSelectedYear((y) => y + 1);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>('');
  // Filter states
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterFromWarehouse, setFilterFromWarehouse] = useState<string>('');
  const [filterToWarehouse, setFilterToWarehouse] = useState<string>('');
  const [warehouseValidationError, setWarehouseValidationError] = useState<string>('');
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [filteredProductsForDropdown, setFilteredProductsForDropdown] = useState<any[]>([]);
  // Поставщики удалены из формы
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [newMovement, setNewMovement] = useState({
    productId: '',
    quantity: 0,
    fromLocation: '',
    toLocation: '',
    notes: ''
  });

  // RU date input helpers for custom range
  const [ruStart, setRuStart] = useState<string>('');
  const [ruEnd, setRuEnd] = useState<string>('');
  const [calendarOpenFor, setCalendarOpenFor] = useState<'start' | 'end' | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  const isoToRu = (iso?: string): string => {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const [, y, mm, dd] = m;
    return `${dd}.${mm}.${y}`;
  };

  const ruDigitsToPretty = (digits: string): string => {
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}`;
    return formatted;
  };

  const ruToIsoIfComplete = (ru: string): string | '' => {
    const m = ru.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return '';
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    setRuStart(isoToRu(startDate));
    if (startDate) {
      const m = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) setCalendarMonth(new Date(Number(m[1]), Number(m[2]) - 1, 1));
    }
  }, [startDate]);
  useEffect(() => {
    setRuEnd(isoToRu(endDate));
  }, [endDate]);

  // Calendar helpers (RU)
  const parseRuToDate = (val?: string): Date | null => {
    if (!val) return null;
    const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  };
  const today = new Date();
  const startOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const endOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const days: Date[] = [];
  const firstWeekday = (startOfMonth.getDay() + 6) % 7; // Monday-first
  for (let i = 0; i < firstWeekday; i++) {
    days.push(new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate() - (firstWeekday - i)));
  }
  for (let d = 1; d <= endOfMonth.getDate(); d++) {
    days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
  }
  while (days.length % 7 !== 0 || days.length < 42) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  const setPickedDate = (which: 'start' | 'end', date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    const ru = `${dd}.${mm}.${yyyy}`;
    const iso = `${yyyy}-${mm}-${dd}`;
    if (which === 'start') {
      setRuStart(ru);
      setStartDate(iso);
    } else {
      setRuEnd(ru);
      setEndDate(iso);
    }
    setCalendarOpenFor(null);
  };

  // Handle date range preset selection
  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    const today = new Date();
    const start = new Date();

    switch (range) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        const weekStart = start.toISOString().split('T')[0];
        const weekEnd = today.toISOString().split('T')[0];
        setStartDate(weekStart);
        setEndDate(weekEnd);
        break;
      case 'month':
        // Default to current month
        const mStart = new Date(selectedYear, selectedMonth, 1);
        const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
        setStartDate(mStart.toISOString().split('T')[0]);
        setEndDate(mEnd.toISOString().split('T')[0]);
        break;
      case 'quarter':
        start.setMonth(today.getMonth() - 3);
        const quarterStart = start.toISOString().split('T')[0];
        const quarterEnd = today.toISOString().split('T')[0];
        setStartDate(quarterStart);
        setEndDate(quarterEnd);
        break;
      default:
        setStartDate('');
        setEndDate('');
    }
  };

  // Recompute dates when specific month/year is changed while 'month' preset is active
  useEffect(() => {
    if (dateRange !== 'month') return;
    const mStart = new Date(selectedYear, selectedMonth, 1);
    const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
    setStartDate(mStart.toISOString().split('T')[0]);
    setEndDate(mEnd.toISOString().split('T')[0]);
  }, [dateRange, selectedMonth, selectedYear]);

  // Determine default source location for a product: prefer location with the highest stock, otherwise use product.location
  const getDefaultFromLocation = (product: any | undefined): string => {
    if (!product) return '';
    const locStock: any = product.locationStock;
    try {
      if (locStock) {
        let entries: Array<[string, number]> = [];
        if (typeof locStock.entries === 'function') {
          entries = Array.from(locStock.entries());
        } else if (typeof locStock === 'object') {
          entries = Object.entries(locStock) as Array<[string, number]>;
        }
        if (entries.length > 0) {
          const best = entries.reduce((acc, cur) => (cur[1] > acc[1] ? cur : acc));
          if (best && best[1] > 0) return best[0];
        }
      }
    } catch { }
    return product.location || '';
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowUpCircle className="h-5 w-5 text-emerald-600" />;
      case 'out':
        return <ArrowDownCircle className="h-5 w-5 text-red-600" />;
      case 'transfer':
        return <ArrowRightCircle className="h-5 w-5 text-blue-600" />;
      case 'adjustment':
        return <Settings className="h-5 w-5 text-orange-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
  };

  const getMovementTypeText = (type: string) => {
    switch (type) {
      case 'in':
        return 'Поступление';
      case 'out':
        return 'Списание';
      case 'transfer':
        return 'Перемещение';
      case 'adjustment':
        return 'Корректировка';
      default:
        return 'Неизвестно';
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'in':
        return 'bg-emerald-100 text-emerald-800';
      case 'out':
        return 'bg-red-100 text-red-800';
      case 'transfer':
        return 'bg-blue-100 text-blue-800';
      case 'adjustment':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserDisplayName = (userId: string | { _id: string; firstName: string; lastName: string; email: string }) => {
    if (typeof userId === 'object' && userId) {
      return `${userId.firstName} ${userId.lastName}`;
    }
    return userId || 'Неизвестный пользователь';
  };

  const getProductDisplayName = (productId: string | { _id: string; nameRu: string; brand: string; model: string; location: string }) => {
    if (typeof productId === 'object' && productId) {
      return `${productId.nameRu} - ${productId.brand} ${productId.model}`;
    }
    return productId || 'Неизвестный товар';
  };

  const getProductIdValue = (productId: string | { _id?: string; id?: string }) => {
    if (typeof productId === 'object' && productId) {
      return (productId._id || (productId as any).id || '') as string;
    }
    return productId || '';
  };

  // Get product price from various sources
  const getProductPrice = (movement: StockMovement): number => {
    // First, try to get price from movement record (if stored during creation)
    const movementPrice = (movement as any).salePrice || (movement as any).purchasePrice || (movement as any).wholesalePrice;

    if (movementPrice && movementPrice > 0) {
      return movementPrice;
    }

    // If movement doesn't have price, try to get from populated product or products array
    let product = null;

    // Check if productId is already a populated object
    if (typeof movement.productId === 'object' && movement.productId && movement.productId !== null) {
      product = movement.productId;
      // Note: populated product from API might not have price fields due to field selection
      // So we still need to check products array
    }

    // Find product in products array by matching ID (this has full product data with prices)
    const productIdValue = getProductIdValue(movement.productId);

    if (productIdValue && products.length > 0) {
      // Try multiple matching strategies
      const foundProduct = products.find((p: any) => {
        const pId = p._id || p.id;
        const pIdStr = String(pId || '');
        const searchIdStr = String(productIdValue);

        // Direct match
        if (pId === productIdValue || pIdStr === searchIdStr) {
          return true;
        }

        // Try matching with ObjectId comparison
        if (pId && productIdValue && String(pId) === String(productIdValue)) {
          return true;
        }

        return false;
      });

      if (foundProduct) {
        product = foundProduct;
      }
    }

    if (product) {
      // Use salePrice as primary price, fallback to purchasePrice, then wholesalePrice
      return (product as any).salePrice || (product as any).purchasePrice || (product as any).wholesalePrice || 0;
    }

    return 0;
  };

  // Calculate total price for grouped movements
  const calculateTotalPrice = (movementsArray: StockMovement[]): number => {
    let total = 0;

    movementsArray.forEach((movement) => {
      const quantity = movement.quantity || 0;
      const price = getProductPrice(movement);

      if (price > 0) {
        total += quantity * price;
      }
    });

    return total;
  };

  // Format price with currency
  const formatPrice = (price: number): string => {
    if (price === 0) return '—';
    return `${price.toLocaleString('ru-RU')} сум`;
  };

  const formatDate = (movement: any) => {
    try {
      // Try different possible timestamp fields
      const timestamp = movement.timestamp || movement.createdAt || movement.updatedAt;
      if (!timestamp) {
        return 'Неизвестная дата';
      }

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.log('Invalid timestamp:', timestamp);
        return 'Неизвестная дата';
      }
      return date.toLocaleDateString('ru-RU');
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Неизвестная дата';
    }
  };

  const formatTime = (movement: any) => {
    try {
      // Try different possible timestamp fields
      const timestamp = movement.timestamp || movement.createdAt || movement.updatedAt;
      if (!timestamp) {
        return 'Неизвестное время';
      }

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Неизвестное время';
      }
      return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Неизвестное время';
    }
  };

  // Load movements from API if not provided via props
  useEffect(() => {
    if (!propMovements) {
      loadMovements();
    }
    loadProducts();
    loadLocations();
    loadCategories();
    // suppliers removed
  }, []);

  // Update products when category filter changes
  useEffect(() => {
    if (filterCategory) {
      // Normalize category before sending to API
      const normalizedCategory = String(filterCategory).toLowerCase().trim();
      loadProducts(normalizedCategory);
      // Reset product filter when category changes
      setFilterProduct('');
    } else {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory]);

  // Update filtered products for dropdown when products or category changes
  useEffect(() => {
    updateFilteredProducts(products, filterCategory || undefined);
  }, [products, filterCategory]);

  // Validate warehouse selection
  useEffect(() => {
    if (filterFromWarehouse && filterToWarehouse && filterFromWarehouse === filterToWarehouse) {
      setWarehouseValidationError('Склад-отправитель и склад-получатель не могут быть одинаковыми');
    } else {
      setWarehouseValidationError('');
    }
  }, [filterFromWarehouse, filterToWarehouse]);

  // Update userLocation when user changes
  useEffect(() => {
    setNewMovement(prev => ({
      ...prev,
      userLocation: user?.firstName ? `${user.firstName} ${user.lastName}` : ''
    }));
  }, [user]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      // Load all movements (including drafts) - increase limit to get all records
      const response = await api.stockMovements.getAll({ limit: 1000, type: 'transfer' });
      if (response.success) {
        setMovements(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки движений');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (category?: string) => {
    try {
      setProductsLoading(true);
      const params: any = { limit: 1000 };
      if (category) {
        // Ensure category is normalized (lowercase) before sending to API
        params.category = String(category).toLowerCase().trim();
      }
      const response = await api.products.getAll(params);
      if (response.success) {
        setProducts(response.data);
        // Update filtered products for dropdown
        // Note: If category filter is active, API already returns filtered products,
        // but we filter again to ensure consistency
        updateFilteredProducts(response.data, category);
      }
    } catch (err: any) {
      console.error('Error loading products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const updateFilteredProducts = (productsList: any[], category?: string) => {
    let filtered = productsList;
    if (category) {
      // Normalize category comparison - categories are stored in lowercase in DB
      const normalizedCategory = String(category || '').toLowerCase().trim();
      filtered = productsList.filter((p: any) => {
        const productCategory = String(p.category || '').toLowerCase().trim();
        return productCategory === normalizedCategory;
      });
      console.log(`Filtered ${filtered.length} products for dropdown (category: ${category})`);
    } else {
      console.log(`Using all ${productsList.length} products for dropdown (no category filter)`);
    }
    setFilteredProductsForDropdown(filtered);
  };

  const loadLocations = async () => {
    try {
      setLocationsLoading(true);
      const response = await api.locations.getAll({ limit: 100 });
      if (response.success) {
        setLocations(response.data);
      }
    } catch (err: any) {
      console.error('Error loading locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  };

  const loadCategories = async () => {
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

  // suppliers logic removed

  const filteredMovements = useMemo(() => {
    // Only show transfer movements
    let base = movements.filter(movement => movement.type === 'transfer');

    const q = movementSearchQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((m) => {
        const movementId = String((m as any).movementId || '').toLowerCase();
        const batchNumber = String((m as any).batchNumber || '').toLowerCase();
        const rawId = String((m as any).id || '').toLowerCase();
        const productId = String((m as any).productId || '').toLowerCase();
        const productName = getProductDisplayName(m.productId).toLowerCase();
        const fromLoc = String(m.fromLocation || '').toLowerCase();
        const toLoc = String(m.toLocation || '').toLowerCase();
        const userName = getUserDisplayName(m.userId).toLowerCase();
        const notes = String(m.notes || '').toLowerCase();
        return [movementId, batchNumber, rawId, productId, productName, fromLoc, toLoc, userName, notes].some((f) => f.includes(q));
      });
    }

    // Filter by date range
    if (startDate || endDate) {
      base = base.filter((m) => {
        // Use createdAt or timestamp field
        const dateField = (m as any).createdAt || (m as any).timestamp;
        if (!dateField) return true; // If no date, include it (safest for drafts)

        const movementDate = new Date(dateField);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          // Set start to beginning of day and end to end of day
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return movementDate >= start && movementDate <= end;
        } else if (start) {
          start.setHours(0, 0, 0, 0);
          return movementDate >= start;
        } else if (end) {
          end.setHours(23, 59, 59, 999);
          return movementDate <= end;
        }
        return true;
      });
    }

    // Filter by product
    if (filterProduct) {
      base = base.filter((m) => {
        const productId = getProductIdValue(m.productId);
        return productId === filterProduct;
      });
    }

    // Filter by category
    if (filterCategory) {
      const normalizedCategory = String(filterCategory || '').toLowerCase().trim();
      base = base.filter((m) => {
        // First, try to get product from movement (populated data)
        let product = typeof m.productId === 'object' && m.productId ? m.productId : null;

        // If product is not populated, try to find it in products array
        if (!product) {
          const productIdValue = getProductIdValue(m.productId);
          product = products.find((p: any) =>
            (p._id || p.id) === productIdValue ||
            String(p._id || p.id) === String(productIdValue)
          );
        }

        // If still no product, skip this movement (can't determine category)
        if (!product) {
          console.warn('Product not found for movement:', m.id, 'productId:', m.productId);
          return false;
        }

        // Get category from product
        const productCategory = String((product as any).category || '').toLowerCase().trim();
        const matches = productCategory === normalizedCategory;

        if (!matches && filterCategory) {
          console.log('Category mismatch:', {
            movementId: m.id,
            productCategory,
            filterCategory: normalizedCategory,
            product: (product as any).nameRu || (product as any).name
          });
        }

        return matches;
      });
      console.log(`Filtered movements by category "${filterCategory}": ${base.length} movements`);
    }

    // Filter by from warehouse
    if (filterFromWarehouse) {
      base = base.filter((m) => {
        const fromLoc = String(m.fromLocation || '');
        return fromLoc === filterFromWarehouse;
      });
    }

    // Filter by to warehouse
    if (filterToWarehouse) {
      base = base.filter((m) => {
        const toLoc = String(m.toLocation || '');
        return toLoc === filterToWarehouse;
      });
    }

    // Group movements by movementId - collect all movementIds with their counts
    const movementIdMap = new Map<string, any[]>();

    base.forEach(movement => {
      // Use batchNumber first (for grouped movements), then movementId, then id as fallback
      const batchNumber = (movement as any).batchNumber;
      const id = batchNumber || (movement as any).movementId || movement.id;

      if (!movementIdMap.has(id)) {
        movementIdMap.set(id, []);
      }
      movementIdMap.get(id)!.push(movement);
    });

    // Create grouped array - only include first movement of each group
    const grouped: any[] = [];
    let groupingOrder = 0;
    movementIdMap.forEach((movementsArray, movementId) => {
      // Check if any movement in the group is a draft
      const hasDraft = movementsArray.some((m: any) =>
        (m as any).status === 'draft' || (m as any).status === 'pending'
      );

      if (movementsArray.length > 1) {
        // Multiple movements with same ID - show as grouped
        grouped.push({
          ...movementsArray[0],
          movementId,
          groupedCount: movementsArray.length,
          isGrouped: true,
          // If any movement in group is draft, mark the whole group as draft
          status: hasDraft ? 'draft' : (movementsArray[0] as any).status || 'completed',
          sortingIndex: groupingOrder++
        });
      } else {
        // Single movement - show as individual
        grouped.push({
          ...movementsArray[0],
          movementId,
          groupedCount: 1,
          isGrouped: false,
          status: (movementsArray[0] as any).status || 'completed',
          sortingIndex: groupingOrder++
        });
      }
    });

    const getStatusPriority = (status?: string) => (
      status === 'draft' || status === 'pending' ? 0 : 1
    );

    grouped.sort((a, b) => {
      const priorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      // If priorities are same, sort by date descending (newest first)
      const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    grouped.forEach((movement) => {
      if ('sortingIndex' in movement) {
        delete (movement as any).sortingIndex;
      }
    });

    return grouped;
  }, [movements, movementSearchQuery, startDate, endDate, filterProduct, filterCategory, filterFromWarehouse, filterToWarehouse, products]);

  const availableBrands = useMemo<string[]>(() => {
    const set = new Set<string>();
    products.forEach((p: any) => {
      if (p?.brand) set.add(String(p.brand));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo<any[]>(() => {
    const query = productSearchQuery.trim().toLowerCase();
    return products.filter((p: any) => {
      const matchesBrand = !brandFilter || (String(p.brand) === brandFilter);
      if (!matchesBrand) return false;
      if (!query) return true;
      const name = (p.nameRu || p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const model = (p.model || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const productId = (p.id || p._id || '').toLowerCase();
      return (
        name.includes(query) ||
        brand.includes(query) ||
        model.includes(query) ||
        barcode.includes(query) ||
        productId.includes(query)
      );
    });
  }, [products, productSearchQuery, brandFilter]);

  const filteredFromLocations = useMemo(() => {
    const toCode = String(newMovement.toLocation || '');
    return locations.filter((l: any) => String(l.code) !== toCode);
  }, [locations, newMovement.toLocation]);

  const filteredToLocations = useMemo(() => {
    const fromCode = String(newMovement.fromLocation || '');
    return locations.filter((l: any) => String(l.code) !== fromCode);
  }, [locations, newMovement.fromLocation]);

  const handleAddMovement = () => {
    setShowAddForm(true);
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📋 Form submitted with:', { productId: newMovement.productId, quantity: newMovement.quantity });

    if (newMovement.productId && newMovement.quantity !== 0) {
      try {
        setLoading(true);
        setError(null);

        // suppliers removed

        const movementData = {
          productId: newMovement.productId,
          type: 'transfer' as const,
          quantity: parseInt(newMovement.quantity.toString()),
          reason: 'Перемещение товара',
          fromLocation: newMovement.fromLocation,
          toLocation: newMovement.toLocation,
          notes: newMovement.notes
        };

        console.log('📤 Sending stock movement data:', movementData);
        const response = await api.stockMovements.create(movementData);

        if (response.success) {
          // Ensure movement has an id for searching and list display
          const created = response.data || {};
          if (!created.id && created._id) {
            created.id = created._id;
          }
          if (!created.id) {
            created.id = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          }
          // Add the new movement to the list
          setMovements(prev => [created, ...prev]);

          // Call parent callback if provided
          if (onAddMovement) {
            onAddMovement(response.data);
          }

          // Reset form
          setNewMovement({
            productId: '',
            quantity: 0,
            fromLocation: '',
            toLocation: '',
            notes: ''
          });
          setProductSearchQuery('');
          setShowProductDropdown(false);
          setShowAddForm(false);
          // Immediately reload from server to reflect any derived changes
          await loadMovements();
        }
      } catch (err: any) {
        console.error('❌ Stock movement creation failed:', err);
        if (err.details && err.details.errors) {
          const errorMessages = err.details.errors.map((e: any) => e.msg).join(', ');
          setError(`Ошибка валидации: ${errorMessages}`);
        } else {
          setError(err.message || 'Ошибка создания движения товара');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelAdd = () => {
    console.log('🚫 Cancel clicked - resetting form without API call');
    setShowAddForm(false);
    setNewMovement({
      productId: '',
      quantity: 0,
      fromLocation: '',
      toLocation: '',
      notes: ''
    });
    setProductSearchQuery('');
    setShowProductDropdown(false);
    setError(null);
  };

  const handleCompleteDraft = async (movementId: string) => {
    if (!confirm('Завершить это перемещение? Это обновит остатки товаров.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.stockMovements.update(movementId, { status: 'completed' });

      if (response.success) {
        // Reload movements
        await loadMovements();
        alert('Перемещение успешно завершено!');
      } else {
        setError((response as any).message || 'Не удалось завершить перемещение');
      }
    } catch (err: any) {
      console.error('Error completing draft:', err);
      setError(err.message || 'Ошибка при завершении перемещения');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!window.confirm('Bu hareketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.stockMovements.delete(movementId);

      // Remove from local state and refresh from server
      setMovements(prev => prev.filter(movement => movement.id !== movementId));
      await loadMovements();

    } catch (err: any) {
      setError(err.message || 'Hareket silinirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setShowDetailModal(true);
    // Ensure products are loaded when opening modal
    if (products.length === 0) {
      loadProducts();
    }
  };

  const handleEditDraft = async (movement: StockMovement) => {
    try {
      setLoading(true);
      const batchNumber = (movement as any).batchNumber || (movement as any).movementId;

      if (!batchNumber) {
        setError('Не удалось определить номер группы перемещения');
        return;
      }

      // Fetch all movements with this batchNumber that are drafts
      const response = await api.stockMovements.getAll({
        limit: 1000,
        type: 'transfer',
        // We can't filter by batchNumber directly, so we'll fetch and filter
      });

      if (response.success) {
        // Filter movements by batchNumber (any status)
        const draftMovements = response.data.filter((m: any) =>
          ((m as any).batchNumber === batchNumber || (m as any).movementId === batchNumber)
        );

        if (draftMovements.length === 0) {
          setError('Перемещение не найдено');
          return;
        }

        // Convert movements to format expected by AddMovementPage
        // Group by productId to avoid duplicates - if same product appears multiple times, sum quantities
        const itemsMap = new Map<string, any>();

        draftMovements.forEach((m: any) => {
          const productId = m.productId?._id || m.productId?.id || m.productId;
          if (!productId) return;

          const key = `${productId}_${m.fromLocation || ''}_${m.toLocation || ''}`;

          if (itemsMap.has(key)) {
            // If same product with same locations, sum quantities
            const existing = itemsMap.get(key);
            existing.quantity = (existing.quantity || 0) + (m.quantity || 0);
            // Merge notes
            if (m.notes && !existing.notes.includes(m.notes)) {
              existing.notes = existing.notes ? `${existing.notes}; ${m.notes}` : m.notes;
            }
          } else {
            // Create new item with exact quantity from database
            itemsMap.set(key, {
              id: m.id || m._id,
              productId: productId,
              product: m.productId || {},
              quantity: m.quantity || 1, // Preserve exact quantity from database
              notes: m.notes || '',
              fromLocation: m.fromLocation || '',
              toLocation: m.toLocation || '',
              movementType: 'transfer' as const
            });
          }
        });

        const draftItems = Array.from(itemsMap.values());

        // Get first movement to get locations
        const firstMovement = draftMovements[0] as any;
        const fromLocation = firstMovement.fromLocation || '';
        const toLocation = firstMovement.toLocation || '';

        // Navigate to AddMovementPage with movement data
        const movementStatus = firstMovement.status || 'completed';
        navigate('/warehouse/add-movement', {
          state: {
            draftData: {
              items: draftItems,
              fromLocation,
              toLocation,
              batchNumber,
              status: movementStatus,
              step: 'products'
            }
          }
        });
      } else {
        setError('Не удалось загрузить черновик');
      }
    } catch (err: any) {
      console.error('Error loading draft:', err);
      setError(err.message || 'Ошибка при загрузке черновика');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedMovement(null);
    setShowDetailModal(false);
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);
      setExportError(null);

      // Prepare data for export - use filtered movements
      const dataToExport = filteredMovements.map((movement) => {
        const productId = typeof movement.productId === 'object' && movement.productId
          ? (movement.productId as any)._id || (movement.productId as any).id
          : movement.productId;

        const productName = typeof movement.productId === 'object' && movement.productId
          ? `${(movement.productId as any).nameRu || ''} - ${(movement.productId as any).brand || ''} ${(movement.productId as any).model || ''}`.trim()
          : productId || '';

        const userName = typeof movement.userId === 'object' && movement.userId
          ? `${(movement.userId as any).firstName || ''} ${(movement.userId as any).lastName || ''}`.trim()
          : movement.userId || '';

        const movementDate = formatDate(movement);
        const movementTime = formatTime(movement);
        const status = ((movement as any).status === 'draft' || (movement as any).status === 'pending') ? 'Незавершено' : 'Завершено';

        return {
          movementId: (movement as any).movementId || (movement as any).batchNumber || movement.id,
          productName: productName || 'Неизвестный товар',
          productId: productId || '',
          quantity: movement.quantity,
          fromLocation: movement.fromLocation || '—',
          toLocation: movement.toLocation || '—',
          userName: userName || 'Неизвестный пользователь',
          date: movementDate,
          time: movementTime,
          status: status,
          notes: movement.notes || '—'
        };
      });

      const columns = [
        { key: 'movementId', header: 'ID перемещения', width: 18, alignment: 'center' as const },
        { key: 'productName', header: 'Товар', width: 40, alignment: 'left' as const },
        { key: 'productId', header: 'ID товара', width: 18, alignment: 'center' as const },
        { key: 'quantity', header: 'Количество (шт.)', width: 15, alignment: 'center' as const, type: 'number' as const },
        { key: 'fromLocation', header: 'Откуда', width: 18, alignment: 'left' as const },
        { key: 'toLocation', header: 'Куда', width: 18, alignment: 'left' as const },
        { key: 'userName', header: 'Пользователь', width: 25, alignment: 'left' as const },
        { key: 'date', header: 'Дата', width: 15, alignment: 'center' as const },
        { key: 'time', header: 'Время', width: 12, alignment: 'center' as const },
        { key: 'status', header: 'Статус', width: 15, alignment: 'center' as const },
        { key: 'notes', header: 'Примечания', width: 30, alignment: 'left' as const }
      ];

      const timestamp = new Date().toISOString().split('T')[0];
      await exportToExcelWithOptions(
        dataToExport,
        columns,
        `Перемещения_товаров_${timestamp}.xlsx`,
        'Перемещения товаров'
      );

      console.log('✅ Stock movements exported to Excel successfully');
    } catch (error: any) {
      console.error('❌ Export failed:', error);
      setExportError(error.message || 'Ошибка экспорта. Пожалуйста, попробуйте снова.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
              }`}>Перемещения товаров</h2>
            <p className={`mt-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>История перемещений товаров между локациями</p>
          </div>
          <div className="flex space-x-3 mt-4 lg:mt-0">
            <button
              onClick={handleExportToExcel}
              disabled={exportLoading}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? 'Экспорт...' : 'Экспорт'}
            </button>
          </div>
        </div>
      </div>

      {/* Export Error Display */}
      {exportError && (
        <div className={`rounded-lg p-4 border transition-all duration-300 ${isDark
          ? 'bg-red-900/20 border-red-800'
          : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className={`transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-800'
              }`}>{exportError}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
        {/* Search Bar - Half Width */}
        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
            Поиск перемещений
          </label>
          <div className="relative w-1/2">
            <input
              type="text"
              value={movementSearchQuery}
              onChange={(e) => setMovementSearchQuery(e.target.value)}
              className={`input-modern w-full pl-4 pr-10`}
              placeholder="Поиск по ID движения, товару, локации, пользователю..."
            />
            <Search className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        </div>

        {/* Product, Category, and Warehouse Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {/* Category Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
              Категория
            </label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setFilterProduct(''); // Reset product when category changes
              }}
              className={`input-modern w-full py-1.5 text-sm`}
              aria-label="Выберите категорию"
            >
              <option value="">Все категории</option>
              {Object.entries(categoriesMap).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* From Warehouse Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
              Склад-отправитель
            </label>
            <select
              value={filterFromWarehouse}
              onChange={(e) => {
                setFilterFromWarehouse(e.target.value);
                if (e.target.value === filterToWarehouse) {
                  setWarehouseValidationError('Склад-отправитель и склад-получатель не могут быть одинаковыми');
                } else {
                  setWarehouseValidationError('');
                }
              }}
              className={`input-modern w-full py-1.5 text-sm ${warehouseValidationError ? 'border-red-500' : ''
                }`}
              aria-label="Выберите склад-отправитель"
            >
              <option value="">Все склады</option>
              {locations.map((location: any) => {
                const locationCode = location.code || location._id || location.id;
                const locationName = location.name || locationCode;
                return (
                  <option key={locationCode} value={locationCode}>
                    {locationName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* To Warehouse Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
              Склад-получатель
            </label>
            <select
              value={filterToWarehouse}
              onChange={(e) => {
                setFilterToWarehouse(e.target.value);
                if (e.target.value === filterFromWarehouse) {
                  setWarehouseValidationError('Склад-отправитель и склад-получатель не могут быть одинаковыми');
                } else {
                  setWarehouseValidationError('');
                }
              }}
              className={`input-modern w-full py-1.5 text-sm ${warehouseValidationError ? 'border-red-500' : ''
                }`}
              aria-label="Выберите склад-получатель"
            >
              <option value="">Все склады</option>
              {locations.map((location: any) => {
                const locationCode = location.code || location._id || location.id;
                const locationName = location.name || locationCode;
                return (
                  <option key={locationCode} value={locationCode}>
                    {locationName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Space for additional filter or empty */}
          <div className="hidden md:block"></div>
        </div>

        {/* Warehouse Validation Error */}
        {warehouseValidationError && (
          <div className={`mb-3 text-xs transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-600'
            }`} role="alert">
            {warehouseValidationError}
          </div>
        )}

        {/* Date Range and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <label className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Период
              </label>
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className={`input-modern py-1.5 text-sm`}
                style={{ width: 'auto', minWidth: 'fit-content' }}
              >
                <option value="today">Сегодня</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
              </select>

              {/* Date Range Inputs */}
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`input-modern py-1.5 text-sm`}
                style={{ width: 'auto', minWidth: '150px' }}
              />
              <span className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`input-modern py-1.5 text-sm`}
                style={{ width: 'auto', minWidth: '150px' }}
              />
            </div>

            {dateRange === 'month' && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="px-2 py-1 rounded-full border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  aria-label="Предыдущий месяц"
                >
                  ‹
                </button>
                <div className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 shadow-inner ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  }`}>
                  {monthNames[selectedMonth]} <span className={isDark ? 'text-gray-300' : 'text-gray-500'}>{selectedYear}</span>
                </div>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="px-2 py-1 rounded-full border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  aria-label="Следующий месяц"
                >
                  ›
                </button>

                {/* Separate year swipe control */}
                <div className={isDark ? 'text-gray-600' : 'text-gray-300'}>|</div>
                <button
                  type="button"
                  onClick={goPrevYear}
                  className="px-2 py-1 rounded-full border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  aria-label="Предыдущий год"
                >
                  ‹
                </button>
                <div className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 shadow-inner ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  }`}>
                  {selectedYear}
                </div>
                <button
                  type="button"
                  onClick={goNextYear}
                  className="px-2 py-1 rounded-full border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  aria-label="Следующий год"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={() => navigate('/warehouse/add-movement')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center shadow-md hover:shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить движение
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={`rounded-lg p-4 border transition-all duration-300 ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className={`transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-800'
              }`}>{error}</span>
          </div>
        </div>
      )}

      {/* Add Movement Form */}
      {showAddForm && (
        <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
          <h3 className={`text-lg font-medium mb-4 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
            }`}>Добавить движение товара</h3>
          <form onSubmit={handleSubmitMovement} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Товар
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="input-modern w-44"
                  >
                    <option value="">Все бренды</option>
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Product Search with Dropdown */}
                <div className="relative">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => {
                      // Delay hiding to allow clicking on dropdown items
                      setTimeout(() => setShowProductDropdown(false), 200);
                    }}
                    className="input-modern w-full"
                    placeholder="Поиск товара по названию, бренду, ID, штрихкоду..."
                    required
                    disabled={productsLoading}
                  />

                  {/* Dropdown */}
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white'
                      }`}>
                      {filteredProducts.slice(0, 10).map((product) => (
                        <div
                          key={product.id}
                          className={`px-4 py-3 cursor-pointer hover:bg-gray-100 border-b border-gray-200 last:border-b-0 ${isDark ? 'hover:bg-gray-700 border-gray-600' : 'hover:bg-gray-100'
                            }`}
                          onClick={() => {
                            const selected = products.find(p => p.id === product.id);
                            const autoFrom = getDefaultFromLocation(selected);
                            setNewMovement({ ...newMovement, productId: product.id, fromLocation: autoFrom });
                            setProductSearchQuery(`${product.nameRu} - ${product.brand} ${product.model}`);
                            setShowProductDropdown(false);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {product.nameRu} - {product.brand} {product.model}
                              </p>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  ID: {product.id}
                                </span>
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  Остаток: {product.stock}
                                </span>
                                {product.barcode && (
                                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Штрихкод: {product.barcode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {filteredProducts.length === 0 && !productsLoading && (
                  <p className="text-xs text-gray-500 mt-1">По заданным условиям ничего не найдено</p>
                )}
                {products.length === 0 && !productsLoading && (
                  <p className="text-sm text-red-600 mt-1">
                    Нет доступных товаров. Сначала добавьте товары в систему.
                  </p>
                )}
                {newMovement.productId && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800 font-medium">Текущие остатки по локациям:</p>
                    <div className="mt-1 text-xs text-blue-700">
                      {(() => {
                        const selectedProduct = products.find(p => p.id === newMovement.productId);
                        if (selectedProduct) {
                          // Show location-specific stocks if available
                          // Support Map, object, or normalized record
                          const ls = selectedProduct.locationStock as any;
                          const entries: Array<[string, number]> = ls
                            ? (typeof ls.entries === 'function' ? Array.from(ls.entries()) : Object.entries(ls)) as any
                            : [];
                          if (entries.length > 0) {
                            // Resolve location codes to names using locations list
                            const codeToName = new Map<string, string>();
                            locations.forEach((l: any) => codeToName.set(l.code, l.name));
                            return entries.map(([location, stock]) => (
                              <div key={location} className="flex justify-between">
                                <span>{codeToName.get(String(location)) || String(location)}:</span>
                                <span className={`font-medium ${Number(stock) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {Number(stock)} шт.
                                </span>
                              </div>
                            ));
                          } else {
                            // No location-specific stocks, show general stock
                            return (
                              <div>
                                <div className="flex justify-between">
                                  <span>Общий остаток:</span>
                                  <span className="font-medium text-green-600">{selectedProduct.stock || 0} шт.</span>
                                </div>
                                <div className="mt-1 text-red-600 text-xs">
                                  ⚠️ Локационные остатки не настроены. Используется общий остаток.
                                </div>
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Количество
                </label>
                <input
                  type="number"
                  value={newMovement.quantity === 0 ? '' : newMovement.quantity}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      console.log('🔢 Quantity cleared to 0');
                      setNewMovement({ ...newMovement, quantity: 0 });
                    } else {
                      const qty = parseInt(value) || 0;
                      console.log('🔢 Quantity changed to:', qty);
                      setNewMovement({ ...newMovement, quantity: qty });
                    }
                  }}
                  className="input-modern"
                  placeholder="0"
                  required
                />
              </div>

              {/* From Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Откуда (Nereden)
                </label>
                <select
                  value={newMovement.fromLocation}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewMovement({
                      ...newMovement,
                      fromLocation: val,
                      toLocation: newMovement.toLocation === val ? '' : newMovement.toLocation
                    });
                  }}
                  className="input-modern"
                  required
                  disabled={locationsLoading}
                >
                  <option value="">
                    {locationsLoading ? 'Загрузка локаций...' : 'Выберите локацию'}
                  </option>
                  {filteredFromLocations.map((location) => (
                    <option key={location.id} value={location.code}>
                      {location.name} ({location.code})
                    </option>
                  ))}
                </select>
                {newMovement.productId && !newMovement.fromLocation && (
                  <p className="text-xs text-orange-600 mt-1">Источник не найден автоматически. Укажите локацию вручную.</p>
                )}
              </div>

              {/* To Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Куда (Nereye)
                </label>
                <select
                  value={newMovement.toLocation}
                  onChange={(e) => setNewMovement({ ...newMovement, toLocation: e.target.value })}
                  className="input-modern"
                  required
                  disabled={locationsLoading}
                >
                  <option value="">
                    {locationsLoading ? 'Загрузка локаций...' : 'Выберите локацию'}
                  </option>
                  {filteredToLocations.map((location) => (
                    <option key={location.id} value={location.code}>
                      {location.name} ({location.code})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Поля поставщика удалены по требованию */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Примечания
              </label>
              <textarea
                value={newMovement.notes}
                onChange={(e) => setNewMovement({ ...newMovement, notes: e.target.value })}
                className="input-modern"
                placeholder="Дополнительные примечания"
                rows={3}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-pill-solid font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : 'Добавить перемещение'}
              </button>
              <button
                type="button"
                onClick={handleCancelAdd}
                className="btn-pill-outline font-medium"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Movements List */}
      <div className={`rounded-lg shadow-md overflow-hidden transition-colors duration-300 ${isDark ? 'bg-gray-900' : 'bg-white'
        }`}>
        <div className={`px-6 py-4 border-b transition-colors duration-300 ${isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>Перемещения товаров</h1>
              <p className={`mt-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                Всего записей: {filteredMovements.length}
                {(() => {
                  const draftCount = filteredMovements.filter((m: any) =>
                    (m as any).status === 'draft' || (m as any).status === 'pending'
                  ).length;
                  return draftCount > 0 ? (
                    <span className={`ml-2 transition-colors duration-300 ${isDark ? 'text-yellow-400' : 'text-yellow-600'
                      }`}>
                      • Незавершено: {draftCount}
                    </span>
                  ) : null;
                })()}
                {loading && <span className={`text-sm ml-2 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>(загрузка...)</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Movements Table */}
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
                    Количество
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Откуда
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Куда
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Пользователь
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Дата
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Статус
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y transition-colors duration-300 ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'
                }`}>
                {filteredMovements.map((movement) => {
                  const isDraft = (movement as any).status === 'draft' || (movement as any).status === 'pending';
                  return (
                    <tr
                      key={movement.id}
                      className={`transition-colors duration-200 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        } ${isDraft ? 'cursor-pointer' : ''}`}
                      onClick={isDraft ? () => handleEditDraft(movement) : undefined}
                      title={isDraft ? 'Нажмите, чтобы продолжить редактирование' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            // Use movementId for grouping if available, otherwise use batchNumber
                            const groupId = (movement as any).movementId || (movement as any).batchNumber;
                            if (groupId) {
                              // Find all movements with this groupId from the original movements array
                              const groupedMovements = movements.filter(m =>
                                ((m as any).movementId || (m as any).batchNumber) === groupId
                              );
                              setSelectedMovement(movement);
                              setShowDetailModal(true);
                            }
                          }}
                          className={`text-sm font-medium transition-colors duration-300 hover:underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                            }`}
                        >
                          {(movement as any).movementId || (movement as any).batchNumber || 'Генерация...'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          {movement.isGrouped ? (
                            <div className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                              }`}>
                              {movement.groupedCount} товаров
                            </div>
                          ) : (
                            <>
                              <div className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {getProductDisplayName(movement.productId)}
                              </div>
                              {getProductIdValue(movement.productId) && (
                                <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                  ID: {getProductIdValue(movement.productId)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ArrowLeftRight className="h-4 w-4 text-blue-500 mr-2" />
                          <span className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                            {movement.quantity} шт.
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          {movement.fromLocation || 'Не указано'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          {movement.toLocation || 'Не указано'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <User className="h-4 w-4 mr-1" />
                          {getUserDisplayName(movement.userId)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                          {formatDate(movement)}
                        </div>
                        <div className={`text-xs transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          {formatTime(movement)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {((movement as any).status === 'draft' || (movement as any).status === 'pending') ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark
                            ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700'
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            }`}>
                            <Clock className="h-3 w-3 mr-1" />
                            Незавершено
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark
                            ? 'bg-green-900/30 text-green-400 border border-green-700'
                            : 'bg-green-100 text-green-800 border border-green-300'
                            }`}>
                            <Check className="h-3 w-3 mr-1" />
                            Завершено
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {((movement as any).status === 'draft' || (movement as any).status === 'pending') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                handleCompleteDraft(movement.id);
                              }}
                              className={`text-green-600 hover:text-green-800 transition-colors duration-200 ${isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-800'
                                }`}
                              title="Завершить перемещение"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              handleEditDraft(movement);
                            }}
                            className={`text-blue-600 hover:text-blue-800 transition-colors duration-200 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                              }`}
                            title="Редактировать"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              handleDeleteMovement(movement.id);
                            }}
                            className="text-red-600 hover:text-red-800 transition-colors duration-200"
                            title="Удалить движение"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredMovements.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className={`mt-2 text-sm font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
              }`}>Перемещения не найдены</h3>
            <p className={`mt-1 text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
              Нет перемещений за выбранный период.
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedMovement && (() => {
        const batchId = (selectedMovement as any).batchNumber || (selectedMovement as any).movementId;
        const groupedMovements = movements.filter(m => ((m as any).batchNumber || (m as any).movementId) === batchId);
        const totalPrice = calculateTotalPrice(groupedMovements);
        const getMovementTimestampMs = (movement: StockMovement): number => {
          const timestamp = (movement as any).timestamp || (movement as any).createdAt || (movement as any).updatedAt;
          if (!timestamp) return 0;
          const date = new Date(timestamp);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        };
        const movementHistory = groupedMovements
          .map((movement, idx) => ({
            key: movement.id || (movement as any)._id || `${batchId}_${idx}`,
            movement,
            timestampValue: getMovementTimestampMs(movement)
          }))
          .sort((a, b) => b.timestampValue - a.timestampValue);

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-lg shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto transition-all duration-300 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
              }`}>
              <div className="p-8">
                {/* Modal Header */}
                <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex-1">
                    <h3 className={`text-3xl font-bold mb-3 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                      Товары в группе перемещений
                    </h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Total Price - Upper Left */}
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${isDark
                        ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                        <span className="text-sm font-medium">общая сумма:</span>
                        <span className="text-lg">{formatPrice(totalPrice)}</span>
                      </div>
                      {/* Item Count Badge */}
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${isDark
                        ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                        }`}>
                        {groupedMovements.length} товаров
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseDetails}
                    className={`ml-4 p-2 rounded-lg transition-colors duration-200 ${isDark
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    aria-label="Закрыть"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* ID Display - Right side */}
                <div className="mb-6 flex justify-end">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-sm ${isDark
                    ? 'bg-gray-700 text-gray-300 border border-gray-600'
                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                    }`}>
                    <span className="text-xs font-normal">ID:</span>
                    <span className="font-semibold">{(selectedMovement as any).movementId || (selectedMovement as any).batchNumber}</span>
                  </div>
                </div>

                {movementHistory.length > 0 && (
                  <div className="mb-8">
                    <h4 className={`text-lg font-semibold mb-3 transition-colors duration-300 ${isDark ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                      История изменений
                    </h4>
                    <div className="space-y-3">
                      {movementHistory.map(({ key, movement }) => (
                        <div
                          key={key}
                          className={`p-3 rounded-lg border transition-colors duration-200 ${isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {getUserDisplayName(movement.userId)}
                            </span>
                            <span className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                              {formatDate(movement)} · {formatTime(movement)}
                            </span>
                          </div>
                          <div className={`mt-2 text-sm flex flex-wrap items-center gap-4 ${isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {movement.fromLocation || '—'} → {movement.toLocation || '—'}
                            </span>
                            <span className="font-medium">{movement.quantity || 0} шт.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* List all products in this movement group */}
                {groupedMovements.length > 1 && (
                  <div className="mb-6">
                    <h4 className={`text-lg font-semibold mb-4 transition-colors duration-300 ${isDark ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                      Список товаров
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {groupedMovements.map((m, idx) => {
                        // Get product price using the helper function
                        const productPrice = getProductPrice(m);

                        const itemTotal = (m.quantity || 0) * productPrice;

                        return (
                          <div
                            key={m.id}
                            className={`p-4 rounded-xl border transition-all duration-200 ${isDark
                              ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                              : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-gray-300 hover:shadow-md'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDark
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {idx + 1}
                                  </span>
                                  <div className={`text-base font-semibold truncate transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                                    }`}>
                                    {getProductDisplayName(m.productId)}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-3 ml-10">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                      <span className="block text-xs uppercase tracking-wide opacity-70">Дата и время</span>
                                      <span className="font-medium">
                                        {formatDate(m)} — {formatTime(m)}
                                      </span>
                                    </div>
                                    <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                      <span className="block text-xs uppercase tracking-wide opacity-70">Кто изменил</span>
                                      <span className="font-medium">{getUserDisplayName(m.userId)}</span>
                                    </div>
                                    <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                      <span className="block text-xs uppercase tracking-wide opacity-70">Откуда / Куда</span>
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {m.fromLocation || '—'} → {m.toLocation || '—'}
                                      </span>
                                    </div>
                                    <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                      <span className="block text-xs uppercase tracking-wide opacity-70">Товары, шт</span>
                                      <span className="font-semibold">{m.quantity} шт.</span>
                                    </div>
                                  </div>
                                  {productPrice > 0 && (
                                    <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                      }`}>
                                      {formatPrice(productPrice)} × {m.quantity} шт. = <span className="font-semibold text-green-600 dark:text-green-400">{formatPrice(itemTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className={`flex flex-col items-end gap-1 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'
                                }`}>
                                <div className="text-lg font-bold">
                                  {m.quantity} шт.
                                </div>
                                {productPrice > 0 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatPrice(productPrice)}/шт.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Details Grid - Only show if single movement */}
                {groupedMovements.length === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Movement ID / Batch Number */}
                    {((selectedMovement as any).movementId || (selectedMovement as any).batchNumber) && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {(selectedMovement as any).movementId ? 'ID движения' : 'Номер группы'}
                        </label>
                        <p className={`text-base font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {(selectedMovement as any).movementId || (selectedMovement as any).batchNumber}
                        </p>
                      </div>
                    )}

                    {/* Product */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Товар</label>
                      <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{getProductDisplayName(selectedMovement.productId)}</p>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Количество</label>
                      <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedMovement.quantity > 0 ? '+' : ''}{selectedMovement.quantity} шт.
                      </p>
                    </div>

                    {/* Причина скрыта по требованию */}

                    {/* From Location */}
                    {selectedMovement.fromLocation && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Откуда</label>
                        <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedMovement.fromLocation}</p>
                      </div>
                    )}

                    {/* To Location */}
                    {selectedMovement.toLocation && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Куда</label>
                        <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedMovement.toLocation}</p>
                      </div>
                    )}

                    {/* User Location (Executor) */}
                    {(selectedMovement as any).userLocation && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Исполнитель</label>
                        <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{(selectedMovement as any).userLocation}</p>
                      </div>
                    )}

                    {/* Warehouse Location (Supplier) */}
                    {(selectedMovement as any).warehouseLocation && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Поставщик / Локация</label>
                        <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{(selectedMovement as any).warehouseLocation}</p>
                      </div>
                    )}

                    {/* Payment Status */}
                    {(selectedMovement as any).paymentStatus && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Статус оплаты</label>
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${(selectedMovement as any).paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {(selectedMovement as any).paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
                        </span>
                      </div>
                    )}

                    {/* Debt Direction */}
                    {(selectedMovement as any).debtDirection && (selectedMovement as any).debtDirection !== 'none' && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Задолженность</label>
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${(selectedMovement as any).debtDirection === 'we_owe'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {(selectedMovement as any).debtDirection === 'we_owe' ? 'Мы должны' : 'Нам должны'}
                        </span>
                      </div>
                    )}

                    {/* Batch Number */}
                    {selectedMovement.batchNumber && (
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Номер партии</label>
                        <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedMovement.batchNumber}</p>
                      </div>
                    )}

                    {/* User */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Пользователь</label>
                      <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{getUserDisplayName(selectedMovement.userId)}</p>
                    </div>

                    {/* Date */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата</label>
                      <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatDate(selectedMovement)}</p>
                    </div>

                    {/* Time */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Время</label>
                      <p className={`text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatTime(selectedMovement)}</p>
                    </div>

                    {/* Notes */}
                    {selectedMovement.notes && (
                      <div className="md:col-span-2">
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Примечания</label>
                        <p className={`text-base p-3 rounded-md ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`}>{selectedMovement.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    onClick={handleCloseDetails}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${isDark
                      ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm hover:shadow'
                      }`}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StockMovements;