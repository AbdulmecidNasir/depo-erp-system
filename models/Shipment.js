import mongoose from 'mongoose';

const shipmentItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0.01, 'Количество должно быть больше 0']
  },
  // Kayıt amaçlı, sipariş anındaki fiyatı da tutabiliriz ama genelde stok hareketi önemlidir
  stockMovementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockMovement'
  }
});

const shipmentSchema = new mongoose.Schema({
  shipmentNumber: {
    type: String,
    unique: true,
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'customerModel', // Order'daki dinamik yapıya uyum sağlar
    required: true
  },
  customerModel: {
    type: String,
    required: true,
    enum: ['User', 'Debitor', 'Supplier'],
    default: 'User'
  },
  items: [shipmentItemSchema],
  status: {
    type: String,
    enum: ['draft', 'ready', 'shipped', 'delivered', 'returned'],
    default: 'draft'
  },
  shippedAt: Date,
  deliveredAt: Date,
  trackingNumber: String,
  shippingMethod: String,
  notes: String,

  totalAmount: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  warehouseManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Otomatik sequential numara üretme
shipmentSchema.pre('validate', async function (next) {
  if (this.isNew && !this.shipmentNumber) {
    try {
      const Counter = mongoose.model('Counter');
      const counter = await Counter.findOneAndUpdate(
        { id: 'shipmentNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      // Format: 000001, 000002, etc.
      this.shipmentNumber = counter.seq.toString().padStart(6, '0');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

export default mongoose.model('Shipment', shipmentSchema);
