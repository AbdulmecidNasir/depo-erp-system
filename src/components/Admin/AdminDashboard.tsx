import React, { useState, useEffect } from 'react';
import { Plus, Download, TrendingUp, TrendingDown, Users, ShoppingBag, AlertTriangle, Package } from 'lucide-react';
import { Product, Analytics } from '../../types';
import AddProductModal from './AddProductModal';
import { api } from '../../services/api';
import { formatUZS } from '../../utils/currency';
import { exportProductsToExcel } from '../../utils/excelExport';
import LocationTurnoverChart from './LocationTurnoverChart';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface AdminDashboardProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'barcode'>) => Promise<void> | void;
  onUpdateProduct: (product: Product) => Promise<void> | void;
  onDeleteProduct: (productId: string) => void;
  categories: Record<string, string>;
  brands: string[];
  locations?: any[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  categories,
  brands,
  locations = []
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics>({
    todaySales: 0,
    yesterdaySales: 0,
    todayCustomers: 0,
    yesterdayCustomers: 0,
    lowStockProducts: products.filter(p => p.stock < p.minStock)
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Load analytics data from API
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        setAnalyticsError(null);

        const response = await api.analytics.getDashboard();

        if (response.success && response.data) {
          const apiData = response.data;
          setAnalytics({
            todaySales: apiData.sales?.today || 0,
            yesterdaySales: apiData.sales?.yesterday || 0,
            todayCustomers: apiData.customers?.today || 0,
            yesterdayCustomers: apiData.customers?.yesterday || 0,
            lowStockProducts: apiData.lowStockProducts || products.filter(p => p.stock < p.minStock),
            // Keep API data for future use
            sales: apiData.sales,
            customers: apiData.customers,
            orders: apiData.orders,
            products: apiData.products
          });
        } else {
          // Fallback to zero values if API fails
          setAnalytics({
            todaySales: 0,
            yesterdaySales: 0,
            todayCustomers: 0,
            yesterdayCustomers: 0,
            lowStockProducts: products.filter(p => p.stock < p.minStock)
          });
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
        setAnalyticsError('Ошибка загрузки аналитики');
        // Keep zero values on error
        setAnalytics({
          todaySales: 0,
          yesterdaySales: 0,
          todayCustomers: 0,
          yesterdayCustomers: 0,
          lowStockProducts: products.filter(p => p.stock < p.minStock)
        });
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [products]);

  const salesChange = ((analytics.todaySales - analytics.yesterdaySales) / analytics.yesterdaySales * 100);
  const customerChange = analytics.todayCustomers - analytics.yesterdayCustomers;

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [tsData, setTsData] = useState<Array<Record<string, any>>>([]);
  const [tsLocations, setTsLocations] = useState<string[]>([]);
  const [tsLoading, setTsLoading] = useState(true);
  const [tsError, setTsError] = useState<string | null>(null);
  type RangeKey = 'default' | 'yesterday' | 'today' | 'week' | 'month' | 'custom';
  const [rangeKey, setRangeKey] = useState<RangeKey>('default');
  // Установка дефолтных дат: начало текущего месяца и сегодня
  const getDefaultCustomStart = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return startOfMonth.toISOString().split('T')[0];
  };
  const getDefaultCustomEnd = () => {
    return new Date().toISOString().split('T')[0];
  };
  const [customStart, setCustomStart] = useState<string>(getDefaultCustomStart());
  const [customEnd, setCustomEnd] = useState<string>(getDefaultCustomEnd());

  const computeRange = (key: RangeKey): { startDate?: string; endDate?: string } => {
    const end = new Date();
    const start = new Date();
    switch (key) {
      case 'today': {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        return { startDate: s.toISOString(), endDate: e.toISOString() };
      }
      case 'yesterday': {
        const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setDate(e.getDate() - 1); e.setHours(23, 59, 59, 999);
        return { startDate: s.toISOString(), endDate: e.toISOString() };
      }
      case 'week': {
        start.setDate(end.getDate() - 6); // last 7 days inclusive
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'month': {
        start.setDate(end.getDate() - 29); // last 30 days
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'custom': {
        if (customStart && customEnd) {
          const s = new Date(customStart);
          const e = new Date(customEnd);
          e.setHours(23, 59, 59, 999);
          return { startDate: s.toISOString(), endDate: e.toISOString() };
        }
        return {};
      }
      default: { // 'default' -> 30 days
        start.setDate(end.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
    }
  };

  useEffect(() => {
    const loadTimeSeries = async () => {
      try {
        setTsLoading(true);
        setTsError(null);
        const { startDate, endDate } = computeRange(rangeKey);
        const resp = await api.analytics.getLocationsTurnoverTimeSeries({ period: 'daily', startDate, endDate });
        if (resp.success) {
          setTsData(resp.data.series);
          setTsLocations(resp.data.locations);
        } else {
          setTsData([]);
          setTsLocations([]);
        }
      } catch (e) {
        console.error('Failed to load locations timeseries', e);
        setTsError('Ошибка загрузки динамики оборота по локациям');
      } finally {
        setTsLoading(false);
      }
    };
    loadTimeSeries();
  }, [rangeKey, customStart, customEnd]);

  const totalTurnover = tsData.reduce((sum, row) => {
    const keys = Object.keys(row).filter(k => k !== 'date');
    const rowSum = keys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
    return sum + rowSum;
  }, 0);

  const exportToExcel = async () => {
    try {
      setExportLoading(true);
      setExportError(null);

      await exportProductsToExcel(products, categories, 'products');

      console.log('✅ Products exported to Excel successfully');
    } catch (error: any) {
      console.error('❌ Export failed:', error);
      setExportError(error.message || 'Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`theme-card rounded-lg shadow-md p-6 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Продажи сегодня</p>
              {analyticsLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-24 rounded mt-1"></div>
              ) : (
                <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatUZS(analytics.todaySales)}</p>
              )}
            </div>
            <ShoppingBag className="h-8 w-8 text-blue-600" />
          </div>
          {!analyticsLoading && (
            <div className="mt-2 flex items-center">
              {salesChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ml-1 ${salesChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {salesChange >= 0 ? '+' : ''}{salesChange.toFixed(1)}%
              </span>
              <span className={`text-sm ml-2 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>чем вчера</span>
            </div>
          )}
          {analyticsError && (
            <div className="mt-2 text-sm text-red-600">
              {analyticsError}
            </div>
          )}
        </div>

        <div className={`theme-card rounded-lg shadow-md p-6 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Клиенты сегодня</p>
              {analyticsLoading ? (
                <div className={`animate-pulse h-8 w-16 rounded mt-1 ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
              ) : (
                <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>{analytics.todayCustomers}</p>
              )}
            </div>
            <Users className="h-8 w-8 text-emerald-600" />
          </div>
          {!analyticsLoading && (
            <div className="mt-2 flex items-center">
              {customerChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ml-1 ${customerChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {customerChange >= 0 ? '+' : ''}{customerChange}
              </span>
              <span className={`text-sm ml-2 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>чем вчера</span>
            </div>
          )}
          {analyticsError && (
            <div className="mt-2 text-sm text-red-600">
              {analyticsError}
            </div>
          )}
        </div>

        <div className={`theme-card rounded-lg shadow-md p-6 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Всего товаров</p>
              <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {analytics.products?.total || products.length}
              </p>
            </div>
            <Package className="h-8 w-8 text-orange-600" />
          </div>
          <div className="mt-2">
            <span className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              в каталоге • {analytics.products?.lowStock || 0} мало товара • {analytics.products?.outOfStock || 0} нет в наличии
            </span>
          </div>
        </div>

        <div className={`theme-card rounded-lg shadow-md p-6 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Низкий остаток</p>
              <p className="text-2xl font-bold text-red-600">{analytics.lowStockProducts.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div className="mt-2">
            <span className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>товаров требуют пополнения</span>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {analytics.lowStockProducts.length > 0 && (
        <div className={`rounded-lg p-4 border transition-all duration-300 ${isDark
            ? 'bg-orange-900/20 border-orange-800'
            : 'bg-orange-50 border-orange-200'
          }`}>
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-600 mr-3" />
            <div>
              <h3 className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-orange-400' : 'text-orange-800'
                }`}>
                Товары с низким остатком
              </h3>
              <p className={`text-sm mt-1 transition-colors duration-300 ${isDark ? 'text-orange-300' : 'text-orange-700'
                }`}>
                {analytics.lowStockProducts.map(p => p.nameRu).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => { setActionError(null); setShowAddModal(true); }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Добавить товар
        </button>

        <button
          onClick={exportToExcel}
          disabled={exportLoading}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-5 w-5 mr-2" />
          {exportLoading ? 'Экспорт...' : 'Экспорт в Excel'}
        </button>
      </div>

      {actionError && (
        <div className={`rounded-md px-4 py-2 border transition-all duration-300 ${isDark
            ? 'bg-red-900/20 border-red-800 text-red-400'
            : 'bg-red-50 border-red-200 text-red-700'
          }`}>
          {actionError}
        </div>
      )}

      {exportError && (
        <div className={`rounded-md px-4 py-2 border transition-all duration-300 ${isDark
            ? 'bg-red-900/20 border-red-800 text-red-400'
            : 'bg-red-50 border-red-200 text-red-700'
          }`}>
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {exportError}
          </div>
        </div>
      )}
      {/* Validation details if any (rendered by parent via actionError only) */}



      {/* Time range controls */}
      <div className={`rounded-lg shadow p-3 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: 'default', label: 'По умолчанию' },
            { key: 'yesterday', label: 'Вчера' },
            { key: 'today', label: 'Сегодня' },
            { key: 'week', label: 'За неделю' },
            { key: 'month', label: 'За месяц' },
            { key: 'custom', label: 'Другое' },
          ] as Array<{ key: RangeKey; label: string }>).map(btn => (
            <button
              key={btn.key}
              onClick={() => setRangeKey(btn.key)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${rangeKey === btn.key
                  ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400'
                  : isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        {rangeKey === 'custom' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className={`block text-xs mb-1 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>Начало</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className={`border rounded px-2 py-1 text-sm transition-all duration-300 ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>Конец</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className={`border rounded px-2 py-1 text-sm transition-all duration-300 ${isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                  }`}
              />
            </div>
            <button
              onClick={() => setRangeKey('custom')}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!customStart || !customEnd}
            >
              Применить
            </button>
          </div>
        )}
      </div>

      {/* Location-based time series chart */}
      <div>
        <h2 className={`text-xl font-semibold mb-6 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
          }`}>Динамика оборота по локациям</h2>
        {tsLoading ? (
          <div className={`rounded-lg shadow p-6 transition-all duration-300 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-900'
            }`}>Загрузка...</div>
        ) : tsError ? (
          <div className={`rounded-md px-4 py-2 border transition-all duration-300 ${isDark
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : 'bg-red-50 border-red-200 text-red-700'
            }`}>{tsError}</div>
        ) : (
          <>
            <div className={`mb-3 text-sm transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
              Итого за период: <span className={`font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>{formatUZS(totalTurnover)}</span>
            </div>
            <LocationTurnoverChart data={tsData} locations={tsLocations} />
          </>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {(showAddModal || editingProduct) && (
        <AddProductModal
          product={editingProduct}
          categories={categories}
          brands={brands}
          locations={locations}
          onSave={async (product) => {
            setActionError(null);
            setSaving(true);
            try {
              if (editingProduct) {
                const previousStock = Number(editingProduct.stock || 0);
                const nextStock = Number((product as any).stock ?? previousStock);
                // Keep stock unchanged in the save payload (no auto movement creation)
                const payload = {
                  ...product,
                  id: editingProduct.id,
                  createdAt: editingProduct.createdAt,
                  updatedAt: new Date().toISOString(),
                  stock: previousStock
                } as Product;
                await onUpdateProduct(payload);
                setEditingProduct(null);
                // Redirect based on stock change
                if (!Number.isNaN(previousStock) && !Number.isNaN(nextStock)) {
                  if (nextStock > previousStock) {
                    navigate('/incoming');
                  } else if (nextStock < previousStock) {
                    navigate('/outgoing');
                  }
                }
              } else {
                await onAddProduct(product);
                setShowAddModal(false);
              }
            } catch (e: any) {
              const details = e?.details?.errors as Array<{ msg: string; param?: string }> | undefined;
              let composed = '';
              if (details && details.length) {
                composed = details.map(d => d.param ? `${d.param}: ${d.msg}` : d.msg).join('; ');
                setActionError(`${e?.message || 'Ошибка'}: ${composed}`);
              } else {
                setActionError(e?.message || 'Не удалось сохранить товар');
              }
              const text = `${e?.message || ''} ${composed}`.toLowerCase();
              if (text.includes('barcode') || text.includes('штрихкод')) {
                window.alert('Товар с данным штрихкодом уже существует');
              }
            } finally {
              setSaving(false);
            }
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;