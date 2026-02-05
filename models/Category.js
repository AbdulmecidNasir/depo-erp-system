import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  slug: {
    type: String,
    required: [true, 'Идентификатор категории обязателен'],
    unique: true,
    trim: true,
    lowercase: true
  },
  nameRu: {
    type: String,
    required: [true, 'Название категории обязательно'],
    trim: true
  },
  icon: {
    type: String,
    default: ''
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ nameRu: 1 });

export default mongoose.model('Category', categorySchema);


