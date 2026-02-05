import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import {
  ArrowLeft,
  X,
  Search,
  Check,
  Building,
  MapPin,
  Plus,
  // Save, // Unused
  // Trash2, // Unused
  AlertTriangle,
  ChevronDown,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import CategorySidebarWithBrands from '../Common/CategorySidebarWithBrands';
import AddProductModal from '../Admin/AddProductModal';
import ExcelJS from 'exceljs';

interface Product {
  _id?: string;
  id?: string;
  productId?: string;
  nameRu: string;
  brand: string;
  model: string;
  category: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  location: string;
  locationStock?: Map<string, number> | Record<string, number>;
}

interface Location {
  _id: string;
  name: string;
  code: string;
  zone?: string;
}

interface IncomingItem {
  productId: string;
  product: Product;
  quantity: number;
  notes: string;
  toLocation: string;
  purchasePrice?: number; // закупка
  wholesalePrice?: number; // опт
  salePrice?: number; // продажа
}

const IncomingProcessPage: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batch');

  const locationState = useLocation();

  // State
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState<string>('');

  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);

  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  // const [originalItems, setOriginalItems] = useState<any[]>([]); // Unused

  // Categories panel
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Product Create Modal & Import
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  // Save Confirmation Modal
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchSuppliers();
    fetchCategories();
    fetchProducts();
  }, []);

  // Handle Edit Mode from Navigation State
  useEffect(() => {
    // Click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (locationState.state?.editMode && locationState.state?.items) {
      setIsEditMode(true);
      setEditingGroupId(locationState.state.groupId);
      setEditingGroupId(locationState.state.groupId);
      // setOriginalItems(locationState.state.items);

      const items = locationState.state.items;
      if (items.length > 0) {
        const first = items[0];
        if (first.toLocation) setSelectedLocation(first.toLocation);

        // Try to find supplier
        const suppId = first.supplierId || (first as any).supplier_id;
        if (suppId) setSelectedSupplier(suppId);
        else if (first.notes) {
          const m = first.notes.match(/Поставщик:\s*([^\n]+)/i);
          if (m) {
            // Optional: try to match name to ID if needed, or just rely on notes
          }
        }

        const mappedItems: IncomingItem[] = items.map((item: any) => ({
          productId: item.productId._id || item.productId.id || item.productId,
          product: item.productId,
          quantity: item.quantity,
          notes: item.notes || '',
          toLocation: item.toLocation || '',
          purchasePrice: item.purchasePrice,
          wholesalePrice: item.wholesalePrice,
          salePrice: item.salePrice
        }));
        setIncomingItems(mappedItems);
      }
    }
  }, [locationState.state]);

  // Handle Draft Loading from URL (Batch ID)
  useEffect(() => {
    if (batchId) {
      loadBatchData(batchId);
    }
  }, [batchId]);

  const loadBatchData = async (id: string) => {
    try {
      const response = await api.stockMovements.getAll({ limit: 100 });
      if (response.success) {
        const batchItems = response.data.filter((m: any) =>
          String(m.movementId || m.batchNumber || m._id) === id
        );

        if (batchItems.length > 0) {
          setIsEditMode(true);
          setEditingGroupId(id);
          setEditingGroupId(id);
          // setOriginalItems(batchItems);

          const first = batchItems[0];
          if (first.toLocation) setSelectedLocation(first.toLocation);
          if (first.supplierId) setSelectedSupplier(first.supplierId);

          const mappedItems: IncomingItem[] = batchItems.map((item: any) => ({
            productId: item.productId._id || item.productId.id || item.productId,
            product: item.productId,
            quantity: item.quantity,
            notes: item.notes || '',
            toLocation: item.toLocation || '',
            purchasePrice: item.purchasePrice,
            wholesalePrice: item.wholesalePrice,
            salePrice: item.salePrice
          }));
          setIncomingItems(mappedItems);
        }
      }
    } catch (err) {
      console.error('Error loading batch:', err);
      setError('Не удалось загрузить черновик');
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.locations.getAll({ limit: 100 });
      if (response.success) {
        setLocations(response.data);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res: any = await api.suppliers.getAll({ activeOnly: true, limit: 200 });
      if (res?.success) {
        const list = (res.suppliers || res.data || []).map((s: any) => ({ id: s.id || s._id, name: s.name }));
        setSuppliers(list);
      }
    } catch (e) {
      console.error('Error fetching suppliers:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.products.getCategories();
      if (response.success) {
        setCategoriesMap(response.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async (search: string = '') => {
    try {
      const response = await api.products.getAll({
        search,
        limit: 20,
        // category: selectedCategory || undefined // Decoupled: Search is global
      });
      if (response.success) {
        let items = response.data as Product[];
        setProducts(items);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCategoryProducts = async (categoryId: string) => {
    try {
      const response = await api.products.getAll({
        limit: 20,
        category: categoryId
      });
      setCategoryProducts(response.data);
    } catch (err) {
      console.error('Error fetching category products:', err);
    }
  };

  const addProductToIncoming = (product: Product) => {
    if (!selectedLocation || !selectedSupplier) {
      setError('Сначала выберите локацию и поставщика');
      return;
    }

    const existingItem = incomingItems.find(item => item.productId === (product._id || product.id));
    if (existingItem) {
      setIncomingItems(prev => prev.map(item =>
        item.productId === (product._id || product.id)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setIncomingItems(prev => [...prev, {
        productId: product._id || product.id || '',
        product,
        quantity: 1,
        notes: '',
        toLocation: selectedLocation || product.location || '',
        purchasePrice: product.purchasePrice,
        wholesalePrice: (product as any).wholesalePrice,
        salePrice: product.salePrice
      }]);
    }
    setShowProductSearch(false);
    setProductSearch('');
  };

  const removeProductFromIncoming = (productId: string) => {
    setIncomingItems(prev => prev.filter(item => item.productId !== productId));
  };

  const updateIncomingItem = (productId: string, field: keyof IncomingItem, value: any) => {
    setIncomingItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, [field]: value }
        : item
    ));
  };

  const handleBack = () => {
    if (incomingItems.length > 0) {
      setShowSaveConfirmation(true);
    } else {
      navigate(-1);
    }
  };

  const submitIncomingItems = async (status: 'completed' | 'draft' = 'completed') => {
    if (incomingItems.length === 0) {
      setError('Добавьте товары для поступления');
      return;
    }

    // Allow 0 quantity for drafts? Maybe. But let's enforce > 0 for completed.
    if (status === 'completed') {
      const validItems = incomingItems.filter(item => item.quantity > 0);
      if (validItems.length === 0) {
        setError('Укажите количество больше 0 для хотя бы одного товара');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // If editing, delete old items first
      if (isEditMode && editingGroupId) {
        // Find ID to delete. Usually editingGroupId is the batchNumber/movementId
        // We need to delete all movements with this ID
        // The API delete usually takes an ID. If it's a batch, we might need to delete each item or if backend supports batch delete.
        // IncomingPage uses api.stockMovements.delete(movementId) where movementId is the group ID.
        await api.stockMovements.delete(editingGroupId);
      }

      const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name;

      const promises = incomingItems.map(item => {
        let notes = item.notes;
        if (generalNotes) notes = (notes ? notes + '. ' : '') + generalNotes;
        if (supplierName) notes = (notes ? notes + ' • ' : '') + `Поставщик: ${supplierName}`;

        return {
          productId: item.productId,
          type: 'in' as const,
          quantity: item.quantity,
          reason: 'Поступление товара',
          notes: notes,
          toLocation: item.toLocation,
          supplierId: selectedSupplier || undefined,
          supplierName: supplierName,
          purchasePrice: item.purchasePrice,
          wholesalePrice: item.wholesalePrice,
          salePrice: item.salePrice,
          status: status,
          // If we are editing, we might want to keep the same batch ID?
          // If we deleted the old one, we can reuse the ID if we pass it as batchNumber
          batchNumber: editingGroupId || undefined
        };
      });

      await api.stockMovements.bulk(promises);

      setIncomingItems([]);
      setGeneralNotes('');
      setError(null);

      if (status === 'draft') {
        // Just go back
        navigate(-1);
      } else {
        alert('Приход товаров успешно создан!');
        navigate(-1);
      }

    } catch (err: any) {
      console.error('Error submitting incoming items:', err);
      setError(err.message || 'Ошибка при создании поступления');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supplier Modal Handlers
  const handleOpenSupplierModal = () => setIsSupplierModalOpen(true);
  const handleCloseSupplierModal = () => {
    setIsSupplierModalOpen(false);
    setSupplierFormError(null);
    setNewSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });
  };
  const handleSupplierFieldChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewSupplier(prev => ({ ...prev, [field]: e.target.value }));
  };
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) {
      setSupplierFormError('Название поставщика обязательно');
      return;
    }
    setIsSavingSupplier(true);
    try {
      const res = await api.suppliers.create(newSupplier);
      if (res.success) {
        await fetchSuppliers();
        setSelectedSupplier(res.data.id || res.data._id);
        handleCloseSupplierModal();
      } else {
        setSupplierFormError('Ошибка при сохранении');
      }
    } catch (err: any) {
      setSupplierFormError(err.message || 'Ошибка при сохранении');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleProductCreate = async (productData: any) => {
    try {
      const res = await api.products.create(productData);
      if (res.success) {
        setIsProductModalOpen(false);
        // Automatically add the new product to the incoming list
        const newProduct = res.data;
        addProductToIncoming(newProduct);
      } else {
        throw new Error((res as any).error || (res as any).message || 'Ошибка при создании товара');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) throw new Error('Не удалось прочитать таблицу');

      const newItems: Product[] = [];
      const quantities: number[] = [];

      // We need to map category names to IDs primarily
      // Inverting categoriesMap: Name -> ID
      const catNameIdMap = Object.entries(categoriesMap).reduce((acc, [id, name]) => {
        acc[name.toLowerCase()] = id;
        return acc;
      }, {} as Record<string, string>);

      // Fetch recent products to determine the next productId
      let nextId = 1;
      try {
        const res: any = await api.products.getAll({ page: 1, limit: 100, sort: '-createdAt' });
        if (res?.success && Array.isArray(res.data)) {
          const maxNum = res.data
            .map((p: any) => String(p.productId || '').trim())
            .filter((id: string) => /^\d{6}$/.test(id))
            .map((id: string) => parseInt(id, 10))
            .reduce((mx: number, n: number) => (n > mx ? n : mx), 0);
          nextId = maxNum + 1;
        }
      } catch (e) {
        console.warn('Failed to fetch max ID, starting from 1');
      }

      if (!selectedLocation) {
        throw new Error('Выберите локацию для импорта товаров');
      }

      const promises: Promise<void>[] = [];
      let currentRowIndex = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        // Assumed Columns: 
        // 1: Name (Ru) *
        // 2: Brand *
        // 3: Category *
        // 4: Model
        // 5: Purchase Price
        // 6: Sale Price
        // 7: Quantity (for incoming)

        const cellValue = (idx: number) => {
          const val = row.getCell(idx).value;
          return val ? String(val).trim() : '';
        };

        const name = cellValue(1);
        const brand = cellValue(2);
        const categoryRaw = cellValue(3);
        const model = cellValue(4);
        let purchasePrice = parseFloat(cellValue(5)) || 0;
        let salePrice = parseFloat(cellValue(6)) || 0;
        const quantity = parseFloat(cellValue(7)) || 1;

        if (!name || !brand || !categoryRaw) return; // Skip invalid rows

        // Ensure non-zero prices (backend requires min 0.01)
        if (purchasePrice < 0.01) purchasePrice = 1;
        if (salePrice < 0.01) salePrice = 1;

        // Find Category ID
        let categoryId = catNameIdMap[categoryRaw.toLowerCase()];
        if (!categoryId) {
          // Fallback: try to find key that looks like it (e.g. 'processors' if user typed 'processors')
          if (categoriesMap[categoryRaw]) categoryId = categoryRaw;
          else categoryId = 'other'; // default
        }

        const currentIdStr = String(nextId + currentRowIndex).padStart(6, '0');
        const barcode = `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}${currentRowIndex}`;
        currentRowIndex++;

        const productData = {
          name,
          nameRu: name,
          brand,
          category: categoryId,
          model,
          purchasePrice,
          salePrice,
          stock: 0, // Initial stock is 0, we are adding incoming
          location: selectedLocation,
          descriptionRu: `Импорт из Excel: ${name}`,
          productId: currentIdStr,
          barcode: barcode.slice(0, 13) // Ensure strictly 13 chars or fewer (though backend allows more, lets stick to safe)
        };

        // Create Product
        const p = api.products.create(productData)
          .then(res => {
            if (res.success) {
              const product = res.data;
              // Add to local list
              newItems.push(product);
              quantities.push(quantity);
            } else {
              console.error(`Failed to create row ${rowNumber}:`, (res as any).message || (res as any).error);
            }
          })
          .catch(err => {
            console.error('Failed to create product from excel row', rowNumber, err);
            // Log detailed validation errors if available
            if (err.response && err.response.data && err.response.data.errors) {
              console.error('Validation errors:', err.response.data.errors);
            }
          });

        promises.push(p);
      });

      await Promise.all(promises);

      // Update state with all new items
      // Note: addProductToIncoming handles SINGLE item. 
      // Let's implement a bulk add to state to avoid many re-renders
      if (newItems.length > 0) {
        setIncomingItems(prev => {
          const current = [...prev];
          newItems.forEach((prod, idx) => {
            const existingIdx = current.findIndex(curr => curr.productId === (prod._id || prod.id));
            const qty = quantities[idx];
            if (existingIdx >= 0) {
              current[existingIdx].quantity += qty;
            } else {
              current.push({
                productId: prod._id || prod.id || '',
                product: prod,
                quantity: qty,
                notes: 'Excel Import',
                toLocation: selectedLocation || prod.location || '',
                purchasePrice: prod.purchasePrice,
                wholesalePrice: (prod as any).wholesalePrice,
                salePrice: prod.salePrice
              });
            }
          });
          return current;
        });
        alert(`Успешно импортировано ${newItems.length} товаров`);
      } else {
        alert('Не найдено корректных товаров для импорта или произошла ошибка');
      }

    } catch (error: any) {
      console.error('Excel import error:', error);
      alert('Ошибка при импорте: ' + error.message);
    } finally {
      setIsImporting(false);
      setIsDropdownOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    // Create a simple workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');
    sheet.columns = [
      { header: 'Название *', key: 'name', width: 30 },
      { header: 'Бренд *', key: 'brand', width: 20 },
      { header: 'Категория *', key: 'category', width: 20 },
      { header: 'Модель', key: 'model', width: 20 },
      { header: 'Цена закупки', key: 'purchasePrice', width: 15 },
      { header: 'Цена продажи', key: 'salePrice', width: 15 },
      { header: 'Количество', key: 'quantity', width: 12 },
    ];
    sheet.addRow(['Пример товара', 'Samsung', 'monitors', 'S24F350', 1500000, 1800000, 5]);

    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  return (
    <>
      <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header Area - Frame 679 - Now Full Width at Top */}
        <header className={`flex-shrink-0 border-b transition-colors duration-300 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBack}
                  className={`p-2 rounded-lg transition-colors duration-300 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600'
                    }`}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                    {isEditMode ? 'Редактировать приход' : 'Добавить приход товаров'}
                  </h1>
                  <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    {isEditMode ? 'Изменение существующего прихода' : 'Добавление новых товаров на склад'}
                  </p>
                </div>
              </div>
              {/* Removed Draft Buttons */}
            </div>
          </div>
        </header>

        {/* Content Area - Sidebar + Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Area - Frame 675 */}
          {(selectedLocation && selectedSupplier) && (
            <aside className={`w-80 flex-shrink-0 border-r overflow-y-auto transition-colors duration-300 ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
              }`}>
              <div className="p-4">
                <CategorySidebarWithBrands
                  title="CATEGORIES"
                  items={(Object.entries(categoriesMap).length ? Object.entries(categoriesMap).map(([id, name]) => ({ id, name })) : [
                    'Computers', 'Laptops', 'Servers', 'Processors', 'RAM', 'Storage', 'Graphic Cards', 'Motherboards', 'Power Supplies', 'Cooling Systems', 'Cases', 'Monitors', 'Mice', 'Headphones', 'Keyboards', 'Microphones', 'Mouse Pads', 'Printers'
                  ].map((n, i) => ({ id: `cat-${i}`, name: n }))) as any}
                  activeId={selectedCategory}
                  onSelect={(id) => {
                    setSelectedCategory(id);
                    fetchCategoryProducts(id);
                  }}
                  isDark={isDark}
                  products={categoryProducts}
                  onProductSelect={(product) => addProductToIncoming(product)}
                />
              </div>
            </aside>
          )}

          {/* Main Content Area - Frame 676 */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Step 1: Location and Supplier Selection */}
                <div className={`rounded-lg shadow-md p-6 h-fit ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Выберите локацию и поставщика
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {/* Location Selection */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className="inline-flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          Локация (Куда поступают товары)
                        </span>
                      </label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      >
                        <option value="">Выберите локацию</option>
                        {locations.map((location) => (
                          <option key={location._id} value={location._id}>
                            {location.name} {location.code && `(${location.code})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier Selection */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className="inline-flex items-center">
                          <Building className="h-4 w-4 mr-1" />
                          Поставщик (обязательно)
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={selectedSupplier}
                          onChange={(e) => {
                            setSelectedSupplier(e.target.value);
                            fetchProducts(productSearch);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        >
                          <option value="">Выберите поставщика</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleOpenSupplierModal}
                          className={`px-3 py-2 rounded-lg border ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                          title="Добавить нового поставщика"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Product Selection */}
                <div className={`rounded-lg shadow-md p-6 h-fit ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Выберите товары для прихода
                    </h2>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                        Добавить продукты
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDropdownOpen && (
                        <div className={`absolute right-0 top-full mt-2 w-56 rounded-lg shadow-lg border z-20 py-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <button
                            onClick={() => { setIsProductModalOpen(true); setIsDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-opacity-50 transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            <Plus className="h-4 w-4" />
                            <span>Создать вручную</span>
                          </button>

                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-opacity-50 transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            {isImporting ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            <span>Импорт из Excel</span>
                          </button>

                          <div className={`h-px my-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />

                          <button
                            onClick={handleDownloadTemplate}
                            className={`w-full text-left px-4 py-2 flex items-center gap-3 text-xs opacity-75 hover:opacity-100 transition-opacity ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            <Download className="h-3 w-3" />
                            <span>Скачать шаблон</span>
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={handleExcelImport}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                      type="text"
                      placeholder={(!selectedLocation || !selectedSupplier) ? "Сначала выберите локацию и поставщика" : "Поиск товара..."}
                      value={productSearch}
                      disabled={!selectedLocation || !selectedSupplier}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductSearch(val);
                        if (val.length > 0) {
                          fetchProducts(val);
                          setShowProductSearch(true);
                        } else {
                          setShowProductSearch(false);
                        }
                      }}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                    {showProductSearch && (
                      <div className={`absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg shadow-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                        {products.length > 0 ? (
                          products.map((product) => (
                            <div
                              key={product._id || product.id}
                              onClick={() => addProductToIncoming(product)}
                              className={`p-3 cursor-pointer hover:bg-opacity-50 ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.nameRu}</div>
                                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{product.brand} • {product.model}</div>
                                </div>
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{product.stock} шт.</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className={`p-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Товары не найдены</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Items List */}
              {incomingItems.length > 0 && (
                <div className={`rounded-lg shadow-md p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                  <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Выбранные товары ({incomingItems.length})
                  </h2>
                  <div className="space-y-4">
                    {incomingItems.map((item) => (
                      <div key={item.productId} className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.product.nameRu}</div>
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.product.brand} • {item.product.model}</div>
                          </div>
                          <button onClick={() => removeProductFromIncoming(item.productId)} className="text-red-600 hover:text-red-800"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className={`${isDark ? 'text-gray-300' : 'text-gray-700'} block text-xs font-medium mb-1`}>Количество</label>
                            <input type="number" min="0" value={item.quantity === 0 ? '' : item.quantity} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => updateIncomingItem(item.productId, 'quantity', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                          </div>
                          <div>
                            <label className={`${isDark ? 'text-gray-300' : 'text-gray-700'} block text-xs font-medium mb-1`}>Себестоимость</label>
                            <input type="number" min="0" step="1" value={typeof item.purchasePrice === 'number' ? item.purchasePrice : (item.product.purchasePrice || '')} placeholder={item.product.purchasePrice ? String(item.product.purchasePrice) : "0"} onFocus={(e) => e.target.select()} onChange={(e) => { const val = e.target.value; const numValue = val === '' ? undefined : Math.max(0, Number(val) || 0); updateIncomingItem(item.productId, 'purchasePrice', numValue); }} className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 mb-3">
                    <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Примечания
                    </label>
                    <input
                      type="text"
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      placeholder="Введите примечания..."
                      className={`w-full max-w-md px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300 ${isDark ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                    />
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button onClick={() => submitIncomingItems('completed')} disabled={isSubmitting || incomingItems.every(i => i.quantity === 0)} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                      {isSubmitting ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> {isEditMode ? 'Обновление...' : 'Создание...'}</>) : (<><Check className="h-4 w-4" /> {isEditMode ? 'Обновить приход' : 'Создать приход'}</>)}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className={`rounded-lg p-4 border mt-4 ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                  <div className={`${isDark ? 'text-red-400' : 'text-red-800'} text-sm`}>{error}</div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className={`w-full max-w-lg rounded-lg shadow-xl p-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Добавить нового поставщика</h3>
              <button type="button" onClick={handleCloseSupplierModal} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название *</label>
                <input type="text" value={newSupplier.name} onChange={handleSupplierFieldChange('name')} className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Название компании" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Контактное лицо</label>
                  <input type="text" value={newSupplier.contactPerson} onChange={handleSupplierFieldChange('contactPerson')} className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Имя Фамилия" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Телефон</label>
                  <input type="text" value={newSupplier.phone} onChange={handleSupplierFieldChange('phone')} className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="+998..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={newSupplier.email} onChange={handleSupplierFieldChange('email')} className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="supplier@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Адрес</label>
                  <input type="text" value={newSupplier.address} onChange={handleSupplierFieldChange('address')} className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Город, улица, офис" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Примечания</label>
                <textarea value={newSupplier.notes} onChange={handleSupplierFieldChange('notes')} rows={3} className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Дополнительная информация" />
              </div>
              {supplierFormError && (
                <div className={`px-3 py-2 rounded-md text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
                  {supplierFormError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleCloseSupplierModal} className={`px-4 py-2 rounded-md border transition-colors ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`} disabled={isSavingSupplier}>
                  Отмена
                </button>
                <button type="submit" disabled={isSavingSupplier} className="px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isSavingSupplier && <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProductModalOpen && (
        <AddProductModal
          onClose={() => setIsProductModalOpen(false)}
          onSave={handleProductCreate}
          categories={categoriesMap}
          brands={[]}
          locations={locations.map(l => ({ ...l, id: l._id }))}
        />
      )}

      {/* Save Confirmation Modal */}
      {showSaveConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className={`w-full max-w-md rounded-lg shadow-xl p-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-full ${isDark ? 'bg-yellow-900/30 text-yellow-500' : 'bg-yellow-100 text-yellow-600'}`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Сохранить изменения?</h3>
            </div>
            <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              У вас есть несохраненные изменения. Хотите сохранить их как черновик перед выходом?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => navigate(-1)}
                className={`px-4 py-2 rounded-lg border transition-colors ${isDark ? 'border-gray-600 hover:bg-gray-700 text-gray-300' : 'border-gray-300 hover:bg-gray-50 text-gray-600'}`}
              >
                Не сохранять
              </button>
              <button
                onClick={() => submitIncomingItems('draft')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Сохранить черновик
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IncomingProcessPage;
