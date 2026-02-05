import express from 'express';
import { body, validationResult, query } from 'express-validator';
import Location from '../models/Location.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all locations with filtering and pagination
// @route   GET /api/locations
// @access  Private (Admin only)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Страница должна быть положительным числом'),
  query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Лимит должна быть от 1 до 10000'),
  query('zone').optional().trim(),
  query('search').optional().trim()
], protect, restrictTo('admin', 'warehouse_manager', 'warehouse_staff', 'sales_manager'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    // Build query
    let query = { isActive: true };

    // Zone filter
    if (req.query.zone) {
      query.zone = req.query.zone;
    }

    // Search filter
    if (req.query.search) {
      query.$or = [
        { code: new RegExp(req.query.search, 'i') },
        { name: new RegExp(req.query.search, 'i') },
        { description: new RegExp(req.query.search, 'i') }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Execute query
    const locations = await Location.find(query)
      .sort({ zone: 1, level: 1, section: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Location.countDocuments(query);

    res.json({
      success: true,
      data: locations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения локаций'
    });
  }
});

// @desc    Get single location
// @route   GET /api/locations/:id
// @access  Private (Admin, Warehouse, Sales)
router.get('/:id', protect, restrictTo('admin', 'warehouse_manager', 'warehouse_staff', 'sales_manager'), async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location || !location.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Локация не найдена'
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения локации'
    });
  }
});

// @desc    Create new location
// @route   POST /api/locations
// @access  Private (Admin only)
router.post('/', [
  body('code').trim().notEmpty().withMessage('Код локации обязателен'),
  body('name').trim().notEmpty().withMessage('Название локации обязательно'),
  body('description').optional().trim(),
  body('capacity').optional().toInt().isInt({ min: 0 }).withMessage('Вместимость должна быть 0 или больше'),
  body('currentOccupancy').optional().toInt().isInt({ min: 0 }).withMessage('Текущая занятость должна быть 0 или больше'),
  body('zone').trim().notEmpty().withMessage('Зона обязательна').toUpperCase(),
  body('level').toInt().isInt({ min: 1 }).withMessage('Уровень должен быть больше 0'),
  body('section').toInt().isInt({ min: 1 }).withMessage('Секция должна быть больше 0')
], protect, restrictTo('admin'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const payload = {
      code: req.body.code,
      name: req.body.name,
      description: req.body.description || '',
      capacity: typeof req.body.capacity === 'number' ? req.body.capacity : 0,
      currentOccupancy: typeof req.body.currentOccupancy === 'number' ? req.body.currentOccupancy : 0,
      zone: req.body.zone,
      level: req.body.level,
      section: req.body.section,
      isActive: true
    };
    const location = new Location(payload);

    await location.save();

    res.status(201).json({
      success: true,
      data: location,
      message: 'Локация успешно создана'
    });
  } catch (error) {
    console.error('Create location error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Локация с таким кодом уже существует'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка создания локации'
    });
  }
});

// @desc    Update location
// @route   PUT /api/locations/:id
// @access  Private (Admin only)
router.put('/:id', [
  body('code').optional().trim().notEmpty().withMessage('Код локации не может быть пустым'),
  body('name').optional().trim().notEmpty().withMessage('Название локации не может быть пустым'),
  body('description').optional().trim(),
  body('capacity').optional().toInt().isInt({ min: 0 }).withMessage('Вместимость должна быть 0 или больше'),
  body('currentOccupancy').optional().toInt().isInt({ min: 0 }).withMessage('Текущая занятость должна быть 0 или больше'),
  body('zone').optional().trim().toUpperCase(),
  body('level').optional().toInt().isInt({ min: 1 }).withMessage('Уровень должен быть больше 0'),
  body('section').optional().toInt().isInt({ min: 1 }).withMessage('Секция должна быть больше 0')
], protect, restrictTo('admin'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const location = await Location.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Локация не найдена'
      });
    }

    res.json({
      success: true,
      data: location,
      message: 'Локация успешно обновлена'
    });
  } catch (error) {
    console.error('Update location error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Локация с таким кодом уже существует'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка обновления локации'
    });
  }
});

// @desc    Delete location (soft delete)
// @route   DELETE /api/locations/:id
// @access  Private (Admin only)
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Локация не найдена'
      });
    }

    res.json({
      success: true,
      message: 'Локация успешно удалена'
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления локации'
    });
  }
});

// @desc    Get location statistics
// @route   GET /api/locations/stats/overview
// @access  Private (Admin only)
router.get('/stats/overview', protect, restrictTo('admin'), async (req, res) => {
  try {
    const stats = await Location.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalLocations: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          totalOccupancy: { $sum: '$currentOccupancy' },
          averageUtilization: {
            $avg: {
              $multiply: [
                { $divide: ['$currentOccupancy', '$capacity'] },
                100
              ]
            }
          }
        }
      }
    ]);

    const zoneStats = await Location.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$zone',
          count: { $sum: 1 },
          capacity: { $sum: '$capacity' },
          occupancy: { $sum: '$currentOccupancy' }
        }
      },
      {
        $addFields: {
          utilization: {
            $multiply: [
              { $divide: ['$occupancy', '$capacity'] },
              100
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalLocations: 0,
          totalCapacity: 0,
          totalOccupancy: 0,
          averageUtilization: 0
        },
        byZone: zoneStats
      }
    });
  } catch (error) {
    console.error('Get location stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики локаций'
    });
  }
});

export default router;
