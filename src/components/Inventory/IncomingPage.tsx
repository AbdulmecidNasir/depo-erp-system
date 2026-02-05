import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, User, MapPin, Search, Plus, X, Check, Trash2, Building, Download, AlertCircle, Edit, SlidersHorizontal, ChevronUp, ChevronDown, Calendar, RotateCcw, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { exportToExcelWithOptions } from '../../utils/excelExport';

interface StockMovement {
  _id: string;
  movementId?: string;
  batchNumber?: string;
  supplierId?: string;
  supplierName?: string;
  productId: {
    _id: string;
    nameRu: string;
    brand: string;
    model: string;
    location: string;
    stock?: number;
    locationStock?: Map<string, number> | Record<string, number>;
    purchasePrice?: number;
    wholesalePrice?: number;
    salePrice?: number;
    priceOpt?: number;
    price?: number;
  };
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  reason?: string;
  notes?: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    id?: string;
  };
  toLocation?: string;
  fromLocation?: string;
  createdAt: string;
  updatedAt: string;
  purchasePrice?: number; // Закупка
  wholesalePrice?: number; // Опт
  salePrice?: number; // Продажа
  status?: 'completed' | 'draft' | 'pending';
}

interface Product {
  _id: string;
  nameRu: string;
  brand: string;
  model: string;
  category: string;
  location: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  supplierId?: string;
}

interface IncomingItem {
  productId: string;
  product: Product;
  quantity: number;
  reason: string;
  notes: string;
  toLocation: string;
}

interface Location {
  _id: string;
  name: string;
  code: string;
  zone?: string;
}

const IncomingPage: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Установка дефолтных дат: начало текущего месяца и сегодня
  const getDefaultDateFrom = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return startOfMonth.toISOString().split('T')[0];
  };
  const getDefaultDateTo = () => {
    return new Date().toISOString().split('T')[0];
  };
  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom());
  const [dateTo, setDateTo] = useState(getDefaultDateTo());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New state for incoming form
  const [showIncomingForm, setShowIncomingForm] = useState(false);
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState<string>('');
  const [currentGroupItems, setCurrentGroupItems] = useState<StockMovement[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Filter Panel State
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  // Period Presets
  const setPeriodPreset = (preset: 'today' | 'week' | 'month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (preset === 'today') {
      setDateFrom(today.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    } else if (preset === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      setDateFrom(weekStart.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    } else {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(monthStart.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setFilterSupplier('');
    setFilterLocation('');
    setFilterUser('');
  };



  // Helper: Russian pluralization for "товар"
  const formatTovarCount = (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} товар`;
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} товара`;
    return `${n} товаров`;
  };

  useEffect(() => {
    fetchIncomingMovements();
    fetchLocations();
    fetchSuppliers();
    fetchUsers();
    // preload products to enrich prices in the table
    fetchProducts('');
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.users.getAll();
      if (res.success) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };


  const fetchIncomingMovements = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.stockMovements.getAll({
        type: 'in',
        page: 1,
        limit: 100
      });

      if (response.success) {
        console.log('Fetched movements:', response.data);
        console.log('First movement:', response.data[0]);
        setMovements(response.data);
      } else {
        throw new Error('Не удалось загрузить данные');
      }
    } catch (err: any) {
      console.error('Error fetching incoming movements:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovement = async () => {
    if (!selectedMovement) return;

    console.log('Selected movement for deletion:', selectedMovement);
    console.log('Movement ID:', selectedMovement._id);
    console.log('Movement ID type:', typeof selectedMovement._id);

    setDeleting(true);
    try {
      // Use movementId if available, otherwise use _id
      const movementId = selectedMovement.movementId || selectedMovement._id;

      if (!movementId) {
        throw new Error('Movement ID not found');
      }

      console.log('Using movement ID:', movementId);
      const response = await api.stockMovements.delete(movementId);

      if (response.success) {
        // Remove the deleted movement from the list
        setMovements(prev => prev.filter(movement =>
          movement._id !== selectedMovement._id &&
          movement.movementId !== selectedMovement.movementId
        ));

        // Also refresh the list to ensure consistency
        await fetchIncomingMovements();

        setShowDeleteModal(false);
        setSelectedMovement(null);
        alert('Приходное движение успешно удалено');
      } else {
        alert('Ошибка при удалении приходного движения');
      }
    } catch (err: any) {
      console.error('Error deleting movement:', err);
      alert(err.message || 'Ошибка при удалении приходного движения');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditMovement = (movement: StockMovement, items?: StockMovement[]) => {
    const groupItems = items || [movement];
    navigate('/incoming-process', {
      state: {
        editMode: true,
        items: groupItems,
        groupId: movement.movementId || movement.batchNumber
      }
    });
  };

  const fetchLocations = async () => {
    try {
      const response = await api.locations.getAll({
        limit: 100
      });
      if (response.success) {
        setLocations(response.data);
        // Set first location as default if available
        if (response.data.length > 0) {
          setSelectedLocation(response.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      const res: any = await api.suppliers.getAll({ activeOnly: true, limit: 200 });
      if (res?.success) {
        const list = (res.suppliers || res.data || []).map((s: any) => ({ id: s.id || s._id, name: s.name }));
        setSuppliers(list);
      }
    } catch (e) {
      console.error('Error fetching suppliers:', e);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const filteredMovements = movements.filter(movement => {
    const q = (searchQuery || '').trim().toLowerCase();
    const matchesSearch = q === '' ||
      (movement.movementId && String(movement.movementId).toLowerCase().includes(q)) ||
      (movement._id && String(movement._id).toLowerCase().includes(q)) ||
      ((movement as any).batchNumber && String((movement as any).batchNumber).toLowerCase().includes(q)) ||
      (movement.productId?.nameRu && movement.productId.nameRu.toLowerCase().includes(q)) ||
      (movement.productId?.brand && movement.productId.brand.toLowerCase().includes(q)) ||
      (movement.productId?.model && movement.productId.model.toLowerCase().includes(q)) ||
      (movement.notes && String(movement.notes).toLowerCase().includes(q));

    // Date range filtering
    let matchesDate = true;
    const movementDate = new Date(movement.createdAt);
    movementDate.setHours(0, 0, 0, 0);

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (movementDate < fromDate) {
        matchesDate = false;
      }
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (movementDate > toDate) {
        matchesDate = false;
      }
    }

    // Additional Filters
    let matchesSupplier = true;
    if (filterSupplier) {
      const mSupId = movement.supplierId || (movement as any).supplierId || (movement as any).supplier?._id || (movement as any).supplier?.id;
      // Also check name match in case ID is missing but name is present
      const mSupName = movement.supplierName || (movement as any).supplierName || (movement as any).supplier?.name;
      const filterSupName = suppliers.find(s => s.id === filterSupplier)?.name;

      matchesSupplier = String(mSupId) === String(filterSupplier) || (!!filterSupName && mSupName === filterSupName);
    }

    let matchesLocation = true;
    if (filterLocation) {
      matchesLocation = movement.toLocation === filterLocation || movement.fromLocation === filterLocation;
    }

    let matchesUser = true;
    if (filterUser) {
      matchesUser = movement.userId?._id === filterUser || movement.userId?.id === filterUser;
    }

    return matchesSearch && matchesDate && matchesSupplier && matchesLocation && matchesUser;
  });

  const totalQuantity = filteredMovements.reduce((sum, movement) => sum + movement.quantity, 0);

  // Group movements by movementId/batchNumber to show one row per group
  // Prioritize movementId (sequential 6-digit) over batchNumber
  const getGroupId = (m: StockMovement) => String(m.movementId || m.batchNumber || m._id);
  const groupedMap = new Map<string, { items: StockMovement[]; first: StockMovement; totalQuantity: number }>();
  filteredMovements.forEach((m) => {
    const gid = getGroupId(m);
    if (!groupedMap.has(gid)) {
      groupedMap.set(gid, { items: [], first: m, totalQuantity: 0 });
    }
    const g = groupedMap.get(gid)!;
    g.items.push(m);
    g.totalQuantity += m.quantity;
  });
  const groupedRows = Array.from(groupedMap.entries()).map(([groupId, g]) => ({ groupId, ...g }));

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);
      setExportError(null);

      // Prepare data for export from grouped rows
      const dataToExport = groupedRows.map((row) => {
        const movement = row.first;
        const productId = movement.productId?._id || '';
        const productName = movement.productId
          ? `${movement.productId.nameRu || ''} - ${movement.productId.brand || ''} ${movement.productId.model || ''}`.trim()
          : 'Неизвестный товар';

        const userName = movement.userId
          ? `${movement.userId.firstName || ''} ${movement.userId.lastName || ''}`.trim()
          : 'Неизвестный пользователь';

        const movementDate = movement.createdAt ? new Date(movement.createdAt).toLocaleDateString('ru-RU') : '—';
        const movementTime = movement.createdAt ? new Date(movement.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';

        const price = movement.purchasePrice || movement.productId?.purchasePrice || 0;
        const totalPrice = price * row.totalQuantity;

        return {
          movementId: movement.movementId || movement.batchNumber || movement._id,
          productName: productName || 'Неизвестный товар',
          productId: productId || '',
          quantity: row.totalQuantity,
          unitPrice: price,
          totalPrice: totalPrice,
          toLocation: movement.toLocation || '—',
          supplierName: movement.supplierName || (movement as any).supplierId || '—',
          userName: userName,
          date: movementDate,
          time: movementTime,
          notes: movement.notes || '—'
        };
      });

      const columns = [
        { key: 'movementId', header: 'ID прихода', width: 18, alignment: 'center' as const },
        { key: 'productName', header: 'Товар', width: 40, alignment: 'left' as const },
        { key: 'productId', header: 'ID товара', width: 18, alignment: 'center' as const },
        { key: 'quantity', header: 'Количество (шт.)', width: 15, alignment: 'center' as const, type: 'number' as const },
        { key: 'unitPrice', header: 'Цена закупки (сўм)', width: 18, alignment: 'right' as const, type: 'currency' as const },
        { key: 'totalPrice', header: 'Общая сумма (сўм)', width: 18, alignment: 'right' as const, type: 'currency' as const },
        { key: 'toLocation', header: 'Локация', width: 18, alignment: 'left' as const },
        { key: 'supplierName', header: 'Поставщик', width: 25, alignment: 'left' as const },
        { key: 'userName', header: 'Пользователь', width: 25, alignment: 'left' as const },
        { key: 'date', header: 'Дата', width: 15, alignment: 'center' as const },
        { key: 'time', header: 'Время', width: 12, alignment: 'center' as const },
        { key: 'notes', header: 'Примечания', width: 30, alignment: 'left' as const }
      ];

      const timestamp = new Date().toISOString().split('T')[0];
      await exportToExcelWithOptions(
        dataToExport,
        columns,
        `Приход_товаров_${timestamp}.xlsx`,
        'Приход товаров'
      );

      console.log('✅ Incoming movements exported to Excel successfully');
    } catch (error: any) {
      console.error('❌ Export failed:', error);
      setExportError(error.message || 'Ошибка экспорта. Пожалуйста, попробуйте снова.');
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrintGroup = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalSum = currentGroupItems.reduce((sum, m) => {
      const price = m.purchasePrice || (m.productId as any)?.purchasePrice || 0;
      return sum + (price * m.quantity);
    }, 0);

    const html = `
      <html>
        <head>
          <title>Приходная накладная #${currentGroupId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { margin-bottom: 20px; }
            .total { margin-top: 20px; text-align: right; font-weight: bold; font-size: 1.2em; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            .sign { border-top: 1px solid #000; width: 200px; padding-top: 5px; text-align: center; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Приходная накладная № ${currentGroupId}</h2>
            <p>Дата печати: ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Товар</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${currentGroupItems.map((item, idx) => {
      const price = item.purchasePrice || (item.productId as any)?.purchasePrice || 0;
      return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.productId?.nameRu} ${item.productId?.brand ? item.productId.brand : ''}</td>
                      <td>${item.quantity} шт.</td>
                      <td>${price.toLocaleString('ru-RU')} сум</td>
                      <td>${(price * item.quantity).toLocaleString('ru-RU')} сум</td>
                    </tr>
                  `;
    }).join('')}
            </tbody>
          </table>
          <div class="total">
            Итого на сумму: ${totalSum.toLocaleString('ru-RU')} сум
          </div>
          
          <div class="footer">
            <div>
              <p>Принял:</p>
              <div class="sign">Подпись</div>
            </div>
            <div>
              <p>Сдал:</p>
              <div class="sign">Подпись</div>
            </div>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Fetch products for selection
  const fetchProducts = async (search: string = '') => {
    try {
      const response = await api.products.getAll({
        search,
        limit: 20
      });
      if (response.success) {
        let items = response.data as Product[];
        if (selectedSupplier) {
          const selId = String(selectedSupplier);
          // Try to find supplier name from state if available
          const supplierNameEntry = suppliers.find(s => String(s.id) === selId);
          const selName = (supplierNameEntry?.name || '').toLowerCase().trim();
          items = items.filter((p: any) => {
            const idCandidates = [
              p.supplierId,
              p.supplier_id,
              p.supplier,
              p.supplier?._id,
              p.supplier?.id,
            ].filter(Boolean).map((v: any) => String(v));
            const nameCandidates = [
              p.supplierName,
              p.supplier_name,
              p.supplier?.name,
              p.vendorName,
              p.vendor,
            ].filter(Boolean).map((v: any) => String(v).toLowerCase().trim());
            return idCandidates.includes(selId) || (!!selName && nameCandidates.includes(selName));
          });
        }
        setProducts(items);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Add product to incoming items
  const addProductToIncoming = (product: Product) => {
    const existingItem = incomingItems.find(item => item.productId === product._id);
    if (existingItem) {
      setIncomingItems(prev => prev.map(item =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setIncomingItems(prev => [...prev, {
        productId: product._id,
        product,
        quantity: 0,
        reason: 'Поступление товара',
        notes: '',
        toLocation: selectedLocation || product.location
      }]);
    }
    setShowProductSearch(false);
    setProductSearch('');
  };

  // Remove product from incoming items
  const removeProductFromIncoming = (productId: string) => {
    setIncomingItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Update incoming item
  const updateIncomingItem = (productId: string, field: keyof IncomingItem, value: any) => {
    setIncomingItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, [field]: value }
        : item
    ));
  };

  // Submit incoming items
  const submitIncomingItems = async () => {
    if (incomingItems.length === 0) {
      setError('Добавьте товары для поступления');
      return;
    }

    // Filter out items with 0 quantity
    const validItems = incomingItems.filter(item => item.quantity > 0);
    if (validItems.length === 0) {
      setError('Укажите количество больше 0 для хотя бы одного товара');
      return;
    }

    setIsSubmitting(true);
    try {
      const promises = validItems.map(item =>
        api.stockMovements.create({
          productId: item.productId,
          type: 'in',
          quantity: item.quantity,
          reason: item.reason,
          notes: item.notes,
          toLocation: item.toLocation
        })
      );

      await Promise.all(promises);

      // Reset form
      setIncomingItems([]);
      setShowIncomingForm(false);
      // Reset to first location
      if (locations.length > 0) {
        setSelectedLocation(locations[0]._id);
      }

      // Refresh movements
      await fetchIncomingMovements();

      setError(null);
    } catch (err: any) {
      console.error('Error submitting incoming items:', err);
      setError(err.message || 'Ошибка при создании поступления');
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
            }`}>Приход товаров</h1>
          <p className={`mt-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
            Всего записей: {groupedRows.length} | Общее количество: {totalQuantity} шт.
          </p>
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

      {/* Error Display */}
      {error && (
        <div className={`rounded-lg p-4 border transition-all duration-300 ${isDark
          ? 'bg-red-900/20 border-red-800'
          : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-center">
            <span className={`transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-800'
              }`}>{error}</span>
          </div>
        </div>
      )}

      {/* Incoming Form */}
      {showIncomingForm && (
        <div className={`rounded-xl shadow-lg p-6 transition-all duration-300 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
              }`}>
              Добавить товары в приход
            </h2>
            <button
              onClick={() => setShowIncomingForm(false)}
              className={`p-2 rounded-lg transition-colors duration-300 ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Location Selection */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
              Локация для поступления
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
                }`}
            >
              {locations.map((location) => (
                <option key={location._id} value={location._id}>
                  {location.name} {location.code && `(${location.code})`}
                </option>
              ))}
            </select>
          </div>

          {/* Product Search + Suppliers */}
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                <input
                  type="text"
                  placeholder="Поиск товаров..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (e.target.value.length > 2) {
                      fetchProducts(e.target.value);
                      setShowProductSearch(true);
                    } else {
                      setShowProductSearch(false);
                    }
                  }}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                />
              </div>

              {/* Suppliers dropdown */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="inline-flex items-center"><Building className="h-3 w-3 mr-1" /> Поставщики</span>
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => {
                    setSelectedSupplier(e.target.value);
                    // refresh list for current query
                    if (productSearch.length > 2) {
                      fetchProducts(productSearch);
                      setShowProductSearch(true);
                    }
                  }}
                  disabled={suppliersLoading}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                >
                  <option value="">Все поставщики</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product Search Results */}
            {showProductSearch && (
              <div className={`absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg shadow-lg border transition-colors duration-300 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                {products.length > 0 ? (
                  products.map((product) => (
                    <div
                      key={product._id}
                      onClick={() => addProductToIncoming(product)}
                      className={`p-3 cursor-pointer hover:bg-opacity-50 transition-colors duration-200 ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className={`font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                            {product.nameRu}
                          </div>
                          <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            {product.brand} • {product.model}
                          </div>
                        </div>
                        <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                          {product.stock} шт.
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`p-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Товары не найдены для выбранного поставщика
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Products */}
          {incomingItems.length > 0 && (
            <div className="space-y-3 mb-4">
              <h3 className={`font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>
                Выбранные товары:
              </h3>
              {incomingItems.map((item) => (
                <div key={item.productId} className={`p-4 rounded-lg border transition-colors duration-300 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className={`font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                        {item.product.nameRu}
                      </div>
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        {item.product.brand} • {item.product.model}
                      </div>
                    </div>
                    <button
                      onClick={() => removeProductFromIncoming(item.productId)}
                      className={`p-1 rounded transition-colors duration-300 ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                        }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Количество
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity === 0 ? '' : item.quantity}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                          updateIncomingItem(item.productId, 'quantity', value);
                        }}
                        className={`w-full px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                          ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Локация
                      </label>
                      <select
                        value={item.toLocation}
                        onChange={(e) => updateIncomingItem(item.productId, 'toLocation', e.target.value)}
                        className={`w-full px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                          ? 'bg-gray-600 border-gray-500 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                          }`}
                      >
                        {locations.map((location) => (
                          <option key={location._id} value={location._id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Причина
                      </label>
                      <input
                        type="text"
                        value={item.reason}
                        onChange={(e) => updateIncomingItem(item.productId, 'reason', e.target.value)}
                        className={`w-full px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                          ? 'bg-gray-600 border-gray-500 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                          }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Примечания
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateIncomingItem(item.productId, 'notes', e.target.value)}
                        className={`w-full px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                          ? 'bg-gray-600 border-gray-500 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                          }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowIncomingForm(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-300 ${isDark
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
            >
              Отмена
            </button>
            <button
              onClick={submitIncomingItems}
              disabled={incomingItems.length === 0 || incomingItems.every(item => item.quantity === 0) || isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${incomingItems.length === 0 || incomingItems.every(item => item.quantity === 0) || isSubmitting
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Создание...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Создать приход
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Panel */}
      <div className={`rounded-xl shadow-lg p-6 transition-all duration-300 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
        {/* Top Bar: Filter Button, Search, Action Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium text-sm shrink-0 ${showFiltersPanel
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <SlidersHorizontal size={18} />
              Фильтры
              {showFiltersPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <div className="relative flex-1 max-w-xl">
              <input
                type="text"
                placeholder="Поиск по товару, ID, примечанию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-4 pr-10 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                  }`}
              />
              <Search className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
          </div>

          <button
            onClick={() => navigate('/incoming-process')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
          >
            <Plus className="h-4 w-4" />
            <span>Приход</span>
          </button>
        </div>

        {/* Expandable Filter Panel */}
        {showFiltersPanel && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Параметры фильтрации
              </h3>
              <button
                onClick={clearAllFilters}
                className={`text-sm flex items-center gap-1 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
              >
                <RotateCcw className="h-3 w-3" />
                Сбросить все
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Period Presets */}
              <div className="col-span-full md:col-span-1 lg:col-span-4 flex gap-2 mb-2">
                <button onClick={() => setPeriodPreset('today')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Сегодня</button>
                <button onClick={() => setPeriodPreset('week')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Неделя</button>
                <button onClick={() => setPeriodPreset('month')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Месяц</button>
              </div>

              {/* Date From */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата с</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  />
                </div>
              </div>

              {/* Date To */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата по</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  />
                </div>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Поставщик</label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                >
                  <option value="">Все поставщики</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Склад / Локация</label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                >
                  <option value="">Все склады</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {/* User Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Сотрудник</label>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                >
                  <option value="">Все сотрудники</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
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
                  Закупка
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Опт
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Продажа
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Локация
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Пользователь
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Поставщик
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Дата
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Примечания
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Действия
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Статус
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y transition-colors duration-300 ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'
              }`}>
              {groupedRows.map((row) => {
                const movement = row.first;
                return (
                  <tr key={row.groupId} className={`transition-colors duration-200 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          const gid = row.groupId;
                          if (movement.status === 'draft') {
                            navigate(`/incoming-process?batch=${gid}`);
                            return;
                          }
                          setCurrentGroupId(String(gid));
                          const items = movements.filter(m => String(m.movementId || m.batchNumber || m._id) === String(gid));
                          setCurrentGroupItems(items);
                          setShowGroupModal(true);
                        }}
                        className={`text-sm font-medium underline transition-colors duration-300 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                          }`}
                        title="Показать товары в группе"
                      >
                        {row.groupId}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                          {row.items.length > 1
                            ? formatTovarCount(row.items.length)
                            : (movement.productId?.nameRu || 'Товар')}
                        </div>
                        {row.items.length === 1 && (() => {
                          const parts = [movement.productId?.brand, movement.productId?.model]
                            .filter(Boolean)
                            .map((v) => String(v).trim())
                            .filter((v) => v.length > 0);
                          if (parts.length === 0) return null;
                          return (
                            <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                              {parts.join(' • ')}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
                        <span className={`text-sm font-medium text-green-600 transition-colors duration-300 ${isDark ? 'text-green-400' : 'text-green-600'
                          }`}>
                          +{row.totalQuantity} шт.
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        {(() => {
                          const prod = movement.productId as any;
                          const prodId = prod?._id || prod || '';
                          const fromList = products.find(p => String(p._id) === String(prodId));
                          // Try multiple sources: movement direct, productId populated, products list
                          const price = movement.purchasePrice
                            || prod?.purchasePrice
                            || prod?.priceOpt
                            || (fromList as any)?.purchasePrice
                            || (fromList as any)?.priceOpt
                            || 0;
                          return price > 0 ? `${Number(price).toLocaleString('ru-RU')} сум` : '—';
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        {(() => {
                          const prod = movement.productId as any;
                          const prodId = prod?._id || prod || '';
                          const fromList = products.find(p => String(p._id) === String(prodId));
                          const price = movement.wholesalePrice
                            || prod?.wholesalePrice
                            || prod?.priceOpt
                            || (fromList as any)?.wholesalePrice
                            || (fromList as any)?.priceOpt
                            || 0;
                          return price > 0 ? `${Number(price).toLocaleString('ru-RU')} сум` : '—';
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        {(() => {
                          const prod = movement.productId as any;
                          const prodId = prod?._id || prod || '';
                          const fromList = products.find(p => String(p._id) === String(prodId));
                          const price = movement.salePrice
                            || prod?.salePrice
                            || prod?.price
                            || (fromList as any)?.salePrice
                            || (fromList as any)?.price
                            || 0;
                          return price > 0 ? `${Number(price).toLocaleString('ru-RU')} сум` : '—';
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {row.items.length === 1 ? (
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          <div>
                            <div className="font-medium">
                              {movement.toLocation || movement.productId?.location || '—'}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Всего: {movement.productId?.stock || 0} шт.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="h-4 w-4 mr-1" />
                        {movement.userId.firstName} {movement.userId.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        {(() => {
                          const prod: any = movement.productId as any;
                          let fromNotes = '';
                          if (movement.notes) {
                            const m = movement.notes.match(/Поставщик:\s*([^\n]+)/i);
                            if (m) fromNotes = m[1].trim();
                          }
                          const candidates = [
                            (movement as any).supplierName,
                            prod?.supplierName,
                            prod?.supplier?.name,
                            prod?.supplier,
                            (movement as any).supplierId,
                            prod?.supplierId,
                            prod?.supplier_id
                          ].filter(Boolean).map((v: any) => String(v));
                          const name = candidates.find(Boolean) || fromNotes || '—';
                          return name;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        {new Date(movement.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                      <div className={`text-xs transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        {new Date(movement.createdAt).toLocaleTimeString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        {(() => {
                          if (!movement.notes) return '—';
                          // Remove "Поставщик:" and everything after it
                          const cleaned = movement.notes.replace(/Поставщик:\s*[^\n]*(?:\n|$)/gi, '').trim();
                          return cleaned || '—';
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditMovement(movement, row.items)}
                          className={`p-2 rounded-lg transition-colors duration-300 ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                            }`}
                          title="Редактировать примечание"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            console.log('Delete button clicked for movement:', movement);
                            console.log('Movement _id:', movement._id);
                            console.log('Movement movementId:', movement.movementId);
                            setSelectedMovement(movement);
                            setShowDeleteModal(true);
                          }}
                          className={`p-2 rounded-lg transition-colors duration-300 ${isDark
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-red-100 hover:bg-red-200 text-red-600'
                            }`}
                          title="Удалить приходное движение"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${movement.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                        }`}>
                        {movement.status === 'draft' ? 'Не завершено' : 'Завершено'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredMovements.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Записи прихода не найдены</h3>
            <p className="mt-1 text-sm text-gray-500">
              Попробуйте изменить параметры поиска или дождитесь поступления товаров.
            </p>
          </div>
        )}
      </div>



      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg shadow-xl max-w-md w-full mx-4 transition-colors duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
            }`}>
            <div className="flex items-center mb-4">
              <div className={`p-2 rounded-full mr-3 ${isDark ? 'bg-red-900' : 'bg-red-100'
                }`}>
                <Trash2 className={`h-6 w-6 ${isDark ? 'text-red-400' : 'text-red-600'
                  }`} />
              </div>
              <h3 className={`text-lg font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>
                Удалить приходное движение
              </h3>
            </div>

            <p className={`mb-6 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
              Вы уверены, что хотите удалить это приходное движение? Это действие нельзя отменить.
            </p>

            {selectedMovement && (
              <div className={`mb-6 p-4 rounded-lg transition-colors duration-300 ${isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                <div className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                  {selectedMovement.productId?.nameRu || 'Товар не найден'}
                </div>
                <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                  Количество: {selectedMovement.quantity}
                </div>
                <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                  Дата: {new Date(selectedMovement.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedMovement(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-300 ${isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteMovement}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors duration-300 flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Details Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col mx-4 transition-colors duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6 flex-shrink-0">
              <div>
                <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Товары в группе перемещений</h2>
                <div className="flex gap-3">
                  <div className={`px-4 py-1.5 rounded-lg border text-sm font-medium ${isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                    общая сумма: {currentGroupItems.reduce((sum, m) => {
                      const price = m.purchasePrice || (m.productId as any)?.purchasePrice || 0;
                      return sum + (price * m.quantity);
                    }, 0).toLocaleString('ru-RU')} сум
                  </div>
                  <div className={`px-4 py-1.5 rounded-lg border text-sm font-medium ${isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                    {currentGroupItems.length} товаров
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`px-3 py-1 rounded text-sm font-mono ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  ID: {currentGroupId}
                </div>
                <button
                  onClick={handlePrintGroup}
                  className={`p-1 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Печать накладной"
                >
                  <Printer className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setShowGroupModal(false)}
                  className={`p-1 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
              {/* History Section */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>История изменений</h3>
                <div className="space-y-3">
                  {currentGroupItems.map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {item.userId?.firstName} {item.userId?.lastName}
                          </div>
                          <div className={`text-sm mt-1 flex items-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <MapPin className="h-3 w-3 mr-1" />
                            {/* Location logic */}
                            <span>
                              {item.fromLocation || 'Поставщик'} → {item.toLocation || item.productId?.location || 'Склад'}
                            </span>
                            <span className={`ml-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.quantity} шт.</span>
                          </div>
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(item.createdAt).toLocaleDateString('ru-RU')} • {new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product List Section */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Список товаров</h3>
                <div className="space-y-4">
                  {currentGroupItems.map((item, idx) => {
                    const price = item.purchasePrice || (item.productId as any)?.purchasePrice || 0;
                    const total = price * item.quantity;
                    return (
                      <div key={idx} className={`p-5 rounded-xl border relative overflow-hidden ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                        {/* Index Badge */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>

                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              {idx + 1}
                            </div>
                          </div>

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {item.productId?.nameRu} {item.productId?.brand ? `- ${item.productId.brand}` : ''}
                              </h4>

                              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                <div>
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ДАТА И ВРЕМЯ</div>
                                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {new Date(item.createdAt).toLocaleDateString('ru-RU')} — {new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                <div>
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>КТО ИЗМЕНИЛ</div>
                                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {item.userId?.firstName} {item.userId?.lastName}
                                  </div>
                                </div>
                                <div>
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ОТКУДА / КУДА</div>
                                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <MapPin className="inline h-3 w-3 mr-1" />
                                    {item.fromLocation || 'Поставщик'} → {item.toLocation || item.productId?.location || 'Склад'}
                                  </div>
                                </div>
                                <div>
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ТОВАРЫ, ШТ</div>
                                  <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {item.quantity} шт.
                                  </div>
                                </div>
                              </div>

                              <div className={`mt-4 text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                {price.toLocaleString('ru-RU')} сум × {item.quantity} шт. = {total.toLocaleString('ru-RU')} сум
                              </div>
                            </div>

                            <div className="flex flex-col items-end justify-start">
                              <div className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                {item.quantity} шт.
                              </div>
                              <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {price.toLocaleString('ru-RU')} сум/шт.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomingPage;


