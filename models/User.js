import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true,
    maxlength: [50, 'Имя не может быть длиннее 50 символов']
  },
  lastName: {
    type: String,
    required: [true, 'Фамилия обязательна'],
    trim: true,
    maxlength: [50, 'Фамилия не может быть длиннее 50 символов']
  },
  email: {
    type: String,
    required: [true, 'Email обязателен'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Введите корректный email'
    ]
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [6, 'Пароль должен содержать минимум 6 символов'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'sales_manager', 'warehouse_manager', 'warehouse_staff', 'cashier', 'customer'],
    default: 'customer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Название компании не может быть длиннее 100 символов'],
    default: ''
  },
  position: {
    type: String,
    trim: true,
    maxlength: [100, 'Должность не может быть длиннее 100 символов'],
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Описание не может быть длиннее 500 символов'],
    default: ''
  },
  profilePhotoUrl: {
    type: String,
    default: ''
  },
  // Settings fields
  language: {
    type: String,
    enum: ['ru', 'en', 'tr'],
    default: 'ru'
  },
  timezone: {
    type: String,
    default: 'Europe/Moscow'
  },
  dateFormat: {
    type: String,
    enum: ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
    default: 'DD.MM.YYYY'
  },
  currency: {
    type: String,
    enum: ['RUB', 'USD', 'EUR', 'TRY', 'UZS'],
    default: 'RUB'
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  colorScheme: {
    type: String,
    default: 'blue'
  },
  sidebarCollapsed: {
    type: Boolean,
    default: false
  },
  fontSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  notificationFrequency: {
    type: String,
    enum: ['immediate', 'hourly', 'daily', 'weekly'],
    default: 'immediate'
  },
  soundAlerts: {
    type: Boolean,
    default: true
  },
  dataExportEnabled: {
    type: Boolean,
    default: true
  },
  privacyLevel: {
    type: String,
    enum: ['public', 'standard', 'private'],
    default: 'standard'
  },
  companyName: {
    type: String,
    trim: true,
    maxlength: [100, 'Название компании не может быть длиннее 100 символов'],
    default: ''
  },
  companyAddress: {
    type: String,
    trim: true,
    maxlength: [500, 'Адрес компании не может быть длиннее 500 символов'],
    default: ''
  },
  taxId: {
    type: String,
    trim: true,
    maxlength: [50, 'Налоговый ID не может быть длиннее 50 символов'],
    default: ''
  },
  invoicePrefix: {
    type: String,
    trim: true,
    maxlength: [10, 'Префикс инвойса не может быть длиннее 10 символов'],
    default: 'INV'
  },
  fiscalYearStart: {
    type: String,
    maxlength: [10, 'Начало фискального года не может быть длиннее 10 символов'],
    default: '01-01'
  },
  apiKeys: [{
    id: String,
    name: String,
    key: String,
    createdAt: String,
    lastUsed: String
  }],
  connectedServices: [{
    id: String,
    name: String,
    status: {
      type: String,
      enum: ['connected', 'disconnected'],
      default: 'disconnected'
    },
    lastSync: String
  }],
  sessions: [{
    id: String,
    device: String,
    location: String,
    ip: String,
    userAgent: String,
    lastActive: {
      type: Date,
      default: Date.now
    }
  }],
  webhooks: [{
    id: String,
    url: String,
    events: [String],
    active: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Transform output
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export default mongoose.model('User', userSchema);