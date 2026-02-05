import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/auth.js';
import Supplier from '../models/Supplier.js';

const router = express.Router();

// Get all suppliers
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 100, skip = 0, search = '', activeOnly = 'true' } = req.query;
    
    const query = {};
    
    // Filter by active status
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const suppliers = await Supplier.find(query)
      .sort({ name: 1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();
      
    const total = await Supplier.countDocuments(query);
    
    res.json({
      success: true,
      data: suppliers,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении поставщиков',
      error: error.message
    });
  }
});

// Get supplier by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }
    
    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении поставщика',
      error: error.message
    });
  }
});

// Create new supplier
router.post('/',
  protect,
  [
    body('name').notEmpty().trim().withMessage('Имя поставщика обязательно'),
    body('email').optional().isEmail().withMessage('Неверный формат email'),
    body('phone').optional().trim(),
    body('contactPerson').optional().trim(),
    body('address').optional().trim(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации',
          errors: errors.array()
        });
      }
      
      // Check if supplier with same name already exists
      const existingSupplier = await Supplier.findOne({ 
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') } 
      });
      
      if (existingSupplier) {
        return res.status(400).json({
          success: false,
          message: 'Поставщик с таким именем уже существует'
        });
      }
      
      const supplier = new Supplier(req.body);
      await supplier.save();
      
      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Поставщик успешно создан'
      });
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при создании поставщика',
        error: error.message
      });
    }
  }
);

// Update supplier
router.put('/:id',
  protect,
  [
    body('name').optional().notEmpty().trim().withMessage('Имя поставщика не может быть пустым'),
    body('email').optional().isEmail().withMessage('Неверный формат email'),
    body('phone').optional().trim(),
    body('contactPerson').optional().trim(),
    body('address').optional().trim(),
    body('notes').optional().trim(),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации',
          errors: errors.array()
        });
      }
      
      // If name is being updated, check for duplicates
      if (req.body.name) {
        const existingSupplier = await Supplier.findOne({
          _id: { $ne: req.params.id },
          name: { $regex: new RegExp(`^${req.body.name}$`, 'i') }
        });
        
        if (existingSupplier) {
          return res.status(400).json({
            success: false,
            message: 'Поставщик с таким именем уже существует'
          });
        }
      }
      
      const supplier = await Supplier.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Поставщик не найден'
        });
      }
      
      res.json({
        success: true,
        data: supplier,
        message: 'Поставщик успешно обновлен'
      });
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при обновлении поставщика',
        error: error.message
      });
    }
  }
);

// Delete supplier
router.delete('/:id', protect, async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }
    
    res.json({
      success: true,
      message: 'Поставщик успешно удален'
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении поставщика',
      error: error.message
    });
  }
});

export default router;

