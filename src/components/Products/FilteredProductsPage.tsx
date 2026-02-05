import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import ProductTable from './ProductTable';
import ProductGrid from './ProductGrid';
import { Product } from '../../types';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';

const FilteredProductsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const category = searchParams.get('category') || '';
  const brands = searchParams.getAll('brands');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load categories
        const categoriesRes = await api.products.getCategories();
        if (categoriesRes.success) {
          setCategories(categoriesRes.data);
        }

        // Load filtered products
        const filters: any = {
          limit: 10000, // Get all matching products
        };

        if (category) {
          filters.category = category;
        }

        // Filter by brands - use API support for multiple brands
        if (brands.length > 0) {
          filters.brands = brands;
        }

        const productsRes = await api.products.getAll(filters);
        
        if (productsRes.success && productsRes.data) {
          setProducts(productsRes.data as Product[]);
        } else {
          setError('Не удалось загрузить товары');
        }
      } catch (err: any) {
        console.error('Error loading filtered products:', err);
        setError(err.message || 'Ошибка загрузки товаров');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [category, brands.join(',')]);

  const categoryName = category ? categories[category] || category : 'Все категории';
  const brandsText = brands.length > 0 ? brands.join(', ') : '';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className={`mb-6 rounded-lg shadow-md p-6 transition-colors duration-300 ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(-1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                  viewMode === 'table'
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Таблица
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                  viewMode === 'grid'
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Сетка
              </button>
            </div>
          </div>

          <div>
            <h1 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Отфильтрованные товары
            </h1>
            <div className={`text-sm transition-colors duration-300 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <p>
                <span className="font-medium">Категория:</span> {categoryName}
              </p>
              {brandsText && (
                <p className="mt-1">
                  <span className="font-medium">Бренды:</span> {brandsText}
                </p>
              )}
              <p className="mt-1">
                <span className="font-medium">Найдено товаров:</span>{' '}
                <span className="text-blue-600 font-semibold">{products.length}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={`flex items-center justify-center py-20 rounded-lg shadow-md transition-colors duration-300 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className={`ml-3 text-lg transition-colors duration-300 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Загрузка товаров...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className={`rounded-lg shadow-md p-6 transition-colors duration-300 ${
            isDark ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              <Package className="h-5 w-5 text-red-600 mr-2" />
              <span className={`transition-colors duration-300 ${
                isDark ? 'text-red-400' : 'text-red-800'
              }`}>
                {error}
              </span>
            </div>
          </div>
        )}

        {/* Products Display */}
        {!loading && !error && (
          <div>
            {viewMode === 'table' ? (
              <ProductTable
                products={products}
                categories={categories}
                onEditProduct={user?.role === 'admin' ? (product) => {
                  // Handle edit - you might want to navigate to edit page
                  console.log('Edit product:', product);
                } : undefined}
              />
            ) : (
              <ProductGrid
                products={products}
                categories={categories}
                onEditProduct={user?.role === 'admin' ? (product) => {
                  console.log('Edit product:', product);
                } : undefined}
              />
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-20 rounded-lg shadow-md transition-colors duration-300 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <Package className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className={`text-lg font-medium mb-2 transition-colors duration-300 ${
              isDark ? 'text-gray-300' : 'text-gray-900'
            }`}>
              Товары не найдены
            </h3>
            <p className={`text-sm transition-colors duration-300 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Попробуйте изменить параметры фильтрации
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilteredProductsPage;

