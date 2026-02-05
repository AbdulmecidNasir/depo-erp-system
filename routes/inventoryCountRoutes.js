import express from 'express';
import {
    createSession,
    getSessionLines,
    addCountLines,
    submitSession,
    approveSession,
    syncInventory
} from '../controllers/inventoryCountController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import CountSession from '../models/CountSession.js';

const router = express.Router();

// Middleware: Sadece yetkili kullanıcılar
router.use(protect);

// 1. Sayım Oturumu İşlemleri
router.post('/sessions', restrictTo('admin', 'manager'), createSession);

router.get('/sessions', async (req, res) => {
    // Tüm oturumları listele (Basit listeleme)
    try {
        const sessions = await CountSession.find().sort({ createdAt: -1 }).limit(20);
        res.json({ success: true, data: sessions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Sayım Detayları ve Giriş
router.get('/:sessionId/lines', getSessionLines);
router.post('/:sessionId/lines', addCountLines); // Sayım girişi (Personel)

// 3. Süreç Yönetimi
router.patch('/:sessionId/submit', submitSession); // Bitir ve Onaya Gönder
router.post('/:sessionId/approve', restrictTo('admin'), approveSession); // KesinOnay (Stok Düzeltme)

// 4. Sistem Araçları
router.post('/sync', restrictTo('admin'), syncInventory); // Inventory <-> Product Sync

export default router;
