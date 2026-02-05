import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import {
  Search, FileText, CheckCircle, X,
  Calendar, User, DollarSign, StickyNote, Printer, CreditCard, ArrowUpRight, ArrowDownLeft,
  SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import DocumentRelations from './DocumentRelations';

// Organization constant

// Define a Payment interface based on what we expected from the API
interface Payment {
  id: string;
  description: any;
  paymentNumber: string;
  createdAt: string;
  type: 'in' | 'out'; // Incoming or Outgoing
  amount: number;
  paidAmount?: number;
  method: 'cash' | 'card' | 'transfer';
  status: 'completed' | 'pending' | 'cancelled' | 'partially_paid';
  customer?: {
    firstName?: string;
    lastName?: string;
    partyName?: string;
    name?: string;
    id?: string;
    _id?: string;
  };
  payerName?: string; // For incoming manual
  payeeName?: string; // For outgoing manual
  category?: string;
  notes?: string;
  createdBy?: {
    firstName?: string;
    lastName?: string;
  };
  order?: any;
  orderId?: string;
  customerModel?: 'User' | 'Debitor' | 'Supplier';
}

const SalesAllPage: React.FC = () => {
  const { isDark } = useTheme();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<any>(null);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [isPartialMode, setIsPartialMode] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState<string>('');
  const [filterAmountMax, setFilterAmountMax] = useState<string>('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [filterStatus, filterType, startDate, endDate]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 1000 };
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterType !== 'all') params.type = filterType;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.payments.getAll(params);
      if (response.success && response.data) {
        setPayments(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentClick = async (payment: Payment) => {
    setSelectedPayment(payment);
    setLinkedOrder(null);
    setIsDetailModalOpen(true);

    // Fetch linked order if exists
    const orderId = payment.orderId || (payment.order ? (payment.order.id || payment.order._id) : null);
    if (orderId) {
      try {
        const res = await api.orders.getById(orderId);
        if (res.success) {
          setLinkedOrder(res.data);
        }
      } catch (e) {
        console.error("Failed to fetch linked order", e);
      }
    }
  };

  const handleApprovePayment = async () => {
    if (!selectedPayment) return;

    const amountToApprove = isPartialMode ? Number(partialAmount) : selectedPayment.amount;

    if (isPartialMode) {
      if (!partialAmount || isNaN(amountToApprove) || amountToApprove <= 0 || amountToApprove >= selectedPayment.amount) {
        alert('Пожалуйста, введите корректную сумму, которая меньше общей суммы платежа');
        return;
      }
    }

    const confirmMsg = isPartialMode
      ? `Вы уверены, что хотите подтвердить ЧАСТИЧНЫЙ платеж на сумму ${amountToApprove.toLocaleString()} UZS?`
      : 'Вы уверены, что хотите подтвердить этот платеж в полном объеме?';

    if (!confirm(confirmMsg)) return;

    try {
      if (isPartialMode) {
        // Increment paidAmount on the SAME record
        const currentPaid = selectedPayment.paidAmount || 0;
        const newTotalPaid = currentPaid + amountToApprove;

        const res = await api.payments.update(selectedPayment.id, {
          paidAmount: newTotalPaid,
          status: newTotalPaid >= selectedPayment.amount ? 'completed' : 'partially_paid',
          notes: (selectedPayment.notes ? selectedPayment.notes + '\n' : '') +
            `Поступило ${amountToApprove.toLocaleString()} UZS (${new Date().toLocaleDateString()})`
        });

        if (res.success) {
          alert(newTotalPaid >= selectedPayment.amount
            ? 'Платеж полностью оплачен и проведен!'
            : `Частичная оплата принята. Общая сумма оплаты: ${newTotalPaid.toLocaleString()} UZS`);
        } else {
          throw new Error('Не удалось обновить платеж');
        }
      } else {
        // Full approval - mark entire amount as paid
        const res = await api.payments.update(selectedPayment.id, {
          status: 'completed',
          paidAmount: selectedPayment.amount
        });
        if (res.success) {
          alert('Платеж успешно проведен в полном объеме');
        } else {
          alert('Ошибка: ' + (res as any).message);
        }
      }

      setIsDetailModalOpen(false);
      setIsPartialMode(false);
      setPartialAmount('');
      fetchPayments(); // Refresh list
    } catch (error) {
      console.error(error);
      alert('Ошибка при процессинге платежа');
    }
  };

  const getCounterpartyName = (payment: Payment) => {
    if (payment.customer) {
      if (payment.customer.partyName) return payment.customer.partyName;
      if (payment.customer.firstName) return `${payment.customer.firstName} ${payment.customer.lastName || ''}`;
      if (payment.customer.name) return payment.customer.name;
    }
    return payment.payerName || payment.payeeName || 'Без названия';
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
    setFilterType('all');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setFilterAmountMin('');
    setFilterAmountMax('');
    setShowFiltersPanel(false);
  };

  const applyFilters = () => { setShowFiltersPanel(false); };

  const filteredList = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const minA = filterAmountMin ? Number(filterAmountMin) : null;
    const maxA = filterAmountMax ? Number(filterAmountMax) : null;

    return payments.filter(p => {
      // 1. Search Filter
      const counterparty = getCounterpartyName(p);
      const matchesSearch = !q ||
        counterparty.toLowerCase().includes(q) ||
        (p.paymentNumber || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q);

      // 2. Amount Filter
      const amount = p.amount ?? p.paidAmount ?? 0;
      const matchesAmount = (minA == null || amount >= minA) && (maxA == null || amount <= maxA);

      // 3. Status Filter (Client-side sync)
      let matchesStatus = true;
      if (filterStatus === 'pending') {
        matchesStatus = p.status === 'pending' || p.status === 'partially_paid';
      } else if (filterStatus === 'completed') {
        matchesStatus = p.status === 'completed';
      }

      // 4. Type Filter (Client-side sync)
      let matchesType = true;
      if (filterType !== 'all') {
        matchesType = p.type === filterType;
      }

      return matchesSearch && matchesAmount && matchesStatus && matchesType;
    });
  }, [payments, searchQuery, filterAmountMin, filterAmountMax, filterStatus, filterType]);

  const stats = useMemo(() => {
    // Actual received/paid money
    const incoming = payments
      .filter(p => p.type === 'in')
      .reduce((acc, curr) => acc + (curr.status === 'completed' ? curr.amount : (curr.paidAmount || 0)), 0);

    const outgoing = payments
      .filter(p => p.type === 'out')
      .reduce((acc, curr) => acc + (curr.status === 'completed' ? curr.amount : (curr.paidAmount || 0)), 0);

    const pendingCount = payments.filter(p => p.status === 'pending' || p.status === 'partially_paid').length;
    return {
      totalCount: payments.length,
      incoming,
      outgoing,
      pendingCount
    };
  }, [payments]);

  const getStatusColor = (status: string) => {
    const s = (status || 'completed').toLowerCase();
    if (s === 'completed') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/60 shadow-sm shadow-emerald-500/5';
    if (s === 'partially_paid') return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/60 shadow-sm shadow-blue-500/5';
    if (s === 'pending') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/60 shadow-sm shadow-amber-500/5';
    if (s === 'cancelled') return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200/60 shadow-sm shadow-red-500/5';
    return 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: 'Проведен',
      pending: 'В обработке',
      partially_paid: 'Частично оплачен',
      cancelled: 'Отменен'
    };
    return labels[(status || 'completed').toLowerCase()] || status;
  };

  const getMethodLabel = (method: string) => {
    const m = (method || 'cash').toLowerCase();
    if (m === 'card') return 'Карта';
    if (m === 'transfer') return 'Перевод';
    return 'Наличные';
  };

  const handlePrintPayment = () => {
    if (!selectedPayment) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isIncoming = selectedPayment.type === 'in';
    const title = isIncoming ? 'Приходный кассовый ордер' : 'Расходный кассовый ордер';
    const counterparty = getCounterpartyName(selectedPayment);
    const dateStr = format(new Date(selectedPayment.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru });

    const html = `
      <html>
        <head>
          <title>${title} #${selectedPayment.paymentNumber}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h2 { margin: 0; text-transform: uppercase; }
            .header p { margin: 5px 0 0; }
            .content { margin-bottom: 40px; line-height: 1.6; }
            .row { display: flex; margin-bottom: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; }
            .label { font-weight: bold; width: 150px; }
            .value { flex: 1; font-style: italic; }
            .amount-box { border: 2px solid #000; padding: 10px; text-align: center; font-size: 1.5em; font-weight: bold; margin: 20px 0; width: fit-content; margin-left: auto; margin-right: auto; }
            .footer { display: flex; justify-content: space-between; margin-top: 50px; }
            .sign { border-top: 1px solid #000; width: 200px; padding-top: 5px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${title}</h2>
            <p>№ ${selectedPayment.paymentNumber}</p>
            <p>Дата: ${dateStr}</p>
          </div>
          
          <div class="content">
            <div class="row">
              <span class="label">Организация:</span>
              <span class="value">ERC WAREHOUSE</span>
            </div>
            <div class="row">
              <span class="label">${isIncoming ? 'Принято от:' : 'Выдано:'}</span>
              <span class="value">${counterparty}</span>
            </div>
            <div class="row">
              <span class="label">Основание:</span>
              <span class="value">${selectedPayment.category || selectedPayment.description || 'Оплата'}</span>
            </div>
             ${selectedPayment.notes ? `
            <div class="row">
              <span class="label">Комментарий:</span>
              <span class="value">${selectedPayment.notes}</span>
            </div>` : ''}
          </div>

          <div class="amount-box">
            ${selectedPayment.amount.toLocaleString()} UZS
          </div>

          <div class="footer">
            <div>
              <p>Главный бухгалтер:</p>
              <div class="sign">Подпись</div>
            </div>
            <div>
              <p>Кассир:</p>
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
            Все платежи
          </h1>
        </div>

        {/* Stats / Quick View */}
        <div className={`p-1 rounded-xl flex gap-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="px-4 py-2 flex items-center gap-2">
            <CheckCircle className="text-amber-500" size={16} />
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
              В обработке: {stats.pendingCount}
            </span>
          </div>
          <div className="w-px bg-gray-300 dark:bg-gray-600 my-2"></div>
          <div className="px-4 py-2 flex items-center gap-2">
            <ArrowDownLeft className="text-emerald-500" size={16} />
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              +{stats.incoming.toLocaleString()}
            </span>
          </div>
          <div className="w-px bg-gray-300 dark:bg-gray-600 my-2"></div>
          <div className="px-4 py-2 flex items-center gap-2">
            <ArrowUpRight className="text-red-500" size={16} />
            <span className="text-sm font-bold text-red-600 dark:text-red-400">
              -{stats.outgoing.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className={`p-4 rounded-xl border mb-6 flex flex-col lg:flex-row gap-6 justify-between items-center ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
        <div className="flex flex-col gap-3 w-full lg:w-auto">
          {/* Status & Type Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-gray-100/80 border border-gray-200/50'}`}>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${filterStatus === 'all'
                  ? (isDark ? 'bg-gray-700 text-white shadow-lg' : 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5')
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700')
                  }`}
              >
                Все
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${filterStatus === 'pending'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700')
                  }`}
              >
                В обработке
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${filterStatus === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700')
                  }`}
              >
                Проведенные
              </button>
            </div>

            <div className={`h-6 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'} hidden sm:block`}></div>

            <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-gray-100/80 border border-gray-200/50'}`}>
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${filterType === 'all'
                  ? (isDark ? 'bg-gray-700 text-white shadow-lg' : 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5')
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700')
                  }`}
              >
                Все типы
              </button>
              <button
                onClick={() => setFilterType('in')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${filterType === 'in'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm'
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700')
                  }`}
              >
                Входящие
              </button>
              <button
                onClick={() => setFilterType('out')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${filterType === 'out'
                  ? 'bg-red-100 text-red-700 border border-red-200 shadow-sm'
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700')
                  }`}
              >
                Исходящие
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
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

      {/* Filter Panel */}
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
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  <option value="all">Все</option>
                  <option value="pending">В обработке</option>
                  <option value="completed">Проведенные</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Тип</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  <option value="all">Все типы</option>
                  <option value="in">Входящие</option>
                  <option value="out">Исходящие</option>
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
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ID, контрагент, комментарий..." className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
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

      {/* TABLE VIEW */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className={`text-xs uppercase ${isDark ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
              <tr>
                <th className="px-6 py-4 font-black">ID</th>
                <th className="px-6 py-4 font-medium">Дата и время</th>
                <th className="px-6 py-4 font-medium">Контрагент</th>
                <th className="px-6 py-4 font-medium">Тип</th>
                <th className="px-6 py-4 font-medium text-right">Сумма</th>
                <th className="px-6 py-4 font-medium">Метод</th>
                <th className="px-6 py-4 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Данные не найдены
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isIncoming = item.type === 'in';
                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handlePaymentClick(item)}
                          className="font-bold text-[11px] text-blue-600 hover:text-blue-500 hover:underline"
                        >
                          #{item.paymentNumber}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {getCounterpartyName(item)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isIncoming ? (
                            <ArrowDownLeft className="text-emerald-500" size={16} />
                          ) : (
                            <ArrowUpRight className="text-red-500" size={16} />
                          )}
                          <span className={isIncoming ? 'text-emerald-600' : 'text-red-600'}>
                            {isIncoming ? 'Входящий' : 'Исходящий'}
                          </span>
                        </div>
                      </td>
                      <td className={`px-6 py-4 font-mono font-bold text-right ${isIncoming ? 'text-emerald-600' : 'text-red-600'}`}>
                        <div className="flex flex-col items-end">
                          <span>{isIncoming ? '+' : '-'}{item.amount.toLocaleString()} UZS</span>
                          {item.status === 'partially_paid' && (
                            <span className="text-[10px] opacity-60">Оплачено: {item.paidAmount?.toLocaleString()}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-gray-500">
                          <CreditCard size={14} />
                          {getMethodLabel(item.method)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handlePaymentClick(item)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all hover:scale-105 active:scale-95 ${getStatusColor(item.status)}`}
                        >
                          {getStatusLabel(item.status)}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className={`px-6 py-4 border-t text-xs text-gray-500 flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
          <span>Всего записей: {filteredList.length}</span>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
          <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>

            {/* Modal Header */}
            <div className={`flex justify-between items-center p-6 border-b ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${selectedPayment.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  <DollarSign size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    Платеж № {selectedPayment.paymentNumber}
                    <span className={`text-xs px-3 py-1 rounded-full border font-black uppercase tracking-widest ${getStatusColor(selectedPayment.status)}`}>
                      {getStatusLabel(selectedPayment.status)}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Calendar size={14} />
                    от {format(new Date(selectedPayment.createdAt), 'dd MMMM yyyy HH:mm', { locale: ru })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPayment}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Печать"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-1 text-gray-400"><User size={18} /></div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">
                        {selectedPayment.type === 'in' ? 'Плательщик' : 'Получатель'}
                      </label>
                      <div className="font-medium text-lg">
                        {getCounterpartyName(selectedPayment)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1 text-gray-400"><CreditCard size={18} /></div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Способ оплаты</label>
                      <div className="font-medium">
                        {getMethodLabel(selectedPayment.method)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1 text-gray-400"><StickyNote size={18} /></div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Назначение / Категория</label>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {selectedPayment.category || selectedPayment.description || 'Не указано'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className={`p-6 rounded-2xl flex flex-col justify-center items-center text-center ${selectedPayment.type === 'in' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'}`}>
                    <span className="text-sm uppercase tracking-wide opacity-70 mb-1">Общая сумма</span>
                    <div className={`text-3xl font-bold ${selectedPayment.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {selectedPayment.type === 'in' ? '+' : '-'}{selectedPayment.amount.toLocaleString()} UZS
                    </div>
                    {selectedPayment.status === 'partially_paid' && (
                      <div className="mt-2 pt-2 border-t border-current/10 w-full">
                        <span className="text-xs opacity-70 block">Уже оплачено</span>
                        <span className="text-xl font-bold opacity-90">{(selectedPayment.paidAmount || 0).toLocaleString()} UZS</span>
                        <span className="text-xs opacity-70 block mt-1">Осталось: {(selectedPayment.amount - (selectedPayment.paidAmount || 0)).toLocaleString()} UZS</span>
                      </div>
                    )}
                  </div>

                  {selectedPayment.notes && (
                    <div className="flex gap-3">
                      <div className="mt-1 text-gray-400"><FileText size={18} /></div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Комментарий</label>
                        <div className="text-sm text-gray-600 dark:text-gray-300 italic">
                          {selectedPayment.notes}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DOCUMENT RELATIONS */}
              <div className="mt-8 pt-6 border-t dark:border-gray-700">
                <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">Связанные документы</h3>
                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4">
                  {linkedOrder ? (
                    <DocumentRelations order={linkedOrder} currentId={selectedPayment.id} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                      <span>Этот платеж не привязан к заказу</span>
                      {selectedPayment.type === 'in' && selectedPayment.status === 'pending' && (
                        <button className="mt-2 text-sm text-blue-500 hover:underline">
                          Привязать к заказу
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className={`p-6 border-t ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
              {(selectedPayment.status === 'pending' || selectedPayment.status === 'partially_paid') && (
                <div className="flex flex-col gap-4">
                  {isPartialMode ? (
                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Сумма к оплате сейчас</label>
                        <div className="relative">
                          <input
                            type="number"
                            autoFocus
                            value={partialAmount}
                            onChange={(e) => setPartialAmount(e.target.value)}
                            className={`w-full pl-3 pr-12 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                            placeholder="Введите сумму..."
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">UZS</div>
                        </div>
                        <p className="mt-1 text-[10px] text-blue-500 font-medium italic">
                          Остаток после этой оплаты: {(selectedPayment.amount - (selectedPayment.paidAmount || 0) - (Number(partialAmount) || 0)).toLocaleString()} UZS.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleApprovePayment}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all"
                        >
                          Подтвердить получение
                        </button>
                        <button
                          onClick={() => setIsPartialMode(false)}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-bold text-sm transition-all"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        onClick={() => {
                          setIsPartialMode(true);
                          const remaining = selectedPayment.amount - (selectedPayment.paidAmount || 0);
                          setPartialAmount(String(remaining / 2));
                        }}
                        className={`px-6 py-2.5 rounded-xl font-bold border transition-all ${isDark ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10' : 'border-amber-500 text-amber-600 hover:bg-amber-50'}`}
                      >
                        Принять часть оплаты
                      </button>
                      <button
                        onClick={handleApprovePayment}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        <CheckCircle size={18} />
                        Оплачено полностью
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!isPartialMode && (
                <div className={`flex justify-end mt-4 ${selectedPayment.status === 'pending' ? 'border-t pt-4 dark:border-gray-700' : ''}`}>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-6 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 font-medium rounded-xl transition-colors"
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesAllPage;
