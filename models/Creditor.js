import mongoose from 'mongoose';

const creditorSchema = new mongoose.Schema({
  partyName: { type: String, required: [true, 'Название обязательно'], trim: true },
  contact: { type: String, trim: true, default: '' },
  amount: { type: Number, required: [true, 'Сумма обязательна'], min: [0, 'Сумма не может быть отрицательной'] },
  currency: { type: String, default: 'UZS', trim: true },
  dueDate: { type: Date },
  status: { type: String, enum: ['В ожидании', 'Оплачено', 'Не оплачено'], default: 'В ожидании' },
  notes: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

creditorSchema.index({ partyName: 'text', contact: 'text', notes: 'text' });
creditorSchema.set('toJSON', { virtuals: true });
creditorSchema.set('toObject', { virtuals: true });

export default mongoose.model('Creditor', creditorSchema);


