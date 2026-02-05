import express from 'express';
import { body, validationResult, query } from 'express-validator';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { protect, restrictTo, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Fallback categories used when the DB has no active categories
const FALLBACK_CATEGORIES = {
  computers: 'Компьютеры',
  laptops: 'Ноутбуки',
  servers: 'Серверы',
  processors: 'Процессоры',
  memory: 'Оперативная память',
  storage: 'Накопители',
  'graphics-cards': 'Видеокарты',
  motherboards: 'Материнские платы',
  'power-supplies': 'Блоки питания',
  cooling: 'Системы охлаждения',
  cases: 'Корпуса',
  monitors: 'Мониторы',
  mishka: 'Мышки',
  naushnik: 'Наушники',
  klavye: 'Клавиатуры',
  mikrofon: 'Микрофоны',
  kovrik: 'Коврики',
  smartphones: 'Смартфоны',
  tablets: 'Планшеты',
  printers: 'Принтеры',
  scanners: 'Сканеры',
  'network-equipment': 'Сетевое оборудование',
  cables: 'Кабели',
  adapters: 'Адаптеры',
  accessories: 'Аксессуары',
  consumables: 'Расходные материалы'
};

// Aliases mapping to canonical slugs
const CATEGORY_ALIASES = {
  networking: 'network-equipment'
};

// Normalize category in incoming bodies and query params before validation
function normalizeCategoryMiddleware(req, res, next) {
  try {
    // Normalize category in body
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'category')) {
      const value = req.body.category;
      if (typeof value !== 'string') {
        delete req.body.category;
      } else {
        const lower = String(value).toLowerCase().trim();
        if (!lower) {
          delete req.body.category;
        } else {
          req.body.category = CATEGORY_ALIASES[lower] || lower;
        }
      }
    }
    // Normalize category in query params
    if (Object.prototype.hasOwnProperty.call(req.query || {}, 'category')) {
      const value = req.query.category;
      if (typeof value !== 'string') {
        delete req.query.category;
      } else {
        const lower = String(value).toLowerCase().trim();
        if (!lower) {
          delete req.query.category;
        } else {
          req.query.category = CATEGORY_ALIASES[lower] || lower;
        }
      }
    }
  } catch (e) {
    // noop: fall through to validators/handler
  }
  next();
}

// Apply normalizer to all product routes
router.use(normalizeCategoryMiddleware);

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
router.get('/', [
  query('page').optional().toInt().isInt({ min: 1 }).withMessage('Страница должна быть положительным числом'),
  query('limit').optional().toInt().isInt({ min: 1, max: 10000 }).withMessage('Лимит должен быть от 1 до 10000'),
  query('sort').optional().isIn(['name', 'nameRu', 'price', 'stock', 'createdAt', '-name', '-nameRu', '-price', '-stock', '-createdAt']).withMessage('Неверный параметр сортировки'),
  query('category').optional().trim(),
  query('search').optional().trim(),
  query('brand').optional().trim(),
  query('brands').optional().trim(), // Can be sent multiple times: ?brands=brand1&brands=brand2
  query('model').optional().trim(),
  query('barcode').optional().trim(),
  query('productId').optional().trim(),
  query('location').optional().trim(),
  query('minPrice').optional().toFloat().isFloat({ min: 0 }).withMessage('Минимальная цена должна быть неотрицательной'),
  query('maxPrice').optional().toFloat().isFloat({ min: 0 }).withMessage('Максимальная цена должна быть неотрицательной'),
  query('inStock').optional().toBoolean().isBoolean().withMessage('Параметр inStock должен быть булевым')
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const filtered = errors.array().filter(e => e.param !== 'category' && e.msg !== 'Неверная категория');
      if (filtered.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации',
          errors: filtered
        });
      }
      // Only category-related issues present; ignore and proceed
    }

    // Build query
    let query = { isActive: true };

    // Text search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Brand filter (single or multiple)
    // Handle brands parameter - can be array or multiple query params
    let brandsArray = [];
    if (req.query.brands) {
      if (Array.isArray(req.query.brands)) {
        brandsArray = req.query.brands;
      } else {
        brandsArray = [req.query.brands];
      }
    }

    if (brandsArray.length > 0) {
      // Multiple brands - use $in operator
      query.brand = { $in: brandsArray.map((b) => new RegExp(String(b).trim(), 'i')) };
    } else if (req.query.brand) {
      // Single brand
      query.brand = new RegExp(req.query.brand, 'i');
    }

    // Model filter
    if (req.query.model) {
      query.model = new RegExp(req.query.model, 'i');
    }

    // Barcode search
    if (req.query.barcode) {
      query.barcode = req.query.barcode;
    }

    // Short Product ID search
    if (req.query.productId) {
      query.productId = req.query.productId;
    }

    // Location filter (admin only)
    if (req.query.location && req.user && req.user.role === 'admin') {
      query.location = new RegExp(req.query.location, 'i');
    }

    // Price range
    if (req.query.minPrice || req.query.maxPrice) {
      query.salePrice = {};
      if (req.query.minPrice) query.salePrice.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.salePrice.$lte = parseFloat(req.query.maxPrice);
    }

    // Stock filter
    if (req.query.inStock === 'true') {
      query.stock = { $gt: 0 };
    } else if (req.query.inStock === 'false') {
      query.stock = 0;
    }

    // Low stock filter (admin only)
    if (req.query.lowStock === 'true' && req.user && req.user.role === 'admin') {
      query.$expr = { $lt: ['$stock', '$minStock'] };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sorting
    let sort = {};
    if (req.query.sort) {
      const sortField = req.query.sort.startsWith('-') ? req.query.sort.slice(1) : req.query.sort;
      const sortOrder = req.query.sort.startsWith('-') ? -1 : 1;

      if (sortField === 'price') {
        sort.salePrice = sortOrder;
      } else {
        sort[sortField] = sortOrder;
      }
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Execute query
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    // Transform products based on user role
    const transformedProducts = products.map(product => {
      const transformed = { ...product };

      // Hide purchase price from customers
      if (!req.user || req.user.role !== 'admin') {
        delete transformed.purchasePrice;
        delete transformed.location;

        // Transform stock info for customers
        transformed.stockStatus = product.stock > 0 ? 'В наличии' : 'Нет в наличии';
        delete transformed.stock;
        delete transformed.minStock;
      }

      return transformed;
    });

    res.json({
      success: true,
      data: transformedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения продуктов'
    });
  }
});

// @desc    Deduplicate products (alias path placed before dynamic :id route)
// @route   POST /api/products/actions/deduplicate
// @access  Private (Admin only)
router.post('/actions/deduplicate', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const activeProducts = await Product.find({ isActive: true }).lean();
    const groups = new Map();
    for (const p of activeProducts) {
      const key = p.barcode || `${(p.brand || '').trim().toLowerCase()}|${(p.model || '').trim().toLowerCase()}|${(p.nameRu || '').trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }

    let mergedGroups = 0;
    let deactivated = 0;
    let updated = 0;

    for (const [key, items] of groups.entries()) {
      if (!Array.isArray(items) || items.length <= 1) continue;
      const keeper = items.reduce((min, cur) => (new Date(cur.createdAt) < new Date(min.createdAt) ? cur : min), items[0]);
      const others = items.filter(i => String(i._id) !== String(keeper._id));
      if (others.length === 0) continue;

      let totalStock = 0;
      const locMap = new Map();
      for (const prod of items) {
        const stock = Number(prod.stock || 0);
        totalStock += stock;
        const ls = prod.locationStock;
        if (ls && typeof ls === 'object') {
          const entries = (typeof ls.forEach === 'function') ? Array.from(ls.entries()) : Object.entries(ls);
          for (const [lname, qty] of entries) {
            const q = Number(qty || 0);
            locMap.set(lname, (locMap.get(lname) || 0) + q);
          }
        } else {
          const lname = (prod.location || '').trim() || '-';
          locMap.set(lname, (locMap.get(lname) || 0) + stock);
        }
      }

      let primaryLocation = keeper.location;
      if (locMap.size > 0) {
        let best = ['', -1];
        for (const [name, qty] of locMap.entries()) {
          if (qty > best[1]) best = [name, qty];
        }
        primaryLocation = best[0] || primaryLocation;
      }

      const keeperDoc = await Product.findById(keeper._id);
      if (keeperDoc) {
        const obj = {};
        for (const [n, q] of locMap.entries()) obj[n] = q;
        keeperDoc.locationStock = obj;
        keeperDoc.stock = totalStock;
        if (primaryLocation) keeperDoc.location = primaryLocation;
        await keeperDoc.save({ validateBeforeSave: false });
        updated += 1;
      }

      const ids = others.map(o => o._id);
      const resUpd = await Product.updateMany({ _id: { $in: ids } }, { isActive: false });
      deactivated += (resUpd.modifiedCount || 0);
      mergedGroups += 1;
    }

    res.json({ success: true, mergedGroups, updated, deactivated });
  } catch (error) {
    console.error('Deduplicate products error:', error);
    res.status(500).json({ success: false, message: 'Ошибка объединения дубликатов' });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Продукт не найден'
      });
    }

    // Increment views
    product.views += 1;
    await product.save({ validateBeforeSave: false });

    // Transform product based on user role
    const transformed = product.toObject();

    if (!req.user || req.user.role !== 'admin') {
      delete transformed.purchasePrice;
      delete transformed.location;
      transformed.stockStatus = product.stock > 0 ? 'В наличии' : 'Нет в наличии';
      delete transformed.stock;
      delete transformed.minStock;
    }

    res.json({
      success: true,
      data: transformed
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения продукта'
    });
  }
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin only)
router.post('/', protect, restrictTo('admin', 'warehouse_manager'), [
  body('name').optional().trim(),
  body('nameRu').trim().notEmpty().withMessage('Русское название обязательно'),
  body('brand').trim().notEmpty().withMessage('Бренд обязателен'),
  body('model').optional().trim(),
  body('category').isString().trim().notEmpty().withMessage('Категория обязательна'),
  body('location').trim().notEmpty().withMessage('Локация обязательна'),
  body('image').optional().trim(),
  body('productId').isLength({ min: 6, max: 6 }).withMessage('ID товара должен содержать ровно 6 символов').matches(/^\d{6}$/).withMessage('ID товара должен содержать только цифры'),
  body('barcode').optional().trim(),
  body('purchasePrice').isFloat({ min: 0.01 }).withMessage('Цена закупки должна быть положительным числом'),
  body('wholesalePrice').optional().isFloat({ min: 0 }).withMessage('Оптовая цена должна быть неотрицательной'),
  body('salePrice').isFloat({ min: 0.01 }).withMessage('Цена продажи должна быть положительным числом'),
  body('stock').isInt({ min: 0 }).withMessage('Количество должно быть неотрицательным числом'),
  body('minStock').optional().isInt({ min: 0 }).withMessage('Минимальный остаток должен быть неотрицательным числом'),
  body('description').optional().trim(),
  body('descriptionRu').trim().notEmpty().withMessage('Русское описание обязательно'),
  body('specifications').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    // Validate category against DB with fallback when DB is empty
    let categorySlug = String(req.body.category || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, categorySlug)) {
      categorySlug = CATEGORY_ALIASES[categorySlug];
    }
    const exists = await Category.exists({ slug: categorySlug, isActive: true });
    if (!exists) {
      const isAllowedFallback = Object.prototype.hasOwnProperty.call(FALLBACK_CATEGORIES, categorySlug);
      if (!isAllowedFallback) {
        return res.status(400).json({ success: false, message: 'Неверная категория' });
      }
    }

    const product = await Product.create({ ...req.body, category: categorySlug });

    res.status(201).json({
      success: true,
      message: 'Продукт успешно создан',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    next(error);
  }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin only)
router.put('/:id', protect, restrictTo('admin', 'warehouse_manager'), normalizeCategoryMiddleware, [
  body('nameRu').optional().trim().notEmpty().withMessage('Русское название не может быть пустым'),
  body('brand').optional().trim().notEmpty().withMessage('Бренд не может быть пустым'),
  body('model').optional().trim(),
  // Relax category validation to avoid rejecting payloads where category is not a string;
  // the handler will normalize or ignore invalid values.
  body('category')
    .optional({ nullable: true })
    .customSanitizer((value) => {
      // Map aliases early; keep non-strings as-is to be handled later
      if (typeof value === 'string') {
        const v = String(value).toLowerCase();
        return CATEGORY_ALIASES[v] || v;
      }
      return value;
    })
    .custom((value) => {
      // Accept undefined/null or non-string (to be ignored later), or non-empty string
      if (value === undefined || value === null) return true;
      if (typeof value !== 'string') return true;
      return value.trim().length > 0;
    })
    .withMessage('Неверная категория'),
  body('productId').optional().isLength({ min: 6, max: 6 }).withMessage('ID товара должен содержать ровно 6 символов').matches(/^\d{6}$/).withMessage('ID товара должен содержать только цифры'),
  body('barcode').optional().trim(),
  body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('Цена закупки должна быть положительным числом'),
  body('wholesalePrice').optional().isFloat({ min: 0 }).withMessage('Оптовая цена должна быть неотрицательной'),
  body('salePrice').optional().isFloat({ min: 0 }).withMessage('Цена продажи должна быть положительным числом'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Количество должно быть неотрицательным числом')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    // Get the current product to compare stock changes
    const currentProduct = await Product.findById(req.params.id);
    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Продукт не найден'
      });
    }

    // If category provided, validate against DB and normalize slug (support fallback when DB empty)
    if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      if (typeof req.body.category !== 'string') {
        // Ignore invalid category types; do not attempt to update category
        delete req.body.category;
      } else if (req.body.category.trim() !== '') {
        let categorySlug = String(req.body.category).toLowerCase();
        if (Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, categorySlug)) {
          categorySlug = CATEGORY_ALIASES[categorySlug];
        }
        const exists = await Category.exists({ slug: categorySlug, isActive: true });
        if (!exists) {
          const isAllowedFallback = Object.prototype.hasOwnProperty.call(FALLBACK_CATEGORIES, categorySlug);
          if (!isAllowedFallback) {
            // If category is invalid, ignore it to allow other fields to update
            delete req.body.category;
          } else {
            req.body.category = categorySlug;
          }
        }
      } else {
        // Empty string provided – do not allow clearing category inadvertently
        delete req.body.category;
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Продукт не найден'
      });
    }

    // Check if stock was changed and create stock movement record
    if (req.body.stock !== undefined && req.body.stock !== currentProduct.stock) {
      const stockDifference = req.body.stock - currentProduct.stock;

      if (stockDifference !== 0) {
        // Import StockMovement model
        const StockMovement = (await import('../models/StockMovement.js')).default;

        // Determine movement type and quantity
        let movementType, movementQuantity, reason;

        if (stockDifference > 0) {
          // Stock increased - create "in" movement
          movementType = 'in';
          movementQuantity = stockDifference;
          reason = 'Корректировка количества (увеличение)';
        } else {
          // Stock decreased - create "out" movement
          movementType = 'out';
          movementQuantity = Math.abs(stockDifference);
          reason = 'Корректировка количества (уменьшение)';
        }

        // Generate unique movement ID
        const movementId = await StockMovement.generateMovementId();

        // Create stock movement record
        await StockMovement.create({
          movementId,
          productId: product._id,
          type: movementType,
          quantity: movementQuantity,
          reason: reason,
          userId: req.user.id,
          notes: `Автоматически создано при редактировании товара. Было: ${currentProduct.stock}, стало: ${req.body.stock}`,
          toLocation: movementType === 'in' ? product.location : undefined,
          fromLocation: movementType === 'out' ? product.location : undefined
        });
      }
    }

    res.json({
      success: true,
      message: 'Продукт успешно обновлен',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    next(error);
  }
});

// @desc    Delete product (hard delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
router.delete('/:id', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Продукт не найден' });
    }
    res.json({ success: true, message: 'Продукт полностью удален' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Ошибка удаления продукта' });
  }
});

// @desc    Get product categories
// @route   GET /api/products/categories/list
// @access  Public
router.get('/categories/list', async (req, res) => {
  try {
    const docs = await Category.find({ isActive: true }).sort({ sortOrder: 1, nameRu: 1 }).lean();
    let categories = docs.reduce((acc, cur) => { acc[cur.slug] = cur.nameRu; return acc; }, {});

    // Fallback to default categories if DB is empty
    if (Object.keys(categories).length === 0) {
      categories = FALLBACK_CATEGORIES;
    }

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения категорий'
    });
  }
});

// @desc    Get product brands
// @route   GET /api/products/brands/list
// @access  Public
router.get('/brands/list', async (req, res) => {
  try {
    const brands = await Product.distinct('brand', { isActive: true });

    res.json({
      success: true,
      data: brands.sort()
    });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения брендов'
    });
  }
});

// @desc    Deduplicate products by barcode or brand+model+nameRu, merging stocks/locations
// @route   POST /api/products/deduplicate
// @access  Private (Admin only)
router.post('/deduplicate', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const activeProducts = await Product.find({ isActive: true }).lean();
    const groups = new Map();
    for (const p of activeProducts) {
      const key = p.barcode || `${(p.brand || '').trim().toLowerCase()}|${(p.model || '').trim().toLowerCase()}|${(p.nameRu || '').trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }

    let mergedGroups = 0;
    let deactivated = 0;
    let updated = 0;

    for (const [key, items] of groups.entries()) {
      if (!Array.isArray(items) || items.length <= 1) continue;
      // Choose the earliest created product as keeper
      const keeper = items.reduce((min, cur) => (new Date(cur.createdAt) < new Date(min.createdAt) ? cur : min), items[0]);
      const others = items.filter(i => String(i._id) !== String(keeper._id));
      if (others.length === 0) continue;

      // Aggregate stock and locations
      let totalStock = 0;
      const locMap = new Map();
      for (const prod of items) {
        const stock = Number(prod.stock || 0);
        totalStock += stock;
        const ls = prod.locationStock;
        if (ls && typeof ls === 'object') {
          // ls may be a plain object or a Map serialized to object when lean
          const entries = (typeof ls.forEach === 'function') ? Array.from(ls.entries()) : Object.entries(ls);
          for (const [lname, qty] of entries) {
            const q = Number(qty || 0);
            locMap.set(lname, (locMap.get(lname) || 0) + q);
          }
        } else {
          const lname = (prod.location || '').trim() || '-';
          locMap.set(lname, (locMap.get(lname) || 0) + stock);
        }
      }

      // Determine primary location as the one with highest qty
      let primaryLocation = keeper.location;
      if (locMap.size > 0) {
        let best = ['', -1];
        for (const [name, qty] of locMap.entries()) {
          if (qty > best[1]) best = [name, qty];
        }
        primaryLocation = best[0] || primaryLocation;
      }

      // Update keeper
      const keeperDoc = await Product.findById(keeper._id);
      if (keeperDoc) {
        // Assign a Map to locationStock
        const obj = {};
        for (const [n, q] of locMap.entries()) obj[n] = q;
        keeperDoc.locationStock = obj; // Mongoose will convert to Map
        keeperDoc.stock = totalStock;
        if (primaryLocation) keeperDoc.location = primaryLocation;
        await keeperDoc.save({ validateBeforeSave: false });
        updated += 1;
      }

      // Soft-delete others
      const ids = others.map(o => o._id);
      const resUpd = await Product.updateMany({ _id: { $in: ids } }, { isActive: false });
      deactivated += (resUpd.modifiedCount || 0);
      mergedGroups += 1;
    }

    res.json({ success: true, mergedGroups, updated, deactivated });
  } catch (error) {
    console.error('Deduplicate products error:', error);
    res.status(500).json({ success: false, message: 'Ошибка объединения дубликатов' });
  }
});

// @desc    Update product stock
// @route   PATCH /api/products/:id/stock
// @access  Private (Admin only)
router.patch('/:id/stock', protect, restrictTo('admin', 'warehouse_manager'), [
  body('stock').isInt({ min: 0 }).withMessage('Количество должно быть неотрицательным числом')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { stock } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Продукт не найден'
      });
    }

    res.json({
      success: true,
      message: 'Остаток успешно обновлен',
      data: { stock: product.stock, isLowStock: product.isLowStock }
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления остатка'
    });
  }
});

export default router;