import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { RefreshCw, Search, AlertCircle, FileText, X, SlidersHorizontal, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RotateCcw } from 'lucide-react';

const SalesReturnsPage: React.FC = () => {
    const { isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<'requests' | 'history'>('requests');
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewReturnModal, setShowNewReturnModal] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterAmountMin, setFilterAmountMin] = useState<string>('');
    const [filterAmountMax, setFilterAmountMax] = useState<string>('');
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // Return Modal State
    const [searchOrderQuery, setSearchOrderQuery] = useState('');
    const [foundOrder, setFoundOrder] = useState<any | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
    const [returnReason, setReturnReason] = useState('');
    const [processingReturn, setProcessingReturn] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    useEffect(() => {
        fetchReturns();
    }, [activeTab, startDate, endDate]);

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const params: any = { limit: 100 };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await api.orders.getAll(params);
            if (response.success) {
                const filtered = response.data.filter((o: any) =>
                    ['returned', 'partially_returned', 'cancelled'].includes(o.status)
                );
                setReturns(filtered);
            }
        } catch (error) {
            console.error('Error fetching returns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchOrder = async (query: string) => {
        if (!query.trim()) return;
        setSearchLoading(true);
        setFoundOrder(null);
        setReturnQuantities({});
        try {
            const res = await api.orders.getAll({ limit: 1000 });
            if (res.success) {
                const order = res.data.find((o: any) =>
                    (o.orderNumber || '').toLowerCase() === query.toLowerCase() ||
                    (o.invoiceNumber || '').toLowerCase() === query.toLowerCase()
                );

                if (order) {
                    setFoundOrder(order);
                    const initialQty: Record<string, number> = {};
                    (order.items || []).forEach((item: any) => {
                        const pid = item.product?._id || item.product?.id || item.product;
                        if (pid) initialQty[pid] = 0;
                    });
                    setReturnQuantities(initialQty);
                } else {
                    alert('Заказ не найден');
                }
            } else {
                alert('Ошибка при поиске заказа');
            }
        } catch (e) {
            console.error(e);
            alert('Ошибка при поиске заказа');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleProcessReturn = async () => {
        if (!foundOrder) return;

        const itemsToReturn = (foundOrder.items || []).filter((item: any) => {
            const pid = item.product?._id || item.product?.id || item.product;
            return pid && (returnQuantities[pid] || 0) > 0;
        });

        if (itemsToReturn.length === 0) {
            alert('Выберите товары для возврата (укажите количество > 0)');
            return;
        }

        setProcessingReturn(true);
        try {
            // 1. Create Stock Movements (IN)
            const movements = itemsToReturn.map((item: any) => {
                const pid = item.product?._id || item.product?.id || item.product;
                return {
                    productId: pid,
                    type: 'in' as const,
                    quantity: returnQuantities[pid],
                    reason: 'Возврат от клиента: ' + (returnReason || 'Без причины'),
                    notes: `Возврат по заказу ${foundOrder.orderNumber}`,
                    // toLocation: undefined // Default
                };
            });

            await api.stockMovements.bulk(movements);

            // 2. Update Order Status
            const allReturned = itemsToReturn.length === foundOrder.items.length &&
                itemsToReturn.every((i: any) => {
                    const pid = i.product?._id || i.product?.id || i.product;
                    return returnQuantities[pid] >= i.quantity;
                });

            const newStatus = allReturned ? 'returned' : 'partially_returned'; // Note: Ensure backend supports 'partially_returned'

            // Pass returnReason as cancelReason
            await api.orders.updateStatus(foundOrder._id || foundOrder.id, newStatus, returnReason || 'Возврат');

            alert('Возврат успешно оформлен!');
            setShowNewReturnModal(false);
            setFoundOrder(null);
            setSearchOrderQuery('');
            fetchReturns();

        } catch (e: any) {
            console.error('Process Return Error:', e);
            const msg = e.response?.data?.message || e.message || 'Ошибка при оформлении возврата';
            const details = e.response?.data?.errors ? '\n' + e.response.data.errors.join('\n') : '';
            alert(msg + details);
        } finally {
            setProcessingReturn(false);
        }
    };

    const handleRestoreOrder = async (orderId: string) => {
        if (!confirm('Вы уверены, что хотите восстановить этот заказ? Если это был возврат, остатки на складе НЕ изменятся автоматически.')) return;

        try {
            const res = await api.orders.restore(orderId);
            if (res.success) {
                alert('Заказ успешно восстановлен');
                fetchReturns();
            } else {
                alert('Ошибка при восстановлении заказа');
            }
        } catch (e) {
            console.error(e);
            alert('Ошибка при восстановлении заказа');
        }
    };

    const handleViewDetail = (ret: any) => {
        setSelectedReturn(ret);
        setIsDetailModalOpen(true);
    };

    const setPeriodPreset = (preset: 'today' | 'week' | 'month') => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (preset === 'today') {
            setStartDate(today.toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        } else if (preset === 'week') {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            setStartDate(weekStart.toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        } else {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(monthStart.toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
        }
    };

    const clearAllFilters = () => {
        setFilterStatus('all');
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
        setFilterAmountMin('');
        setFilterAmountMax('');
        setShowFiltersPanel(false);
    };

    const applyFilters = () => { setShowFiltersPanel(false); };

    const filteredReturns = useMemo(() => {
        const q = (searchQuery || '').trim().toLowerCase();
        const minA = filterAmountMin ? Number(filterAmountMin) : null;
        const maxA = filterAmountMax ? Number(filterAmountMax) : null;
        return returns.filter(r => {
            const customerName = r.customer ? `${r.customer.firstName || ''} ${r.customer.lastName || ''}`.trim() || 'Гость' : 'Гость';
            const matchesSearch = !q ||
                customerName.toLowerCase().includes(q) ||
                (r.orderNumber || r.invoiceNumber || '').toLowerCase().includes(q) ||
                (r.notes || '').toLowerCase().includes(q);
            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
            const amount = r.total ?? 0;
            const matchesAmount = (minA == null || amount >= minA) && (maxA == null || amount <= maxA);
            return matchesSearch && matchesStatus && matchesAmount;
        });
    }, [returns, searchQuery, filterStatus, filterAmountMin, filterAmountMax]);

    const handlePrintReturn = () => {
        if (!selectedReturn) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const customerName = selectedReturn.customer ? `${selectedReturn.customer.firstName || ''} ${selectedReturn.customer.lastName || ''}`.trim() : 'Гость';
        const dateStr = format(new Date(selectedReturn.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru });
        const totalSum = selectedReturn.total || 0;

        const isCancelled = selectedReturn.status === 'cancelled';
        const title = isCancelled ? 'Акт отмены заказа' : 'Накладная на возврат';

        const html = `
          <html>
            <head>
              <title>${title} #${selectedReturn.orderNumber}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .header { margin-bottom: 20px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                .total { margin-top: 20px; text-align: right; font-weight: bold; font-size: 1.2em; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; }
                .sign { border-top: 1px solid #000; width: 200px; padding-top: 5px; text-align: center; }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>${title} № ${selectedReturn.orderNumber}</h2>
                <p>Дата: ${dateStr}</p>
              </div>
              
              <div class="info-grid">
                <div>
                  <strong>Клиент:</strong><br>
                  ${customerName}
                </div>
                <div>
                  <strong>Принял:</strong><br>
                  ${isCancelled
                ? (selectedReturn.cancelledBy ? `${selectedReturn.cancelledBy.firstName} ${selectedReturn.cancelledBy.lastName}` : '---')
                : (selectedReturn.returnedBy ? `${selectedReturn.returnedBy.firstName} ${selectedReturn.returnedBy.lastName}` : '---')}
                </div>
              </div>

               ${selectedReturn.cancelReason ? `<p><strong>Причина:</strong> ${selectedReturn.cancelReason}</p>` : ''}
               ${selectedReturn.notes ? `<p><strong>Комментарий:</strong> ${selectedReturn.notes}</p>` : ''}

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
                  ${(selectedReturn.items || []).map((item: any, idx: number) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.product?.nameRu || item.product?.name || 'Товар'}</td>
                      <td>${item.quantity} шт.</td>
                      <td>${(item.price || 0).toLocaleString('ru-RU')} сум</td>
                      <td>${(item.total || (item.price * item.quantity) || 0).toLocaleString('ru-RU')} сум</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="total">
                Сумма возврата: ${totalSum.toLocaleString('ru-RU')} сум
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

    return (
        <div className={`min-h-screen p-6 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                        Возвраты
                    </h1>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Управление возвратами и отменами
                    </p>
                </div>
                <button
                    onClick={() => setShowNewReturnModal(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 font-medium transition-all"
                >
                    <RefreshCw size={18} />
                    Создать возврат
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600"><AlertCircle size={20} /></div>
                        <span className="text-sm text-gray-500 font-medium">Отменены/Возвращены</span>
                    </div>
                    <p className="text-2xl font-bold">{returns.length}</p>
                </div>
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600"><RefreshCw size={20} /></div>
                        <span className="text-sm text-gray-500 font-medium">Сумма возвратов</span>
                    </div>
                    <p className="text-2xl font-bold">
                        {returns.reduce((acc, curr) => acc + (curr.total || 0), 0).toLocaleString()} UZS
                    </p>
                </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex gap-4 w-full lg:w-auto">
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            История
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <button
                            type="button"
                            onClick={() => setShowFiltersPanel(prev => !prev)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium text-sm shrink-0 ${showFiltersPanel ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25' : isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'}`}
                        >
                            <SlidersHorizontal size={18} />
                            Фильтры
                            {showFiltersPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <div className="relative w-full sm:w-64">
                            <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-4 pr-10 py-2 text-sm rounded-lg border outline-none focus:ring-1 focus:ring-orange-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'}`} />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                {showFiltersPanel && (
                    <div className={`p-4 border-b border-gray-200 dark:border-gray-700 rounded-b-2xl ${isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Расширенные фильтры</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={clearAllFilters} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Очистить</button>
                                <button onClick={applyFilters} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all">Найти</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Статус</label>
                                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                                    <option value="all">Все</option>
                                    <option value="returned">Возврат</option>
                                    <option value="partially_returned">Частичный возврат</option>
                                    <option value="cancelled">Отменено</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Период</label>
                                <div className="flex gap-2 flex-wrap">
                                    <button type="button" onClick={() => setPeriodPreset('today')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Сегодня</button>
                                    <button type="button" onClick={() => setPeriodPreset('week')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Неделя</button>
                                    <button type="button" onClick={() => setPeriodPreset('month')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Месяц</button>
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата с</label>
                                <div className="relative" lang="ru">
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 relative z-10 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} ${!startDate ? 'text-transparent' : isDark ? 'text-white' : 'text-gray-900'}`} title="дд.мм.гггг" />
                                    {!startDate && <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none z-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>дд.мм.гггг</span>}
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата по</label>
                                <div className="relative" lang="ru">
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 relative z-10 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} ${!endDate ? 'text-transparent' : isDark ? 'text-white' : 'text-gray-900'}`} title="дд.мм.гггг" />
                                    {!endDate && <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none z-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>дд.мм.гггг</span>}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Номер или комментарий</label>
                                <div className="relative">
                                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Номер заказа, клиент, комментарий..." className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                                    <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Сумма от (UZS)</label>
                                <input type="number" min={0} value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} placeholder="0" className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Сумма до (UZS)</label>
                                <input type="number" min={0} value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} placeholder="—" className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className={`uppercase text-xs font-semibold ${isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            <tr>
                                <th className="px-6 py-4 font-black">ID</th>
                                <th className="px-6 py-4">Клиент</th>
                                <th className="px-6 py-4">Дата</th>
                                <th className="px-6 py-4">Сумма</th>
                                <th className="px-6 py-4">Статус</th>
                                <th className="px-6 py-4">Кем обработан</th>
                                <th className="px-6 py-4 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-8">Загрузка...</td></tr>
                            ) : filteredReturns.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-500">Нет данных</td></tr>
                            ) : filteredReturns.map((ret) => (
                                <tr key={ret._id} className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleViewDetail(ret)}
                                            className="font-bold text-[11px] text-blue-600 hover:text-blue-500 hover:underline"
                                        >
                                            {String(ret.orderNumber || ret.invoiceNumber || '').replace(/\D/g, '').padStart(6, '0') || '000000'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-medium">
                                        {ret.customer ? `${ret.customer.firstName} ${ret.customer.lastName}` : 'Гость'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {format(new Date(ret.createdAt), 'dd.MM.yyyy', { locale: ru })}
                                    </td>
                                    <td className="px-6 py-4 font-mono font-medium">{ret.total || ret.totalAmountUSD} UZS</td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleViewDetail(ret)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:scale-105 active:scale-95 ${ret.status === 'returned' || ret.status === 'cancelled'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                }`}
                                        >
                                            {ret.status === 'cancelled' ? 'Отменен' : 'Возврат'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {ret.status === 'cancelled'
                                                    ? (ret.cancelledBy ? `${ret.cancelledBy.firstName} ${ret.cancelledBy.lastName}` : '---')
                                                    : (ret.returnedBy ? `${ret.returnedBy.firstName} ${ret.returnedBy.lastName}` : '---')
                                                }
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {format(new Date(ret.status === 'cancelled' ? (ret.cancelledAt || ret.updatedAt) : (ret.returnedAt || ret.updatedAt)), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleRestoreOrder(ret._id || ret.id)}
                                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                                title="Восстановить заказ"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleViewDetail(ret)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Посмотреть детали"
                                            >
                                                <FileText size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showNewReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-2xl rounded-2xl shadow-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <h2 className="text-xl font-bold mb-4">Оформить возврат</h2>

                        {!foundOrder ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-500">№ Заказа / Накладной</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Например: ORD-8821"
                                            className={`flex-1 p-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                            value={searchOrderQuery}
                                            onChange={(e) => setSearchOrderQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSearchOrder(searchOrderQuery);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => handleSearchOrder(searchOrderQuery)}
                                            disabled={searchLoading}
                                            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400 rounded-lg font-medium transition-colors"
                                        >
                                            {searchLoading ? 'Поиск...' : 'Найти'}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                                    ℹ️ Введите номер заказа для оформления возврата.
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-lg">{foundOrder.orderNumber}</span>
                                        <span className="text-sm text-gray-500">{new Date(foundOrder.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm">
                                        Клиент: <span className="font-medium">{foundOrder.customer?.firstName} {foundOrder.customer?.lastName}</span>
                                    </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto border rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className={isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}>
                                            <tr>
                                                <th className="p-2">Товар</th>
                                                <th className="p-2 text-right">Куплено</th>
                                                <th className="p-2 text-right">Цена</th>
                                                <th className="p-2 text-right">Возврат</th>
                                            </tr>
                                        </thead>
                                        <tbody className={isDark ? 'divide-gray-600' : 'divide-gray-200'}>
                                            {foundOrder.items.map((item: any, idx: number) => {
                                                const pid = item.product?._id || item.product?.id || item.product;
                                                const maxQty = item.quantity || 0;
                                                const name = item.product?.nameRu || item.product?.name || 'Товар';

                                                return (
                                                    <tr key={idx} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                                        <td className="p-2 overflow-hidden max-w-[200px] truncate" title={name}>{name}</td>
                                                        <td className="p-2 text-right">{maxQty}</td>
                                                        <td className="p-2 text-right">{item.price}</td>
                                                        <td className="p-2 text-right">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={maxQty}
                                                                className={`w-20 p-1 border rounded text-right ${isDark ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'}`}
                                                                value={returnQuantities[pid] || 0}
                                                                onChange={(e) => {
                                                                    const val = Math.min(maxQty, Math.max(0, parseInt(e.target.value) || 0));
                                                                    setReturnQuantities(prev => ({ ...prev, [pid]: val }));
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Причина возврата</label>
                                    <textarea
                                        className={`w-full p-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                        rows={2}
                                        value={returnReason}
                                        onChange={(e) => setReturnReason(e.target.value)}
                                        placeholder="Брак, не подошло, ошибка..."
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => { setShowNewReturnModal(false); setFoundOrder(null); setSearchOrderQuery(''); }}
                                className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium"
                            >
                                Отмена
                            </button>
                            {foundOrder && (
                                <button
                                    onClick={handleProcessReturn}
                                    disabled={processingReturn}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
                                >
                                    {processingReturn ? 'Обработка...' : 'Подтвердить возврат'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Detail Modal */}
            {isDetailModalOpen && selectedReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-xl font-bold">{selectedReturn.orderNumber}</h2>
                                <p className="text-sm text-gray-500">Детали возврата/отмены</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrintReturn}
                                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                    title="Печать"
                                >
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Статус</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedReturn.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {selectedReturn.status === 'cancelled' ? 'Отменен' : 'Возврат'}
                                    </span>
                                </div>
                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Сумма</p>
                                    <p className="font-mono font-bold text-lg">{selectedReturn.total?.toLocaleString()} UZS</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Клиент</p>
                                    <p className="font-medium">{selectedReturn.customer ? `${selectedReturn.customer.firstName} ${selectedReturn.customer.lastName}` : '---'}</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Обработал</p>
                                    <p className="font-medium">
                                        {selectedReturn.status === 'cancelled'
                                            ? (selectedReturn.cancelledBy ? `${selectedReturn.cancelledBy.firstName} ${selectedReturn.cancelledBy.lastName}` : '---')
                                            : (selectedReturn.returnedBy ? `${selectedReturn.returnedBy.firstName} ${selectedReturn.returnedBy.lastName}` : '---')
                                        }
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold uppercase text-gray-500 mb-3 ml-1">Товары</h3>
                                <div className="border rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                                    {(selectedReturn.items || []).map((item: any, i: number) => (
                                        <div key={i} className={`p-4 flex justify-between items-center ${isDark ? 'bg-gray-900/30' : 'bg-white'}`}>
                                            <div>
                                                <p className="font-medium text-sm">{item.product?.nameRu || 'Товар'}</p>
                                                <p className="text-xs text-gray-500">{item.quantity} шт. × {item.price?.toLocaleString()} UZS</p>
                                            </div>
                                            <p className="font-mono font-bold">{(item.quantity * item.price)?.toLocaleString()} UZS</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedReturn.cancelReason && (
                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-red-900/10 border-red-900/20' : 'bg-red-50 border-red-100'}`}>
                                    <p className="text-xs text-red-500 uppercase font-bold mb-1">Причина</p>
                                    <p className="text-sm">{selectedReturn.cancelReason}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-6 py-2.5 bg-gray-800 dark:bg-gray-700 text-white rounded-xl font-medium"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesReturnsPage;
