import React, { useState, useRef, useEffect } from 'react';
import { Package, Hash, Building, DollarSign, AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useSearch } from '../../contexts/SearchContext';
import { api } from '../../services/api';

const ProductFilterDropdown: React.FC = () => {
  const { isDark } = useTheme();
  const { 
    productFilters, 
    updateFilters, 
    clearFilters, 
    getActiveFilterCount 
  } = useSearch();
  
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    category: '',
    supplier: '',
    priceMin: '',
    priceMax: '',
    stockStatus: 'all',
    sku: '',
    ...productFilters
  } as any);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Load categories and suppliers
  useEffect(() => {
    const load = async () => {
      try {
        const catRes: any = await api.products.getCategories();
        if (catRes?.success && catRes.data) {
          const list = Object.entries(catRes.data as Record<string, string>).map(([id, name]) => ({ id, name }));
          setCategories(list);
        }
      } catch {}
      try {
        const supRes: any = await api.suppliers.getAll({ activeOnly: true, limit: 500 });
        if (supRes?.success) setSuppliers((supRes.suppliers || supRes.data || []).map((s: any) => ({ id: s.id || s._id, name: s.name })));
      } catch {}
    };
    load();
  }, []);

  // Update local filters when global filters change
  useEffect(() => {
    setLocalFilters((prev: any) => ({
      category: '',
      supplier: '',
      priceMin: '',
      priceMax: '',
      stockStatus: 'all',
      sku: '',
      ...prev,
      ...productFilters
    }));
  }, [productFilters]);

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const handleApplyFilters = () => {
    const payload: any = {
      category: localFilters.category || undefined,
      supplier: localFilters.supplier || undefined,
      sku: localFilters.sku || undefined,
      priceMin: localFilters.priceMin !== '' ? Number(localFilters.priceMin) : undefined,
      priceMax: localFilters.priceMax !== '' ? Number(localFilters.priceMax) : undefined,
      stockStatus: localFilters.stockStatus || undefined,
    };
    updateFilters('products', payload);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const cleared = { category: '', supplier: '', priceMin: '', priceMax: '', stockStatus: 'all', sku: '' } as any;
    setLocalFilters(cleared);
    clearFilters('products');
    setIsOpen(false);
  };

  const activeCount = getActiveFilterCount('products');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group relative p-2 rounded-lg transition-all duration-300 modern-button focus-ring ${
          isDark 
            ? 'hover:bg-gray-600' 
            : 'hover:bg-gray-100'
        } ${activeCount > 0 ? 'filter-pulse' : ''}`}
        title="Фильтры товаров"
      >
        <Package className={`h-5 w-5 transition-all duration-300 ${
          isOpen 
            ? 'text-blue-500 group-hover:scale-110' 
            : isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'
        }`} />
        
        {/* Filter Count Badge */}
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg animate-bounce-in">
            {activeCount}
          </span>
        )}
      </button>

      {/* Overlay to close on outside click */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown Content */}
          <div className={`absolute top-full left-0 mt-2 w-96 rounded-lg shadow-xl border z-50 ${
          isDark 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
          }`}>
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Фильтры товаров
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Form */}
            <div className="space-y-4">
              {/* Row 1: SKU */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Hash className="h-3 w-3 inline mr-1" />
                    Артикул/SKU
                  </label>
                  <input
                    type="text"
                    value={localFilters.sku || ''}
                    onChange={(e) => handleFilterChange('sku', e.target.value)}
                    placeholder="Введите артикул..."
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
              </div>

              {/* Row 2 removed (ID товара) */}

              {/* Row 3: Category and Supplier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Package className="h-3 w-3 inline mr-1" />
                    Категория
                  </label>
                  <select
                    value={localFilters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Building className="h-3 w-3 inline mr-1" />
                    Поставщик
                  </label>
                  <select
                    value={localFilters.supplier}
                    onChange={(e) => handleFilterChange('supplier', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  >
                    <option value="">Все поставщики</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Price Range */}
              <div>
                <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  <DollarSign className="h-3 w-3 inline mr-1" />
                  Диапазон цен
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={localFilters.priceMin}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                    placeholder="Мин."
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  <input
                    type="number"
                    value={localFilters.priceMax}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                    placeholder="Макс."
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
              </div>

              {/* Date range removed per simplified filters */}

              {/* Row 5: Stock Status */}
              <div>
                <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Статус наличия
                </label>
                <div className="flex space-x-2">
                  {[
                    { value: 'all', label: 'Все' },
                    { value: 'inStock', label: 'В наличии' },
                    { value: 'lowStock', label: 'Мало' },
                    { value: 'outOfStock', label: 'Нет' }
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => handleFilterChange('stockStatus', status.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        localFilters.stockStatus === status.value
                          ? 'bg-blue-500 text-white'
                          : isDark
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClearFilters}
                className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center space-x-1.5 ${
                  isDark
                    ? 'text-gray-300 hover:text-white border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 hover:text-gray-900 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <X className="h-3 w-3" />
                <span>Очистить</span>
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Применить
              </button>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProductFilterDropdown;
