import express from 'express';
import { body, validationResult } from 'express-validator';
import Creditor from '../models/Creditor.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// GET /api/creditors
router.get('/', protect, restrictTo('admin', 'cashier', 'sales_manager'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    const query = { isActive: true };
    if (status) query.status = status;
    if (search) query.$text = { $search: search };

    const [items, total] = await Promise.all([
      Creditor.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Creditor.countDocuments(query)
    ]);

    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Не удалось получить список кредиторов' });
  }
});

// POST /api/creditors
router.post('/', protect, restrictTo('admin', 'cashier', 'sales_manager'), [
  body('partyName').trim().notEmpty().withMessage('Название обязательно'),
  body('amount').isFloat({ min: 0 }).withMessage('Сумма не может быть отрицательной'),
  body('status').optional().isIn(['В ожидании', 'Оплачено', 'Не оплачено']).withMessage('Неверный статус')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Ошибка валидации', errors: errors.array() });
  }

  try {
    const doc = await Creditor.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Не удалось создать кредитора' });
  }
});

// PUT /api/creditors/:id
router.put('/:id', protect, restrictTo('admin', 'cashier'), [
  body('partyName').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['В ожидании', 'Оплачено', 'Не оплачено'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Ошибка валидации', errors: errors.array() });
  }
  try {
    const updated = await Creditor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Запись не найдена' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Не удалось обновить запись' });
  }
});

// PATCH /api/creditors/:id/status
router.patch('/:id/status', protect, restrictTo('admin', 'cashier'), [
  body('status').isIn(['В ожидании', 'Оплачено', 'Не оплачено']).withMessage('Неверный статус')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Ошибка валидации', errors: errors.array() });
  }
  try {
    const updated = await Creditor.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Запись не найдена' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Не удалось обновить статус' });
  }
});

// DELETE /api/creditors/:id (soft delete)
router.delete('/:id', protect, restrictTo('admin', 'cashier'), async (req, res) => {
  try {
    const doc = await Creditor.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Запись не найдена' });
    doc.isActive = false;
    await doc.save();
    res.json({ success: true, message: 'Запись удалена' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Не удалось удалить запись' });
  }
});

export default router;


