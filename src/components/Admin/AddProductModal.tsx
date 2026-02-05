import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { Product, TechCategory } from '../../types';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

interface AddProductModalProps {
  product?: Product | null;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void; // allow optional barcode
  onClose: () => void;
  categories: Record<string, string>;
  brands: string[];
  locations?: any[];
}

const AddProductModal: React.FC<AddProductModalProps> = ({ product, onSave, onClose, categories, brands, locations = [] }) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    nameRu: '',
    brand: '',
    category: 'processors' as TechCategory,
    location: '',
    image: '',
    purchasePrice: 1,
    wholesalePrice: 0,
    salePrice: 1,
    stock: 0,
    minStock: 5,
    descriptionRu: '',
    specifications: {} as Record<string, string>
  } as Partial<Product> as any);
  const [productIdInput, setProductIdInput] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [specUnit, setSpecUnit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // String inputs for numeric fields to control leading zeros UX
  const [purchasePriceInput, setPurchasePriceInput] = useState('1');
  const [wholesalePriceInput, setWholesalePriceInput] = useState('0');
  const [salePriceInput, setSalePriceInput] = useState('1');
  const [stockInput, setStockInput] = useState('0');
  const [minStockInput, setMinStockInput] = useState('5');
  // Multiple images state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (product) {
      setFormData({
        nameRu: product.nameRu,
        brand: product.brand,
        category: product.category,
        location: product.location,
        image: product.image,
        purchasePrice: product.purchasePrice,
        wholesalePrice: (product as any).wholesalePrice ?? 0,
        salePrice: product.salePrice,
        stock: product.stock,
        minStock: product.minStock,
        descriptionRu: product.descriptionRu,
        specifications: { ...product.specifications }
      } as any);
      setPurchasePriceInput(String(product.purchasePrice ?? 0));
      setWholesalePriceInput(String((product as any).wholesalePrice ?? 0));
      setSalePriceInput(String(product.salePrice ?? 0));
      setStockInput(String(product.stock ?? 0));
      setMinStockInput(String(product.minStock ?? 0));
      setProductIdInput(product.productId || '');
      setBarcodeInput(product.barcode || '');
      // Load existing images into preview list (read-only preview for existing)
      const existingPreviews: string[] = [];
      if (product.image) existingPreviews.push(product.image);
      if (Array.isArray(product.images)) existingPreviews.push(...product.images.map(img => img.url));
      if (existingPreviews.length > 0) {
        setFilePreviews(existingPreviews);
      }
    }
  }, [product]);

  // Auto-generate sequential 6-digit productId when creating a new product
  useEffect(() => {
    const prefFillNextId = async () => {
      if (product) return; // editing existing
      try {
        // Fetch recent products and determine the max existing 6-digit productId
        const res: any = await api.products.getAll({ page: 1, limit: 100, sort: '-createdAt' });
        if (res?.success && Array.isArray(res.data)) {
          const maxNum = res.data
            .map((p: any) => String(p.productId || '').trim())
            .filter((id: string) => /^\d{6}$/.test(id))
            .map((id: string) => parseInt(id, 10))
            .reduce((mx: number, n: number) => (n > mx ? n : mx), 0);
          const next = String((maxNum || 0) + 1).padStart(6, '0');
          setProductIdInput(next);
        } else {
          setProductIdInput('000001');
        }
      } catch (e) {
        // Fallback to the initial value if API fails
        setProductIdInput(prev => (prev && prev.length === 6 ? prev : '000001'));
      }
    };
    prefFillNextId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const generateBarcode = () => {
    const base = `${Date.now()}${Math.floor(Math.random()*1_000_000).toString().padStart(6,'0')}`;
    return base.slice(0, 13);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    // Validate required fields
    if (!formData.nameRu?.trim()) {
      setSubmitError('Русское название обязательно');
      return;
    }
    if (!formData.brand?.trim()) {
      setSubmitError('Бренд обязателен');
      return;
    }
    if (!formData.category?.trim()) {
      setSubmitError('Категория обязательна');
      return;
    }
    if (!formData.location?.trim()) {
      setSubmitError('Локация обязательна');
      return;
    }
    if (!formData.descriptionRu?.trim()) {
      setSubmitError('Русское описание обязательно');
      return;
    }
    if (formData.purchasePrice <= 0) {
      setSubmitError('Цена закупки должна быть положительным числом');
      return;
    }
    if (formData.salePrice <= 0) {
      setSubmitError('Цена продажи должна быть положительным числом');
      return;
    }
    if (formData.stock < 0) {
      setSubmitError('Количество не может быть отрицательным');
      return;
    }
    if (!productIdInput || productIdInput.length !== 6) {
      setSubmitError('ID товара должен содержать ровно 6 цифр');
      return;
    }
    
    try {
      const payload = {
        ...(formData as any),
        name: (formData as any).nameRu,
        descriptionRu: (formData as any).descriptionRu ?? '',
        productId: productIdInput,
        barcode: (barcodeInput && barcodeInput.trim() !== '') ? barcodeInput.trim() : generateBarcode()
      } as any;
      await onSave(payload);
    } catch (err: any) {
      console.error('Product creation error:', err);
      let msg = err?.message || 'Ошибка сохранения товара';
      
      // Handle validation errors
      if (err?.details?.errors && Array.isArray(err.details.errors)) {
        const validationErrors = err.details.errors.map((e: any) => `${e.param}: ${e.msg}`).join(', ');
        msg = `Ошибка валидации: ${validationErrors}`;
      }
      
      setSubmitError(msg);
      const base = `${err?.message || ''} ${err?.details ? JSON.stringify(err.details) : ''}`.toLowerCase();
      if (base.includes('barcode') || base.includes('штрихкод')) {
        window.alert('Товар с данным штрихкодом уже существует');
      }
    }
  };

  const addSpecification = () => {
    let key = specKey.trim();
    let value = specValue.trim();
    if (!value) return;

    // If key is empty but a descriptive option selected in unit dropdown, use it as key
    const characteristicAsKey = new Set(['длина', 'ширина', 'высота', 'толщина', 'вес', 'масса']);
    const unitSuffixes = new Set(['кг', 'гр', 'см', 'м']);

    if (!key && characteristicAsKey.has(specUnit)) {
      key = specUnit;
    }
    if (!key) return;

    // Append unit only for measurable units (not for descriptive keys like длина/ширина)
    if (specUnit && unitSuffixes.has(specUnit)) {
      const unit = specUnit.trim();
      const hasUnit = new RegExp(`(^|\s)${unit}$`, 'i').test(value);
      if (!hasUnit) value = `${value} ${unit}`;
    }

    setFormData(prev => ({
      ...prev,
      specifications: { ...prev.specifications, [key]: value }
    }));
    setSpecKey('');
    setSpecValue('');
    setSpecUnit('');
  };

  const removeSpecification = (key: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: Object.fromEntries(Object.entries(prev.specifications).filter(([k]) => k !== key))
    }));
  };

  // Helpers for numeric inputs
  const sanitizeDecimal = (value: string) => {
    // Keep digits and one dot
    value = value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    // Remove leading zeros if not a decimal like 0.xxx
    value = value.replace(/^0+(?=\d)/, '');
    // Edge cases
    if (value === '.') value = '0.';
    return value;
  };

  const sanitizeInt = (value: string) => {
    value = value.replace(/[^0-9]/g, '');
    value = value.replace(/^0+(?=\d)/, '');
    return value;
  };

  const handlePriceChange = (raw: string, field: 'purchasePrice' | 'wholesalePrice' | 'salePrice') => {
    const v = sanitizeDecimal(raw);
    if (field === 'purchasePrice') setPurchasePriceInput(v === '' ? '' : v);
    else if (field === 'wholesalePrice') setWholesalePriceInput(v === '' ? '' : v);
    else setSalePriceInput(v === '' ? '' : v);
    setFormData(prev => ({ ...prev, [field]: v === '' ? 0 : parseFloat(v) }));
  };

  const handleIntChange = (raw: string, field: 'stock' | 'minStock') => {
    const v = sanitizeInt(raw);
    if (field === 'stock') setStockInput(v === '' ? '' : v);
    else setMinStockInput(v === '' ? '' : v);
    setFormData(prev => ({ ...prev, [field]: v === '' ? 0 : parseInt(v) }));
  };

  const handleFocusZero = (value: string, setFn: (v: string) => void) => {
    if (value === '0') setFn('');
  };

  const handleBlurEmpty = (value: string, setFn: (v: string) => void, fallback: string) => {
    if (value === '') setFn(fallback);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    setUploadError(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const maxSize = 5 * 1024 * 1024; // 5MB per file
    const dedupe = new Set<string>();
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    [...selectedFiles, ...files].forEach((f) => {
      const key = `${f.name}_${f.size}`;
      if (!dedupe.has(key)) {
        dedupe.add(key);
        if (!validTypes.includes(f.type)) return;
        if (f.size > maxSize) return;
        newFiles.push(f);
      }
    });
    const previews = newFiles.map(f => URL.createObjectURL(f));
    // cleanup old previews
    filePreviews.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles(newFiles);
    setFilePreviews(previews);
  };

  const handleUploadImage = async () => {
    if (selectedFiles.length === 0 && !selectedFile) {
      setUploadError('Пожалуйста, выберите файл(ы) изображения');
      return;
    }
    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      setOverallProgress(0);
      if (selectedFiles.length > 0) {
        const res = await api.upload.uploadImagesWithProgress(selectedFiles, undefined, (p) => setOverallProgress(p));
        if (res.success) {
          const uploaded = res.data;
          const primary = uploaded[0];
          const others = uploaded.slice(1).map(d => ({ url: d.url, publicId: d.publicId, alt: '' }));
          setFormData(prev => {
            const mergedOthers = Array.isArray((prev as any).images) ? ([...(prev as any).images, ...others]) : others;
            return {
              ...prev,
              image: primary?.url || prev.image,
              images: mergedOthers
            } as any;
          });
          // Merge previews with new uploads
          setFilePreviews(prev => {
            const newUploaded = uploaded.map(u => u.url);
            return [...(prev || []), ...newUploaded];
          });
        }
      } else if (selectedFile) {
        const res = await api.upload.uploadImage(selectedFile, (p) => setUploadProgress(p));
        if (res.success) {
          setFormData(prev => ({ ...prev, image: res.data.url }));
          setFilePreviews(prev => ([...(prev || []), res.data.url]));
        }
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Ошибка загрузки изображения');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setOverallProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-6 border-b transition-all duration-300 ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold transition-colors duration-300 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {product ? 'Редактировать товар' : 'Добавить новый товар'}
            </h2>
            <button
              onClick={onClose}
              className={`transition-colors duration-300 ${
                isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {submitError && (
            <div className={`rounded-md px-4 py-2 border text-sm ${
              isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {submitError}
            </div>
          )}
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название (RU) *
              </label>
              <input
                type="text"
                required
                value={formData.nameRu as any}
                onChange={(e) => setFormData(prev => ({ ...(prev as any), nameRu: e.target.value }))}
                className="input-modern"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Бренд *
              </label>
              <input
                type="text"
                required
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Введите название бренда"
                className="input-modern"
              />
            </div>

            {/* Модель и Вариант/Модификация удалены по требованию */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Категория *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as TechCategory }))}
                className="input-modern"
              >
                {Object.entries(categories).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Локация на складе *
              </label>
              <select
                required
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="input-modern"
              >
                <option value="">Выберите локацию</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.code}>
                    {location.code} - {location.name} (Зона {location.zone}, Уровень {location.level}, Секция {location.section})
                  </option>
                ))}
              </select>
              {locations.length === 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  Нет доступных локаций. Сначала создайте локации в разделе "Управление складом".
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Изображение товара
              </label>
              <div className="space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 ${dragActive ? 'border-blue-400' : 'border-dashed border-gray-300'} rounded-md p-4 text-center cursor-pointer`}
                  onClick={() => document.getElementById('product-image-input')?.click()}
                >
                  <input
                    id="product-image-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center text-gray-600">
                    <Upload className="h-6 w-6 mb-1" />
                    <span className="text-sm">Перетащите изображения сюда или нажмите, чтобы выбрать</span>
                    <span className="text-xs text-gray-400 mt-1">Поддерживаемые форматы: JPG, PNG, WEBP, AVIF. Макс. 5MB/файл</span>
                  </div>
                </div>
                {(selectedFiles.length > 0) && (
                  <div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                      {filePreviews.map((src, idx) => (
                        <div key={idx} className="relative group">
                          {/* eslint-disable-next-line jsx-a11y/alt-text */}
                          <img src={src} className="h-24 w-full object-cover rounded-md border" />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Выбрано файлов: {selectedFiles.length}</div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUploadImage}
                    disabled={uploading || (selectedFiles.length === 0 && !selectedFile)}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {uploading ? 'Загрузка...' : 'Загрузить'}
                  </button>
                  {uploading && selectedFiles.length === 0 && (
                    <div className="flex-1 h-2 bg-gray-200 rounded">
                      <div className="h-2 bg-emerald-500 rounded" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  {uploading && selectedFiles.length > 0 && (
                    <div className="flex-1 h-2 bg-gray-200 rounded">
                      <div className="h-2 bg-emerald-500 rounded" style={{ width: `${overallProgress}%` }} />
                    </div>
                  )}
                </div>
                {uploadError && (
                  <div className="text-sm text-red-600">{uploadError}</div>
                )}
                {(previewUrl || formData.image) && (
                  <div className="mt-2">
                    <img src={previewUrl || formData.image} alt="preview" className="h-32 rounded-md object-cover border" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цена закупки (сўм) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={purchasePriceInput}
                onFocus={() => handleFocusZero(purchasePriceInput, setPurchasePriceInput)}
                onBlur={() => handleBlurEmpty(purchasePriceInput, setPurchasePriceInput, '1')}
                onChange={(e) => handlePriceChange(e.target.value, 'purchasePrice')}
                className="input-modern"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Оптовая цена (сўм)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={wholesalePriceInput}
                onFocus={() => handleFocusZero(wholesalePriceInput, setWholesalePriceInput)}
                onBlur={() => handleBlurEmpty(wholesalePriceInput, setWholesalePriceInput, '0')}
                onChange={(e) => handlePriceChange(e.target.value, 'wholesalePrice')}
                className="input-modern"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID товара (6 цифр) *
              </label>
              <input
                type="text"
                value={productIdInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setProductIdInput(value);
                }}
                className="input-modern"
                placeholder="123456"
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Только цифры, максимум 6 символов
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Штрихкод (необязательно)
              </label>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="input-modern"
                placeholder="Введите штрихкод или оставьте пустым"
              />
              <p className="text-xs text-gray-500 mt-1">
                Штрихкод отличается от ID товара
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цена продажи (сўм) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={salePriceInput}
                onFocus={() => handleFocusZero(salePriceInput, setSalePriceInput)}
                onBlur={() => handleBlurEmpty(salePriceInput, setSalePriceInput, '1')}
                onChange={(e) => handlePriceChange(e.target.value, 'salePrice')}
                className="input-modern"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Количество на складе *
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={stockInput}
                onFocus={() => handleFocusZero(stockInput, setStockInput)}
                onBlur={() => handleBlurEmpty(stockInput, setStockInput, '0')}
                onChange={(e) => handleIntChange(e.target.value, 'stock')}
                className="input-modern"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Мин. остаток
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={minStockInput}
                onFocus={() => handleFocusZero(minStockInput, setMinStockInput)}
                onBlur={() => handleBlurEmpty(minStockInput, setMinStockInput, '5')}
                onChange={(e) => handleIntChange(e.target.value, 'minStock')}
                className="input-modern"
              />
            </div>
          </div>

          {/* Description */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание (RU) *
              </label>
              <textarea
                rows={3}
                required
                value={formData.descriptionRu as any}
                onChange={(e) => setFormData(prev => ({ ...(prev as any), descriptionRu: e.target.value }))}
                className="input-modern"
              />
            </div>
          </div>

          {/* Specifications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Технические характеристики
            </label>
            
            {/* Add new specification */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Характеристика (например: длина)"
                value={specKey}
                onChange={(e) => setSpecKey(e.target.value)}
                className="flex-1 input-modern"
              />
              <div className="flex flex-1 gap-2">
                <input
                  type="text"
                  placeholder="Значение (например: 8)"
                  value={specValue}
                  onChange={(e) => setSpecValue(e.target.value)}
                  className="flex-1 input-modern"
                />
                <select
                  value={specUnit}
                  onChange={(e) => setSpecUnit(e.target.value)}
                  className="w-28 input-modern"
                >
                  <option value="">ед.</option>
                  <option value="кг">кг</option>
                  <option value="гр">гр</option>
                  <option value="длина">длина</option>
                  <option value="ширина">ширина</option>
                  <option value="см">см</option>
                  <option value="м">м</option>
                </select>
              </div>
              <button
                type="button"
                onClick={addSpecification}
                className="btn-pill-solid"
              >
                Добавить
              </button>
            </div>

            {/* Existing specifications */}
            <div className="space-y-2">
              {Object.entries(formData.specifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-sm">
                    <strong>{key}:</strong> {value}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSpecification(key)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-pill-outline"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-pill-solid"
            >
              {product ? 'Сохранить изменения' : 'Добавить товар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;