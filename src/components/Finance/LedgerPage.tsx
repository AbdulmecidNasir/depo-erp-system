import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Calendar,
  Search,
  User,
  Tag,
  Download,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  SlidersHorizontal,
  Printer,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface UnifiedTransaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    partyName?: string;
    name?: string;
    phone?: string;
  };
  order: {
    id: string;
    orderNumber: string;
    total: number;
    paymentStatus: string;
    items: any[];
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  referenceId: string;
  paymentStatus: string;
}

const LedgerPage: React.FC = () => {
  const { isDark } = useTheme();
  const { formatPrice } = useSettings();

  // Unified Finance state
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<UnifiedTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sellerId: '',
    productId: '',
    customerId: '',
    search: ''
  });
  const [sellers, setSellers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, sellersRes, productsRes] = await Promise.all([
        api.finance.getUnified({
          startDate: filters.startDate,
          endDate: filters.endDate,
          sellerId: filters.sellerId,
          customerId: filters.customerId
        }),
        api.users.getAll(),
        api.products.getAll({ limit: 1000 })
      ]);

      if (res.success) setTransactions(res.data);
      if (sellersRes.success) setSellers(sellersRes.data);
      if (productsRes.success) setProducts(productsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.startDate, filters.endDate, filters.sellerId, filters.customerId]);

  const filteredTransactions = useMemo(() => {
    if (!filters.search) return transactions;
    const s = filters.search.toLowerCase();
    return transactions.filter(t => {
      const cName = (t.customer?.firstName || '' + ' ' + t.customer?.lastName || '' + ' ' + t.customer?.partyName || '' + ' ' + t.customer?.name || '').toLowerCase();
      const oNum = (t.order?.orderNumber || '').toLowerCase();
      const refId = (t.referenceId || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      return cName.includes(s) || oNum.includes(s) || refId.includes(s) || desc.includes(s);
    });
  }, [transactions, filters.search]);

  const groupedByClient = useMemo(() => {
    const groups: Record<string, { customer: any, transactions: UnifiedTransaction[], balance: number }> = {};
    filteredTransactions.forEach(t => {
      const cId = t.customer?.id || 'unknown';
      if (!groups[cId]) groups[cId] = { customer: t.customer, transactions: [], balance: 0 };
      groups[cId].transactions.push(t);
      if (t.type === 'income') groups[cId].balance += t.amount;
      else groups[cId].balance -= t.amount;
    });
    return Object.entries(groups).sort((a, b) => Math.abs(b[1].balance) - Math.abs(a[1].balance));
  }, [filteredTransactions]);

  const exportExcel = async () => {
    const { exportToExcelWithOptions } = await import('../../utils/excelExport');
    const columns = [
      { key: 'date', header: 'Дата', type: 'date' },
      { key: 'type', header: 'Тип', type: 'text' },
      { key: 'category', header: 'Категория', type: 'text' },
      { key: 'customerName', header: 'Клиент', type: 'text' },
      { key: 'ref', header: 'Ссылка/Номер', type: 'text' },
      { key: 'amount', header: 'Сумма ($)', type: 'number' },
      { key: 'status', header: 'Статус оплаты', type: 'text' },
      { key: 'seller', header: 'Продавец', type: 'text' }
    ] as const;

    const exportData = filteredTransactions.map(t => ({
      date: t.date,
      type: t.type === 'income' ? 'Приход' : 'Расход',
      category: t.category,
      customerName: t.customer?.partyName || `${t.customer?.firstName || ''} ${t.customer?.lastName || ''}`.trim() || 'Без имени',
      ref: t.referenceId,
      amount: t.amount,
      status: getStatusLabel(t.paymentStatus),
      seller: `${t.createdBy?.firstName || ''} ${t.createdBy?.lastName || ''}`.trim()
    }));

    await exportToExcelWithOptions(exportData, columns as any, `Финансы_${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'Финансовый отчет');
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'paid' || s === 'completed' || s === 'проведен' || s === 'оплачено') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (s === 'pending' || s === 'в ожидании') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (s === 'partially_paid' || s === 'частично') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (s === 'failed' || s === 'ошибка' || s === 'не оплачено') return 'bg-red-500/10 text-red-500 border-red-500/20';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const getStatusLabel = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'paid' || s === 'completed') return 'Оплачено';
    if (s === 'pending') return 'В ожидании';
    if (s === 'failed') return 'Ошибка';
    if (s === 'partially_paid') return 'Частично';
    if (s === 'refunded') return 'Возврат';
    if (s === 'shipped') return 'Отгружено';
    return status || '---';
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const setPeriodPreset = (preset: 'today' | 'week' | 'month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (preset === 'today') {
      setFilters(f => ({ ...f, startDate: today.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] }));
    } else if (preset === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      setFilters(f => ({ ...f, startDate: weekStart.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] }));
    } else {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters(f => ({ ...f, startDate: monthStart.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] }));
    }
  };

  const clearAllFilters = () => {
    setFilters({ startDate: '', endDate: '', sellerId: '', productId: '', customerId: '', search: '' });
    setShowFiltersPanel(false);
  };

  const applyFilters = () => { setShowFiltersPanel(false); };

  const handleTransactionClick = (transaction: UnifiedTransaction) => {
    setSelectedTransaction(transaction);
    setIsDetailModalOpen(true);
  };

  const handlePrintTransaction = () => {
    if (!selectedTransaction) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const t = selectedTransaction;
    const dateStr = format(new Date(t.date), 'dd.MM.yyyy HH:mm');
    const cName = t.customer?.partyName || `${t.customer?.firstName || ''} ${t.customer?.lastName || ''}`.trim() || 'Без имени';
    const isIncome = t.type === 'income';

    const html = `
      <html>
        <head>
          <title>Финансовая операция #${t.referenceId || t.id}</title>
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
            .status { padding: 5px 10px; border-radius: 4px; font-weight: bold; display: inline-block; }
            .income { background-color: #d1fae5; color: #065f46; }
            .expense { background-color: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${isIncome ? 'Приходный ордер' : 'Расходный ордер'}</h2>
            <p>№ ${t.referenceId || t.id.slice(-6).toUpperCase()}</p>
            <p>Дата: ${dateStr}</p>
          </div>
          
          <div class="info-grid">
            <div>
              <strong>Контрагент:</strong><br>
              ${cName}
            </div>
            <div>
              <strong>Ответственный:</strong><br>
              ${t.createdBy?.firstName || ''} ${t.createdBy?.lastName || ''}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
             <strong>Категория:</strong> ${t.category}<br>
             <strong>Статус:</strong> ${getStatusLabel(t.paymentStatus)}<br>
             ${t.description ? `<strong>Описание:</strong> ${t.description}<br>` : ''}
             ${t.order?.orderNumber ? `<strong>Связанный документ:</strong> ${t.order.orderNumber}` : ''}
          </div>

          ${t.order?.items && t.order.items.length > 0 ? `
            <h3>Товары в заказе/накладной:</h3>
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
                ${t.order.items.map((item: any, idx: number) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.product?.nameRu || item.product?.name || 'Товар'}</td>
                    <td>${item.quantity}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td>${(item.total || 0).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          <div class="total">
            Сумма операции: ${t.amount.toLocaleString()} $
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Финансовый модуль
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Автоматический учет отгрузок и оплат
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGroupingEnabled(!groupingEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${groupingEnabled
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
              : (isDark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm')
              }`}
          >
            <Users className="h-4 w-4" />
            {groupingEnabled ? 'Лента операций' : 'По клиентам'}
          </button>
          <button
            onClick={exportExcel}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isDark
              ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
          >
            <Download className="h-4 w-4" />
            Экспорт
          </button>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 space-y-6 pb-12">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Приход (Оплаты)" value={formatPrice(totalIncome)} icon={ArrowDownLeft} color="emerald" isDark={isDark} />
          <StatsCard title="Расход (Отгрузки)" value={formatPrice(totalExpense)} icon={ArrowUpRight} color="blue" isDark={isDark} />
          <StatsCard title="Дебиторка (Разница)" value={formatPrice(totalExpense - totalIncome)} icon={DollarSign} color="amber" isDark={isDark} />
          <StatsCard title="Транзакции" value={transactions.length.toString()} icon={CreditCard} color="purple" isDark={isDark} />
        </div>

        {/* Filters — Фильтры button + search; expandable panel */}
        <div className={`p-6 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 ${isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button type="button" onClick={() => setShowFiltersPanel(prev => !prev)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium text-sm shrink-0 ${showFiltersPanel ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25' : isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'}`}>
              <SlidersHorizontal size={18} />
              Фильтры
              {showFiltersPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div className="relative flex-1 w-full max-w-md">
              <input type="text" placeholder="Поиск по клиенту, заказу или ID..." value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} className={`w-full pl-4 pr-10 py-2.5 rounded-xl border outline-none transition-all ${isDark ? 'bg-gray-900 border-gray-700 text-white focus:ring-2 focus:ring-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-400'}`} />
              <Search className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
          </div>
          {showFiltersPanel && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Расширенные фильтры</h3>
                <div className="flex items-center gap-3">
                  <button onClick={clearAllFilters} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Очистить</button>
                  <button onClick={applyFilters} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all">Найти</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                    <input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 relative z-10 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} ${!filters.startDate ? 'text-transparent' : isDark ? 'text-white' : 'text-gray-900'}`} title="дд.мм.гггг" />
                    {!filters.startDate && <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none z-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>дд.мм.гггг</span>}
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата по</label>
                  <div className="relative" lang="ru">
                    <input type="date" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 relative z-10 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} ${!filters.endDate ? 'text-transparent' : isDark ? 'text-white' : 'text-gray-900'}`} title="дд.мм.гггг" />
                    {!filters.endDate && <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none z-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>дд.мм.гггг</span>}
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Продавец</label>
                  <select value={filters.sellerId} onChange={(e) => setFilters(f => ({ ...f, sellerId: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                    <option value="">Все продавцы</option>
                    {sellers.filter(s => s && s.id).map(s => (<option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Контрагент</label>
                  <select value={filters.customerId} onChange={(e) => setFilters(f => ({ ...f, customerId: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                    <option value="">Все клиенты</option>
                    {Array.from(new Set(transactions.map(t => t.customer).filter(c => c && c.id).map(c => JSON.stringify({ id: c!.id, name: ((c as any).partyName || `${(c as any).firstName || ''} ${(c as any).lastName || ''}`.trim()) })))).map(cStr => {
                      const c = JSON.parse(cStr);
                      return <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>
          )}
          {loading && <div className="mt-2 text-center"><span className="text-xs text-blue-500 animate-pulse font-medium">Обновление данных...</span></div>}
        </div>

        {groupingEnabled ? (
          <div className={`rounded-2xl border divide-y overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800 divide-gray-800' : 'bg-white border-gray-200 divide-gray-100 shadow-lg'}`}>
            {groupedByClient.map(([cId, g]) => (
              <div key={cId} className="group hover:bg-blue-600/[0.02] transition-colors">
                <div onClick={() => setExpandedClients(prev => ({ ...prev, [cId]: !prev[cId] }))} className="p-4 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shadow-inner ${isDark ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{g.customer?.firstName?.[0] || 'C'}</div>
                    <div>
                      <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{g.customer?.partyName || g.customer?.name || `${g.customer?.firstName || ''} ${g.customer?.lastName || ''}`.trim() || 'Без имени'}</h4>
                      <p className="text-xs text-gray-500">{g.transactions.length} операций • Текущий баланс: {g.balance.toLocaleString()} $</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Сальдо</p>
                      <p className={`text-xl font-black ${g.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {g.balance.toLocaleString()} <span className="text-xs font-medium text-gray-400">$</span>
                      </p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${expandedClients[cId] ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {expandedClients[cId] && (
                  <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-black/20 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                        <FinanceTable transactions={g.transactions} isDark={isDark} getStatusColor={getStatusColor} getStatusLabel={getStatusLabel} compact={true} onTransactionClick={handleTransactionClick} formatPrice={formatPrice} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-3xl border overflow-hidden shadow-2xl transition-all duration-300 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <FinanceTable transactions={filteredTransactions} isDark={isDark} getStatusColor={getStatusColor} getStatusLabel={getStatusLabel} compact={false} onTransactionClick={handleTransactionClick} formatPrice={formatPrice} />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl transform transition-all ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`} onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Операция #{selectedTransaction.referenceId || selectedTransaction.id.slice(-6).toUpperCase()}</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  от {format(new Date(selectedTransaction.date), 'dd MMMM yyyy HH:mm', { locale: (window as any).dateFnsLocaleRu })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintTransaction}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Печать"
                >
                  <Printer size={20} />
                </button>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60">Тип операции</label>
                  <div className={`mt-1 text-lg font-bold flex items-center gap-2 ${selectedTransaction.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {selectedTransaction.type === 'income' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    {selectedTransaction.type === 'income' ? 'Приход' : 'Расход'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60">Сумма</label>
                  <div className={`mt-1 text-lg font-bold ${selectedTransaction.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatPrice(selectedTransaction.amount)}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60">Категория</label>
                  <div className="mt-1 font-medium">{selectedTransaction.category}</div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60">Статус</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${getStatusColor(selectedTransaction.paymentStatus)}`}>
                      {getStatusLabel(selectedTransaction.paymentStatus)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider opacity-60">Клиент</label>
                    <div className="mt-1 font-bold">
                      {selectedTransaction.customer?.partyName || `${selectedTransaction.customer?.firstName || ''} ${selectedTransaction.customer?.lastName || ''}`.trim() || 'Без имени'}
                    </div>
                  </div>
                  {selectedTransaction.order?.orderNumber && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider opacity-60">Документ</label>
                      <div className="mt-1 font-bold flex items-center gap-2">
                        <Package size={16} />
                        #{selectedTransaction.order.orderNumber}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedTransaction.description && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60">Описание / Комментарий</label>
                  <div className="mt-1 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                    {selectedTransaction.description}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className={`px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
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

interface StatsCardProps {
  title: string;
  value: string;
  icon: any;
  color: 'blue' | 'emerald' | 'purple' | 'amber';
  isDark: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, isDark }) => {
  const colors = {
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20 shadow-purple-500/10',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10',
  };
  return (
    <div className={`p-6 rounded-3xl border shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl ${isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-2xl border ${colors[color]}`}><Icon className="h-6 w-6" /></div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</p>
          <h3 className={`text-2xl font-black mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</h3>
        </div>
      </div>
    </div>
  );
};

interface FinanceTableProps {
  transactions: UnifiedTransaction[];
  isDark: boolean;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  compact: boolean;
  onTransactionClick: (t: UnifiedTransaction) => void;
  formatPrice: (amount: number) => string;
}

const FinanceTable: React.FC<FinanceTableProps> = ({ transactions, isDark, getStatusColor, getStatusLabel, compact, onTransactionClick, formatPrice }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead className={`${isDark ? 'bg-black/30 text-gray-400' : 'bg-gray-50/50 text-gray-500'} text-[10px] uppercase font-bold`}>
        <tr>
          <th className="px-6 py-4 font-black">ID</th>
          <th className="px-6 py-4">Дата</th>
          <th className="px-6 py-4">Тип / Категория</th>
          {!compact && <th className="px-6 py-4">Клиент</th>}
          <th className="px-6 py-4">Документ</th>
          <th className="px-6 py-4">Сумма</th>
          <th className="px-6 py-4">Статус оплаты</th>
          <th className="px-6 py-4">Кто провел</th>
        </tr>
      </thead>
      <tbody className={`divide-y ${isDark ? 'divide-gray-800/50' : 'divide-gray-100'}`}>
        {transactions.map(t => {
          const cName = t.customer?.partyName || `${t.customer?.firstName || ''} ${t.customer?.lastName || ''}`.trim();
          return (
            <tr key={t.id} className="group hover:bg-blue-600/[0.03] transition-colors">
              <td className="px-6 py-4">
                <span
                  onClick={() => onTransactionClick(t)}
                  className="text-blue-600 text-[11px] font-bold hover:underline cursor-pointer"
                >
                  {t.referenceId?.replace(/\D/g, '').padStart(6, '0') || t.id.slice(-6).toUpperCase()}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{format(new Date(t.date), 'dd.MM.yyyy')}</div>
                <div className="text-[10px] text-gray-500">{format(new Date(t.date), 'HH:mm')}</div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {t.type === 'income' ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-[10px] font-black uppercase tracking-wider ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'income' ? 'Приход' : 'Расход'}
                  </span>
                </div>
                <div className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t.category}</div>
              </td>
              {!compact && (
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{cName || '---'}</div>
                  <div className="text-[10px] text-gray-500">{t.customer?.phone || 'Нет контакта'}</div>
                </td>
              )}
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Package className="h-3 w-3 text-blue-500" />
                  <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>#{t.order?.orderNumber || '---'}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className={`text-sm font-black ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {t.type === 'expense' ? '-' : '+'}{formatPrice(t.amount)}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${getStatusColor(t.paymentStatus)}`}>
                  {getStatusLabel(t.paymentStatus)}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black uppercase ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    {t.createdBy?.firstName?.[0] || 'A'}
                  </div>
                  <span className="text-[10px] font-medium">{t.createdBy?.firstName || 'Admin'}</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default LedgerPage;
