import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import AuditLog from '../models/AuditLog.js';
import Shift from '../models/Shift.js';
import { protect, restrictTo as authorize } from '../middleware/auth.js';

const router = express.Router();

// GET all sales (with filtering)
router.get('/', protect, async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            startDate, endDate,
            status, search,
            minAmount, maxAmount
        } = req.query;

        const query = { isDeleted: false };

        // Date Range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Status
        if (status) query.status = status;
        // Hide parked by default unless asked? Or usually separate endpoint. 
        // Let's keep general list for 'completed', 'returned' etc. behavior configurable.
        if (!status) {
            query.status = { $in: ['completed', 'returned', 'partially_returned', 'cancelled'] };
        }

        // Search
        if (search) {
            query.$text = { $search: search };
        }

        const sales = await Sale.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('cashierId', 'firstName lastName email')
            .populate('items.productId', 'name brand');

        const total = await Sale.countDocuments(query);

        res.json({
            success: true,
            data: sales,
            meta: {
                total,
                page: Number(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// CREATE Sale
router.post('/', protect, async (req, res) => {
    const session = await Sale.startSession();
    session.startTransaction();

    try {
        const { items, payments, customerId, notes, type, branchId } = req.body;

        // 1. Calculate totals
        let totalUZS = 0;
        let totalUSD = 0;

        // Validate items and check stock
        for (const item of items) {
            const product = await Product.findById(item.productId).session(session);
            if (!product) throw new Error(`Product not found: ${item.productId}`);

            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
            }

            // Update Stock
            product.stock -= item.quantity;
            await product.save({ session });

            // Calculate item total (simplified logic, assuming item.currency matches item.price)
            const itemTotal = item.quantity * item.unitPrice;
            if (item.currency === 'USD') totalUSD += itemTotal;
            else totalUZS += itemTotal; // Default UZS
        }

        // Generate Invoice Number (Simple format)
        const count = await Sale.countDocuments();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(6, '0')}`;

        // Create Sale
        const sale = new Sale({
            invoiceNumber,
            branchId: branchId || 'main', // Default branch if not provided
            cashierId: req.user._id,
            customerId,
            items,
            payments,
            status: 'completed',
            type: type || 'retail',
            totalAmountUZS: payments.filter(p => p.currency === 'UZS').reduce((a, b) => a + b.amount, 0),
            totalAmountUSD: payments.filter(p => p.currency === 'USD').reduce((a, b) => a + b.amount, 0),
            notes
        });

        await sale.save({ session });

        // Update Shift Totals (if shift tracking is enabled/active)
        // Find active shift for user
        const shift = await Shift.findOne({ cashierId: req.user._id, status: 'open' }).session(session);
        if (shift) {
            // Add cash payments
            const cashPayments = payments.filter(p => p.method === 'cash');
            shift.totalSalesCashUZS += cashPayments.filter(p => p.currency === 'UZS').reduce((a, b) => a + b.amount, 0);
            shift.totalSalesCashUSD += cashPayments.filter(p => p.currency === 'USD').reduce((a, b) => a + b.amount, 0);

            // Add card payments
            const cardPayments = payments.filter(p => p.method === 'card');
            shift.totalSalesCardUZS += cardPayments.filter(p => p.currency === 'UZS').reduce((a, b) => a + b.amount, 0);
            shift.totalSalesCardUSD += cardPayments.filter(p => p.currency === 'USD').reduce((a, b) => a + b.amount, 0);

            await shift.save({ session });
        }

        await session.commitTransaction();
        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

// PARK Sale
router.post('/park', protect, async (req, res) => {
    try {
        const { items, customerId, notes } = req.body;

        // Use dummy invoice number for parked
        const invoiceNumber = `PARK-${Date.now()}`;

        const sale = new Sale({
            invoiceNumber,
            branchId: 'main',
            cashierId: req.user._id,
            customerId,
            items,
            status: 'parked',
            parkedAt: new Date(),
            parkedBy: req.user.firstName,
            notes,
            totalAmountUZS: items.filter(i => i.currency === 'UZS').reduce((a, b) => a + b.totalPrice, 0),
            totalAmountUSD: items.filter(i => i.currency === 'USD').reduce((a, b) => a + b.totalPrice, 0),
        });

        await sale.save();
        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET Parked Sales
router.get('/parked', protect, async (req, res) => {
    try {
        const sales = await Sale.find({ status: 'parked', isDeleted: false })
            .sort({ parkedAt: -1 })
            .populate('items.productId', 'name');
        res.json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// SOFT DELETE / CANCEL
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
    const session = await Sale.startSession();
    session.startTransaction();
    try {
        const { reason } = req.body;
        const sale = await Sale.findById(req.params.id).session(session);

        if (!sale) throw new Error('Sale not found');
        if (sale.isDeleted) throw new Error('Already deleted');
        if (sale.status === 'completed') {
            // Revert Stock
            for (const item of sale.items) {
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: item.quantity } },
                    { session }
                );
            }
        }

        sale.isDeleted = true;
        sale.deletedAt = new Date();
        sale.deletedBy = req.user._id;
        sale.deleteReason = reason || 'Cancelled by admin';
        sale.status = 'cancelled';

        await sale.save({ session });

        // Create Audit Log
        await AuditLog.create([{
            action: 'DELETE_SALE',
            entity: 'Sale',
            entityId: sale._id,
            performedBy: req.user._id,
            details: { reason, invoiceNumber: sale.invoiceNumber },
            ipAddress: req.ip
        }], { session });

        await session.commitTransaction();
        res.json({ success: true, message: 'Sale cancelled and stock reverted' });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

// GET Deleted Sales (Audit)
router.get('/deleted', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const sales = await Sale.find({ isDeleted: true })
            .sort({ deletedAt: -1 })
            .populate('deletedBy', 'firstName lastName');
        res.json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
