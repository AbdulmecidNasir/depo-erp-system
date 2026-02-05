import React, { createContext, useContext, useState, useCallback } from 'react';

// Search filter types
export interface ProductFilters {
  name?: string;
  sku?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  stockStatus?: ('in_stock' | 'low_stock' | 'out_of_stock')[];
  supplier?: string;
  movementId?: string;
  productId?: string;
  createdFrom?: string; // dd.mm.yyyy
  createdTo?: string;   // dd.mm.yyyy
}

export interface SalesFilters {
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  paymentMethod?: ('cash' | 'card' | 'transfer')[];
  status?: ('completed' | 'pending' | 'cancelled')[];
  cashier?: string;
}

export interface ClientFilters {
  name?: string;
  phone?: string;
  email?: string;
  type?: ('regular' | 'vip' | 'wholesale')[];
  registrationFrom?: string;
  registrationTo?: string;
}

export interface FinancialFilters {
  transactionType?: ('income' | 'expense')[];
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  paymentMethod?: ('cash' | 'card' | 'transfer')[];
}

export type SearchCategory = 'products' | 'sales' | 'clients' | 'financial';

export interface SearchFilters {
  products: ProductFilters;
  sales: SalesFilters;
  clients: ClientFilters;
  financial: FinancialFilters;
}

export interface FilterPreset {
  id: string;
  name: string;
  category: SearchCategory;
  filters: ProductFilters | SalesFilters | ClientFilters | FinancialFilters;
  createdAt: string;
}

export interface RecentSearch {
  id: string;
  category: SearchCategory;
  query: string;
  filters: ProductFilters | SalesFilters | ClientFilters | FinancialFilters;
  timestamp: string;
}

interface SearchContextType {
  isAdvancedSearchOpen: boolean;
  openAdvancedSearch: () => void;
  closeAdvancedSearch: () => void;
  activeCategory: SearchCategory;
  setActiveCategory: (category: SearchCategory) => void;
  searchFilters: SearchFilters;
  productFilters: ProductFilters;
  updateFilters: (category: SearchCategory, filters: Partial<ProductFilters | SalesFilters | ClientFilters | FinancialFilters>) => void;
  clearFilters: (category?: SearchCategory) => void;
  getActiveFilterCount: (category: SearchCategory) => number;
  filterPresets: FilterPreset[];
  savePreset: (name: string, category: SearchCategory) => void;
  deletePreset: (id: string) => void;
  loadPreset: (preset: FilterPreset) => void;
  recentSearches: RecentSearch[];
  addRecentSearch: (category: SearchCategory, query: string) => void;
  clearRecentSearches: () => void;
  applySearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('products');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    products: {},
    sales: {},
    clients: {},
    financial: {},
  });
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('searchFilterPresets');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });

  const openAdvancedSearch = useCallback(() => {
    setIsAdvancedSearchOpen(true);
  }, []);

  const closeAdvancedSearch = useCallback(() => {
    setIsAdvancedSearchOpen(false);
  }, []);

  const updateFilters = useCallback((category: SearchCategory, filters: Partial<ProductFilters | SalesFilters | ClientFilters | FinancialFilters>) => {
    setSearchFilters(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...filters,
      },
    }));
  }, []);

  const clearFilters = useCallback((category?: SearchCategory) => {
    if (category) {
      setSearchFilters(prev => ({
        ...prev,
        [category]: {},
      }));
    } else {
      setSearchFilters({
        products: {},
        sales: {},
        clients: {},
        financial: {},
      });
    }
  }, []);

  const getActiveFilterCount = useCallback((category: SearchCategory): number => {
    const filters = searchFilters[category];
    let count = 0;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value) && value.length > 0) {
          count++;
        } else if (!Array.isArray(value)) {
          count++;
        }
      }
    });
    
    return count;
  }, [searchFilters]);

  const savePreset = useCallback((name: string, category: SearchCategory) => {
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name,
      category,
      filters: searchFilters[category],
      createdAt: new Date().toISOString(),
    };
    
    const updatedPresets = [...filterPresets, newPreset];
    setFilterPresets(updatedPresets);
    localStorage.setItem('searchFilterPresets', JSON.stringify(updatedPresets));
  }, [filterPresets, searchFilters]);

  const deletePreset = useCallback((id: string) => {
    const updatedPresets = filterPresets.filter(p => p.id !== id);
    setFilterPresets(updatedPresets);
    localStorage.setItem('searchFilterPresets', JSON.stringify(updatedPresets));
  }, [filterPresets]);

  const loadPreset = useCallback((preset: FilterPreset) => {
    setActiveCategory(preset.category);
    setSearchFilters(prev => ({
      ...prev,
      [preset.category]: preset.filters,
    }));
  }, []);

  const addRecentSearch = useCallback((category: SearchCategory, query: string) => {
    const newSearch: RecentSearch = {
      id: Date.now().toString(),
      category,
      query,
      filters: searchFilters[category],
      timestamp: new Date().toISOString(),
    };
    
    const updatedSearches = [newSearch, ...recentSearches.slice(0, 9)]; // Keep last 10
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  }, [recentSearches, searchFilters]);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  }, []);

  const applySearch = useCallback(() => {
    // This will be used to trigger search in components
    closeAdvancedSearch();
  }, [closeAdvancedSearch]);

  return (
    <SearchContext.Provider
      value={{
        isAdvancedSearchOpen,
        openAdvancedSearch,
        closeAdvancedSearch,
        activeCategory,
        setActiveCategory,
        searchFilters,
        productFilters: searchFilters.products,
        updateFilters,
        clearFilters,
        getActiveFilterCount,
        filterPresets,
        savePreset,
        deletePreset,
        loadPreset,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        applySearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

