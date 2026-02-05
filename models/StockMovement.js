import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  // Unique movement ID (6 digits only)
  movementId: {
    type: String,
    required: false, // Сделаем необязательным для существующих записей
    unique: true,
    maxlength: [6, 'ID движения не должен превышать 6 символов'],
    minlength: [6, 'ID движения должен содержать 6 символов'],
    match: [/^\d{6}$/, 'ID движения должен содержать только цифры'],
    trim: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'ID продукта обязателен']
  },
  type: {
    type: String,
    default: 'transfer',
    enum: ['in', 'out', 'transfer', 'adjustment']
  },
  quantity: {
    type: Number,
    required: [true, 'Количество обязательно'],
    min: [1, 'Количество должно быть положительным числом']
  },
  fromLocation: {
    type: String,
    trim: true
  },
  toLocation: {
    type: String,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID пользователя обязателен']
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  notes: {
    type: String,
    trim: true
  },
  batchNumber: {
    type: String,
    trim: true,
    index: true // Add index for faster grouping queries
  },
  purchasePrice: {
    type: Number,
    min: [0, 'Цена закупки не может быть отрицательной']
  },
  wholesalePrice: {
    type: Number,
    min: [0, 'Оптовая цена не может быть отрицательной']
  },
  salePrice: {
    type: Number,
    min: [0, 'Цена продажи не может быть отрицательной']
  },
  status: {
    type: String,
    enum: ['draft', 'completed'],
    default: 'completed',
    index: true
  },
  deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deleteReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
stockMovementSchema.index({ movementId: 1 });
stockMovementSchema.index({ productId: 1, timestamp: -1 });
stockMovementSchema.index({ type: 1, timestamp: -1 });
stockMovementSchema.index({ userId: 1, timestamp: -1 });
stockMovementSchema.index({ timestamp: -1 });

// Transform output
stockMovementSchema.set('toJSON', { virtuals: true });
stockMovementSchema.set('toObject', { virtuals: true });

// Function to generate unique sequential movement ID
stockMovementSchema.statics.generateMovementId = async function () {
  // Use aggregation to find the maximum numeric movementId efficiently
  const result = await this.aggregate([
    {
      $match: {
        movementId: { $exists: true, $ne: null, $regex: /^\d{6}$/ }
      }
    },
    {
      $project: {
        numericId: {
          $convert: {
            input: '$movementId',
            to: 'int',
            onError: null,
            onNull: null
          }
        }
      }
    },
    {
      $match: {
        numericId: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        maxNumber: { $max: '$numericId' }
      }
    }
  ]);

  // Get the maximum number, or 0 if no movements exist
  const maxNumber = result.length > 0 && result[0].maxNumber !== null ? result[0].maxNumber : 0;

  // Next number is maxNumber + 1, or 1 if no movements exist
  const nextNumber = maxNumber + 1;

  // Format as 6-digit string with leading zeros
  const movementId = String(nextNumber).padStart(6, '0');

  // Double-check uniqueness (in case of race condition)
  const existing = await this.findOne({ movementId });
  if (existing) {
    // If somehow it exists, find the next available number
    let checkNumber = nextNumber + 1;
    let found = false;
    while (!found && checkNumber < 999999) {
      const checkId = String(checkNumber).padStart(6, '0');
      const checkExisting = await this.findOne({ movementId: checkId });
      if (!checkExisting) {
        return checkId;
      }
      checkNumber++;
    }
    throw new Error('Не удалось сгенерировать уникальный ID движения');
  }

  return movementId;
};

// Middleware to generate movementId if not provided
stockMovementSchema.pre('save', async function (next) {
  if (!this.movementId) {
    this.movementId = await this.constructor.generateMovementId();
  }
  next();
});

export default mongoose.model('StockMovement', stockMovementSchema);
