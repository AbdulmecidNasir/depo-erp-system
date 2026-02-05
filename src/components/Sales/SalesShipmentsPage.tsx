import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import {
    Truck, Search, FileText, Package, X, Calendar, User, StickyNote, Printer, SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import DocumentRelations from './DocumentRelations';

interface Shipment {
    _id: string;
    shipmentNumber: string;
    createdAt: string;
    status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
    customer: {
        _id: string;
        firstName?: string;
        lastName?: string;
        partyName?: string;
        name?: string;
    };
    order: {
        _id: string;
        orderNumber: string;
        total: number;
        items?: any[];
        createdBy?: {
            firstName?: string;
            lastName?: string;
        };
    };

    items: Array<{
        product: {
            _id: string;
            name: string;
            nameRu?: string;
            brand?: string;
            model?: string;
            salePrice?: number;
            location?: string;
        };
        quantity: number;
    }>;
    trackingNumber?: string;
    notes?: string;
    totalAmount?: number;
    totalCost?: number;
    warehouseManager?: {
        firstName?: string;
        lastName?: string;
    };
    createdBy?: {
        firstName?: string;
        lastName?: string;
    };
}

const SalesShipmentsPage: React.FC = () => {
    const { isDark } = useTheme();
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterAmountMin, setFilterAmountMin] = useState<string>('');
    const [filterAmountMax, setFilterAmountMax] = useState<string>('');
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // View Mode: 'shipments' = NEW Documents, 'orders' = OLD (Pending Orders)
    const [viewMode, setViewMode] = useState<'shipments' | 'orders'>('shipments'); // Default to shipments history as per request implication

    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [linkedOrder, setLinkedOrder] = useState<any>(null);

    // Create Shipment Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [shippingItems, setShippingItems] = useState<any[]>([]);

    useEffect(() => {
        fetchShipments();
    }, [filterStatus, startDate, endDate]);

    useEffect(() => {
        fetchPendingOrders();
    }, []);

    const fetchShipments = async () => {
        setLoading(true);
        try {
            const params: any = { limit: 100 };
            if (filterStatus !== 'all') params.status = filterStatus;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await api.shipments.getAll(params);
            if (response.success) {
                setShipments(response.data);
            }
        } catch (error) {
            console.error('Error fetching shipments:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingOrders = async () => {
        try {
            const response = await api.orders.getAll({ limit: 100 });
            if (response.success) {
                const ready = response.data.filter((o: any) =>
                    ['confirmed', 'processing', 'partially_shipped'].includes(o.status)
                );
                setPendingOrders(ready);
            }
        } catch (error) {
            console.error('Error fetching pending orders:', error);
        }
    };

    const handleCreateShipmentClick = (order: any) => {
        // Close detail modal if open
        setIsDetailModalOpen(false);
        setIsCreateModalOpen(true);
        setSelectedOrder(order); // Keep selected order context

        // Pre-fill items
        setShippingItems(order.items.map((i: any) => ({
            product: i.product,
            quantity: i.quantity,
            maxQuantity: i.quantity,
            price: i.price || i.product?.salePrice || 0
        })));
    };

    const submitShipment = async () => {
        if (!selectedOrder) return;

        const itemsToShip = shippingItems.filter(i => i.quantity > 0).map(i => ({
            product: i.product._id || i.product.id,
            quantity: i.quantity
        }));

        if (itemsToShip.length === 0) {
            alert('Выберите товары для отгрузки');
            return;
        }

        // Calculate total amount for the payment using the stored price
        const totalAmount = shippingItems.reduce((acc, item) => {
            return acc + (item.quantity * (item.price || 0));
        }, 0);

        try {
            const payload = {
                orderId: selectedOrder._id,
                items: itemsToShip,
                notes: 'Создано со страницы отгрузок'
            };

            const res = await api.shipments.create(payload);
            if (res.success) {
                // AUTO-CREATE PENDING PAYMENT
                if (totalAmount > 0) {
                    try {
                        await api.payments.create({
                            order: selectedOrder._id,
                            amount: totalAmount,
                            type: 'in',
                            status: 'pending',
                            method: 'cash',
                            customer: selectedOrder.customer?._id || selectedOrder.customer,
                            customerModel: selectedOrder.customerModel || 'User',
                            description: `Оплата за отгрузку ${res.data.shipmentNumber}`,
                            notes: `Авто-платеж по отгрузке №${res.data.shipmentNumber}`,
                            date: new Date().toISOString()
                        });
                    } catch (payErr) {
                        console.error('Failed to auto-create payment:', payErr);
                    }
                }

                alert('Отгрузка создана, платеж выставлен в очередь ("В обработке")');
                setIsCreateModalOpen(false);
                fetchShipments();
                fetchPendingOrders();
                setViewMode('shipments');
                setSelectedOrder(null);

                // Open the new shipment in detail view
                handleShipmentClick(res.data);
            } else {
                alert('Ошибка: ' + (res.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error(error);
            alert('Ошибка при создании: ' + (error.message || 'Unknown error'));
        }
    };

    const handleShipmentClick = async (shipment: Shipment) => {
        setSelectedShipment(shipment);
        setSelectedOrder(null);
        setIsDetailModalOpen(true);
        if (shipment.order?._id) {
            try {
                const res = await api.orders.getById(shipment.order._id);
                if (res.success) {
                    setLinkedOrder(res.data);
                }
            } catch (e) {
                console.error("Failed to fetch linked order", e);
            }
        }
    };

    const handleOrderClick = (order: any) => {
        setSelectedOrder(order);
        setSelectedShipment(null);
        setIsDetailModalOpen(true);
    };

    const getCustomerName = (customer: any) => {
        if (!customer) return 'Неизвестный';
        if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
        if (customer.partyName) return customer.partyName;
        if (customer.name) return customer.name;
        return 'Клиент';
    };

    const filteredList = useMemo(() => {
        const q = (searchQuery || '').trim().toLowerCase();
        if (viewMode === 'shipments') {
            return shipments.filter(s => {
                const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
                const customerName = getCustomerName(s.customer);
                const matchesSearch = !q ||
                    customerName.toLowerCase().includes(q) ||
                    s.shipmentNumber.toLowerCase().includes(q) ||
                    (s.order?.orderNumber || '').toLowerCase().includes(q) ||
                    (s.notes || '').toLowerCase().includes(q);

                const shipmentDate = new Date(s.createdAt);
                const matchesStart = !startDate || shipmentDate >= new Date(startDate);
                const matchesEnd = !endDate || shipmentDate <= new Date(endDate);

                const amount = s.totalAmount ?? (s as any).total ?? 0;
                const minA = filterAmountMin ? Number(filterAmountMin) : null;
                const maxA = filterAmountMax ? Number(filterAmountMax) : null;
                const matchesAmount = (minA == null || amount >= minA) && (maxA == null || amount <= maxA);

                return matchesStatus && matchesSearch && matchesStart && matchesEnd && matchesAmount;
            });
        } else {
            return pendingOrders.filter(o => {
                const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
                const customerName = getCustomerName(o.customer);
                const matchesSearch = !q ||
                    customerName.toLowerCase().includes(q) ||
                    (o.orderNumber || '').toLowerCase().includes(q) ||
                    (o.notes || '').toLowerCase().includes(q);

                const orderDate = new Date(o.createdAt || o.created);
                const matchesStart = !startDate || orderDate >= new Date(startDate);
                const matchesEnd = !endDate || orderDate <= new Date(endDate);

                return matchesStatus && matchesSearch && matchesStart && matchesEnd;
            });
        }
    }, [shipments, pendingOrders, filterStatus, searchQuery, startDate, endDate, filterAmountMin, filterAmountMax, viewMode]);

    const stats = useMemo(() => ({
        toShip: pendingOrders.length,
        shipped: shipments.filter(s => s.status === 'shipped').length,
        delivered: shipments.filter(s => s.status === 'delivered').length,
        total: shipments.length
    }), [shipments, pendingOrders]);

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'confirmed' || s === 'completed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (s === 'processing') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        if (s === 'shipped') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'; // В пути
        if (s === 'delivered') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        if (s === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
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

    const applyFilters = () => {
        setShowFiltersPanel(false);
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: 'Ожидает',
            confirmed: 'К отгрузке',
            cancelled: 'Отменен',
            processing: 'В обработке',
            shipped: 'Отгружен',
            delivered: 'Доставлен',
            partially_shipped: 'Частично'
        };
        return labels[status.toLowerCase()] || status;
    };

    // Calculate sum helper
    const calculateTotal = (item: any) => {
        // for shipment items
        if (viewMode === 'shipments') {
            // shipment item structure: { product, quantity }
            // we need to find price from original order or current product price
            // Simplification: use product salePrice if available in shipment item
            return (item.items || []).reduce((acc: number, i: any) => {
                const price = i.product?.salePrice || 0;
                return acc + (price * i.quantity);
            }, 0);
        } else {
            // order structure: { total }
            return item.total || 0;
        }
    };

    const calculateMargin = (shipment: Shipment) => {
        if (!shipment.totalAmount || !shipment.totalCost) return 0;
        return shipment.totalAmount - shipment.totalCost;
    };

    const handlePrintShipment = () => {
        const doc = selectedShipment || selectedOrder;
        if (!doc) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const isShipment = !!selectedShipment;
        const number = isShipment ? doc.shipmentNumber : doc.orderNumber;
        const title = isShipment ? 'Накладная на отгрузку' : 'Заказ на отгрузку';
        const dateStr = format(new Date(doc.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru });
        const customerName = getCustomerName(doc.customer);

        let items: any[] = [];
        let totalSum = 0;

        if (isShipment) {
            items = doc.items.map((i: any) => {
                const price = i.product?.salePrice || 0;
                return {
                    name: i.product?.nameRu || i.product?.name || 'Товар',
                    brand: i.product?.brand,
                    quantity: i.quantity,
                    price: price,
                    total: price * i.quantity
                };
            });
            totalSum = items.reduce((acc, i) => acc + i.total, 0);
        } else {
            items = (doc.items || []).map((i: any) => ({
                name: i.product?.nameRu || i.product?.name || 'Товар',
                brand: i.product?.brand,
                quantity: i.quantity,
                price: i.price,
                total: i.total
            }));
            totalSum = doc.total || 0;
        }

        const html = `
          <html>
            <head>
              <title>${title} #${number}</title>
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
                <h2>${title} № ${number}</h2>
                <p>Дата: ${dateStr}</p>
                <p>Статус: ${getStatusLabel(doc.status)}</p>
              </div>
              
              <div class="info-grid">
                <div>
                  <strong>Получатель:</strong><br>
                  ${customerName}
                </div>
                <div>
                  <strong>Отпустил:</strong><br>
                  ${isShipment && doc.warehouseManager ? `${doc.warehouseManager.firstName || ''} ${doc.warehouseManager.lastName || ''}` : 'Склад'}
                </div>
              </div>

              ${doc.notes ? `<p><strong>Комментарий:</strong> ${doc.notes}</p>` : ''}

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
                  ${items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.name} ${item.brand ? `(${item.brand})` : ''}</td>
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
                  <p>Отпустил:</p>
                  <div class="sign">Подпись</div>
                </div>
                <div>
                  <p>Получил:</p>
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
                        Отгрузки
                    </h1>
                </div>

                {/* View Mode Toggle */}
                <div className={`p-1.5 rounded-2xl flex gap-2 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <button
                        onClick={() => setViewMode('orders')}
                        className={`px-8 py-3 rounded-xl text-base font-black transition-all flex items-center gap-3 ${viewMode === 'orders'
                            ? 'bg-blue-600 shadow-lg shadow-blue-500/30 text-white scale-105'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`}
                    >
                        <Package size={20} />
                        К ОТГРУЗКЕ ({stats.toShip})
                    </button>
                    <button
                        onClick={() => setViewMode('shipments')}
                        className={`px-6 py-3 rounded-xl text-base font-bold transition-all flex items-center gap-3 ${viewMode === 'shipments'
                            ? 'bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`}
                    >
                        <FileText size={20} />
                        Накладные ({stats.total})
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className={`p-4 rounded-xl border mb-6 flex flex-col lg:flex-row gap-6 justify-between items-center ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                    <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Все {viewMode === 'orders' ? stats.toShip : stats.total}</button>
                    <button onClick={() => setFilterStatus(viewMode === 'orders' ? 'confirmed' : 'shipped')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === (viewMode === 'orders' ? 'confirmed' : 'shipped') ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                        {viewMode === 'orders' ? 'Готовы к отгрузке' : 'В пути'}
                    </button>
                    {viewMode === 'shipments' && (
                        <button onClick={() => setFilterStatus('delivered')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'delivered' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>Доставлено</button>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {/* Фильтры button — opens filter panel */}
                    <button
                        type="button"
                        onClick={() => setShowFiltersPanel(prev => !prev)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium text-sm shrink-0 ${showFiltersPanel
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25'
                            : isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                    >
                        <SlidersHorizontal size={18} />
                        Фильтры
                        {showFiltersPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-4 pr-10 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDark
                                ? 'bg-gray-900 border-gray-700 text-white'
                                : 'bg-gray-50 border-gray-200 text-gray-900'
                                }`}
                        />
                        <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                </div>
            </div>

            {/* Filter Panel — modern slide-down */}
            {showFiltersPanel && (
                <div className={`mb-6 rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ${isDark ? 'bg-gray-800/90 border-gray-700 backdrop-blur-sm' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Расширенные фильтры</h3>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={clearAllFilters}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    Очистить
                                </button>
                                <button
                                    onClick={applyFilters}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all"
                                >
                                    Найти
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Статус */}
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Статус</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                                >
                                    <option value="all">Все</option>
                                    {viewMode === 'orders' ? (
                                        <>
                                            <option value="confirmed">Готовы к отгрузке</option>
                                            <option value="processing">В обработке</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="shipped">В пути</option>
                                            <option value="delivered">Доставлено</option>
                                            <option value="pending">Ожидает</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Период — быстрый выбор */}
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Период</label>
                                <div className="flex gap-2 flex-wrap">
                                    <button type="button" onClick={() => setPeriodPreset('today')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Сегодня</button>
                                    <button type="button" onClick={() => setPeriodPreset('week')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Неделя</button>
                                    <button type="button" onClick={() => setPeriodPreset('month')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Месяц</button>
                                </div>
                            </div>

                            {/* Дата с — русский формат дд.мм.гггг, bold */}
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата с</label>
                                <div className="relative" lang="ru">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 relative z-10 ${isDark ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500/50' : 'bg-gray-50 border-gray-200'} ${!startDate ? 'text-transparent' : isDark ? 'text-white' : 'text-gray-900'}`}
                                        title="дд.мм.гггг"
                                    />
                                    {!startDate && (
                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none z-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>дд.мм.гггг</span>
                                    )}
                                </div>
                            </div>

                            {/* Дата по — русский формат дд.мм.гггг, bold */}
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата по</label>
                                <div className="relative" lang="ru">
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 relative z-10 ${isDark ? 'bg-gray-700 border-gray-600 focus:ring-indigo-500/50' : 'bg-gray-50 border-gray-200'} ${!endDate ? 'text-transparent' : isDark ? 'text-white' : 'text-gray-900'}`}
                                        title="дд.мм.гггг"
                                    />
                                    {!endDate && (
                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none z-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>дд.мм.гггг</span>
                                    )}
                                </div>
                            </div>

                            {/* Номер или комментарий */}
                            <div className="md:col-span-2">
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Номер или комментарий</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Номер отгрузки, заказа, контрагент..."
                                        className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                    />
                                    <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                </div>
                            </div>

                            {/* Сумма от (только для накладных) */}
                            {viewMode === 'shipments' && (
                                <>
                                    <div>
                                        <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Сумма от (UZS)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={filterAmountMin}
                                            onChange={(e) => setFilterAmountMin(e.target.value)}
                                            placeholder="0"
                                            className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Сумма до (UZS)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={filterAmountMax}
                                            onChange={(e) => setFilterAmountMax(e.target.value)}
                                            placeholder="—"
                                            className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TABLE VIEW */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-xs uppercase ${isDark ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            <tr>
                                <th className="px-6 py-4 font-black">ID</th>
                                <th className="px-6 py-4 font-medium">Дата и время</th>
                                <th className="px-6 py-4 font-medium">Контрагент</th>
                                <th className="px-6 py-4 font-medium">Сумма</th>
                                {viewMode === 'shipments' && <th className="px-6 py-4 font-medium">Маржа</th>}
                                <th className="px-6 py-4 font-medium">Статус</th>
                                <th className="px-6 py-4 font-medium">Ответственные</th>
                                {viewMode === 'orders' && <th className="px-6 py-4 text-center">Действие</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={viewMode === 'orders' ? 7 : 6} className="px-6 py-8 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={viewMode === 'orders' ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                                        Данные не найдены
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((item) => {
                                    const totalSum = calculateTotal(item);
                                    const identifier = viewMode === 'shipments' ? item.shipmentNumber : item.orderNumber;

                                    return (
                                        <tr
                                            key={item._id}
                                            className={`group transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => viewMode === 'shipments' ? handleShipmentClick(item) : handleOrderClick(item)}
                                                    className="font-bold text-[11px] text-blue-600 hover:text-blue-500 hover:underline"
                                                >
                                                    {String(identifier || '').replace(/\D/g, '').padStart(6, '0') || '000000'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                {format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                                {getCustomerName(item.customer)}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium">
                                                {(viewMode === 'shipments' ? (item.totalAmount || totalSum) : totalSum).toLocaleString()}
                                            </td>
                                            {viewMode === 'shipments' && (
                                                <td className={`px-6 py-4 font-mono font-bold ${calculateMargin(item) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {calculateMargin(item).toLocaleString()}
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => viewMode === 'shipments' ? handleShipmentClick(item) : handleOrderClick(item)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:scale-105 active:scale-95 ${getStatusColor(item.status)}`}
                                                >
                                                    {getStatusLabel(item.status)}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-gray-400">Сейлс:</span>
                                                        <span className="font-medium">
                                                            {item.createdBy
                                                                ? `${item.createdBy.firstName || ''} ${item.createdBy.lastName || ''}`.trim() || 'Пользователь'
                                                                : 'Не указан'}
                                                        </span>
                                                    </div>
                                                    {viewMode === 'shipments' && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-400">Склад:</span>
                                                            <span className="font-medium">
                                                                {item.warehouseManager
                                                                    ? `${item.warehouseManager.firstName || ''} ${item.warehouseManager.lastName || ''}`.trim() || 'Пользователь'
                                                                    : 'Не указан'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            {viewMode === 'orders' && (
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => handleCreateShipmentClick(item)}
                                                        className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
                                                    >
                                                        Создать отгрузку
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination placeholder if needed */}
                <div className={`px-6 py-4 border-t text-xs text-gray-500 flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                    <span>Всего: {filteredList.length}</span>
                </div>
            </div>

            {/* DETAIL MODAL (Document View) */}
            {isDetailModalOpen && (selectedShipment || selectedOrder) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
                    <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>

                        {/* Modal Header */}
                        <div className={`flex justify-between items-center p-6 border-b ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${selectedShipment ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {selectedShipment ? <FileText size={24} /> : <Package size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-3">
                                        {selectedShipment
                                            ? `Отгрузка № ${selectedShipment.shipmentNumber}`
                                            : `Заявка № ${selectedOrder.orderNumber}`
                                        }
                                        <span className={`text-sm px-3 py-1 rounded-full border ${selectedShipment ? getStatusColor(selectedShipment.status) : getStatusColor(selectedOrder.status)}`}>
                                            {getStatusLabel(selectedShipment ? selectedShipment.status : selectedOrder.status)}
                                        </span>
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                        <Calendar size={14} />
                                        от {format(new Date(selectedShipment ? selectedShipment.createdAt : selectedOrder.createdAt), 'dd MMMM yyyy HH:mm', { locale: ru })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrintShipment}
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
                                            <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Контрагент</label>
                                            <div className="font-medium text-lg">
                                                {getCustomerName(selectedShipment ? selectedShipment.customer : selectedOrder.customer)}
                                            </div>
                                            {/* Future: Add Phone/Address here if available */}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 text-gray-400"><StickyNote size={18} /></div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Комментарий</label>
                                            <div className="text-sm text-gray-600 dark:text-gray-300 italic">
                                                {(selectedShipment ? selectedShipment.notes : selectedOrder.notes) || 'Нет комментария'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {selectedShipment && selectedShipment.order && (
                                        <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50">
                                            <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Основание</label>
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-blue-600">Заказ покупателя № {selectedShipment.order.orderNumber}</span>
                                                {/* Could link deeper here */}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex flex-col items-end pt-2">
                                        <div className="text-right space-y-2">
                                            <div>
                                                <span className="text-xs text-gray-500 uppercase">Продавец (Заявка)</span>
                                                <div className="font-bold text-indigo-600">
                                                    {selectedShipment
                                                        ? `${selectedShipment.createdBy?.firstName || ''} ${selectedShipment.createdBy?.lastName || ''}`.trim() || 'Не указан'
                                                        : `${selectedOrder?.createdBy?.firstName || ''} ${selectedOrder?.createdBy?.lastName || ''}`.trim() || 'Не указан'
                                                    }
                                                </div>
                                            </div>
                                            {selectedShipment && (
                                                <div>
                                                    <span className="text-xs text-gray-500 uppercase">Кладовщик (Отгрузка)</span>
                                                    <div className="font-bold text-amber-600">
                                                        {selectedShipment.warehouseManager
                                                            ? `${selectedShipment.warehouseManager.firstName || ''} ${selectedShipment.warehouseManager.lastName || ''}`.trim() || 'Не указан'
                                                            : 'Не указан'
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedShipment && (
                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="text-xs text-gray-500 uppercase mb-1">Сумма продажи</div>
                                        <div className="text-xl font-black text-blue-600">{(selectedShipment.totalAmount || 0).toLocaleString()} UZS</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="text-xs text-gray-500 uppercase mb-1">Себестоимость</div>
                                        <div className="text-xl font-bold text-gray-400">{(selectedShipment.totalCost || 0).toLocaleString()} UZS</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <div className="text-xs text-emerald-600 uppercase mb-1 font-bold">Чистая маржа</div>
                                        <div className="text-xl font-black text-emerald-600">{calculateMargin(selectedShipment).toLocaleString()} UZS</div>
                                    </div>
                                </div>
                            )}

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
                                            {(selectedShipment?.items || selectedOrder?.items || []).map((item: any, idx: number) => {
                                                const product = item.product;
                                                const productName = product?.nameRu || product?.name || 'Товар';

                                                // Calculate Price and Total dynamically based on context
                                                let price = 0;
                                                if (selectedOrder) {
                                                    price = item.price || 0;
                                                } else if (selectedShipment) {
                                                    // Try to match with Order Item price if available, else product salePrice
                                                    const oItem = selectedShipment.order?.items?.find((oi: any) =>
                                                        (oi.product?._id || oi.product) === (product?._id || product.id)
                                                    );
                                                    price = oItem?.price || product?.salePrice || 0;
                                                }

                                                const total = price * item.quantity;

                                                return (
                                                    <tr key={idx} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-white'}>
                                                        <td className="px-4 py-3 text-gray-500 w-12">{idx + 1}</td>
                                                        <td className="px-4 py-3 font-medium">
                                                            <div>{productName}</div>
                                                            {product?.brand && <div className="text-xs text-gray-500">{product.brand} {product?.model}</div>}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500">шт</td>
                                                        <td className="px-4 py-3 text-right font-mono font-medium">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right text-gray-500">{price.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right font-bold">{total.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className={`font-bold ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-right uppercase text-xs tracking-wider">Итого:</td>
                                                <td className="px-4 py-3 text-right text-emerald-600">
                                                    {(selectedShipment
                                                        ? calculateTotal(selectedShipment)
                                                        : (selectedOrder?.total || 0)
                                                    ).toLocaleString()} UZS
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Document Relations Tabs for Shipments */}
                            {selectedShipment && (
                                <div className="mt-8 pt-6 border-t dark:border-gray-700">
                                    <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">Связанные документы</h3>
                                    <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4">
                                        {linkedOrder ? (
                                            <DocumentRelations order={linkedOrder} currentId={selectedShipment._id} />
                                        ) : (
                                            <span className="text-sm text-gray-400">Нет связанных документов</span>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer Actions */}
                        <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                            {selectedOrder && (
                                <button
                                    onClick={() => handleCreateShipmentClick(selectedOrder)}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    <Truck size={18} />
                                    Создать отгрузку
                                </button>
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

            {/* CREATE SHIPMENT MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                            <h2 className="text-xl font-bold">Создание отгрузки</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <p className="text-sm text-gray-500 mb-4">Укажите количество товаров для фактической отгрузки:</p>
                            <div className="space-y-3">
                                {shippingItems.map((item, idx) => (
                                    <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                                        <div className="flex-1 pr-4">
                                            <div className="font-medium text-sm line-clamp-1">{item.product?.nameRu || item.product?.name}</div>
                                            <div className="text-xs text-gray-500">Заказано: {item.maxQuantity} шт</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.maxQuantity}
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const val = Math.min(Math.max(0, Number(e.target.value)), item.maxQuantity);
                                                    const newItems = [...shippingItems];
                                                    newItems[idx].quantity = val;
                                                    setShippingItems(newItems);
                                                }}
                                                className={`w-20 p-2 text-center rounded-lg border font-bold ${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-300'}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium">Отмена</button>
                            <button
                                onClick={submitShipment}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20"
                            >
                                Подтвердить отгрузку
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesShipmentsPage;
