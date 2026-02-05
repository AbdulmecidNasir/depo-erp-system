import express from 'express';
import { body, validationResult, query } from 'express-validator';
import mongoose from 'mongoose';
import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Helpers for location normalization
function normalizeLocationKey(key) {
  try {
    const str = String(key || '').trim();
    if (!str) return '';
    const match = str.match(/\(([^)]+)\)/);
    const extracted = match ? match[1] : str;
    return String(extracted).trim();
  } catch {
    return String(key || '').trim();
  }
}

function toMap(ls) {
  if (ls && typeof ls.forEach === 'function' && typeof ls.get === 'function') return ls;
  const obj = ls && typeof ls === 'object' ? ls : {};
  return new Map(Object.entries(obj));
}

function canonicalizeLocationStockMap(ls) {
  const map = toMap(ls);
  const result = new Map();
  map.forEach((qty, k) => {
    const canon = normalizeLocationKey(k);
    const prev = result.get(canon) || 0;
    result.set(canon, prev + Number(qty || 0));
  });
  return result;
}

// @desc    Get all stock movements with filtering and pagination
// @route   GET /api/stock-movements
// @access  Private (Admin, Warehouse Manager, Warehouse Staff)
router.get('/', [
  query('page').optional().toInt().isInt({ min: 1 }).withMessage('Страница должна быть положительным числом'),
  query('limit').optional().toInt().isInt({ min: 1, max: 10000 }).withMessage('Лимит должен быть от 1 до 10000'),
  query('type').optional().isIn(['in', 'out', 'transfer', 'adjustment']).withMessage('Неверный тип движения'),
  query('status').optional().isIn(['draft', 'completed']).withMessage('Неверный статус'),
  query('productId').optional().isMongoId().withMessage('Неверный ID продукта'),
  query('userId').optional().isMongoId().withMessage('Неверный ID пользователя'),
  query('supplierId').optional().isMongoId().withMessage('Неверный ID поставщика'),
  query('startDate').optional().isISO8601().withMessage('Неверная дата начала'),
  query('endDate').optional().isISO8601().withMessage('Неверная дата окончания')
], protect, restrictTo('admin', 'warehouse_manager', 'warehouse_staff'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('GET /stock-movements validation errors:', JSON.stringify(errors.array(), null, 2));
      console.error('Request query params:', req.query);
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    // Build query
    let query = {
      deleted: { $ne: true }
    };

    // Type filter
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Product filter
    if (req.query.productId) {
      query.productId = req.query.productId;
    }

    // User filter
    if (req.query.userId) {
      query.userId = req.query.userId;
    }

    // Supplier filter
    if (req.query.supplierId) {
      query.supplier = req.query.supplierId;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        query.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Execute query with population
    const movements = await StockMovement.find(query)
      .populate('productId', 'nameRu brand model location stock locationStock category salePrice purchasePrice wholesalePrice')
      .populate('userId', 'firstName lastName email')
      .populate('supplier', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Generate movementId for records that don't have it and clean location names
    for (let movement of movements) {
      if (!movement.movementId) {
        const newId = await StockMovement.generateMovementId();
        await StockMovement.findByIdAndUpdate(movement._id, { movementId: newId });
        movement.movementId = newId;
      }

      // Clean location names in productId.locationStock
      if (movement.productId && movement.productId.locationStock) {
        const cleanedLocationStock = {};
        Object.entries(movement.productId.locationStock).forEach(([location, qty]) => {
          // Extract only the part inside parentheses or use the original if no parentheses
          const cleanLocation = location.includes('(') && location.includes(')')
            ? location.match(/\(([^)]+)\)/)?.[1] || location
            : location;

          if (cleanLocation && cleanLocation.trim() !== '') {
            cleanedLocationStock[cleanLocation] = qty;
          }
        });
        movement.productId.locationStock = cleanedLocationStock;
      }
    }

    // Get total count for pagination
    const total = await StockMovement.countDocuments(query);

    res.json({
      success: true,
      data: movements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения движений товаров'
    });
  }
});

// @desc    Create new stock movement
// @route   POST /api/stock-movements
// @access  Private (Admin, Warehouse Manager, Warehouse Staff)
router.post('/', [
  body('productId').isMongoId().withMessage('Неверный ID продукта'),
  body('quantity').isInt({ min: 1 }).withMessage('Количество должно быть положительным числом'),
  body('fromLocation').optional().trim(),
  body('toLocation').optional().trim(),
  body('notes').optional().trim(),
  body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('Цена закупки должна быть положительным числом'),
  body('wholesalePrice').optional().isFloat({ min: 0 }).withMessage('Оптовая цена должна быть положительным числом'),
  body('salePrice').optional().isFloat({ min: 0 }).withMessage('Цена продажи должна быть положительным числом'),
  body('supplier').optional().isMongoId().withMessage('Неверный ID поставщика')
], protect, restrictTo('admin', 'warehouse_manager', 'warehouse_staff'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    // Check if product exists
    const product = await Product.findById(req.body.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Продукт не найден'
      });
    }

    // Set default type to 'transfer' and validate movement requirements
    const type = req.body.type || 'transfer';
    const { fromLocation, toLocation } = req.body;

    if ((type === 'out' || type === 'transfer') && !fromLocation) {
      return res.status(400).json({
        success: false,
        message: 'Локация отправления обязательна для операций выбытия и перемещения'
      });
    }

    if ((type === 'in' || type === 'transfer') && !toLocation) {
      return res.status(400).json({
        success: false,
        message: 'Локация назначения обязательна для операций поступления и перемещения'
      });
    }

    // Check if there's enough stock for outbound movements
    if (type === 'out' || type === 'transfer') {
      const fromLocation = req.body.fromLocation;
      if (fromLocation) {
        // Check location-specific stock
        const locationStock = product.locationStock?.get(fromLocation) || 0;
        if (locationStock < req.body.quantity) {
          // If no location-specific stock, check if we can use general stock
          if (product.stock >= req.body.quantity && locationStock === 0) {
            // Allow the movement but warn that we're using general stock
            console.log(`Using general stock for location ${fromLocation} - no location-specific stock set`);
          } else {
            return res.status(400).json({
              success: false,
              message: `Недостаточно товара в локации ${fromLocation}. Доступно: ${locationStock}, требуется: ${req.body.quantity}. Общий остаток: ${product.stock}`
            });
          }
        }
      } else if (product.stock < req.body.quantity) {
        return res.status(400).json({
          success: false,
          message: `Недостаточно товара на складе. Доступно: ${product.stock}, требуется: ${req.body.quantity}`
        });
      }
    }

    // Generate unique movement ID
    const movementId = await StockMovement.generateMovementId();

    // Create stock movement
    const stockMovement = await StockMovement.create({
      productId: req.body.productId,
      type: type,
      quantity: req.body.quantity,
      fromLocation: req.body.fromLocation,
      toLocation: req.body.toLocation,
      notes: req.body.notes,
      movementId,
      userId: req.user.id,
      purchasePrice: req.body.purchasePrice,
      wholesalePrice: req.body.wholesalePrice,
      salePrice: req.body.salePrice,
      supplier: req.body.supplier
    });

    // Normalize locationStock and product.location
    product.locationStock = canonicalizeLocationStockMap(product.locationStock);
    const productLocationCanon = normalizeLocationKey(product.location);

    // Update product stock based on movement type
    let stockChange = 0;

    switch (type) {
      case 'in': {
        stockChange = req.body.quantity;
        if (req.body.toLocation) {
          const toKey = normalizeLocationKey(req.body.toLocation);
          const currentLocationStock = product.locationStock.get(toKey) || 0;
          product.locationStock.set(toKey, currentLocationStock + req.body.quantity);
          // Set primary location to destination (canonical key)
          product.location = toKey;
        }
        break;
      }
      case 'out': {
        const qty = req.body.quantity;
        const fromLoc = normalizeLocationKey(req.body.fromLocation);
        stockChange = -qty;
        if (fromLoc) {
          let currentFrom = product.locationStock.get(fromLoc) || 0;
          if (currentFrom < qty && productLocationCanon === fromLoc) {
            // Infer available at primary location as (total - sum(other locations))
            let sumOthers = 0;
            product.locationStock.forEach((v, k) => { if (k !== fromLoc) sumOthers += Number(v || 0); });
            currentFrom = Math.max(0, (product.stock || 0) - sumOthers);
          }
          if (currentFrom < qty) {
            return res.status(400).json({ success: false, message: `Недостаточно товара в локации ${fromLoc}. Доступно: ${currentFrom}, требуется: ${qty}` });
          }
          product.locationStock.set(fromLoc, currentFrom - qty);
        }
        break;
      }
      case 'transfer': {
        const qty = req.body.quantity;
        const fromLoc = req.body.fromLocation;
        const toLoc = req.body.toLocation;
        if (fromLoc && toLoc) {
          // Ensure positive transfer and sufficient source location stock
          let currentFrom = product.locationStock.get(fromLoc) || 0;
          if (currentFrom === 0 && product.location === fromLoc) {
            // Infer available stock at primary location as (total - sum(other locations))
            let sumOthers = 0;
            product.locationStock.forEach((v, k) => { if (k !== fromLoc) sumOthers += Number(v || 0); });
            currentFrom = Math.max(0, (product.stock || 0) - sumOthers);
          }
          if (currentFrom < qty) {
            return res.status(400).json({ success: false, message: `Недостаточно товара в локации ${fromLoc}. Доступно: ${currentFrom}, требуется: ${qty}` });
          }

          // Decrease from source location stock (create entry if missing), increase destination within the SAME product
          product.locationStock.set(fromLoc, currentFrom - qty);
          const currentTo = product.locationStock.get(toLoc) || 0;
          product.locationStock.set(toLoc, currentTo + qty);

          // Keep total stock unchanged for transfer
          // Merge any existing separate destination product into this one to avoid duplicates
          const duplicateAtDest = await Product.findOne({
            _id: { $ne: product._id },
            nameRu: product.nameRu,
            brand: product.brand,
            model: product.model,
            category: product.category,
            isActive: true
          });
          if (duplicateAtDest) {
            // Merge its locationStock into current product
            const ls = duplicateAtDest.locationStock;
            if (ls && typeof ls === 'object') {
              const entries = (typeof ls.forEach === 'function') ? Array.from(ls.entries()) : Object.entries(ls);
              for (const [lname, lqty] of entries) {
                const prev = product.locationStock.get(lname) || 0;
                product.locationStock.set(lname, prev + Number(lqty || 0));
              }
            } else if (duplicateAtDest.location) {
              const prev = product.locationStock.get(duplicateAtDest.location) || 0;
              product.locationStock.set(duplicateAtDest.location, prev + (duplicateAtDest.stock || 0));
            }
            // Sum total stock
            product.stock = (product.stock || 0) + (duplicateAtDest.stock || 0);
            // Deactivate duplicate
            duplicateAtDest.isActive = false;
            await duplicateAtDest.save({ validateBeforeSave: false });
          }
        }
        break;
      }
      case 'adjustment': {
        product.stock = req.body.quantity;
        if (req.body.toLocation) {
          product.locationStock.set(req.body.toLocation, req.body.quantity);
          product.location = req.body.toLocation;
        }
        break;
      }
    }

    // Update total stock
    if (type !== 'adjustment') {
      product.stock += stockChange;
    }

    // Update product main location only for receipts; for transfers we keep source product location
    if (req.body.toLocation && type === 'in') {
      product.location = req.body.toLocation;
    }

    await product.save();

    // Populate the created movement
    const populatedMovement = await StockMovement.findById(stockMovement._id)
      .populate('productId', 'nameRu brand model location')
      .populate('userId', 'firstName lastName email')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Движение товара успешно создано',
      data: populatedMovement
    });
  } catch (error) {
    console.error('Create stock movement error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания движения товара'
    });
  }
});

// @desc    Get deleted stock movements
// @route   GET /api/stock-movements/deleted
// @access  Private (Admin, Warehouse Manager)
router.get('/deleted', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const movements = await StockMovement.find({ deleted: true })
      .populate('productId', 'nameRu brand model')
      .populate('userId', 'firstName lastName email')
      .populate('deletedBy', 'firstName lastName email')
      .sort({ deletedAt: -1 })
      .limit(100) // Limit to last 100 deleted items for now
      .lean();

    res.json({
      success: true,
      data: movements
    });
  } catch (error) {
    console.error('Get deleted movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения удаленных движений'
    });
  }
});

// @desc    Get single stock movement
// @route   GET /api/stock-movements/:id
// @access  Private (Admin, Warehouse Manager, Warehouse Staff)
router.get('/:id', protect, restrictTo('admin', 'warehouse_manager', 'warehouse_staff'), async (req, res) => {
  try {
    const movement = await StockMovement.findById(req.params.id)
      .populate('productId', 'nameRu brand model location')
      .populate('userId', 'firstName lastName email')
      .lean();

    if (!movement) {
      return res.status(404).json({
        success: false,
        message: 'Движение товара не найдено'
      });
    }

    res.json({
      success: true,
      data: movement
    });
  } catch (error) {
    console.error('Get stock movement error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения движения товара'
    });
  }
});

// @desc    Update stock movement (limited updates)
// @route   PUT /api/stock-movements/:id
// @access  Private (Admin, Warehouse Manager only)
router.put('/:id', [
  body('reason').optional().trim().notEmpty().withMessage('Причина не может быть пустой'),
  body('notes').optional().trim(),
  body('batchNumber').optional().trim(),
  body('status').optional().isIn(['draft', 'completed']).withMessage('Неверный статус')
], protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    // Only allow updating certain fields
    const allowedUpdates = ['reason', 'notes', 'batchNumber', 'status'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const movement = await StockMovement.findById(req.params.id)
      .populate('productId')
      .lean();

    if (!movement) {
      return res.status(404).json({
        success: false,
        message: 'Движение товара не найдено'
      });
    }

    // If status is being changed from draft to completed, update stock
    // Also update all movements in the same batch (same batchNumber)
    if (updates.status === 'completed' && movement.status === 'draft') {
      const batchNumber = movement.batchNumber;

      // Find all draft movements with the same batchNumber
      const batchMovements = await StockMovement.find({
        batchNumber: batchNumber,
        status: 'draft'
      }).populate('productId').lean();

      // Use transaction to ensure all-or-nothing
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Process each movement in the batch
          for (const batchMovement of batchMovements) {
            const product = await Product.findById(batchMovement.productId).session(session);
            if (!product) {
              throw new Error(`Товар не найден для перемещения ${batchMovement._id}`);
            }

            product.locationStock = canonicalizeLocationStockMap(product.locationStock);
            const productLocationCanon = normalizeLocationKey(product.location);

            // Update stock based on movement type
            if (batchMovement.type === 'transfer' && batchMovement.fromLocation && batchMovement.toLocation) {
              const fromKey = normalizeLocationKey(batchMovement.fromLocation);
              const toKey = normalizeLocationKey(batchMovement.toLocation);
              const rawFrom = product.locationStock.get(fromKey) || 0;
              let availableFrom = rawFrom;
              if (availableFrom <= 0 && productLocationCanon === fromKey) {
                let sumOthers = 0;
                product.locationStock.forEach((v, k) => { if (k !== fromKey) sumOthers += Number(v || 0); });
                availableFrom = Math.max(0, (product.stock || 0) - sumOthers);
              }
              if (availableFrom < batchMovement.quantity) {
                throw new Error(`Недостаточно товара в локации ${fromKey}. Доступно: ${availableFrom}, требуется: ${batchMovement.quantity}`);
              }
              product.locationStock.set(fromKey, availableFrom - batchMovement.quantity);
              const currentTo = product.locationStock.get(toKey) || 0;
              product.locationStock.set(toKey, currentTo + batchMovement.quantity);
            } else if (batchMovement.type === 'in' && batchMovement.toLocation) {
              product.stock += batchMovement.quantity;
              const toKey = normalizeLocationKey(batchMovement.toLocation);
              const currentTo = product.locationStock.get(toKey) || 0;
              product.locationStock.set(toKey, currentTo + batchMovement.quantity);
              product.location = toKey;
            } else if (batchMovement.type === 'out' && batchMovement.fromLocation) {
              const fromKey = normalizeLocationKey(batchMovement.fromLocation);
              let currentFrom = product.locationStock.get(fromKey) || 0;
              if (currentFrom < batchMovement.quantity && productLocationCanon === fromKey) {
                let sumOthers = 0;
                product.locationStock.forEach((v, k) => { if (k !== fromKey) sumOthers += Number(v || 0); });
                currentFrom = Math.max(0, (product.stock || 0) - sumOthers);
              }
              if (currentFrom < batchMovement.quantity) {
                throw new Error(`Недостаточно товара в локации ${fromKey}. Доступно: ${currentFrom}, требуется: ${batchMovement.quantity}`);
              }
              product.locationStock.set(fromKey, currentFrom - batchMovement.quantity);
              product.stock = Math.max(0, product.stock - batchMovement.quantity);
            }

            await product.save({ session });
          }

          // Update status for all movements in the batch
          await StockMovement.updateMany(
            { batchNumber: batchNumber, status: 'draft' },
            { $set: { status: 'completed' } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    }

    const updatedMovement = await StockMovement.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('productId', 'nameRu brand model location')
      .populate('userId', 'firstName lastName email')
      .lean();

    res.json({
      success: true,
      message: 'Движение товара успешно обновлено',
      data: updatedMovement
    });
  } catch (error) {
    console.error('Update stock movement error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления движения товара'
    });
  }
});

// @desc    Complete all draft movements in a batch
// @route   PUT /api/stock-movements/batch/:batchNumber/complete
// @access  Private (Admin, Warehouse Manager)
router.put('/batch/:batchNumber/complete', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const { batchNumber } = req.params;

    if (!batchNumber) {
      return res.status(400).json({
        success: false,
        message: 'Номер партии обязателен'
      });
    }

    // Find all draft movements with this batchNumber
    const draftMovements = await StockMovement.find({
      batchNumber: batchNumber,
      status: 'draft'
    }).populate('productId').lean();

    if (draftMovements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Черновики с этим номером партии не найдены'
      });
    }

    // Use transaction to ensure all-or-nothing
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Process each movement in the batch
        for (const movement of draftMovements) {
          const product = await Product.findById(movement.productId).session(session);
          if (!product) {
            throw new Error(`Товар не найден для перемещения ${movement._id}`);
          }

          // Update stock based on movement type
          if (movement.type === 'in') {
            product.stock = Number(product.stock || 0) + Number(movement.quantity);
          } else if (movement.type === 'out') {
            product.stock = Number(product.stock || 0) - Number(movement.quantity);
          } else if (movement.type === 'transfer') {
            // For transfers, update locationStock
            if (movement.fromLocation && movement.toLocation) {
              const locationStock = product.locationStock || {};
              const fromLoc = movement.fromLocation.toLowerCase().trim();
              const toLoc = movement.toLocation.toLowerCase().trim();

              locationStock[fromLoc] = Math.max(0, (locationStock[fromLoc] || 0) - movement.quantity);
              locationStock[toLoc] = (locationStock[toLoc] || 0) + movement.quantity;
              product.locationStock = locationStock;
            }
          }

          await product.save({ session });

          // Update movement status to completed
          await StockMovement.findByIdAndUpdate(
            movement._id,
            { status: 'completed' },
            { session }
          );
        }
      });

      await session.endSession();

      res.json({
        success: true,
        message: `Успешно завершено ${draftMovements.length} движений в партии ${batchNumber}`,
        data: {
          completedCount: draftMovements.length,
          batchNumber
        }
      });
    } catch (transactionError) {
      await session.endSession();
      throw transactionError;
    }
  } catch (error) {
    console.error('Complete batch error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка при завершении партии движений'
    });
  }
});

// @desc    Delete all movements in a batch
// @route   DELETE /api/stock-movements/batch/:batchNumber
// @access  Private (Admin, Warehouse Manager)
router.delete('/batch/:batchNumber', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const { batchNumber } = req.params;

    if (!batchNumber) {
      return res.status(400).json({
        success: false,
        message: 'Номер партии обязателен'
      });
    }

    // Find all movements with this batchNumber
    const movements = await StockMovement.find({
      batchNumber: batchNumber
    }).populate('productId').lean();

    if (movements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Движения с этим номером партии не найдены'
      });
    }

    // Use transaction to ensure all-or-nothing
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Reverse stock changes for completed movements
        for (const movement of movements) {
          if (movement.status === 'completed') {
            const product = await Product.findById(movement.productId).session(session);
            if (product) {
              // Reverse the stock changes
              if (movement.type === 'in') {
                product.stock = Math.max(0, Number(product.stock || 0) - Number(movement.quantity));
              } else if (movement.type === 'out') {
                product.stock = Number(product.stock || 0) + Number(movement.quantity);
              } else if (movement.type === 'transfer') {
                // Reverse transfer for locationStock
                if (movement.fromLocation && movement.toLocation) {
                  const locationStock = product.locationStock || {};
                  const fromLoc = movement.fromLocation.toLowerCase().trim();
                  const toLoc = movement.toLocation.toLowerCase().trim();

                  // Reverse: add back to fromLocation, subtract from toLocation
                  locationStock[fromLoc] = (locationStock[fromLoc] || 0) + movement.quantity;
                  locationStock[toLoc] = Math.max(0, (locationStock[toLoc] || 0) - movement.quantity);
                  product.locationStock = locationStock;
                }
              }
              await product.save({ session });
            }
          }
        }

        // Soft delete all movements in the batch
        await StockMovement.updateMany(
          { batchNumber: batchNumber },
          {
            $set: {
              deleted: true,
              deletedAt: new Date(),
              deletedBy: req.user.id,
              deleteReason: 'Batch deletion'
            }
          },
          { session }
        );
      });

      await session.endSession();

      res.json({
        success: true,
        message: `Успешно удалено ${movements.length} движений в партии ${batchNumber}`,
        data: {
          deletedCount: movements.length,
          batchNumber
        }
      });
    } catch (transactionError) {
      await session.endSession();
      throw transactionError;
    }
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка при удалении партии движений'
    });
  }
});

// @desc    Delete stock movement
// @route   DELETE /api/stock-movements/:id
// @access  Private (Admin, Warehouse Manager)
router.delete('/:id', protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    console.log('=== DELETE REQUEST START ===');
    console.log('Request ID:', req.params.id);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);

    // Try multiple ways to find the movement
    let movement = null;

    // First try: Find by movementId
    movement = await StockMovement.findOne({ movementId: req.params.id });
    console.log('Found by movementId:', !!movement);

    // Second try: Find by _id if not found
    if (!movement) {
      movement = await StockMovement.findById(req.params.id);
      console.log('Found by _id:', !!movement);
    }

    // Third try: Find by movementId as string if still not found
    if (!movement) {
      movement = await StockMovement.findOne({ movementId: req.params.id.toString() });
      console.log('Found by movementId string:', !!movement);
    }

    if (!movement) {
      console.log('Movement not found with any method');
      return res.status(404).json({
        success: false,
        message: 'Движение товара не найдено'
      });
    }

    console.log('Found movement:', movement._id, 'movementId:', movement.movementId);

    // Soft delete
    movement.deleted = true;
    movement.deletedAt = new Date();
    movement.deletedBy = req.user.id;
    movement.deleteReason = 'Manual deletion';

    // Reverse stock changes if status was completed
    if (movement.status === 'completed') {
      const product = await Product.findById(movement.productId);
      if (product) {
        if (movement.type === 'in') {
          product.stock = Math.max(0, Number(product.stock || 0) - Number(movement.quantity));
          // Should we update locationStock too? Ideally yes.
          if (movement.toLocation) {
            const toLoc = normalizeLocationKey(movement.toLocation);
            const current = product.locationStock.get(toLoc) || 0;
            product.locationStock.set(toLoc, Math.max(0, current - movement.quantity));
          }
        } else if (movement.type === 'out') {
          product.stock = Number(product.stock || 0) + Number(movement.quantity);
          if (movement.fromLocation) {
            const fromLoc = normalizeLocationKey(movement.fromLocation);
            const current = product.locationStock.get(fromLoc) || 0;
            product.locationStock.set(fromLoc, current + movement.quantity);
          }
        } else if (movement.type === 'transfer') {
          if (movement.fromLocation && movement.toLocation) {
            const fromLoc = normalizeLocationKey(movement.fromLocation);
            const toLoc = normalizeLocationKey(movement.toLocation);
            const currFrom = product.locationStock.get(fromLoc) || 0;
            const currTo = product.locationStock.get(toLoc) || 0;

            product.locationStock.set(fromLoc, currFrom + movement.quantity);
            product.locationStock.set(toLoc, Math.max(0, currTo - movement.quantity));
          }
        }
        await product.save();
      }
    }

    await movement.save();

    console.log('Movement deleted successfully');
    console.log('=== DELETE REQUEST END ===');

    res.json({
      success: true,
      message: 'Движение товара успешно удалено'
    });
  } catch (error) {
    console.log('=== ERROR START ===');
    console.error('Full error object:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.log('=== ERROR END ===');

    res.status(500).json({
      success: false,
      message: 'Ошибка удаления движения товара',
      error: error.message
    });
  }
});

// @desc    Create multiple stock movements
// @route   POST /api/stock-movements/bulk
// @access  Private (Admin, Warehouse Manager)
router.post('/bulk', [
  body('movements').isArray({ min: 1 }).withMessage('Движения должны быть массивом'),
  body('movements.*.productId').isMongoId().withMessage('Неверный ID продукта'),
  body('movements.*.type').isIn(['in', 'out', 'transfer', 'adjustment']).withMessage('Неверный тип движения'),
  body('movements.*.quantity').isInt({ min: 1 }).withMessage('Количество должно быть положительным числом'),
  body('movements.*.fromLocation').optional().isString().withMessage('Откуда должно быть строкой'),
  body('movements.*.toLocation').optional().isString().withMessage('Куда должно быть строкой'),
  body('movements.*.notes').optional().isString().withMessage('Примечания должны быть строкой'),
  body('movements.*.purchasePrice').optional().isFloat({ min: 0 }).withMessage('Цена закупки должна быть положительным числом'),
  body('movements.*.wholesalePrice').optional().isFloat({ min: 0 }).withMessage('Оптовая цена должна быть положительным числом'),
  body('movements.*.salePrice').optional().isFloat({ min: 0 }).withMessage('Цена продажи должна быть положительным числом'),
  body('movements.*.status').optional().isIn(['draft', 'completed']).withMessage('Неверный статус')
], protect, restrictTo('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { movements } = req.body;
    const createdMovements = [];

    console.log('Bulk movements request:', JSON.stringify(movements, null, 2));

    // First, validate all movements before committing any
    for (const movementData of movements) {
      const { productId, type, quantity, fromLocation, toLocation } = movementData;

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Товар с ID ${productId} не найден`
        });
      }

      // Check stock availability before creating any movements
      if (type === 'transfer' && fromLocation) {
        const fromKey = normalizeLocationKey(fromLocation);
        product.locationStock = canonicalizeLocationStockMap(product.locationStock);
        const productLocationCanon = normalizeLocationKey(product.location);

        const rawFrom = product.locationStock.get(fromKey) || 0;
        let availableFrom = rawFrom;
        if (availableFrom <= 0 && productLocationCanon === fromKey) {
          let sumOthers = 0;
          product.locationStock.forEach((v, k) => { if (k !== fromKey) sumOthers += Number(v || 0); });
          availableFrom = Math.max(0, (product.stock || 0) - sumOthers);
        }

        if (availableFrom < quantity) {
          return res.status(400).json({
            success: false,
            message: `Недостаточно товара в локации ${fromKey}. Доступно: ${availableFrom}, требуется: ${quantity}`
          });
        }
      }
    }

    // Use MongoDB transaction to ensure all-or-nothing
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        for (const movementData of movements) {
          const { productId, type, quantity, fromLocation, toLocation, notes, batchNumber, movementId } = movementData;

          // Get product details
          const product = await Product.findById(productId);
          if (!product) {
            return res.status(404).json({
              success: false,
              message: `Товар с ID ${productId} не найден`
            });
          }

          // Create movement - use batchNumber as the shared ID for grouped movements
          // If batchNumber is not provided, generate sequential one or use movementId
          let sharedBatchNumber = batchNumber || movementId;
          if (!sharedBatchNumber) {
            // Generate sequential batchNumber using the same logic as movementId
            const lastBatch = await StockMovement.findOne(
              { batchNumber: { $exists: true, $ne: null, $regex: /^\d{6}$/ } },
              { batchNumber: 1 },
              { sort: { batchNumber: -1 } }
            ).lean();
            const maxBatchNum = lastBatch && lastBatch.batchNumber ? parseInt(lastBatch.batchNumber, 10) : 0;
            sharedBatchNumber = String(maxBatchNum + 1).padStart(6, '0');
          }
          const movementStatus = movementData.status || 'completed';
          const movement = new StockMovement({
            productId,
            type,
            quantity,
            fromLocation,
            toLocation,
            notes: notes || 'Перемещение товара',
            batchNumber: sharedBatchNumber,
            userId: req.user.id,
            timestamp: new Date(),
            purchasePrice: movementData.purchasePrice,
            wholesalePrice: movementData.wholesalePrice,
            salePrice: movementData.salePrice,
            status: movementStatus,
            supplier: movementData.supplierId || movementData.supplier
          });

          const savedMovement = await movement.save({ session });
          console.log('Saved movement with batchNumber:', sharedBatchNumber, 'movementId:', savedMovement.movementId);
          createdMovements.push(savedMovement);

          // Normalize location stock keys and primary location to canonical form (code inside parentheses or trimmed)
          product.locationStock = canonicalizeLocationStockMap(product.locationStock);
          const productLocationCanon = normalizeLocationKey(product.location);

          // Update product stock and per-location balances based on movement type
          // Skip stock updates if status is 'draft'
          if (movementStatus === 'draft') {
            // Don't update stock for drafts
          } else if (type === 'in') {
            product.stock += quantity;
            if (toLocation) {
              const toKey = normalizeLocationKey(toLocation);
              const currentTo = product.locationStock.get(toKey) || 0;
              product.locationStock.set(toKey, currentTo + quantity);
              product.location = toKey;
            }
          } else if (type === 'out') {
            if (fromLocation) {
              const fromKey = normalizeLocationKey(fromLocation);
              let currentFrom = product.locationStock.get(fromKey) || 0;
              if (currentFrom < quantity && productLocationCanon === fromKey) {
                let sumOthers = 0;
                product.locationStock.forEach((v, k) => { if (k !== fromKey) sumOthers += Number(v || 0); });
                currentFrom = Math.max(0, (product.stock || 0) - sumOthers);
              }
              if (currentFrom < quantity) {
                return res.status(400).json({
                  success: false,
                  message: `Недостаточно товара в локации ${fromKey}. Доступно: ${currentFrom}, требуется: ${quantity}`
                });
              }
              product.locationStock.set(fromKey, currentFrom - quantity);
            }
            product.stock = Math.max(0, product.stock - quantity);
          } else if (type === 'transfer') {
            if (fromLocation && toLocation) {
              const fromKey = normalizeLocationKey(fromLocation);
              const toKey = normalizeLocationKey(toLocation);
              // Determine available quantity at source location
              const rawFrom = product.locationStock.get(fromKey) || 0;
              let availableFrom = rawFrom;
              if (availableFrom <= 0 && productLocationCanon === fromKey) {
                let sumOthers = 0;
                product.locationStock.forEach((v, k) => { if (k !== fromKey) sumOthers += Number(v || 0); });
                availableFrom = Math.max(0, (product.stock || 0) - sumOthers);
              }
              if (availableFrom < quantity) {
                return res.status(400).json({
                  success: false,
                  message: `Недостаточно товара в локации ${fromKey}. Доступно: ${availableFrom}, требуется: ${quantity}`
                });
              }
              // Update per-location stocks without going negative
              product.locationStock.set(fromKey, availableFrom - quantity);
              const currentTo = product.locationStock.get(toKey) || 0;
              product.locationStock.set(toKey, currentTo + quantity);
              // Total stock unchanged for transfer
            }
          }

          // Only save product if stock was updated (not a draft)
          if (movementStatus !== 'draft') {
            await product.save({ session });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      message: `Успешно создано ${createdMovements.length} движений`,
      data: createdMovements
    });

  } catch (error) {
    console.error('Error creating bulk movements:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при создании движений',
      error: error.message
    });
  }
});

export default router;
