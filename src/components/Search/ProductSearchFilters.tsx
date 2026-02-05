import React, { useState, useEffect } from 'react';
import { Package, Barcode, Tag, DollarSign, TrendingDown, Building, Hash, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';

const ProductSearchFilters: React.FC = () => {
  const { searchFilters, updateFilters } = useSearch();
  const { isDark } = useTheme();
  const filters = searchFilters.products;

  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Primary source for categories across project: products.getCategories (map slug->name)
      try {
        const mapRes: any = await api.products.getCategories();
        if (mapRes.success && mapRes.data) {
          setCategoriesMap(mapRes.data as Record<string, string>);
        } else {
          // Fallback to categories.getAll (array)
          const categoriesRes: any = await api.categories.getAll();
          if (categoriesRes.success) {
            const arr = (categoriesRes.categories || categoriesRes.data || []) as Array<any>;
            const mapped = arr.reduce((acc: Record<string, string>, c: any) => {
              const key = c.slug || c.id;
              const val = c.nameRu || c.name;
              if (key && val) acc[key] = val;
              return acc;
            }, {});
            setCategoriesMap(mapped);
          }
        }
      } catch (e) {
        // Final fallback: try categories.getAll
        try {
          const categoriesRes: any = await api.categories.getAll();
          if (categoriesRes.success) {
            const arr = (categoriesRes.categories || categoriesRes.data || []) as Array<any>;
            const mapped = arr.reduce((acc: Record<string, string>, c: any) => {
              const key = c.slug || c.id;
              const val = c.nameRu || c.name;
              if (key && val) acc[key] = val;
              return acc;
            }, {});
            setCategoriesMap(mapped);
          }
        } catch (err) {
          console.error('Categories fetch failed:', err);
        }
      }

      // Build authoritative lists from actual products (ensures we only show user's real categories/suppliers)
      try {
        const LIMIT = 100;
        const MAX_PAGES = 20; // cap 2000 items
        let page = 1;
        const categorySet = new Set<string>();
        const supplierMap = new Map<string, string>();
        while (page <= MAX_PAGES) {
          const res: any = await api.products.getAll({ page, limit: LIMIT });
          if (!res?.success) break;
          const items: any[] = res.data || [];
          items.forEach((p: any) => {
            if (p?.category) categorySet.add(String(p.category));
            const sid = p?.supplierId || p?.supplier_id || p?.supplier?._id || p?.supplier?.id;
            const sname = p?.supplierName || p?.supplier_name || p?.supplier?.name;
            if (sid && sname && !supplierMap.has(String(sid))) supplierMap.set(String(sid), String(sname));
          });
          const pg = res.pagination;
          if (!pg || page >= (pg.pages || 1)) break;
          page += 1;
        }
        // If backend categories were sparse, enrich from products
        if (categorySet.size > 0) {
          setCategoriesMap(prev => {
            const merged: Record<string, string> = { ...prev };
            categorySet.forEach((slug) => {
              if (!merged[slug]) merged[slug] = slug; // fallback: show slug if name missing
            });
            return merged;
          });
        }
        if (supplierMap.size > 0) {
          setSuppliers(Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name })));
        } else {
          // Fallback to suppliers endpoint if products had no supplier linkage
          try {
            const supRes: any = await api.suppliers.getAll({ activeOnly: true, limit: 500 });
            if (supRes?.success) {
              setSuppliers(supRes.suppliers || supRes.data || []);
            }
          } catch {}
        }
      } catch (err) {
        // As a last resort, load suppliers list directly
        try {
          const supRes: any = await api.suppliers.getAll({ activeOnly: true, limit: 500 });
          if (supRes?.success) {
            setSuppliers(supRes.suppliers || supRes.data || []);
          }
        } catch {}
      }
    };
    fetchData();
  }, []);

  const stockStatuses = [
    { value: 'in_stock', label: 'В наличии', color: 'green' },
    { value: 'low_stock', label: 'Мало', color: 'yellow' },
    { value: 'out_of_stock', label: 'Нет', color: 'red' },
  ];

  const toggleStockStatus = (status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
    const current = filters.stockStatus || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilters('products', { stockStatus: updated });
  };

  const inputClass = `w-full px-3 py-2 text-sm border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
    isDark 
      ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-400' 
      : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500'
  }`;

  const labelClass = `flex items-center text-[11px] font-semibold tracking-wide uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`;

  // Date range state for calendar popup
  const [calendarOpenFor, setCalendarOpenFor] = useState<'from' | 'to' | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    // If a date is already set, open that month first
    const target = filters.createdFrom || filters.createdTo;
    if (target) {
      const parts = target.split('.');
      if (parts.length === 3) {
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, 1);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const parseRuToDate = (val?: string): Date | null => {
    if (!val) return null;
    const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const fromDate = parseRuToDate(filters.createdFrom || undefined);
  const toDate = parseRuToDate(filters.createdTo || undefined);

  const today = new Date();
  const startOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const endOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

  const days: Date[] = [];
  // Weekday offset (Mon=1..Sun=7 -> we treat Mon as first). Adjust JS (Sun=0) to Mon-first.
  const firstWeekday = (startOfMonth.getDay() + 6) % 7; // 0..6, 0 = Monday
  for (let i = 0; i < firstWeekday; i++) {
    days.push(new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate() - (firstWeekday - i)));
  }
  for (let d = 1; d <= endOfMonth.getDate(); d++) {
    days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
  }
  // Fill to 6 weeks grid
  while (days.length % 7 !== 0 || days.length < 42) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  const handlePickDate = (picked: Date) => {
    // Disable future dates
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    if (picked.getTime() > endOfToday.getTime()) return;

    if (calendarOpenFor === 'from') {
      const newFrom = formatDate(picked);
      // If to exists and is before new from, clear it
      if (toDate && picked.getTime() > toDate.getTime()) {
        updateFilters('products', { createdFrom: newFrom, createdTo: undefined });
      } else {
        updateFilters('products', { createdFrom: newFrom });
      }
      setCalendarOpenFor(null);
    } else if (calendarOpenFor === 'to') {
      const newTo = formatDate(picked);
      // If from exists and to is before from, swap
      if (fromDate && picked.getTime() < fromDate.getTime()) {
        updateFilters('products', { createdFrom: newTo, createdTo: formatDate(fromDate) });
      } else {
        updateFilters('products', { createdTo: newTo });
      }
      setCalendarOpenFor(null);
    }
  };

  const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'month' | 'all') => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (preset === 'today') {
      updateFilters('products', { createdFrom: formatDate(startOfToday), createdTo: formatDate(endOfToday) });
      return;
    }
    if (preset === 'yesterday') {
      const y = new Date(startOfToday);
      y.setDate(y.getDate() - 1);
      const e = new Date(endOfToday);
      e.setDate(e.getDate() - 1);
      updateFilters('products', { createdFrom: formatDate(y), createdTo: formatDate(e) });
      return;
    }
    if (preset === 'last7') {
      const s = new Date(endOfToday);
      s.setDate(s.getDate() - 6);
      updateFilters('products', { createdFrom: formatDate(s), createdTo: formatDate(endOfToday) });
      return;
    }
    if (preset === 'last30') {
      const s = new Date(endOfToday);
      s.setDate(s.getDate() - 29);
      updateFilters('products', { createdFrom: formatDate(s), createdTo: formatDate(endOfToday) });
      return;
    }
    if (preset === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      updateFilters('products', { createdFrom: formatDate(s), createdTo: formatDate(endOfToday) });
      return;
    }
    if (preset === 'all') {
      updateFilters('products', { createdFrom: undefined, createdTo: undefined });
      return;
    }
  };

  return (
    <div className="space-y-4">
      {/* Product Name/SKU */}
      <div className={labelClass}>Базовые параметры</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>
            <Package className="h-3 w-3 mr-1 text-blue-500" />
            Название товара
          </label>
          <input
            type="text"
            value={filters.name || ''}
            onChange={(e) => updateFilters('products', { name: e.target.value })}
            placeholder="Поиск по названию..."
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>
            <Barcode className="h-3 w-3 mr-1 text-purple-500" />
            Артикул/SKU
          </label>
          <input
            type="text"
            value={filters.sku || ''}
            onChange={(e) => updateFilters('products', { sku: e.target.value })}
            placeholder="Введите артикул..."
            className={inputClass}
          />
        </div>
      </div>

      {/* Product ID and Movement ID Search */}
      <div className={labelClass}>Идентификаторы</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>
            <Hash className="h-3 w-3 mr-1 text-blue-500" />
            ID товара
          </label>
          <input
            type="text"
            value={filters.productId || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6); // Only digits, max 6
              updateFilters('products', { productId: value });
            }}
            placeholder="Введите 6-значный ID товара..."
            className={inputClass}
            maxLength={6}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>
            <Hash className="h-3 w-3 mr-1 text-indigo-500" />
            ID движения товара
          </label>
          <input
            type="text"
            value={filters.movementId || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6); // Only digits, max 6
              updateFilters('products', { movementId: value });
            }}
            placeholder="Введите 6-значный ID движения..."
            className={inputClass}
            maxLength={6}
          />
        </div>
      </div>

      {/* Category and Supplier */}
      <div className={labelClass}>Категория и поставщик</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>
            <Tag className="h-3 w-3 mr-1 text-green-500" />
            Категория
          </label>
          <select
            value={filters.category || ''}
            onChange={(e) => updateFilters('products', { category: e.target.value })}
            className={inputClass}
          >
            <option value="">Все категории</option>
            {Object.entries(categoriesMap).map(([slug, name]) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>
            <Building className="h-3 w-3 mr-1 text-orange-500" />
            Поставщик
          </label>
          <select
            value={filters.supplier || ''}
            onChange={(e) => updateFilters('products', { supplier: e.target.value })}
            className={inputClass}
          >
            <option value="">Все поставщики</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-1.5">
        <div className={labelClass}>Диапазон цен</div>
        <label className={labelClass}>
          <DollarSign className="h-3 w-3 mr-1 text-emerald-500" />
          Диапазон цен
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={filters.priceMin || ''}
            onChange={(e) => updateFilters('products', { priceMin: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Мин."
            className={inputClass}
            min="0"
          />
          <input
            type="number"
            value={filters.priceMax || ''}
            onChange={(e) => updateFilters('products', { priceMax: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Макс."
            className={inputClass}
            min="0"
          />
        </div>
      </div>

      {/* Stock Status */}
      <div className="space-y-1.5">
        <div className={labelClass}>Статус наличия</div>
        <label className={labelClass}>
          <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
          Статус наличия
        </label>
        <div className="flex flex-wrap gap-2">
          {stockStatuses.map((status) => {
            const isSelected = (filters.stockStatus || []).includes(status.value as any);
            return (
              <button
                key={status.value}
                onClick={() => toggleStockStatus(status.value as any)}
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

      {/* Date Range */}
      <div className="space-y-1.5">
        <div className={labelClass}>Дата добавления</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* From */}
          <div className="relative">
            <label className={labelClass}>От</label>
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="дд.мм.гггг"
                value={filters.createdFrom || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 4) formatted = `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,8)}`;
                  else if (digits.length > 2) formatted = `${digits.slice(0,2)}.${digits.slice(2,4)}`;
                  updateFilters('products', { createdFrom: formatted });
                }}
                className={`${inputClass} pl-10 pr-10`}
              />
              <button
                type="button"
                onClick={() => setCalendarOpenFor(calendarOpenFor === 'from' ? null : 'from')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                title="Календарь"
              >
                <Calendar className={`h-4 w-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>

          {/* To */}
          <div className="relative">
            <label className={labelClass}>До</label>
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="дд.мм.гггг"
                value={filters.createdTo || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 4) formatted = `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,8)}`;
                  else if (digits.length > 2) formatted = `${digits.slice(0,2)}.${digits.slice(2,4)}`;
                  updateFilters('products', { createdTo: formatted });
                }}
                className={`${inputClass} pl-10 pr-10`}
              />
              <button
                type="button"
                onClick={() => setCalendarOpenFor(calendarOpenFor === 'to' ? null : 'to')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                title="Календарь"
              >
                <Calendar className={`h-4 w-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={() => applyPreset('today')} className={`px-2 py-1 text-xs rounded border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Сегодня</button>
          <button onClick={() => applyPreset('yesterday')} className={`px-2 py-1 text-xs rounded border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Вчера</button>
          <button onClick={() => applyPreset('last7')} className={`px-2 py-1 text-xs rounded border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Последние 7 дней</button>
          <button onClick={() => applyPreset('last30')} className={`px-2 py-1 text-xs rounded border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Последние 30 дней</button>
          <button onClick={() => applyPreset('month')} className={`px-2 py-1 text-xs rounded border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Этот месяц</button>
          <button onClick={() => applyPreset('all')} className={`px-2 py-1 text-xs rounded border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Весь период</button>
        </div>

        {/* Calendar Popup */}
        {calendarOpenFor && (
          <div className={`mt-2 p-3 rounded-lg shadow-xl border z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className={`p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                title="Предыдущий месяц"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {calendarMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </div>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className={`p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                title="Следующий месяц"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className={`grid grid-cols-7 text-center text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, idx) => {
                const inCurrentMonth = d.getMonth() === calendarMonth.getMonth();
                const isFuture = d.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const selectedStart = fromDate && isSameDay(d, fromDate);
                const selectedEnd = toDate && isSameDay(d, toDate);
                const inRange = fromDate && toDate && d.getTime() > fromDate.getTime() && d.getTime() < toDate.getTime();
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!inCurrentMonth || isFuture}
                    onClick={() => handlePickDate(d)}
                    className={`py-1.5 rounded text-xs transition-colors ${
                      !inCurrentMonth ? (isDark ? 'text-gray-600' : 'text-gray-300') : ''
                    } ${
                      isFuture ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    } ${
                      selectedStart || selectedEnd ? 'bg-blue-500 text-white' : inRange ? (isDark ? 'bg-blue-900/20' : 'bg-blue-100') : ''
                    } ${
                      isWeekend && inCurrentMonth ? (isDark ? 'text-red-300' : 'text-red-600') : ''
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-3">
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date())}
                className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Сегодня
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarOpenFor(null)}
                  className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {Object.keys(filters).some(key => filters[key as keyof typeof filters]) && (
        <div className={`pt-2 mt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex flex-wrap gap-1.5">
            {filters.name && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                {filters.name}
              </span>
            )}
            {filters.sku && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                SKU: {filters.sku}
              </span>
            )}
            {filters.productId && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                ID товара: {filters.productId}
              </span>
            )}
            {filters.movementId && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                ID движения: {filters.movementId}
              </span>
            )}
            {(filters.priceMin !== undefined || filters.priceMax !== undefined) && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                {filters.priceMin || 0} - {filters.priceMax || '∞'} ₸
              </span>
            )}
            {(filters.createdFrom || filters.createdTo) && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                Дата: {filters.createdFrom || '…'} — {filters.createdTo || '…'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSearchFilters;
