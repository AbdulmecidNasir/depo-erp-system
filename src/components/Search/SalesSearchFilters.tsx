import React from 'react';
import { Calendar, DollarSign, CreditCard, CheckCircle, User } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useTheme } from '../../contexts/ThemeContext';

const SalesSearchFilters: React.FC = () => {
  const { searchFilters, updateFilters } = useSearch();
  const { isDark } = useTheme();
  const filters = searchFilters.sales;

  const paymentMethods = [
    { value: 'cash', label: 'Наличные', icon: '💵', color: 'green' },
    { value: 'card', label: 'Карта', icon: '💳', color: 'blue' },
    { value: 'transfer', label: 'Перевод', icon: '🏦', color: 'purple' },
  ];

  const saleStatuses = [
    { value: 'completed', label: 'Завершена', color: 'green' },
    { value: 'pending', label: 'В обработке', color: 'yellow' },
    { value: 'cancelled', label: 'Отменена', color: 'red' },
  ];

  const togglePaymentMethod = (method: 'cash' | 'card' | 'transfer') => {
    const current = filters.paymentMethod || [];
    const updated = current.includes(method) ? current.filter(m => m !== method) : [...current, method];
    updateFilters('sales', { paymentMethod: updated });
  };

  const toggleStatus = (status: 'completed' | 'pending' | 'cancelled') => {
    const current = filters.status || [];
    const updated = current.includes(status) ? current.filter(s => s !== status) : [...current, status];
    updateFilters('sales', { status: updated });
  };

  const inputClass = `w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
    isDark ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
  }`;

  const labelClass = `flex items-center text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="space-y-3">
      {/* Date Range */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <Calendar className="h-3 w-3 mr-1 text-blue-500" />
          Период
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={filters.dateFrom || ''} onChange={(e) => updateFilters('sales', { dateFrom: e.target.value })} className={inputClass} />
          <input type="date" value={filters.dateTo || ''} onChange={(e) => updateFilters('sales', { dateTo: e.target.value })} className={inputClass} />
        </div>
      </div>

      {/* Amount Range */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <DollarSign className="h-3 w-3 mr-1 text-emerald-500" />
          Сумма продажи
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={filters.amountMin || ''} onChange={(e) => updateFilters('sales', { amountMin: e.target.value ? Number(e.target.value) : undefined })} placeholder="Мин." className={inputClass} min="0" />
          <input type="number" value={filters.amountMax || ''} onChange={(e) => updateFilters('sales', { amountMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="Макс." className={inputClass} min="0" />
        </div>
      </div>

      {/* Payment Method */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <CreditCard className="h-3 w-3 mr-1 text-purple-500" />
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
                    ? `border-${method.color}-500 ${isDark ? `bg-${method.color}-900/20` : `bg-${method.color}-50`}`
                    : `${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`
                }`}
              >
                <div className="text-base mb-0.5">{method.icon}</div>
                <div className={isSelected ? `text-${method.color}-${isDark ? '300' : '700'}` : `${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {method.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sale Status */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
          Статус
        </label>
        <div className="flex flex-wrap gap-2">
          {saleStatuses.map((status) => {
            const isSelected = (filters.status || []).includes(status.value as any);
            return (
              <button
                key={status.value}
                onClick={() => toggleStatus(status.value as any)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? `border-${status.color}-500 ${isDark ? `bg-${status.color}-900/20 text-${status.color}-300` : `bg-${status.color}-50 text-${status.color}-700`}`
                    : `${isDark ? 'border-gray-600 text-gray-400 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`
                }`}
              >
                {status.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cashier */}
      <div className="space-y-1">
        <label className={labelClass}>
          <User className="h-3 w-3 mr-1 text-orange-500" />
          Кассир
        </label>
        <input type="text" value={filters.cashier || ''} onChange={(e) => updateFilters('sales', { cashier: e.target.value })} placeholder="Имя кассира..." className={inputClass} />
      </div>
    </div>
  );
};

export default SalesSearchFilters;
