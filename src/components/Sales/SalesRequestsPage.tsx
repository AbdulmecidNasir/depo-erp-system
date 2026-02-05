import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import {
    Plus, Search, CheckCircle, XCircle,
    Package, FileText, Calendar, User, Printer, StickyNote, X,
    SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import DocumentRelations from './DocumentRelations';

interface OrderRequest {
    _id: string;
    orderNumber: string;
    createdAt: string;
    customer?: {
        _id: string;
        firstName?: string;
        lastName?: string;
        partyName?: string;
        name?: string;
    };
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'partially_returned';
    total: number;
    items: Array<{
        product: {
            name: string;
            nameRu?: string;
            brand?: string;
            model?: string;
            salePrice?: number;
            stock?: number;
        };
        quantity: number;
        price: number;
        total: number;
    }>;
    notes?: string;
    itemsCount?: number;
    // Relations populated
    shipments?: any[];
    payments?: any[];
    createdBy?: {
        _id: string;
        firstName?: string;
        lastName?: string;
    };
}

const SalesRequestsPage: React.FC = () => {
    const { isDark } = useTheme();
    const [requests, setRequests] = useState<OrderRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterAmountMin, setFilterAmountMin] = useState<string>('');
    const [filterAmountMax, setFilterAmountMax] = useState<string>('');
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // UI State
    const [selectedRequest, setSelectedRequest] = useState<OrderRequest | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Clients for Create Modal
    const [clients, setClients] = useState<any[]>([]);

    // Create Request State
    const [selectedClient, setSelectedClient] = useState('');
    const [newRequestItems, setNewRequestItems] = useState<Array<{ product: any, quantity: number, price: number }>>([]);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [productSearch, setProductSearch] = useState('');
    // UI state for products removed if not needed to avoid lint

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(timer);
    }, [filterStatus, startDate, endDate, searchQuery]);

    useEffect(() => {
        fetchClients();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true); // Re-using loading or I should keep loadingProducts
        try {
            const res = await api.products.getAll({ limit: 1000 });
            if (res.success) {
                setProducts(res.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const [debitorsRes, suppliersRes] = await Promise.all([
                api.debitors.getAll({ limit: 1000 }),
                api.suppliers.getAll({ limit: 1000 })
            ]);

            const allClients: any[] = [];

            if (debitorsRes.success && Array.isArray(debitorsRes.data)) {
                allClients.push(...debitorsRes.data.map((d: any) => ({
                    id: d._id || d.id,
                    name: d.partyName || 'Без названия',
                    type: 'debitor'
                })));
            }

            if (suppliersRes.success && Array.isArray(suppliersRes.data)) {
                allClients.push(...suppliersRes.data.map((s: any) => ({
                    id: s.id || s._id,
                    name: s.name || s.partyName || 'Без названия',
                    type: 'supplier'
                })));
            }

            setClients(allClients);
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    const getCustomerName = (customer: any) => {
        if (!customer) return 'Гость';
        if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
        if (customer.firstName) return customer.firstName;
        if (customer.partyName) return customer.partyName;
        if (customer.name) return customer.name;
        return 'Клиент';
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params: any = { limit: 1000 };
            if (filterStatus !== 'all') params.status = filterStatus;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const response = await api.orders.getAll(params);
            if (response.success) {
                setRequests(response.data as unknown as OrderRequest[]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestClick = async (req: OrderRequest) => {
        setSelectedRequest(req);
        setIsDetailModalOpen(true);

        // Fetch full details
        try {
            const res = await api.orders.getById(req._id);
            if (res.success) {
                setSelectedRequest(res.data);
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
        }
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

    const filteredRequests = useMemo(() => {
        const q = (searchQuery || '').trim().toLowerCase();
        const minA = filterAmountMin ? Number(filterAmountMin) : null;
        const maxA = filterAmountMax ? Number(filterAmountMax) : null;
        return requests.filter(req => {
            const customerName = getCustomerName(req.customer);
            const matchesSearch = !q ||
                customerName.toLowerCase().includes(q) ||
                (req.orderNumber || '').toLowerCase().includes(q) ||
                (req.notes || '').toLowerCase().includes(q);
            const amount = req.total ?? 0;
            const matchesAmount = (minA == null || amount >= minA) && (maxA == null || amount <= maxA);
            return matchesSearch && matchesAmount;
        });
    }, [requests, searchQuery, filterAmountMin, filterAmountMax]);

    // stats constant removed as it was unused

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'shipped': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
            case 'delivered': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: 'Ожидает',
            confirmed: 'Подтвержден',
            cancelled: 'Отменен',
            processing: 'В обработке',
            shipped: 'Отгружен',
            delivered: 'Доставлен',
            completed: 'Завершен',
            returned: 'Возврат',
            partially_returned: 'Частичный возврат'
        };
        return labels[status] || status;
    };

    // ----- Create Request Logic -----

    const handleAddProductToRequest = (product: any) => {
        const existingItem = newRequestItems.find(item => item.product.id === product.id);
        if (existingItem) {
            alert('Этот товар уже добавлен');
            return;
        }
        setNewRequestItems([...newRequestItems, { product, quantity: 1, price: product.salePrice || 0 }]);
        setIsAddingProduct(false);
        setProductSearch('');
    };

    const handleUpdateItem = (index: number, field: 'quantity' | 'price', value: number) => {
        const updatedItems = [...newRequestItems];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setNewRequestItems(updatedItems);
    };

    const handleRemoveItem = (index: number) => {
        setNewRequestItems(newRequestItems.filter((_, i) => i !== index));
    };

    const handleCreateRequest = async () => {
        if (!selectedClient) {
            alert('Выберите клиента');
            return;
        }
        if (newRequestItems.length === 0) {
            alert('Добавьте хотя бы один товар');
            return;
        }

        try {
            const selectedClientObj = clients.find(c => c.id === selectedClient);
            const customerModel = selectedClientObj?.type === 'debitor' ? 'Debitor' :
                selectedClientObj?.type === 'supplier' ? 'Supplier' : 'User';

            const payload = {
                customerId: selectedClient,
                customerModel,
                items: newRequestItems.map(item => ({
                    product: item.product.id,
                    quantity: item.quantity,
                    price: item.price
                })),
                status: 'pending' as const
            };

            const res = await api.orders.create(payload);
            if (res.success) {
                setIsCreateModalOpen(false);
                setNewRequestItems([]);
                setSelectedClient('');
                fetchOrders();
            } else {
                console.error('Create request failed:', res);
                alert(`Ошибка при создании заявки: ${res.message || 'Неизвестная ошибка'}`);
            }
        } catch (error: any) {
            console.error('Create request error:', error);
            let errorMessage = error?.message || 'Ошибка при создании заявки';
            if (error?.response?.data?.message) errorMessage = error.response.data.message;
            alert(`Ошибка:\n${errorMessage}`);
        }
    };

    const handleStatusUpdate = async (status: 'confirmed' | 'cancelled') => {
        if (!selectedRequest) return;

        if (!confirm(`Вы уверены, что хотите ${status === 'confirmed' ? 'подтвердить' : 'отменить'} эту заявку?`)) {
            return;
        }

        try {
            const res = await api.orders.updateStatus(selectedRequest._id, status);
            if (res.success) {
                // Update local status immediately
                setSelectedRequest({ ...selectedRequest, status });
                // Update in the list
                setRequests(requests.map(req =>
                    req._id === selectedRequest._id ? { ...req, status } : req
                ));
                fetchOrders();
                alert(`Заявка ${status === 'confirmed' ? 'подтверждена' : 'отменена'}`);
            } else {
                alert(`Ошибка: ${res.message || 'Не удалось обновить статус'}`);
            }
        } catch (error: any) {
            alert(`Ошибка: ${error?.message || 'Не удалось обновить статус'}`);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return products.slice(0, 50);
        return products.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.barcode && p.barcode.includes(productSearch))
        ).slice(0, 50);
    }, [products, productSearch]);

    const handlePrintRequest = () => {
        if (!selectedRequest) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const customerName = getCustomerName(selectedRequest.customer);
        const dateStr = selectedRequest.createdAt ? format(new Date(selectedRequest.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : '-';
        const totalSum = selectedRequest.total || 0;

        const html = `
      <html>
        <head>
          <title>Заявка #${selectedRequest.orderNumber}</title>
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
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Заявка на продажу № ${selectedRequest.orderNumber}</h2>
            <p>Дата: ${dateStr}</p>
            <p>Статус: ${getStatusLabel(selectedRequest.status)}</p>
          </div>
          
          <div class="info-grid">
            <div>
              <strong>Клиент:</strong><br>
              ${customerName}
            </div>
            <div>
              <strong>Создал:</strong><br>
              ${selectedRequest.createdBy ? `${selectedRequest.createdBy.firstName || ''} ${selectedRequest.createdBy.lastName || ''}`.trim() : 'Система'}
            </div>
          </div>

          ${selectedRequest.notes ? `<p><strong>Комментарий:</strong> ${selectedRequest.notes}</p>` : ''}

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
              ${(selectedRequest.items || []).map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.product?.nameRu || item.product?.name || 'Товар'} ${item.product?.brand ? `(${item.product.brand})` : ''}</td>
                  <td>${item.quantity} шт.</td>
                  <td>${item.price.toLocaleString('ru-RU')} сум</td>
                  <td>${item.total.toLocaleString('ru-RU')} сум</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            Итого: ${totalSum.toLocaleString('ru-RU')} сум
          </div>
          
          <div class="footer">
            <div>
              <p>Менеджер:</p>
              <div class="sign">Подпись</div>
            </div>
            <div>
              <p>Клиент:</p>
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
        <div className={`min-h-screen p-6 transition-colors duration-300 font-sans ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Заявки
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all font-medium"
                    >
                        <Plus size={18} />
                        Создать заявку
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className={`p-4 rounded-xl border mb-6 flex flex-col lg:flex-row gap-6 justify-between items-center ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    {(['all', 'pending', 'confirmed', 'processing', 'cancelled'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterStatus === status
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {status === 'all' ? 'Все' : (
                                status === 'pending' ? 'Ожидают' :
                                    status === 'confirmed' ? 'Подтверждены' :
                                        status === 'processing' ? 'В обработке' :
                                            status === 'cancelled' ? 'Отменены' : status
                            )}
                        </button>
                    ))}
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
                        <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-4 pr-10 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                        <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                </div>
            </div>

            {showFiltersPanel && (
                <div className={`mb-6 rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ${isDark ? 'bg-gray-800/90 border-gray-700 backdrop-blur-sm' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
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
                                    <option value="pending">Ожидает</option>
                                    <option value="confirmed">Подтверждено</option>
                                    <option value="processing">В обработке</option>
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
                                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Номер заявки, клиент, комментарий..." className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
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
                </div>
            )}

            {/* Table View */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-xs uppercase ${isDark ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            <tr>
                                <th className="px-6 py-4 font-black">ID</th>
                                <th className="px-6 py-4 font-medium">Дата и время</th>
                                <th className="px-6 py-4 font-medium">Клиент</th>
                                <th className="px-6 py-4 font-medium">Сумма</th>
                                <th className="px-6 py-4 font-medium">Статус</th>
                                <th className="px-6 py-4 font-medium">Кем создан</th>
                                <th className="px-6 py-4 font-medium">Комментарий</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        Заявки не найдены
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <tr
                                        key={req._id}
                                        className={`group transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleRequestClick(req)}
                                                className="font-bold text-[11px] text-blue-600 hover:text-blue-500 hover:underline"
                                            >
                                                #{req.orderNumber}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {req.createdAt ? format(new Date(req.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {getCustomerName(req.customer)}
                                        </td>
                                        <td className="px-6 py-4 font-mono font-medium">
                                            {req.total?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleRequestClick(req)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:scale-105 active:scale-95 ${getStatusColor(req.status)}`}
                                            >
                                                {getStatusLabel(req.status)}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {req.createdBy ? `${req.createdBy.firstName || ''} ${req.createdBy.lastName || ''}`.trim() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 italic truncate max-w-[200px]">
                                            {req.notes || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className={`text-xs ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                            <tr>
                                <td colSpan={6} className="px-6 py-3 text-right text-gray-500">
                                    Всего: {filteredRequests.length}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* DETAIL MODAL */}
            {isDetailModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
                    <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>

                        {/* Modal Header */}
                        <div className={`flex justify-between items-center p-6 border-b ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-3">
                                        Заявка № {selectedRequest.orderNumber}
                                        <span className={`text-sm px-3 py-1 rounded-full border ${getStatusColor(selectedRequest.status)}`}>
                                            {getStatusLabel(selectedRequest.status)}
                                        </span>
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                        <Calendar size={14} />
                                        от {selectedRequest.createdAt ? format(new Date(selectedRequest.createdAt), 'dd MMMM yyyy HH:mm', { locale: ru }) : '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrintRequest}
                                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                    title="Печать"
                                >
                                    <Printer size={20} />
                                </button>
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            {/* Top Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <div className="mt-1 text-gray-400"><User size={18} /></div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Клиент</label>
                                            <div className="font-medium text-lg">
                                                {getCustomerName(selectedRequest.customer)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 text-gray-400"><User size={18} /></div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Кем создан</label>
                                            <div className="text-sm">
                                                {selectedRequest.createdBy ? `${selectedRequest.createdBy.firstName || ''} ${selectedRequest.createdBy.lastName || ''}`.trim() : 'Система'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 text-gray-400"><StickyNote size={18} /></div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Комментарий</label>
                                            <div className="text-sm text-gray-600 dark:text-gray-300 italic">
                                                {selectedRequest.notes || 'Нет комментария'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Package size={20} className="text-gray-400" />
                                    Товары
                                </h3>
                                <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <table className="w-full text-sm">
                                        <thead className={`text-xs uppercase text-left ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                            <tr>
                                                <th className="px-4 py-3 font-medium">№</th>
                                                <th className="px-4 py-3 font-medium">Наименование</th>
                                                <th className="px-4 py-3 font-medium">Ед.</th>
                                                <th className="px-4 py-3 font-medium text-right">Кол-во</th>
                                                <th className="px-4 py-3 font-medium text-right">Цена</th>
                                                <th className="px-4 py-3 font-medium text-right">Сумма</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {(selectedRequest.items || []).map((item, idx) => {
                                                const product = item.product;
                                                const productName = product?.nameRu || product?.name || 'Товар';

                                                return (
                                                    <tr key={idx} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-white'}>
                                                        <td className="px-4 py-3 text-gray-500 w-12">{idx + 1}</td>
                                                        <td className="px-4 py-3 font-medium">
                                                            <div>{productName}</div>
                                                            {product?.brand && <div className="text-xs text-gray-500">{product.brand} {product?.model}</div>}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500">шт</td>
                                                        <td className="px-4 py-3 text-right font-mono font-medium">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right text-gray-500">{item.price.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right font-bold">{item.total.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className={`font-bold ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-right uppercase text-xs tracking-wider">Итого:</td>
                                                <td className="px-4 py-3 text-right text-emerald-600">
                                                    {(selectedRequest.total || 0).toLocaleString()} UZS
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Document Relations */}
                            <div className="mt-8 pt-6 border-t dark:border-gray-700">
                                <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">Связанные документы</h3>
                                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4">
                                    <DocumentRelations order={selectedRequest} currentId={selectedRequest._id} />
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer Actions */}
                        <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                            {selectedRequest.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => handleStatusUpdate('cancelled')}
                                        className="px-6 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        Отклонить
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate('confirmed')}
                                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                                    >
                                        <CheckCircle size={18} />
                                        Подтвердить
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-6 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 font-medium rounded-xl transition-colors"
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-2xl rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[90vh] ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                            <h2 className="text-2xl font-bold">
                                {isAddingProduct ? 'Выберите товар' : 'Создать новую заявку'}
                            </h2>
                            <button onClick={() => { setIsCreateModalOpen(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><XCircle size={24} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="space-y-6">
                                {/* Client Selection */}
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-500">Клиент</label>
                                    <select
                                        value={selectedClient}
                                        onChange={(e) => setSelectedClient(e.target.value)}
                                        className={`w-full p-2.5 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                    >
                                        <option value="">Выберите клиента...</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.name} ({client.type === 'debitor' ? 'Дебитор' : 'Поставщик'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Product Search & Add */}
                                <div className="space-y-2">
                                    {!isAddingProduct ? (
                                        <button
                                            onClick={() => setIsAddingProduct(true)}
                                            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all font-medium mb-6"
                                        >
                                            <Plus size={20} />
                                            Добавить товар
                                        </button>
                                    ) : (
                                        <div className="space-y-2 p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 animate-fadeIn mb-6">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-gray-500">Поиск товара</label>
                                                <button onClick={() => setIsAddingProduct(false)} className="text-gray-400 hover:text-gray-600 text-sm">Закрыть</button>
                                            </div>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Поиск товара по названию или штрихкоду..."
                                                    value={productSearch}
                                                    onChange={(e) => setProductSearch(e.target.value)}
                                                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Product Suggestions */}
                                            <div className={`max-h-[200px] overflow-y-auto rounded-xl border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-white border-gray-200'}`}>
                                                {filteredProducts.length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500 text-sm">Товары не найдены</div>
                                                ) : (
                                                    <div className="divide-y dark:divide-gray-600">
                                                        {filteredProducts.map(product => {
                                                            const isSelected = newRequestItems.some(i => i.product.id === product.id);
                                                            return (
                                                                <div
                                                                    key={product.id}
                                                                    onClick={() => !isSelected && handleAddProductToRequest(product)}
                                                                    className={`p-2.5 flex justify-between items-center transition-colors cursor-pointer ${isSelected
                                                                        ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                                                                        : 'hover:bg-blue-50 dark:hover:bg-gray-600'
                                                                        }`}
                                                                >
                                                                    <div className="flex-1 min-w-0 pr-2">
                                                                        <div className="font-medium text-sm truncate">{product.name}</div>
                                                                        <div className="text-xs text-gray-500 flex gap-2">
                                                                            <span>Арт: {product.sku || product.productId || '-'}</span>
                                                                            <span>Остаток: {product.stock}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-blue-600 text-sm">{product.salePrice} UZS</span>
                                                                        {isSelected && <CheckCircle size={16} className="text-emerald-500" />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Selected Items List */}
                                    {newRequestItems.length > 0 && (
                                        <div className="space-y-3 pt-4 border-t border-dashed border-gray-300 dark:border-gray-600">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-semibold text-sm uppercase text-gray-500">Выбрано ({newRequestItems.length})</h3>
                                                <span className="text-sm font-bold text-emerald-600">
                                                    {newRequestItems.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0).toLocaleString()} UZS
                                                </span>
                                            </div>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {newRequestItems.map((item, idx) => (
                                                    <div key={idx} className={`p-3 rounded-lg border flex flex-col sm:flex-row gap-3 items-center ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'}`}>
                                                        <div className="flex-1 w-full">
                                                            <div className="font-medium text-sm line-clamp-1">{item.product.name}</div>
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <span className="text-xs text-gray-500">Цена:</span>
                                                                <input
                                                                    type="number"
                                                                    value={item.price}
                                                                    onChange={(e) => handleUpdateItem(idx, 'price', Number(e.target.value))}
                                                                    className={`w-24 px-2 py-0.5 text-xs rounded border font-mono ${isDark ? 'bg-gray-600 border-gray-500' : 'bg-gray-50 border-gray-300'}`}
                                                                />
                                                                <span className="text-xs text-gray-500">UZS</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] text-gray-500 mb-0.5">Кол-во</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                                    className={`w-16 p-1.5 text-sm rounded border text-center ${isDark ? 'bg-gray-600 border-gray-500' : 'bg-gray-50 border-gray-300'}`}
                                                                />
                                                            </div>
                                                            <button onClick={() => handleRemoveItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium">Отмена</button>
                            <button
                                onClick={handleCreateRequest}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!selectedClient || newRequestItems.length === 0}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesRequestsPage;
