import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Количество должно быть больше 0']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Цена не может быть отрицательной']
  },
  total: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'customerModel'
  },
  customerModel: {
    type: String,
    required: true,
    enum: ['User', 'Debitor', 'Supplier'],
    default: 'User'
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'returned', 'partially_returned'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer'],
    default: 'card'
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Россия' }
  },
  notes: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  estimatedDelivery: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelReason: String,
  returnedAt: Date,
  returnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // New Relationships for Advanced Workflow
  shipments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
  }],
  payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],

  // Status Enhancements
  fulfillmentStatus: {
    type: String,
    enum: ['unfulfilled', 'partially_shipped', 'shipped'],
    default: 'unfulfilled'
  },
  salesRecord: { // Link to the final accounting Sale record if fully paid/closed
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Generate sequential order number before validation
orderSchema.pre('validate', async function (next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const Counter = mongoose.model('Counter');
      const counter = await Counter.findOneAndUpdate(
        { id: 'orderNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      // Format: 000001, 000002, etc.
      this.orderNumber = counter.seq.toString().padStart(6, '0');
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Calculate totals before saving
orderSchema.pre('save', function (next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.total = this.subtotal + this.tax + this.shipping;
  next();
});

// Indexes
orderSchema.index({ customer: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model('Order', orderSchema);