import express from 'express';
import Shift from '../models/Shift.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// START Shift
router.post('/start', protect, async (req, res) => {
    try {
        const { openingBalanceUZS = 0, openingBalanceUSD = 0, terminalId } = req.body;

        // Check if user already has open shift
        const existingShift = await Shift.findOne({
            cashierId: req.user._id,
            status: 'open'
        });

        if (existingShift) {
            return res.status(400).json({
                success: false,
                message: 'У вас уже есть открытая смена'
            });
        }

        const shift = await Shift.create({
            cashierId: req.user._id,
            branchId: 'main', // Default
            terminalId: terminalId || 'POS-01',
            openingBalanceUZS,
            openingBalanceUSD,
            startTime: new Date(),
            status: 'open'
        });

        res.status(201).json({ success: true, data: shift });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET Current Active Shift
router.get('/current', protect, async (req, res) => {
    try {
        const shift = await Shift.findOne({
            cashierId: req.user._id,
            status: 'open'
        });

        if (!shift) {
            return res.json({ success: true, data: null });
        }

        res.json({ success: true, data: shift });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CLOSE Shift (Z-Report)
router.post('/end', protect, async (req, res) => {
    try {
        const { closingBalanceActualUZS, closingBalanceActualUSD, notes } = req.body;

        const shift = await Shift.findOne({
            cashierId: req.user._id,
            status: 'open'
        });

        if (!shift) {
            return res.status(404).json({ success: false, message: 'Нет активной смены' });
        }

        // Calculate theoretical closing balance
        shift.closingBalanceTheoreticalUZS = shift.openingBalanceUZS + shift.totalSalesCashUZS - shift.totalReturnsUZS;
        shift.closingBalanceTheoreticalUSD = shift.openingBalanceUSD + shift.totalSalesCashUSD - shift.totalReturnsUSD;

        shift.closingBalanceActualUZS = closingBalanceActualUZS;
        shift.closingBalanceActualUSD = closingBalanceActualUSD;

        shift.endTime = new Date();
        shift.status = 'closed';
        shift.notes = notes;

        await shift.save();

        res.json({ success: true, data: shift });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET Shift History
router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const shifts = await Shift.find({ cashierId: req.user._id }) // Managers might see all
            .sort({ startTime: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ success: true, data: shifts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
