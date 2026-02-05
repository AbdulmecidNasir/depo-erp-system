import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, [
  body('items').isArray({ min: 1 }).withMessage('Заказ должен содержать минимум один товар'),
  body('items.*.product').isMongoId().withMessage('Неверный ID продукта'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Количество должно быть больше 0'),
  body('shippingAddress.street').optional().trim().notEmpty().withMessage('Улица не может быть пустой'),
  body('shippingAddress.city').optional().trim().notEmpty().withMessage('Город не может быть пустым')
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

    const { items, shippingAddress, notes, customerId, customerModel } = req.body;

    // Validate products and calculate totals
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Продукт ${item.product} не найден или недоступен`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Недостаточно товара "${product.nameRu}" на складе. Доступно: ${product.stock}`
        });
      }

      // Allow override price if provided, otherwise use current salePrice
      const itemPrice = item.price !== undefined ? Number(item.price) : product.salePrice;
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice,
        total: itemTotal
      });
    }

    // Determine customer
    let finalCustomerId = req.user.id;
    let finalCustomerModel = 'User';

    if (customerId && (req.user.role === 'admin' || req.user.role === 'warehouse_manager')) {
      finalCustomerId = customerId;
      if (customerModel && ['User', 'Debitor', 'Supplier'].includes(customerModel)) {
        finalCustomerModel = customerModel;
      }
    }

    // Create order
    const order = await Order.create({
      customer: finalCustomerId,
      customerModel: finalCustomerModel,
      items: orderItems,
      subtotal,
      total: subtotal, // Can add tax and shipping later
      shippingAddress,
      notes,
      createdBy: req.user.id
    });

    // NOTE: In the new workflow, stock is NOT deducted here. 
    // It is deducted when a Shipment is created.
    // We only validated availability above.

    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'firstName lastName email partyName name')
      .populate('items.product', 'nameRu brand model images');

    res.status(201).json({
      success: true,
      message: 'Заказ успешно создан',
      data: populatedOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка создания заказа',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Get user orders
// @route   GET /api/orders/my
// @access  Private
router.get('/my', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ customer: req.user.id })
      .populate('items.product', 'nameRu brand model images')
      .populate('customer', 'firstName lastName email partyName name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ customer: req.user.id });

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения заказов'
    });
  }
});

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
// @access  Private (Admin only)
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.customer) {
      query.customer = req.query.customer;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        // Start of the day
        const start = new Date(req.query.startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (req.query.endDate) {
        // End of the day
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Search filter (Order Number, Notes, Customer Name)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');

      // We need to search in User, Debitor, and Supplier collections for names
      // Since order.customer is a shared field.
      // This is a bit expensive, but necessary for a good search.
      try {
        const User = mongoose.model('User');
        const Debitor = mongoose.model('Debitor');
        const Supplier = mongoose.model('Supplier');

        const [users, debitors, suppliers] = await Promise.all([
          User.find({ $or: [{ firstName: searchRegex }, { lastName: searchRegex }] }).select('_id'),
          Debitor.find({ partyName: searchRegex }).select('_id'),
          Supplier.find({ name: searchRegex }).select('_id')
        ]);

        const customerIds = [
          ...users.map(u => u._id),
          ...debitors.map(d => d._id),
          ...suppliers.map(s => s._id)
        ];

        query.$or = [
          { orderNumber: searchRegex },
          { notes: searchRegex },
          { customer: { $in: customerIds } }
        ];
      } catch (err) {
        console.error('Search lookup error:', err);
        // Fallback to just number and notes if populating fails or models aren't loaded
        query.$or = [
          { orderNumber: searchRegex },
          { notes: searchRegex }
        ];
      }
    }

    const orders = await Order.find(query)
      .populate('customer', 'firstName lastName email partyName name')
      .populate('items.product', 'nameRu brand model images')
      .populate('createdBy', 'firstName lastName')
      .populate('cancelledBy', 'firstName lastName')
      .populate('returnedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения заказов'
    });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    let query = { _id: req.params.id };

    // Non-admin users can only see their own orders
    if (req.user.role !== 'admin') {
      query.customer = req.user.id;
    }

    const order = await Order.findOne(query)
      .populate('customer', 'firstName lastName email partyName name')
      .populate('items.product', 'nameRu brand model images salePrice')
      .populate('shipments')
      .populate('payments')
      .populate('createdBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения заказа'
    });
  }
});

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Admin only)
router.patch('/:id/status', protect, restrictTo('admin'), [
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'partially_returned']).withMessage('Неверный статус заказа')
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

    const { status } = req.body;
    const updateData = { status };

    // Set timestamps and users for specific statuses
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = req.user.id;
      if (req.body.cancelReason) {
        updateData.cancelReason = req.body.cancelReason;
      }
    } else if (status === 'returned' || status === 'partially_returned') {
      updateData.returnedAt = new Date();
      updateData.returnedBy = req.user.id;
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('customer', 'firstName lastName email partyName name')
      .populate('items.product', 'nameRu brand model')
      .populate('cancelledBy', 'firstName lastName')
      .populate('returnedBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
    }

    // If order is cancelled, we don't need to restore stock here because 
    // it wasn't deducted at order creation. 
    // If it was shipped, a separate 'Return' process should be used.

    res.json({
      success: true,
      message: 'Статус заказа обновлен',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления статуса заказа'
    });
  }
});

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    let query = { _id: req.params.id };

    // Non-admin users can only cancel their own orders
    if (req.user.role !== 'admin') {
      query.customer = req.user.id;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Заказ нельзя отменить в текущем статусе'
      });
    }

    // Update order
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = req.user.id;
    if (req.body.reason) {
      order.cancelReason = req.body.reason;
    }
    await order.save();

    // No stock restoration needed for Order Cancellation in this workflow.
    // Stock is only handled via Shipments/Returns.

    res.json({
      success: true,
      message: 'Заказ успешно отменен'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка отмены заказа'
    });
  }
});

// @desc    Restore order
// @route   PATCH /api/orders/:id/restore
// @access  Private (Admin only)
router.patch('/:id/restore', protect, restrictTo('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
    }

    // Set back to pending or confirmed
    order.status = 'pending';

    // Clear cancellation/return info
    order.cancelledAt = undefined;
    order.cancelledBy = undefined;
    order.cancelReason = undefined;
    order.returnedAt = undefined;
    order.returnedBy = undefined;

    await order.save();

    res.json({
      success: true,
      message: 'Заказ успешно восстановлен',
      data: order
    });
  } catch (error) {
    console.error('Restore order error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка восстановления заказа'
    });
  }
});

export default router;