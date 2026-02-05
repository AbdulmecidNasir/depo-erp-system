import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // Short Product ID (6 digits only)
  productId: {
    type: String,
    required: false, // Сделаем необязательным для существующих записей
    unique: true,
    maxlength: [6, 'ID товара не должен превышать 6 символов'],
    minlength: [6, 'ID товара должен содержать 6 символов'],
    match: [/^\d{6}$/, 'ID товара должен содержать только цифры'],
    trim: true
  },
  // Название (optional - for English name)
  name: {
    type: String,
    trim: true,
    default: ''
  },
  // Название (RU) * - Required
  nameRu: {
    type: String,
    required: [true, 'Название обязательно'],
    trim: true
  },
  // Бренд * - Required
  brand: {
    type: String,
    required: [true, 'Бренд обязателен'],
    trim: true
  },
  // Модель (optional)
  model: {
    type: String,
    trim: true,
    default: ''
  },
  // Вариант/Модификация (optional)
  variant: {
    type: String,
    trim: true,
    default: ''
  },
  // Категория * - Required
  category: {
    type: String,
    required: [true, 'Категория обязательна'],
    trim: true,
    lowercase: true
  },
  // ABC Sınıfı (A: Yüksek Değer/Hız, B: Orta, C: Düşük)
  abcClass: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: 'C',
    index: true
  },
  // Штрихкод (необязательно) - Optional
  barcode: {
    type: String,
    unique: true,
    required: false,
    sparse: true // Allows multiple null values
  },
  // Локация на складе * - Required
  location: {
    type: String,
    required: [true, 'Локация на складе обязательна'],
    trim: true
  },
  // Изображение товара - Optional
  image: {
    type: String,
    default: ''
  },
  // Multiple images support
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: String,
    alt: String
  }],
  // Цена закупки (сўм) * - Required
  purchasePrice: {
    type: Number,
    required: [true, 'Цена закупки обязательна'],
    min: [0.01, 'Цена закупки должна быть положительной']
  },
  // Оптовая цена (сўм) - Optional
  wholesalePrice: {
    type: Number,
    default: 0,
    min: [0, 'Оптовая цена не может быть отрицательной']
  },
  // Цена продажи (сўм) * - Required
  salePrice: {
    type: Number,
    required: [true, 'Цена продажи обязательна'],
    min: [0.01, 'Цена продажи должна быть положительной']
  },
  // Количество на складе * - Required
  stock: {
    type: Number,
    required: [true, 'Количество на складе обязательно'],
    min: [0, 'Количество не может быть отрицательным'],
    default: 0
  },
  // Location-based stock tracking
  locationStock: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // Мин. остаток - Optional (default 10)
  minStock: {
    type: Number,
    default: 10,
    min: [0, 'Минимальный остаток не может быть отрицательным']
  },
  // Описание (EN) - Optional
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Описание (RU) * - Required
  descriptionRu: {
    type: String,
    required: [true, 'Описание (RU) обязательно'],
    trim: true
  },
  // Технические характеристики - Optional
  specifications: {
    type: Map,
    of: String,
    default: new Map()
  },
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  soldCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
productSchema.index({ productId: 1 });
productSchema.index({ name: 'text', nameRu: 'text', brand: 'text', model: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ createdAt: -1 });

// Virtual for low stock check
productSchema.virtual('isLowStock').get(function () {
  return this.stock < this.minStock;
});

// Virtual for out of stock check
productSchema.virtual('isOutOfStock').get(function () {
  return this.stock === 0;
});

// Function to generate unique product ID
productSchema.statics.generateProductId = async function () {
  const chars = '0123456789'; // Только цифры
  let productId;
  let isUnique = false;

  while (!isUnique) {
    // Generate 6-digit ID
    productId = '';
    for (let i = 0; i < 6; i++) {
      productId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if ID already exists
    const existing = await this.findOne({ productId });
    if (!existing) {
      isUnique = true;
    }
  }

  return productId;
};

// Generate productId and barcode before saving
productSchema.pre('save', async function (next) {
  // Generate productId if not provided
  if (!this.productId) {
    this.productId = await this.constructor.generateProductId();
  }

  // Generate barcode if not provided
  if (!this.barcode) {
    let barcode;
    let isUnique = false;

    while (!isUnique) {
      barcode = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const existingProduct = await this.constructor.findOne({ barcode });
      if (!existingProduct) {
        isUnique = true;
      }
    }

    this.barcode = barcode;
  }
  next();
});

// Transform output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export default mongoose.model('Product', productSchema);