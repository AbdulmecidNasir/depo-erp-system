import React from 'react';
import { User, Phone, Mail, Crown, Calendar } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useTheme } from '../../contexts/ThemeContext';

const ClientSearchFilters: React.FC = () => {
  const { searchFilters, updateFilters } = useSearch();
  const { isDark } = useTheme();
  const filters = searchFilters.clients;

  const clientTypes = [
    { value: 'regular', label: 'Обычный', icon: '👤', color: 'blue' },
    { value: 'vip', label: 'VIP', icon: '⭐', color: 'yellow' },
    { value: 'wholesale', label: 'Оптовый', icon: '🏢', color: 'purple' },
  ];

  const toggleClientType = (type: 'regular' | 'vip' | 'wholesale') => {
    const current = filters.type || [];
    const updated = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
    updateFilters('clients', { type: updated });
  };

  const inputClass = `w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
    isDark ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
  }`;

  const labelClass = `flex items-center text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="space-y-3">
      {/* Name, Phone, Email */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>
            <User className="h-3 w-3 mr-1 text-blue-500" />
            Имя
          </label>
          <input type="text" value={filters.name || ''} onChange={(e) => updateFilters('clients', { name: e.target.value })} placeholder="Имя..." className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>
            <Phone className="h-3 w-3 mr-1 text-green-500" />
            Телефон
          </label>
          <input type="tel" value={filters.phone || ''} onChange={(e) => updateFilters('clients', { phone: e.target.value })} placeholder="+7 ..." className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>
            <Mail className="h-3 w-3 mr-1 text-purple-500" />
            Email
          </label>
          <input type="email" value={filters.email || ''} onChange={(e) => updateFilters('clients', { email: e.target.value })} placeholder="email@..." className={inputClass} />
        </div>
      </div>

      {/* Client Type */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <Crown className="h-3 w-3 mr-1 text-yellow-500" />
          Тип клиента
        </label>
        <div className="grid grid-cols-3 gap-2">
          {clientTypes.map((type) => {
            const isSelected = (filters.type || []).includes(type.value as any);
            return (
              <button
                key={type.value}
                onClick={() => toggleClientType(type.value as any)}
                className={`p-2 text-xs rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? `border-${type.color}-500 ${isDark ? `bg-${type.color}-900/20` : `bg-${type.color}-50`}`
                    : `${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`
                }`}
              >
                <div className="text-base mb-0.5">{type.icon}</div>
                <div className={isSelected ? `text-${type.color}-${isDark ? '300' : '700'}` : `${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {type.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Registration Date */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          <Calendar className="h-3 w-3 mr-1 text-orange-500" />
          Дата регистрации
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={filters.registrationFrom || ''} onChange={(e) => updateFilters('clients', { registrationFrom: e.target.value })} className={inputClass} />
          <input type="date" value={filters.registrationTo || ''} onChange={(e) => updateFilters('clients', { registrationTo: e.target.value })} className={inputClass} />
        </div>
      </div>

      {/* Quick Filters */}
      <div className={`rounded-lg p-2 ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'}`}>
        <h4 className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Быстрые фильтры</h4>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => updateFilters('clients', { type: ['vip'] })} className={`px-2 py-1 text-xs rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Только VIP
          </button>
          <button onClick={() => {
            const today = new Date();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            updateFilters('clients', { registrationFrom: lastMonth.toISOString().split('T')[0], registrationTo: today.toISOString().split('T')[0] });
          }} className={`px-2 py-1 text-xs rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Новые (месяц)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientSearchFilters;
