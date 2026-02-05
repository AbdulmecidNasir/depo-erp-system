import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Код локации обязателен'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Название локации обязательно'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  capacity: {
    type: Number,
    required: [true, 'Вместимость обязательна'],
    min: [0, 'Вместимость не может быть отрицательной'],
    default: 0
  },
  currentOccupancy: {
    type: Number,
    min: [0, 'Текущая занятость не может быть отрицательной'],
    default: 0
  },
  zone: {
    type: String,
    required: [true, 'Зона обязательна'],
    uppercase: true
  },
  level: {
    type: Number,
    required: [true, 'Уровень обязателен'],
    min: [1, 'Уровень должен быть больше 0']
  },
  section: {
    type: Number,
    required: [true, 'Секция обязательна'],
    min: [1, 'Секция должна быть больше 0']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
locationSchema.index({ zone: 1, level: 1, section: 1 });
locationSchema.index({ code: 1 });

// Virtual for utilization percentage
locationSchema.virtual('utilization').get(function () {
  return this.capacity > 0 ? (this.currentOccupancy / this.capacity) * 100 : 0;
});

// Ensure virtual fields are serialized
locationSchema.set('toJSON', { virtuals: true });
locationSchema.set('toObject', { virtuals: true });

export default mongoose.model('Location', locationSchema);
