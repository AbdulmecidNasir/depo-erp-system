import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SearchProvider, useSearch } from './contexts/SearchContext';
import { SettingsProvider } from './contexts/SettingsContext';
import Header from './components/Layout/Header';
import AppSidebar from './components/Layout/AppSidebar';
// Inventory Count Components
import InventorySessionList from './components/InventoryCount/InventorySessionList';
import InventoryCountDetail from './components/InventoryCount/InventoryCountDetail';

import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import VerifyEmailPage from './components/Auth/VerifyEmailPage';
import AdminDashboard from './components/Admin/AdminDashboard';
import WarehouseDashboard from './components/Warehouse/WarehouseDashboard';
import ProductManagement from './components/Warehouse/ProductManagement';
import StockMovements from './components/Warehouse/StockMovements';
import AddMovementPage from './components/Warehouse/AddMovementPage';
import LocationManagement from './components/Warehouse/LocationManagement';
import ProductTable from './components/Products/ProductTable';
import FilteredProductsPage from './components/Products/FilteredProductsPage';
import CartView from './components/Cart/CartView';
import { Product } from './types';
import { ExtendedProduct } from './types/warehouse';
import { api } from './services/api';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import ProductDetail from './components/Products/ProductDetail';
import AddProductModal from './components/Admin/AddProductModal';
import { PRODUCT_DETAIL_ENABLED } from './config/features';

import LedgerPage from './components/Finance/LedgerPage';
import IncomingPage from './components/Inventory/IncomingPage';
import IncomingProcessPage from './components/Inventory/IncomingProcessPage';
import OutgoingPage from './components/Inventory/OutgoingPage';
import WriteoffProcessPage from './components/Inventory/WriteoffProcessPage';

import EmployeesPage from './components/HR/EmployeesPage';
import SuppliersPage from './components/Suppliers/SuppliersPage';
import SalesAllPage from './components/Sales/SalesAllPage';
import SalesDeletedPage from './components/Sales/SalesDeletedPage';
import SalesRequestsPage from './components/Sales/SalesRequestsPage';
import SalesShipmentsPage from './components/Sales/SalesShipmentsPage';
import SalesReturnsPage from './components/Sales/SalesReturnsPage';
import SalesShowcasePage from './components/Sales/SalesShowcasePage';


import ProfilePage from './components/Profile/ProfilePage';
import SettingsPage from './components/Settings/SettingsPage';
import UsersPage from './pages/UsersPage';
import AdvancedSearchModal from './components/Search/AdvancedSearchModal';
import { exportProductsToExcel } from './utils/excelExport';

function AppContent() {
  const { user, isLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { searchFilters } = useSearch();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<ExtendedProduct[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<any[]>([]);
  // const [stockMovements, setStockMovements] = useState<any[]>([]); // Removed - StockMovements component handles its own state
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState('shop');
  const [showRegister, setShowRegister] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load brands and categories
        const [brandsResponse, categoriesResponse] = await Promise.all([
          api.products.getBrands(),
          api.products.getCategories()
        ]);

        if (brandsResponse.success) {
          setBrands(brandsResponse.data);
        }

        if (categoriesResponse.success) {
          setCategories(categoriesResponse.data);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    if (user) {
      loadInitialData();
    }
  }, [user]);

  // Load warehouse locations
  useEffect(() => {
    const loadLocations = async () => {
      if (!user || user.role !== 'admin') return;

      try {
        const response = await api.locations.getAll();
        if (response.success) {
          setWarehouseLocations(response.data);
        }
      } catch (error) {
        console.error('Error loading locations:', error);
      }
    };

    loadLocations();
  }, [user]);

  // Load products when filters change
  const [orders, setOrders] = useState<any[]>([]);

  // Load products and orders when filters change
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setProductsLoading(true);
      try {
        const productFilters = searchFilters.products;

        // Fetch products and passed orders together to ensure sync
        const [productsRes, ordersRes] = await Promise.all([
          api.products.getAll({
            search: searchQuery || productFilters.name || undefined,
            category: selectedCategory || productFilters.category || undefined,
            brand: selectedBrand || undefined,
            movementId: productFilters.movementId || undefined,
            productId: productFilters.productId || undefined,
            minPrice: productFilters.priceMin,
            maxPrice: productFilters.priceMax,
            limit: 3000
          }),
          api.orders.getAll({ limit: 1000 }) // Fetch active orders for reservation calc
        ]);

        if (productsRes.success) {
          setProducts(productsRes.data);
        }

        if (ordersRes.success) {
          setOrders(ordersRes.data);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    loadData();
  }, [user, searchQuery, selectedCategory, selectedBrand, searchFilters.products]);

  // Auto-refresh products when navigating to Управление товарами (/products)
  useEffect(() => {
    const refreshOnEnterProducts = async () => {
      if (!user) return;
      if (location.pathname !== '/products') return;
      try {
        setProductsLoading(true);
        const productFilters = searchFilters.products;
        const response = await api.products.getAll({
          search: searchQuery || productFilters.name || undefined,
          category: selectedCategory || productFilters.category || undefined,
          brand: selectedBrand || undefined,
          movementId: productFilters.movementId || undefined,
          productId: productFilters.productId || undefined,
          minPrice: productFilters.priceMin,
          maxPrice: productFilters.priceMax,
          limit: 3000
        });
        if (response.success) {
          setProducts(response.data);
        }
      } catch (e) {
        console.error('Error refreshing products on route enter:', e);
      } finally {
        setProductsLoading(false);
      }
    };
    refreshOnEnterProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Deterministically map DB products to warehouse view model (no randomness)
  useEffect(() => {
    if (!user) return;

    // Calculate reserved stock per product from orders
    // "Reserved" = Orders that are CONFIRMED or PROCESSING (approved but not sent)
    // NOT pending, NOT shipped, NOT delivered, NOT cancelled
    const reservedMap = new Map<string, number>();

    orders.forEach(order => {
      if (order.status === 'confirmed' || order.status === 'processing') {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            // item.product might be an ID string or an object with _id
            const pId = item.product?._id || item.product?.id || (typeof item.product === 'string' ? item.product : null);
            if (pId) {
              const qty = Number(item.quantity) || 0;
              reservedMap.set(pId, (reservedMap.get(pId) || 0) + qty);
            }
          });
        }
      }
    });

    const mapped: ExtendedProduct[] = products.map((p) => {
      // Normalize locationStock (can be Map or plain object)
      const rawLocationStock = (p as any).locationStock as any;
      const normalizedLocationStock: Record<string, number> = {};
      if (rawLocationStock && typeof rawLocationStock.forEach === 'function') {
        rawLocationStock.forEach((qty: number, loc: string) => {
          normalizedLocationStock[String(loc)] = Number(qty) || 0;
        });
      } else if (rawLocationStock && typeof rawLocationStock === 'object') {
        Object.entries(rawLocationStock).forEach(([loc, qty]) => {
          normalizedLocationStock[String(loc)] = Number(qty as any) || 0;
        });
      }

      // Alternative locations are any locations in locationStock except the primary one with qty > 0
      const alternativeLocations = Object.keys(normalizedLocationStock)
        .filter((loc) => loc && loc !== p.location && (normalizedLocationStock[loc] || 0) > 0);

      const reservedQty = reservedMap.get(p.id) || 0;
      const availableQty = Math.max(0, p.stock - reservedQty);

      const mappedProduct: ExtendedProduct = {
        id: p.id,
        productId: (p as any).productId || p.id.slice(-6), // Use productId or last 6 chars of id
        name: p.name,
        nameRu: p.nameRu,
        brand: p.brand,
        model: p.model,
        variant: p.variant,
        category: p.category as any,
        subCategory: undefined,
        barcode: p.barcode,
        qrCode: undefined,
        location: p.location,
        alternativeLocations,
        images: p.image ? [p.image] : [],
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        stock: p.stock,
        minStock: p.minStock,
        maxStock: p.stock,
        reservedStock: reservedQty,
        availableStock: availableQty,
        description: p.description,
        descriptionRu: p.descriptionRu,
        specifications: {} as any,
        supplierId: (p as any).supplierId || (p as any).supplier_id || (p as any).supplier?._id || (p as any).supplier?.id || undefined,
        serialNumbers: [],
        isActive: true,
        isSerialTracked: false,
        hasWarranty: false,
        warrantyPeriod: undefined,
        tags: [],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdBy: user?.firstName || 'admin',
        lastMovement: undefined,
      };

      // Attach normalized locationStock for UI (non-typed field)
      (mappedProduct as any).locationStock = normalizedLocationStock;
      // Attach wholesale price and supplier name for UI (non-typed fields)
      (mappedProduct as any).wholesalePrice = (p as any).wholesalePrice ?? 0;
      (mappedProduct as any).supplierName = (p as any).supplierName || (p as any).supplier_name || (p as any).supplier?.name || undefined;

      return mappedProduct;
    });
    setWarehouseProducts(mapped);
  }, [products, orders, user]);

  // Soft refresh on route change: remount content and scroll to top
  useEffect(() => {
    const container = document.querySelector('.app-scroll-container');
    if (container) {
      try { container.scrollTo({ top: 0, behavior: 'instant' as any }); } catch { (container as any).scrollTop = 0; }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location.pathname === '/verify-email') {
      return <VerifyEmailPage />;
    }
    return showRegister ? (
      <RegisterForm onToggleForm={() => setShowRegister(false)} />
    ) : (
      <LoginForm onToggleForm={() => setShowRegister(true)} />
    );
  }

  const handleAddProduct = async (newProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'barcode'>) => {
    try {
      const response = await api.products.create(newProduct);
      if (response.success) {
        setProducts(prev => [response.data, ...prev]);
      } else {
        throw new Error('Не удалось создать продукт');
      }
    } catch (error: any) {
      console.error('Error adding product:', error);
      throw new Error(error?.message || 'Ошибка создания продукта');
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    try {
      const id = updatedProduct?.id;
      const isValidObjectId = typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
      if (!isValidObjectId) {
        throw new Error('Неверный формат ID продукта');
      }
      const response = await api.products.update(id, updatedProduct);
      if (response.success) {
        setProducts(prev => prev.map(p => p.id === id ? response.data : p));
      } else {
        throw new Error('Не удалось обновить продукт');
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      throw new Error(error?.message || 'Ошибка обновления продукта');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
      try {
        const response = await api.products.delete(productId);
        if (response.success) {
          setProducts(prev => prev.filter(p => p.id !== productId));
          setWarehouseProducts(prev => prev.filter(p => p.id !== productId));
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
      }
    }
  };

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

  // Warehouse management functions
  const handleAddWarehouseProduct = () => {
    // Navigate to add product form or open modal
    setCurrentView('admin');
  };

  const handleEditWarehouseProduct = (product: ExtendedProduct) => {
    // Convert warehouse product back to regular product and open edit modal
    const regularProduct = {
      id: product.id,
      name: product.name,
      nameRu: product.nameRu,
      brand: product.brand,
      model: product.model,
      variant: product.variant,
      category: product.category,
      barcode: product.barcode,
      location: product.location,
      image: product.images?.[0] || '',
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description,
      descriptionRu: product.descriptionRu,
      specifications: {},
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    } as unknown as Product;
    setEditingProduct(regularProduct);
  };

  const handleDeleteWarehouseProduct = (productId: string) => {
    handleDeleteProduct(productId);
  };

  const handleAddStockMovement = (movement: any) => {
    // The StockMovements component now handles API calls directly
    // This callback is optional and can be used for additional side effects
    console.log('Stock movement added:', movement);
  };

  const handleAddLocation = async (location: any) => {
    try {
      const response = await api.locations.create(location);
      if (response.success) {
        setWarehouseLocations(prev => [response.data, ...prev]);
        alert('Локация успешно добавлена');
      } else {
        alert('Ошибка при добавлении локации');
      }
    } catch (error) {
      console.error('Error adding location:', error);
      alert('Ошибка при добавлении локации');
    }
  };

  const handleEditLocation = async (location: any) => {
    try {
      const response = await api.locations.update(location.id, location);
      if (response.success) {
        setWarehouseLocations(prev => prev.map(l => l.id === location.id ? response.data : l));
        alert('Локация успешно обновлена');
      } else {
        alert('Ошибка при обновлении локации');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Ошибка при обновлении локации');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту локацию?')) {
      try {
        console.log('🗑️ Deleting location with ID:', locationId);
        const response = await api.locations.delete(locationId);
        if (response.success) {
          setWarehouseLocations(prev => prev.filter(l => l.id !== locationId));
          alert('Локация успешно удалена');
        } else {
          alert('Ошибка при удалении локации');
        }
      } catch (error) {
        console.error('Error deleting location:', error);
        alert('Ошибка при удалении локации');
      }
    }
  };

  const ShopHome = (
    <div className={`flex flex-1 transition-colors duration-300 ${isDark ? 'bg-transparent' : 'bg-gray-50'}`}>
      {/* Sidebar with filters removed from magazine page */}
      <main className="flex-1 p-6">
        {/* Filters moved into Header search dropdown */}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {user.role === 'admin' ? 'Управление товарами' : 'Интернет-магазин'}
            </h1>
            {user.role === 'admin' && (
              <div className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <p>Всего товаров: <span className="font-semibold text-blue-600">{products.length}</span></p>
                <p className="text-xs mt-1">
                  Активных: {products.filter(p => p.isActive !== false).length} •
                  Низкий остаток: {products.filter(p => p.stock < p.minStock).length} •
                  Нет в наличии: {products.filter(p => p.stock === 0).length}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <button
                onClick={exportToExcel}
                disabled={exportLoading}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exportLoading ? 'Экспорт...' : 'Экспорт'}
              </button>
            )}
          </div>
        </div>

        {/* Export Error Display */}
        {exportError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{exportError}</p>
          </div>
        )}

        {productsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className={`mt-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка товаров...</p>
          </div>
        ) : (
          <ProductTable
            products={products}
            categories={categories}
            onEditProduct={(prod) => {
              // open edit modal with selected product (admin path)
              setEditingProduct(prod);
            }}
          />
        )}
      </main>
    </div>
  );

  return (
    <div className={`min-h-screen transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gray-50'}`}>
      <Header />
      <AdvancedSearchModal />
      <div className="flex">
        <AppSidebar />
        <div key={location.pathname} className={`app-scroll-container flex-1 p-6 h-[calc(100vh-4rem)] overflow-y-auto transition-all duration-300 ${isDark ? 'bg-gray-900/50' : 'bg-transparent'}`}>
          {editingProduct && (
            <AddProductModal
              product={editingProduct}
              categories={categories}
              brands={brands}
              locations={warehouseLocations}
              onSave={async (product) => {
                try {
                  const previousStock = Number(editingProduct.stock || 0);
                  const nextStock = Number((product as any).stock ?? previousStock);
                  // Keep stock unchanged when saving from management; only redirect user to perform operation
                  const payload = {
                    ...(product as Product),
                    id: editingProduct.id,
                    createdAt: editingProduct.createdAt,
                    updatedAt: new Date().toISOString(),
                    stock: previousStock
                  } as Product;
                  await handleUpdateProduct(payload);
                  setEditingProduct(null);
                  if (!Number.isNaN(previousStock) && !Number.isNaN(nextStock)) {
                    if (nextStock > previousStock) {
                      navigate('/incoming');
                    } else if (nextStock < previousStock) {
                      navigate('/outgoing');
                    }
                  }
                } catch (e: any) {
                  const base = `${e?.message || ''} ${e?.details ? JSON.stringify(e.details) : ''}`.toLowerCase();
                  if (base.includes('barcode') || base.includes('штрихкод')) {
                    window.alert('Товар с данным штрихкодом уже существует');
                  }
                  throw e;
                }
              }}
              onClose={() => setEditingProduct(null)}
            />
          )}
          <Routes>
            <Route path="/" element={ShopHome} />
            <Route path="/products" element={
              (['admin', 'warehouse_manager', 'warehouse_staff', 'sales_manager'].includes(user.role)) ? (
                <ProductManagement
                  products={warehouseProducts}
                  categories={categories}
                  onEditProduct={['admin', 'warehouse_manager'].includes(user.role) ? handleEditWarehouseProduct : undefined}
                  onDeleteProduct={['admin', 'warehouse_manager'].includes(user.role) ? (id) => handleDeleteProduct(id) : undefined}
                />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            {PRODUCT_DETAIL_ENABLED ? (
              <Route path="/product/:id" element={<ProductDetail />} />
            ) : null}
            <Route path="/products/filtered" element={<FilteredProductsPage />} />
            {/* Admin/warehouse routes mapped to proper warehouse dashboard */}
            <Route path="/warehouse" element={
              (['admin', 'warehouse_manager', 'sales_manager'].includes(user.role)) ? (
                <WarehouseDashboard
                  products={warehouseProducts}
                />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/movements" element={
              (['admin', 'warehouse_manager', 'warehouse_staff'].includes(user.role)) ? (
                <StockMovements
                  onAddMovement={handleAddStockMovement}
                />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/warehouse/add-movement" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <AddMovementPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/locations" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <LocationManagement
                  locations={warehouseLocations}
                  products={warehouseProducts}
                  onAddLocation={handleAddLocation}
                  onEditLocation={handleEditLocation}
                  onDeleteLocation={handleDeleteLocation}
                />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/inventory" element={
              (['admin', 'warehouse_manager', 'warehouse_staff'].includes(user.role)) ? (
                <InventorySessionList />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/inventory/count/:id" element={
              (['admin', 'warehouse_manager', 'warehouse_staff'].includes(user.role)) ? (
                <InventoryCountDetail />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/incoming" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <IncomingPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/incoming-process" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <IncomingProcessPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/outgoing" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <OutgoingPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/writeoff-process" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <WriteoffProcessPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />

            <Route path="/suppliers" element={
              (['admin', 'warehouse_manager', 'sales_manager'].includes(user.role)) ? (
                <SuppliersPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/employees" element={
              (['admin', 'warehouse_manager'].includes(user.role)) ? (
                <EmployeesPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/sales" element={
              (['admin', 'sales_manager', 'cashier'].includes(user.role)) ? (
                <SalesAllPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />

            <Route path="/sales/requests" element={
              (['admin', 'sales_manager'].includes(user.role)) ? (
                <SalesRequestsPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/sales/shipments" element={
              (['admin', 'sales_manager', 'warehouse_manager'].includes(user.role)) ? (
                <SalesShipmentsPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/sales/returns" element={
              (['admin', 'sales_manager'].includes(user.role)) ? (
                <SalesReturnsPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/sales/showcase" element={
              (['admin', 'sales_manager'].includes(user.role)) ? (
                <SalesShowcasePage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />

            <Route path="/admin" element={
              (user.role === 'admin') ? (
                <AdminDashboard
                  products={products}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  categories={categories}
                  brands={brands}
                  locations={warehouseLocations}
                />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/cart" element={<CartView />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={
              (user.role === 'admin') ? (
                <UsersPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            <Route path="/ledger" element={
              (['admin', 'cashier'].includes(user.role)) ? (
                <LedgerPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />

            <Route path="/deleted-transactions" element={
              (user.role === 'admin') ? (
                <SalesDeletedPage />
              ) : (<div className="text-center py-12"><p className="text-red-600">Доступ запрещен</p></div>)
            } />
            {/* Fallback to existing views for admin/warehouse sections through state */}
            <Route path="*" element={ShopHome} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <SearchProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </SearchProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;