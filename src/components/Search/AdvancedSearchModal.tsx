import React, { useState, useEffect } from 'react';
import { X, Filter, Search, Sliders, Calendar, DollarSign, Package, ShoppingCart, Users, TrendingUp, Save, Trash2, Clock, Star, ChevronDown, Tag } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useTheme } from '../../contexts/ThemeContext';
import ProductSearchFilters from './ProductSearchFilters';
import SalesSearchFilters from './SalesSearchFilters';
import ClientSearchFilters from './ClientSearchFilters';
import FinancialSearchFilters from './FinancialSearchFilters';

const AdvancedSearchModal: React.FC = () => {
  const {
    isAdvancedSearchOpen,
    closeAdvancedSearch,
    activeCategory,
    setActiveCategory,
    clearFilters,
    getActiveFilterCount,
    filterPresets,
    savePreset,
    deletePreset,
    loadPreset,
    recentSearches,
    applySearch,
  } = useSearch();

  const { isDark } = useTheme();
  const [isClosing, setIsClosing] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [openSections, setOpenSections] = useState<{ products: boolean; sales: boolean; clients: boolean; financial: boolean }>({
    products: true,
    sales: true,
    clients: true,
    financial: true,
  });

  const toggleOpen = (id: 'products' | 'sales' | 'clients' | 'financial') =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    if (isAdvancedSearchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAdvancedSearchOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeAdvancedSearch();
      setIsClosing(false);
    }, 300);
  };

  const handleApplyFilters = async () => {
    setIsApplying(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    applySearch();
    setIsApplying(false);
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      savePreset(presetName, activeCategory);
      setPresetName('');
      setShowPresetModal(false);
    }
  };

  if (!isAdvancedSearchOpen && !isClosing) return null;

  const categories = [
    { id: 'products', label: 'Товары', icon: Package, color: 'blue' },
    { id: 'sales', label: 'Продажи', icon: ShoppingCart, color: 'green' },
    { id: 'clients', label: 'Клиенты', icon: Users, color: 'purple' },
    { id: 'financial', label: 'Финансы', icon: TrendingUp, color: 'orange' },
  ];

  const activeFilterCount = getActiveFilterCount(activeCategory);
  const currentPresets = filterPresets.filter(p => p.category === activeCategory);
  const currentRecentSearches = recentSearches.filter(s => s.category === activeCategory).slice(0, 5);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}
      >
        <div
          className={`rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden pointer-events-auto transform transition-all duration-300 ${
            isClosing ? 'scale-95 opacity-0 translate-y-4' : 'scale-100 opacity-100 translate-y-0'
          } ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Расширенный поиск</h2>
                <p className="text-xs text-white/80 mt-0.5">Настройте фильтры для точного поиска</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors group"
            >
              <X className="h-5 w-5 text-white group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className={`border-b px-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex space-x-1 overflow-x-auto">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                const count = getActiveFilterCount(cat.id as any);
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`relative flex items-center space-x-1.5 px-3 py-2 font-medium text-xs transition-all duration-200 border-b-2 whitespace-nowrap ${
                      isActive
                        ? `border-${cat.color}-500 ${isDark ? `text-${cat.color}-400 bg-gray-900` : `text-${cat.color}-600 bg-white`}`
                        : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? `text-${cat.color}-500` : ''}`} />
                    <span>{cat.label}</span>
                    {count > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? `bg-${cat.color}-500 text-white`
                          : `${isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700'}`
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-160px)] custom-scrollbar">
            <div className="p-4">
              {/* Presets and Recent Searches */}
              {(currentPresets.length > 0 || currentRecentSearches.length > 0) && (
                <div className="mb-4 space-y-3">
                  {/* Saved Presets */}
                  {currentPresets.length > 0 && (
                    <div>
                      <h3 className={`text-xs font-semibold mb-1.5 flex items-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Star className="h-3 w-3 mr-1 text-yellow-500" />
                        Сохранённые фильтры
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {currentPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className={`group flex items-center space-x-1.5 border rounded-md px-2 py-1 hover:shadow-md transition-all duration-200 ${
                              isDark 
                                ? 'bg-yellow-900/20 border-yellow-700' 
                                : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                            }`}
                          >
                            <button
                              onClick={() => loadPreset(preset)}
                              className={`text-xs font-medium ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
                            >
                              {preset.name}
                            </button>
                            <button
                              onClick={() => deletePreset(preset.id)}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded ${
                                isDark ? 'hover:bg-red-900/30' : 'hover:bg-red-100'
                              }`}
                            >
                              <Trash2 className="h-2.5 w-2.5 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Searches */}
                  {currentRecentSearches.length > 0 && (
                    <div>
                      <h3 className={`text-xs font-semibold mb-1.5 flex items-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Clock className="h-3 w-3 mr-1 text-blue-500" />
                        Недавние поиски
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {currentRecentSearches.map((search) => (
                          <button
                            key={search.id}
                            className={`text-xs border rounded-md px-2 py-1 transition-colors ${
                              isDark
                                ? 'bg-blue-900/20 border-blue-700 hover:bg-blue-900/30 text-gray-300'
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-gray-700'
                            }`}
                          >
                            {search.query || 'Поиск без запроса'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Filter Forms as collapsible sections */}
              <div className="animate-fade-in space-y-3">
                {/* Products */}
                {activeCategory === 'products' && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleOpen('products')}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between border ${
                        isDark ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <Package className="h-3 w-3 text-blue-500" /> Фильтры товаров
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.products ? '' : 'rotate-180'}`} />
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-300"
                      style={{ maxHeight: openSections.products ? 1200 : 0 }}
                    >
                      <div className="pt-3">
                        <ProductSearchFilters />
                      </div>
                    </div>
                  </>
                )}

                {/* Sales */}
                {activeCategory === 'sales' && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleOpen('sales')}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between border ${
                        isDark ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <ShoppingCart className="h-3 w-3 text-green-500" /> Фильтры продаж
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.sales ? '' : 'rotate-180'}`} />
                    </button>
                    <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: openSections.sales ? 1200 : 0 }}>
                      <div className="pt-3">
                        <SalesSearchFilters />
                      </div>
                    </div>
                  </>
                )}

                {/* Clients */}
                {activeCategory === 'clients' && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleOpen('clients')}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between border ${
                        isDark ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <Users className="h-3 w-3 text-purple-500" /> Фильтры клиентов
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.clients ? '' : 'rotate-180'}`} />
                    </button>
                    <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: openSections.clients ? 1200 : 0 }}>
                      <div className="pt-3">
                        <ClientSearchFilters />
                      </div>
                    </div>
                  </>
                )}

                {/* Financial */}
                {activeCategory === 'financial' && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleOpen('financial')}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between border ${
                        isDark ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <TrendingUp className="h-3 w-3 text-orange-500" /> Фильтры финансов
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.financial ? '' : 'rotate-180'}`} />
                    </button>
                    <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: openSections.financial ? 1200 : 0 }}>
                      <div className="pt-3">
                        <FinancialSearchFilters />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`border-t px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => clearFilters(activeCategory)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center space-x-1.5 ${
                    isDark
                      ? 'text-gray-300 hover:text-white border-gray-600 hover:bg-gray-700'
                      : 'text-gray-700 hover:text-gray-900 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Очистить</span>
                </button>
                <button
                  onClick={() => setShowPresetModal(true)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center space-x-1.5 ${
                    isDark
                      ? 'text-blue-400 hover:text-blue-300 border-blue-600 hover:bg-blue-900/20'
                      : 'text-blue-600 hover:text-blue-700 border-blue-300 hover:bg-blue-50'
                  }`}
                  disabled={activeFilterCount === 0}
                >
                  <Save className="h-3 w-3" />
                  <span>Сохранить</span>
                </button>
              </div>
              <button
                onClick={handleApplyFilters}
                disabled={isApplying}
                className="relative px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
              >
                <span className={`flex items-center space-x-1.5 ${isApplying ? 'opacity-0' : 'opacity-100'}`}>
                  <Search className="h-3.5 w-3.5" />
                  <span>Применить</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 bg-white/30 px-1.5 py-0.5 rounded-full text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                {isApplying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Preset Modal */}
      {showPresetModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowPresetModal(false)}
        >
          <div
            className={`rounded-lg shadow-2xl p-4 w-full max-w-sm transform transition-all duration-300 scale-100 ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-sm font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Сохранить фильтр</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Введите название фильтра..."
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3 ${
                isDark
                  ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
              }`}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPresetModal(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Отмена
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdvancedSearchModal;

