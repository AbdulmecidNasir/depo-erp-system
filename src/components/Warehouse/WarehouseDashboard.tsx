/*
 * Data Source Notice (2025-09-20)
 * This Warehouse dashboard has been cleaned to use ONLY real product data passed via props.
 * All mock/example analytics and placeholder lists were removed.
 * If you later add real movement/analytics data, inject it via props or API.
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Search,
  ChevronDown,
  CheckSquare,
  Square,
  X,
  Filter,
  Clock,
  Users,
  Briefcase,
  Layers,
  Calendar
} from 'lucide-react';
import { ExtendedProduct, StockAlert } from '../../types/warehouse';
import { useTheme } from '../../contexts/ThemeContext';

const categoryTranslations: Record<string, string> = {
  'processors': 'Процессоры',
  'computers': 'Компьютеры',
  'laptops': 'Ноутбуки',
  'servers': 'Серверы',
  'memory': 'Оперативная память',
  'storage': 'Накопители',
  'graphics-cards': 'Видеокарты',
  'motherboards': 'Материнские платы',
  'power-supplies': 'Блоки питания',
  'cooling': 'Охлаждение',
  'cases': 'Корпуса',
  'monitors': 'Мониторы',
  'mishka': 'Мышки',
  'naushnik': 'Наушники',
  'klavye': 'Клавиатуры',
  'mikrofon': 'Микрофоны',
  'kovrik': 'Коврики',
  'printers': 'Принтеры',
  'scanners': 'Сканеры',
  'network-equipment': 'Сетевое оборудование',
  'cables': 'Кабели',
  'adapters': 'Адаптеры',
  'accessories': 'Аксессуары',
  'consumables': 'Расходные материалы',
  'phones': 'Телефоны',
  'tablets': 'Планшеты',
  'components': 'Комплектующие',
  'network': 'Сетевое оборудование',
  'peripherals': 'Периферия',
  'software': 'Программное обеспечение',
  'office': 'Оргтехника',
  'parts': 'Запчасти',
  'other': 'Прочее'
};

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  isDark: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ value, onChange, options, placeholder, isDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-transparent border-b-2 py-2 font-medium focus:outline-none transition-colors ${isDark ? 'border-gray-600 text-gray-400' : 'border-gray-200 text-gray-500'
          }`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-50 top-full left-0 w-full mt-1 max-h-60 overflow-y-auto rounded-md shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`px-4 py-2 cursor-pointer text-sm transition-colors ${isDark
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
                } ${value === option.value ? (isDark ? 'bg-gray-700 font-semibold' : 'bg-gray-100 font-semibold') : ''}`}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface WarehouseDashboardProps {
  products: ExtendedProduct[];
  onExportData?: () => void;
}

const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({
  products,
  onExportData
}) => {
  const { isDark } = useTheme();
  const [showAlerts, setShowAlerts] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);

  // Multi-Select Search State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSelectedView, setShowSelectedView] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build stock alerts from real products
  const stockAlerts = useMemo<StockAlert[]>(() => {
    const alerts: StockAlert[] = [] as any;
    for (const p of products) {
      if (p.stock === 0) {
        alerts.push({
          id: `${p.id}-oos`,
          productId: p.id,
          type: 'out_of_stock' as any,
          message: `${p.nameRu} — нет в наличии`,
          severity: 'critical' as any,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      } else if (p.stock <= p.minStock) {
        alerts.push({
          id: `${p.id}-low`,
          productId: p.id,
          type: 'low_stock' as any,
          message: `${p.nameRu} — низкий остаток (${p.stock} шт.)`,
          severity: 'warning' as any,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    }
    return alerts;
  }, [products]);

  // Extract unique locations for filter
  const locations = useMemo(() => {
    const locs = new Set(products.map(p => p.location).filter(Boolean));
    return Array.from(locs);
  }, [products]);

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  // Extended Filter States
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDaysMin, setFilterDaysMin] = useState('');
  const [filterDaysMax, setFilterDaysMax] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState(''); // Stock Status (Positive/Zero/Low)
  const [filterAvailability, setFilterAvailability] = useState(''); // separate dropdown for Available/Reserved

  // Extra Fields (Mock/Placeholder as per request)
  const [filterSeller, setFilterSeller] = useState(''); // "prodavets"
  const [filterCounterpartyGroup, setFilterCounterpartyGroup] = useState('');

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Extract Lists for Filters
  const uniqueBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const uniqueSuppliers = useMemo(() => Array.from(new Set(products.map(p => (p as any).supplierName).filter(Boolean))), [products]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        // Do not close if clicking the toggle button (handled by button onClick)
        // But here the button is outside the ref. We'll handle it by wrapping both or careful events.
        // Simplified: Just close if click is outside ref AND not on the button
        // Ideally wrap the whole top bar. For now, rely on ref check.
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    // 1. If items are manually selected AND the user has confirmed logic (e.g. by pressing enter), show ONLY them
    if (showSelectedView && selectedIds.size > 0) {
      return products.filter(p => selectedIds.has(p.id));
    }

    // 2. Otherwise standard filtering
    return products.filter(product => {
      // Text Search
      const matchesSearch =
        product.nameRu.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.model.toLowerCase().includes(searchTerm.toLowerCase());

      // Dropdown Filters
      const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
      const matchesLocation = selectedLocation ? product.location === selectedLocation : true;
      const matchesUrgency = showUrgentOnly ? (product.stock <= product.minStock || product.stock === 0) : true;

      // New Advanced Filters
      const matchesBrand = filterBrand ? product.brand === filterBrand : true;
      const matchesSupplier = filterSupplier ? (product as any).supplierName === filterSupplier : true;

      // Days in Stock (mock calc based on updatedAt/createdAt)
      let matchesDays = true;
      if (filterDaysMin || filterDaysMax) {
        const daysInStock = Math.floor((new Date().getTime() - new Date(product.createdAt || new Date()).getTime()) / (1000 * 3600 * 24));
        if (filterDaysMin && daysInStock < Number(filterDaysMin)) matchesDays = false;
        if (filterDaysMax && daysInStock > Number(filterDaysMax)) matchesDays = false;
      }

      // Stock Status Filter
      let matchesStockStatus = true;
      if (filterStockStatus === 'positive') matchesStockStatus = product.stock > 0;
      else if (filterStockStatus === 'zero') matchesStockStatus = product.stock === 0;
      else if (filterStockStatus === 'below_min') matchesStockStatus = product.stock <= product.minStock;

      // Availability Filter (Separate Dropdown)
      let matchesAvailability = true;
      if (filterAvailability === 'available') matchesAvailability = (product.availableStock || 0) > 0;
      else if (filterAvailability === 'reserved') matchesAvailability = (product.reservedStock || 0) > 0;

      return matchesSearch && matchesCategory && matchesLocation && matchesUrgency && matchesBrand && matchesSupplier && matchesDays && matchesStockStatus && matchesAvailability;
    });
  }, [products, searchTerm, selectedCategory, selectedLocation, showUrgentOnly, selectedIds, showSelectedView, filterBrand, filterSupplier, filterDaysMin, filterDaysMax, filterStockStatus, filterAvailability]);

  // Options for the Search Dropdown
  const dropdownOptions = useMemo(() => {
    if (!searchTerm) return [];
    return products.filter(product =>
      product.nameRu.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50);
  }, [products, searchTerm]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsDropdownOpen(false);
      if (selectedIds.size > 0) {
        setShowSelectedView(true);
      }
    }
  };

  // Prepare options for custom dropdowns
  const categoryOptions = useMemo(() => {
    return [
      { value: '', label: 'Все категории' },
      ...categories.map(cat => ({
        value: cat,
        label: categoryTranslations[cat.toLowerCase()] || cat
      }))
    ];
  }, [categories]);

  const locationOptions = useMemo(() => {
    return [
      { value: '', label: 'Все склады' },
      ...locations.map(loc => ({
        value: loc,
        label: loc
      }))
    ];
  }, [locations]);

  return (
    <div className="space-y-6">
      {/* 1. URGENCY Section */}
      {showAlerts && (
        <div className={`rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-md`}>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <span className={`text-lg font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
                СРОЧНОСТЬ
              </span>
              {stockAlerts.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {stockAlerts.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              className={`flex-1 md:flex-none px-8 py-3 rounded-md font-medium transition-colors uppercase tracking-wide ${showUrgentOnly
                ? 'bg-red-700 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-gray-900'
                : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              onClick={() => setShowUrgentOnly(!showUrgentOnly)}
            >
              {showUrgentOnly ? 'ПОКАЗАТЬ ВСЕ' : 'ПРОВЕРИТЬ'}
            </button>
            <button
              className={`flex-1 md:flex-none px-8 py-3 rounded-md font-medium transition-colors uppercase tracking-wide ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              onClick={() => setShowAlerts(false)}
            >
              СКРЫТЬ
            </button>
          </div>
        </div>
      )}

      {/* 2. Filters Row (REMOVED - Moved to Advanced Filter Menu) */}

      {/* 3. Search Row (Multi-Select) & Filter */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg shadow-md transition-all duration-300 z-30 relative ${isDark ? 'bg-gray-800' : 'bg-white'} w-full max-w-md`} ref={searchWrapperRef}>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Поиск и выбор товаров (Enter чтобы показать)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
                if (showSelectedView) setShowSelectedView(false); // Reset view if searching again
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={handleKeyDown}
              className={`w-full pl-4 pr-16 py-2 bg-transparent border-none focus:ring-0 text-sm placeholder-opacity-50 ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
            />
            {selectedIds.size === 0 && (
              <Search className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            )}

            {/* Selected Count & Clear Button */}
            {selectedIds.size > 0 && (
              <div className="absolute right-3 flex items-center gap-2">
                {showSelectedView && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full animate-pulse">
                    Фильтр
                  </span>
                )}
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {selectedIds.size}
                </span>
                <button
                  onClick={() => {
                    setSelectedIds(new Set());
                    setSearchTerm('');
                    setShowSelectedView(false);
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Сбросить выбор"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Dropdown Results */}
          {isDropdownOpen && searchTerm && (
            <div className={`absolute top-full left-0 right-0 mt-2 max-h-[400px] overflow-y-auto rounded-xl border shadow-2xl z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              {dropdownOptions.length === 0 ? (
                <div className="p-3 text-center text-gray-500 text-xs">Ничего не найдено</div>
              ) : (
                <div className="divide-y dark:divide-gray-700">
                  {dropdownOptions.map(product => {
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <div
                        key={product.id}
                        onClick={() => toggleSelection(product.id)}
                        className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${isSelected
                          ? isDark ? 'bg-blue-900/20' : 'bg-blue-50'
                          : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{product.nameRu}</div>
                          <div className="text-xs text-gray-500 flex gap-2">
                            <span>{product.brand} {product.model}</span>
                            {product.stock !== undefined && (
                              <>
                                <span>•</span>
                                <span className={product.stock === 0 ? 'text-red-500' : ''}>{product.stock > 0 ? `${product.stock} шт` : 'Нет'}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && <span className="text-[10px] font-bold text-blue-600">Выбрано</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFilterMenuOpen(!isFilterMenuOpen);
            }}
            className={`p-2.5 rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 ${isDark || isFilterMenuOpen ? 'bg-gray-800 text-blue-400 border border-blue-500' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            title="Фильтры"
          >
            <Filter size={20} />
          </button>

          {/* ADVANCED FILTER MENU POPUP */}
          {isFilterMenuOpen && (
            <div
              ref={filterMenuRef}
              className={`absolute top-0 left-full ml-3 w-[600px] p-6 rounded-2xl shadow-2xl border z-40 animate-fadeIn ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* 1. Category */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Категория (kategoriya)</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Все категории</option>
                    {categories.map(c => <option key={c} value={c}>{categoryTranslations[c.toLowerCase()] || c}</option>)}
                  </select>
                </div>

                {/* 2. Warehouse */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Склад</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Все склады</option>
                    {locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* 3. Stock Status (New) */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Остаток</label>
                  <select
                    value={filterStockStatus}
                    onChange={(e) => setFilterStockStatus(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Любой</option>
                    <option value="positive">Положительный</option>
                    <option value="zero">Нулевой</option>
                    <option value="below_min">Ниже неснижаемого остатка</option>
                  </select>
                </div>

                {/* 4. Availability (New Separate Dropdown) */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Наличие</label>
                  <select
                    value={filterAvailability}
                    onChange={(e) => setFilterAvailability(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Все</option>
                    <option value="available">Доступно</option>
                    <option value="reserved">Забронировано</option>
                  </select>
                </div>

                {/* 3. Brand */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Проект: Brand</label>
                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Все бренды</option>
                    {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* 4. Counterparty */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Контрагент</label>
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Все контрагенты</option>
                    {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* 5. Counterparty Group */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Группа контрагента</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Группа..."
                      value={filterCounterpartyGroup}
                      onChange={(e) => setFilterCounterpartyGroup(e.target.value)}
                      className={`w-full pl-9 p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    />
                  </div>
                </div>

                {/* 6. Seller / Prodavets */}
                <div className="col-span-1">
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Продавец</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Продавец..."
                      value={filterSeller}
                      onChange={(e) => setFilterSeller(e.target.value)}
                      className={`w-full pl-9 p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    />
                  </div>
                </div>

                {/* 8. Days in Stock / Stats */}
                <div className="col-span-2 border-t pt-4 mt-2 dark:border-gray-700">
                  <label className={`block text-xs font-bold uppercase mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дополнительно: Дней на складе</label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="number"
                          placeholder="Мин. дней"
                          value={filterDaysMin}
                          onChange={(e) => setFilterDaysMin(e.target.value)}
                          className={`w-full pl-9 p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="number"
                          placeholder="Макс. дней"
                          value={filterDaysMax}
                          onChange={(e) => setFilterDaysMax(e.target.value)}
                          className={`w-full pl-9 p-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-green-500`}></div>
                      <span className="text-xs text-gray-500">Доступно</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-orange-500`}></div>
                      <span className="text-xs text-gray-500">Забронировано</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. List Area */}
      <div className={`rounded-lg shadow-md p-6 min-h-[500px] transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <th className={`px-6 py-4 text-left text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ТОВАР
                </th>
                <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ЦЕНА
                </th>
                <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  СКЛАД
                </th>
                <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ОСТАТОК
                </th>
                <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  МИН. ОСТАТОК
                </th>
                <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ДНЕЙ
                </th>
                <th className={`px-6 py-4 text-center text-sm font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  СТАТУС
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock === 0;
                const isLowStock = product.stock <= product.minStock;
                const daysInStock = Math.floor((new Date().getTime() - new Date(product.createdAt || new Date()).getTime()) / (1000 * 3600 * 24));

                return (
                  <tr key={product.id} className={`group transition-colors duration-200 ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.nameRu} className="h-10 w-10 rounded-md object-cover mr-4" />
                        ) : (
                          <div className={`h-10 w-10 rounded-md mr-4 flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {product.nameRu}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {product.brand} {product.model}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-center font-mono font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {product.salePrice ? product.salePrice.toLocaleString() : '0'} UZS
                    </td>
                    <td className={`px-6 py-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {(product as any).locationStock ? (
                        <div className="flex flex-col gap-1 items-center">
                          {Object.entries((product as any).locationStock).map(([loc, qty]) => (
                            Number(qty) > 0 && (
                              <div key={loc} className="text-xs">
                                <span className="font-medium">{loc}: </span>
                                <span>{Number(qty)}</span>
                              </div>
                            )
                          ))}
                          {Object.keys((product as any).locationStock).length === 0 && (product.location || '—')}
                        </div>
                      ) : (
                        product.location || '—'
                      )}
                    </td>
                    <td className={`px-6 py-4 text-center font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {product.stock}
                    </td>
                    <td className={`px-6 py-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {product.minStock}
                    </td>
                    <td className={`px-6 py-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <Clock size={14} />
                        <span>{daysInStock}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Нет в наличии
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          Мало
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          В наличии
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Package className={`mx-auto h-12 w-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {showUrgentOnly ? 'Срочные товары не найдены' : 'Список пуст'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WarehouseDashboard;