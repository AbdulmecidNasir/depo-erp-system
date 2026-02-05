import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { Search, Filter, Package, Grid, List, CheckSquare, Square, Check, X, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

const SalesShowcasePage: React.FC = () => {
    const { isDark } = useTheme();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Multi-Select Search State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);

    // Data State
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<{ id: string, name: string, count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    // Refs
    const searchWrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();

        // Click outside to close dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prodRes, catRes] = await Promise.all([
                api.products.getAll({ limit: 3000 }),
                api.products.getCategories()
            ]);

            if (prodRes.success) {
                setProducts(prodRes.data);
            }

            if (catRes.success) {
                const cats = Object.entries(catRes.data || {}).map(([id, name]) => ({
                    id,
                    name: name as string,
                    count: 0
                }));
                setCategories(cats);
            }
        } catch (error) {
            console.error('Error fetching showcase:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filtered options for the DROPDOWN (Search candidates)
    const dropdownOptions = React.useMemo(() => {
        if (!searchQuery && selectedIds.size > 0) return products; // If empty search, show everything (could filter to nothing if desired, but user might want to browse)
        if (!searchQuery) return products; // Default showing all if focused? Maybe limit? Let's limit to 50 for performance if no query

        return products.filter(product => {
            return product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.barcode && product.barcode.includes(searchQuery));
        });
    }, [products, searchQuery, selectedIds]);

    // Products to display in the MAIN GRID
    const displayedProducts = React.useMemo(() => {
        // If "Enter" was pressed and we have selected items, show ONLY them
        if (showSelectedOnly && selectedIds.size > 0) {
            return products.filter(p => selectedIds.has(p.id));
        }

        // Otherwise, show filtered by Category (default view)
        return products.filter(product => {
            return selectedCategory === 'all' || product.category === selectedCategory;
        });
    }, [products, showSelectedOnly, selectedIds, selectedCategory]);

    // Pagination Logic
    const totalPages = Math.ceil(displayedProducts.length / ITEMS_PER_PAGE);
    const paginatedProducts = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return displayedProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [displayedProducts, currentPage]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, showSelectedOnly, selectedIds]);

    // Handlers
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
                setShowSelectedOnly(true);
            } else {
                setShowSelectedOnly(false);
            }
        }
    };

    return (
        <div className={`min-h-screen flex flex-col ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>

            <div className={`sticky top-0 z-30 px-6 py-4 border-b backdrop-blur-md ${isDark ? 'bg-gray-900/80 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
                <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-8 flex-1">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent shrink-0">B2B Витрина</h1>

                        <button
                            type="button"
                            onClick={() => setShowFiltersPanel(prev => !prev)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium text-sm shrink-0 ${showFiltersPanel ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25' : isDark ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'}`}
                        >
                            <SlidersHorizontal size={18} />
                            Фильтры
                            {showFiltersPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {/* Multi-Select Search Bar */}
                        <div className="hidden md:block relative w-96 z-50" ref={searchWrapperRef}>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Поиск и выбор товаров..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsDropdownOpen(true);
                                    if (showSelectedOnly) setShowSelectedOnly(false); // Reset view on new search interact
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                onKeyDown={handleKeyDown}
                                className={`w-full pl-4 pr-16 py-2 rounded-xl outline-none border transition-all ${isDark ? 'bg-gray-800 border-gray-700 focus:border-purple-500' : 'bg-gray-100 border-gray-200 focus:border-purple-500'}`}
                            />
                            {selectedIds.size === 0 && (
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            )}
                            {/* Selected Count Indicator */}
                            {selectedIds.size > 0 && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                        {selectedIds.size}
                                    </span>
                                    <button
                                        onClick={() => { setSelectedIds(new Set()); setShowSelectedOnly(false); setSearchQuery(''); }}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                        title="Сбросить выбор"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Dropdown Results */}
                            {isDropdownOpen && (
                                <div className={`absolute top-full left-0 right-0 mt-2 max-h-[400px] overflow-y-auto rounded-xl border shadow-2xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                    {dropdownOptions.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 text-sm">Ничего не найдено</div>
                                    ) : (
                                        <div className="divide-y dark:divide-gray-700">
                                            {dropdownOptions.slice(0, 50).map(product => { // Limit render for perf
                                                const isSelected = selectedIds.has(product.id);
                                                return (
                                                    <div
                                                        key={product.id}
                                                        onClick={() => toggleSelection(product.id)}
                                                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${isSelected
                                                            ? isDark ? 'bg-purple-900/20' : 'bg-purple-50'
                                                            : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <div className={`shrink-0 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`}>
                                                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate">{product.name}</div>
                                                            <div className="text-xs text-gray-500 flex gap-2">
                                                                <span>{product.barcode}</span>
                                                                {product.stock !== undefined && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className={product.stock === 0 ? 'text-red-500' : ''}>{product.stock > 0 ? `${product.stock} шт` : 'Нет'}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSelected && <Check size={16} className="text-purple-600 shrink-0" />}
                                                    </div>
                                                );
                                            })}
                                            {dropdownOptions.length > 50 && (
                                                <div className="p-2 text-center text-xs text-gray-400">
                                                    Показано 50 из {dropdownOptions.length}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 border p-1 rounded-lg dark:border-gray-700">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700 text-purple-600' : 'text-gray-400'}`}><Grid size={18} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700 text-purple-600' : 'text-gray-400'}`}><List size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {showFiltersPanel && (
                <div className={`max-w-7xl mx-auto w-full px-6 pb-4`}>
                    <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ${isDark ? 'bg-gray-800/90 border-gray-700 backdrop-blur-sm' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Расширенные фильтры</h3>
                                <button onClick={() => setShowFiltersPanel(false)} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all">Применить</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                <div className="md:col-span-2">
                                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Поиск по товарам</label>
                                    <div className="relative">
                                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Номер, название, штрихкод..." className={`w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                                        <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Категория</label>
                                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                                        <option value="all">Все категории</option>
                                        {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 max-w-7xl mx-auto w-full p-6 gap-8 relative">

                {/* Categories Sidebar */}
                <aside className="w-64 hidden lg:block shrink-0">
                    <div className={`sticky top-24 p-4 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'}`}>
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Filter size={18} /> Категории</h3>
                        <ul className="space-y-1">
                            <li>
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === 'all'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium'
                                        : isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <span>Все категории</span>
                                </button>
                            </li>
                            {categories.map(cat => (
                                <li key={cat.id}>
                                    <button
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat.id
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium'
                                            : isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-600'}`}
                                    >
                                        <span>{cat.name}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Main Product Grid */}
                <main className="flex-1">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                        </div>
                    ) : displayedProducts.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            {showSelectedOnly ? 'Товары не выбраны' : 'Товары не найдены'}
                        </div>
                    ) : (
                        <>
                            {showSelectedOnly && (
                                <div className="mb-6 flex items-center justify-between bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                                    <span className="text-purple-800 dark:text-purple-200 font-medium">
                                        Результаты поиска: найдено {displayedProducts.length} товаров
                                    </span>
                                    <button
                                        onClick={() => { setSelectedIds(new Set()); setShowSelectedOnly(false); setSearchQuery(''); }}
                                        className="text-sm font-bold text-purple-600 hover:text-purple-800 dark:hover:text-purple-400"
                                    >
                                        Показать все
                                    </button>
                                </div>
                            )}
                            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                                {paginatedProducts.map(product => {
                                    const isSelected = selectedIds.has(product.id);
                                    return (
                                        <div
                                            key={product.id || product._id}
                                            onClick={() => toggleSelection(product.id)}
                                            className={`group p-4 rounded-2xl border transition-all duration-300 hover:shadow-xl cursor-pointer ${isDark ? 'bg-gray-800/80 border-gray-700 hover:border-purple-500/50' : 'bg-white border-gray-200 hover:border-purple-300'} ${isSelected ? 'ring-2 ring-purple-500 border-transparent' : ''}`}
                                        >
                                            <div className={`aspect-[4/3] rounded-xl mb-4 overflow-hidden relative ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                                {/* Image Logic */}
                                                {product.image || product.images?.[0] ? (
                                                    <img src={product.image || product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                                        <Package size={32} strokeWidth={1} />
                                                    </div>
                                                )}

                                                {product.stock === 0 && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">Нет в наличии</span>
                                                    </div>
                                                )}

                                                {/* Checkbox Overlay for Visual Feedback */}
                                                <div className={`absolute top-2 right-2 p-1.5 rounded-lg shadow-sm transition-all ${isSelected ? 'bg-purple-600 text-white' : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                                                    {isSelected ? <Check size={16} strokeWidth={3} /> : <Square size={16} />}
                                                </div>
                                            </div>

                                            <div className="mb-2">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
                                                    {categories.find(c => c.id === product.category)?.name || product.category || 'Общее'}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-lg mb-1 leading-tight">{product.name}</h3>
                                            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>SKU: {product.barcode || product.id?.slice(-6)}</p>

                                            <div className="flex items-end justify-between mt-auto">
                                                <div>
                                                    <p className="text-xs text-gray-500">Цена</p>
                                                    <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{product.salePrice || product.price || 0} UZS</p>
                                                </div>
                                                <div className={`text-sm font-medium ${product.stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {product.stock > 0 ? `${product.stock} шт` : 'Нет'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Pagination Controls */}
                    {!loading && displayedProducts.length > 0 && totalPages > 1 && (
                        <div className="flex justify-center mt-8 gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className={`p-2 rounded-lg border transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-800 disabled:opacity-30' : 'border-gray-200 hover:bg-gray-50 disabled:opacity-30'}`}
                            >
                                <ChevronLeft size={20} />
                            </button>

                            {/* Page Numbers */}
                            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide max-w-[calc(100vw-100px)] lg:max-w-none">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        // Show first, last, and pages around current
                                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                                    })
                                    .map((page, index, array) => {
                                        const prev = array[index - 1];
                                        const showEllipsis = prev && page - prev > 1;

                                        return (
                                            <React.Fragment key={page}>
                                                {showEllipsis && (
                                                    <span className={`px-2 py-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>...</span>
                                                )}
                                                <button
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-10 h-10 rounded-lg border font-medium transition-colors ${currentPage === page
                                                            ? 'bg-purple-600 text-white border-purple-600'
                                                            : isDark
                                                                ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                                                                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className={`p-2 rounded-lg border transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-800 disabled:opacity-30' : 'border-gray-200 hover:bg-gray-50 disabled:opacity-30'}`}
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default SalesShowcasePage;
