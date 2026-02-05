import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Tag, CreditCard } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useTheme } from '../../contexts/ThemeContext';

const FinancialSearchFilters: React.FC = () => {
  const { searchFilters, updateFilters } = useSearch();
  const { isDark } = useTheme();
  const filters = searchFilters.financial;

  const transactionTypes = [
    { value: 'income', label: 'Доход', icon: TrendingUp, color: 'green' },
    { value: 'expense', label: 'Расход', icon: TrendingDown, color: 'red' },
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Наличные', icon: '💵' },
    { value: 'card', label: 'Карта', icon: '💳' },
    { value: 'transfer', label: 'Перевод', icon: '🏦' },
  ];

  const categories = ['Продажи', 'Закупки', 'Зарплата', 'Аренда', 'Налоги', 'Прочее'];

  const toggleTransactionType = (type: 'income' | 'expense') => {
    const current = filters.transactionType || [];
    const updated = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
    updateFilters('financial', { transactionType: updated });
  };

  const togglePaymentMethod = (method: 'cash' | 'card' | 'transfer') => {
    const current = filters.paymentMethod || [];
    const updated = current.includes(method) ? current.filter(m => m !== method) : [...current, method];
    updateFilters('financial', { paymentMethod: updated });
  };

  const inputClass = `w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
    isDark ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
  }`;

  const labelClass = `flex items-center text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="space-y-3">
      {/* Transaction Type */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <TrendingUp className="h-3 w-3 mr-1 text-blue-500" />
          Тип транзакции
        </label>
        <div className="grid grid-cols-2 gap-2">
          {transactionTypes.map((type) => {
            const isSelected = (filters.transactionType || []).includes(type.value as any);
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => toggleTransactionType(type.value as any)}
                className={`p-2 text-xs rounded-lg border transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                  isSelected
                    ? `border-${type.color}-500 ${isDark ? `bg-${type.color}-900/20 text-${type.color}-300` : `bg-${type.color}-50 text-${type.color}-700`}`
                    : `${isDark ? 'border-gray-600 text-gray-400 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount Range */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <DollarSign className="h-3 w-3 mr-1 text-emerald-500" />
          Сумма
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={filters.amountMin || ''} onChange={(e) => updateFilters('financial', { amountMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="Мин." className={inputClass} min="0" />
          <input type="number" value={filters.amountMax || ''} onChange={(e) => updateFilters('financial', { amountMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="Макс." className={inputClass} min="0" />
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <Calendar className="h-3 w-3 mr-1 text-blue-500" />
          Период
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={filters.dateFrom || ''} onChange={(e) => updateFilters('financial', { dateFrom: e.target.value })} className={inputClass} />
          <input type="date" value={filters.dateTo || ''} onChange={(e) => updateFilters('financial', { dateTo: e.target.value })} className={inputClass} />
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1">
        <label className={labelClass}>
          <Tag className="h-3 w-3 mr-1 text-purple-500" />
          Категория
        </label>
        <select value={filters.category || ''} onChange={(e) => updateFilters('financial', { category: e.target.value })} className={inputClass}>
          <option value="">Все категории</option>
          {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
        </select>
      </div>

      {/* Payment Method */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <CreditCard className="h-3 w-3 mr-1 text-orange-500" />
          Способ оплаты
        </label>
        <div className="grid grid-cols-3 gap-2">
          {paymentMethods.map((method) => {
            const isSelected = (filters.paymentMethod || []).includes(method.value as any);
            return (
              <button
                key={method.value}
                onClick={() => togglePaymentMethod(method.value as any)}
                className={`p-2 text-xs rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? `${isDark ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50'}`
                    : `${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`
                }`}
              >
                <div className="text-base mb-0.5">{method.icon}</div>
                <div className={isSelected ? `${isDark ? 'text-blue-300' : 'text-blue-700'}` : `${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {method.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Filters */}
      <div className={`rounded-lg p-2 ${isDark ? 'bg-green-900/20 border border-green-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'}`}>
        <h4 className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Быстрые фильтры</h4>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            updateFilters('financial', { dateFrom: startOfMonth.toISOString().split('T')[0], dateTo: today.toISOString().split('T')[0] });
          }} className={`px-2 py-1 text-xs rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Этот месяц
          </button>
          <button onClick={() => updateFilters('financial', { transactionType: ['income'] })} className={`px-2 py-1 text-xs rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Только доходы
          </button>
          <button onClick={() => updateFilters('financial', { amountMin: 10000 })} className={`px-2 py-1 text-xs rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Крупные (&gt;10k ₸)
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialSearchFilters;
