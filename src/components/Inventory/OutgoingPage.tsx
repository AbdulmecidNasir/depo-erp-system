import React, { useState, useEffect, useMemo } from 'react';
import { Package, TrendingDown, User, MapPin, Search, Plus, X, Download, AlertCircle, Eye, Trash2, SlidersHorizontal, ChevronUp, ChevronDown, RotateCcw, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { exportToExcelWithOptions } from '../../utils/excelExport';

interface StockMovement {
  _id: string;
  movementId?: string;
  productId: {
    _id: string;
    nameRu: string;
    brand: string;
    model: string;
    location: string;
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
  };
  toLocation?: string;
  fromLocation?: string;
  createdAt: string;
  updatedAt: string;
  status?: 'completed' | 'draft' | 'pending';
}

const OutgoingPage: React.FC = () => {
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

  // Filter States
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filterUser, setFilterUser] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const uniqueReasons = useMemo(() => Array.from(new Set(movements.map(m => m.reason).filter(Boolean))), [movements]);

  const fetchFiltersData = async () => {
    try {
      const [u, l] = await Promise.all([api.users.getAll(), api.locations.getAll({ limit: 100 })]);
      if (u.success) setUsers(u.data);
      if (l.success) setLocations(l.data);
    } catch (e) { console.error(e); }
  };

  const setPeriodPreset = (preset: 'today' | 'week' | 'month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    if (preset === 'week') start.setDate(today.getDate() - today.getDay() + 1);
    else if (preset === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
    setDateFrom(start.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  };

  const clearAllFilters = () => {
    setSearchQuery(''); setDateFrom(''); setDateTo('');
    setFilterUser(''); setFilterLocation(''); setFilterReason('');
  };

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState<string>('');
  const [currentGroupItems, setCurrentGroupItems] = useState<StockMovement[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    fetchOutgoingMovements();
    fetchFiltersData();
  }, []);


  const fetchOutgoingMovements = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.stockMovements.getAll({
        type: 'out',
        page: 1,
        limit: 100
      });

      if (response.success) {
        setMovements(response.data);
      } else {
        throw new Error('Не удалось загрузить данные');
      }
    } catch (err: any) {
      console.error('Error fetching outgoing movements:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter(movement => {
    const q = (searchQuery || '').trim().toLowerCase();

    // New Filters logic
    if (filterUser && movement.userId?._id !== filterUser) return false;
    if (filterReason && movement.reason !== filterReason) return false;
    if (filterLocation) {
      const locName = locations.find(l => l._id === filterLocation)?.name;
      const mLoc = movement.fromLocation || movement.productId?.location;
      if (mLoc !== filterLocation && (!locName || mLoc !== locName)) return false;
    }

    const matchesSearch = q === '' ||
      (movement.movementId && String(movement.movementId).toLowerCase().includes(q)) ||
      (movement._id && String(movement._id).toLowerCase().includes(q)) ||
      ((movement as any).batchNumber && String((movement as any).batchNumber).toLowerCase().includes(q)) ||
      (movement.productId?.nameRu && movement.productId.nameRu.toLowerCase().includes(q)) ||
      (movement.productId?.brand && movement.productId.brand.toLowerCase().includes(q)) ||
      (movement.productId?.model && movement.productId.model.toLowerCase().includes(q)) ||
      (movement.reason && String(movement.reason).toLowerCase().includes(q)) ||
      (movement.notes && String(movement.notes).toLowerCase().includes(q));

    let matchesDate = true;
    const md = new Date(movement.createdAt);
    md.setHours(0, 0, 0, 0);
    if (dateFrom) { const f = new Date(dateFrom); f.setHours(0, 0, 0, 0); if (md < f) matchesDate = false; }
    if (dateTo) { const t = new Date(dateTo); t.setHours(23, 59, 59, 999); if (md > t) matchesDate = false; }

    return matchesSearch && matchesDate;
  });

  const handleDeleteGroup = async (items: StockMovement[]) => {
    if (!window.confirm(`Вы уверены, что хотите удалить ${items.length === 1 ? 'эту запись' : 'эту группу списаний (' + items.length + ' позиций)'}?`)) return;

    try {
      setLoading(true);
      const results = await Promise.all(items.map(item => api.stockMovements.delete(item._id)));
      const failedCount = results.filter(r => !r.success).length;

      if (failedCount === 0) {
        alert('Удаление выполнено успешно');
      } else if (failedCount < items.length) {
        alert(`Частичное удаление: ${items.length - failedCount} успешно, ${failedCount} ошибка`);
      } else {
        alert('Не удалось удалить записи');
      }

      await fetchOutgoingMovements();
    } catch (err: any) {
      console.error('Error deleting movements:', err);
      alert('Ошибка при удалении: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  const totalQuantity = filteredMovements.reduce((sum, movement) => sum + movement.quantity, 0);

  // Group rows by movementId/batchNumber like IncomingPage
  // Prioritize movementId (sequential 6-digit) over batchNumber
  const getGroupId = (m: StockMovement) => String(m.movementId || (m as any).batchNumber || m._id);
  const groupedMap = new Map<string, { items: StockMovement[]; first: StockMovement; totalQuantity: number }>();
  filteredMovements.forEach((m) => {
    const gid = getGroupId(m);
    if (!groupedMap.has(gid)) groupedMap.set(gid, { items: [], first: m, totalQuantity: 0 });
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

        return {
          movementId: movement.movementId || movement._id,
          productName: productName || 'Неизвестный товар',
          productId: productId || '',
          quantity: row.totalQuantity,
          reason: movement.reason || '—',
          fromLocation: movement.toLocation || '—',
          userName: userName,
          date: movementDate,
          time: movementTime,
          notes: movement.notes || '—'
        };
      });

      const columns = [
        { key: 'movementId', header: 'ID списания', width: 18, alignment: 'center' as const },
        { key: 'productName', header: 'Товар', width: 40, alignment: 'left' as const },
        { key: 'productId', header: 'ID товара', width: 18, alignment: 'center' as const },
        { key: 'quantity', header: 'Количество (шт.)', width: 15, alignment: 'center' as const, type: 'number' as const },
        { key: 'reason', header: 'Причина списания', width: 25, alignment: 'left' as const },
        { key: 'fromLocation', header: 'Локация', width: 18, alignment: 'left' as const },
        { key: 'userName', header: 'Пользователь', width: 25, alignment: 'left' as const },
        { key: 'date', header: 'Дата', width: 15, alignment: 'center' as const },
        { key: 'time', header: 'Время', width: 12, alignment: 'center' as const },
        { key: 'notes', header: 'Примечания', width: 30, alignment: 'left' as const }
      ];

      const timestamp = new Date().toISOString().split('T')[0];
      await exportToExcelWithOptions(
        dataToExport,
        columns,
        `Списанные_товары_${timestamp}.xlsx`,
        'Списанные товары'
      );

      console.log('✅ Outgoing movements exported to Excel successfully');
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
      const price = (m.productId as any)?.purchasePrice || 0;
      return sum + (price * m.quantity);
    }, 0);

    const html = `
      <html>
        <head>
          <title>Акт списания #${currentGroupId}</title>
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
            <h2>Акт списания товаров № ${currentGroupId}</h2>
            <p>Дата печати: ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Товар</th>
                <th>Причина</th>
                <th>Кол-во</th>
                <th>Цена (себест.)</th>
                <th>Сумма потерь</th>
              </tr>
            </thead>
            <tbody>
              ${currentGroupItems.map((item, idx) => {
      const price = (item.productId as any)?.purchasePrice || 0;
      return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.productId?.nameRu} ${item.productId?.brand ? item.productId.brand : ''}</td>
                      <td>${item.reason || '-'}</td>
                      <td>${item.quantity} шт.</td>
                      <td>${price.toLocaleString('ru-RU')} сум</td>
                      <td>${(price * item.quantity).toLocaleString('ru-RU')} сум</td>
                    </tr>
                  `;
    }).join('')}
            </tbody>
          </table>
          <div class="total">
            Итого списано на сумму: ${totalSum.toLocaleString('ru-RU')} сум
          </div>
          
          <div class="footer">
            <div>
              <p>Утвердил:</p>
              <div class="sign">Подпись</div>
            </div>
            <div>
              <p>Сдал (МОЛ):</p>
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
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
            }`}>Списанные товары</h1>
          <p className={`mt-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
            Всего записей: {groupedRows.length} | Общее количество: {-totalQuantity} шт.
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

      {/* Group Details Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col mx-4 transition-colors duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6 flex-shrink-0">
              <div>
                <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Товары в списании</h2>
                <div className="flex gap-3">
                  <div className={`px-4 py-1.5 rounded-lg border text-sm font-medium ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    общая сумма: {currentGroupItems.reduce((sum, m) => {
                      const price = (m.productId as any)?.purchasePrice || 0;
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
                  title="Печать акта"
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
              {/* Product List Section */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Список товаров</h3>
                <div className="space-y-4">
                  {currentGroupItems.map((item, idx) => {
                    const price = (item.productId as any)?.purchasePrice || 0;
                    const total = price * item.quantity;
                    return (
                      <div key={idx} className={`p-5 rounded-xl border relative overflow-hidden ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                        {/* Index Badge */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>

                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
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
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>КТО СПИСАЛ</div>
                                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {item.userId?.firstName} {item.userId?.lastName}
                                  </div>
                                </div>
                                <div>
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ОТКУДА</div>
                                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <MapPin className="inline h-3 w-3 mr-1" />
                                    {item.fromLocation || item.productId?.location || 'Склад'}
                                  </div>
                                </div>
                                <div>
                                  <div className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>КОЛИЧЕСТВО</div>
                                  <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {item.quantity} шт.
                                  </div>
                                </div>
                              </div>

                              <div className={`mt-4 text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                {price.toLocaleString('ru-RU')} сум × {item.quantity} шт. = {total.toLocaleString('ru-RU')} сум (потеря)
                              </div>

                              {item.notes && (
                                <div className={`mt-2 text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  Примечание: {item.notes}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end justify-start">
                              <div className={`text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                -{item.quantity} шт.
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

      {/* Search and Filters Panel */}
      <div className={`rounded-xl shadow-lg p-6 transition-all duration-300 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Top Bar */}
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setShowFiltersPanel(!showFiltersPanel)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium text-sm shrink-0 ${showFiltersPanel ? 'bg-red-600 text-white border-red-600 shadow-md' : isDark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              <SlidersHorizontal size={18} />
              Фильтры
              {showFiltersPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div className="relative flex-1 max-w-xl">
              <input type="text" placeholder="Поиск по товару, причине, примечанию..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-4 pr-10 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-300 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'}`} />
              <Search className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
          </div>

          <button onClick={() => navigate('/writeoff-process')} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20">
            <Plus className="h-4 w-4" />
            <span>Списание</span>
          </button>
        </div>

        {/* Filters Panel */}
        {showFiltersPanel && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Параметры фильтрации</h3>
              <button onClick={clearAllFilters} className={`text-sm flex items-center gap-1 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                <RotateCcw className="h-3 w-3" />
                Сбросить все
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="col-span-full md:col-span-1 lg:col-span-4 flex gap-2 mb-2">
                <button onClick={() => setPeriodPreset('today')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Сегодня</button>
                <button onClick={() => setPeriodPreset('week')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Неделя</button>
                <button onClick={() => setPeriodPreset('month')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Месяц</button>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата с</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата по</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Сотрудник</label>
                <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <option value="">Все сотрудники</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Помещение / Склад</label>
                <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <option value="">Все локации</option>
                  {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Причина</label>
                <select value={filterReason} onChange={(e) => setFilterReason(e.target.value)} className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <option value="">Все причины</option>
                  {uniqueReasons.map((r, i) => <option key={i} value={r}>{r}</option>)}
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
                  Локация
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Пользователь
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Статус
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Дата
                </th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                  Действия
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
                            navigate(`/writeoff-process?batch=${gid}`);
                            return;
                          }
                          setCurrentGroupId(String(gid));
                          const items = filteredMovements.filter(m => String(m.movementId || (m as any).batchNumber || m._id) === String(gid));
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
                          {row.items.length > 1 ? `${row.items.length} товаров` : (movement.productId?.nameRu || 'Товар')}
                        </div>
                        {row.items.length === 1 && (
                          <div className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            {[movement.productId?.brand, movement.productId?.model].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrendingDown className="h-4 w-4 text-red-500 mr-2" />
                        <span className={`text-sm font-medium text-red-600 transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-600'
                          }`}>
                          -{row.totalQuantity} шт.
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1" />
                        {row.items.length === 1 ? (movement.fromLocation || movement.productId?.location || '—') : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="h-4 w-4 mr-1" />
                        {movement.userId.firstName} {movement.userId.lastName}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            const gid = row.groupId;
                            if (movement.status === 'draft') {
                              navigate(`/writeoff-process?batch=${gid}`);
                              return;
                            }
                            setCurrentGroupId(String(gid));
                            const items = filteredMovements.filter(m => String(m.movementId || (m as any).batchNumber || m._id) === String(gid));
                            setCurrentGroupItems(items);
                            setShowGroupModal(true);
                          }}
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                          title="Просмотр"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(row.items)}
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {
          filteredMovements.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Записи списания не найдены</h3>
              <p className="mt-1 text-sm text-gray-500">
                Попробуйте изменить параметры поиска или дождитесь списания товаров.
              </p>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default OutgoingPage;
