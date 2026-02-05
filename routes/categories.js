import express from 'express';
import Category from '../models/Category.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get categories list (array)
// @route   GET /api/categories
// @access  Public
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, nameRu: 1 }).lean();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Ошибка получения категорий' });
  }
});

// @desc    Get categories as map { slug: nameRu }
// @route   GET /api/categories/map
// @access  Public
router.get('/map', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, nameRu: 1 }).lean();
    const map = categories.reduce((acc, cur) => { acc[cur.slug] = cur.nameRu; return acc; }, {});
    res.json({ success: true, data: map });
  } catch (error) {
    console.error('Get categories map error:', error);
    res.status(500).json({ success: false, message: 'Ошибка получения категорий' });
  }
});

// @desc    Seed all categories from frontend warehouseData.itCategories
// @route   POST /api/categories/seed
// @access  Private (Admin only)
router.post('/seed', protect, restrictTo('admin'), async (req, res) => {
  try {
    // Allow passing categories via body; if missing, use default list from server
    const provided = req.body?.categories;

    // Default server copy, kept in sync with frontend `itCategories`
    const defaultCategories = {
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
      printers: 'Принтеры',
      scanners: 'Сканеры',
      'network-equipment': 'Сетевое оборудование',
      cables: 'Кабели',
      adapters: 'Адаптеры',
      accessories: 'Аксессуары',
      consumables: 'Расходные материалы'
    };

    const source = provided && typeof provided === 'object' && !Array.isArray(provided) ? provided : defaultCategories;
    const entries = Object.entries(source);

    const results = [];
    for (const [slug, nameRu] of entries) {
      const update = {
        slug,
        nameRu,
        isActive: true
      };
      const doc = await Category.findOneAndUpdate(
        { slug },
        { $set: update, $setOnInsert: { sortOrder: results.length } },
        { new: true, upsert: true }
      );
      results.push(doc);
    }

    res.json({ success: true, message: 'Категории успешно засеяны', count: results.length, data: results });
  } catch (error) {
    console.error('Seed categories error:', error);
    res.status(500).json({ success: false, message: 'Ошибка сохранения категорий' });
  }
});

// @desc    Initial seed without auth (only when empty)
// @route   POST /api/categories/seed/init
// @access  Public (guards ensure it runs only once)
router.post('/seed/init', async (req, res) => {
  try {
    const count = await Category.countDocuments();
    if (count > 0) {
      return res.status(403).json({ success: false, message: 'Категории уже существуют' });
    }

    const defaultCategories = {
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
      printers: 'Принтеры',
      scanners: 'Сканеры',
      'network-equipment': 'Сетевое оборудование',
      cables: 'Кабели',
      adapters: 'Адаптеры',
      accessories: 'Аксессуары',
      consumables: 'Расходные материалы'
    };

    const entries = Object.entries(defaultCategories);
    const bulk = entries.map(([slug, nameRu], idx) => ({ slug, nameRu, sortOrder: idx, isActive: true }));
    const created = await Category.insertMany(bulk, { ordered: false });
    res.json({ success: true, message: 'Категории инициализированы', count: created.length });
  } catch (error) {
    console.error('Init seed categories error:', error);
    res.status(500).json({ success: false, message: 'Ошибка инициализации категорий' });
  }
});

export default router;


