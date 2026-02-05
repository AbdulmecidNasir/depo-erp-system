import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import Shipment from '../models/Shipment.js';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';

const router = express.Router();

// @desc    Get unified financial transactions (Shipments as Expenses, Payments as Income)
// @route   GET /api/finance/unified
router.get('/unified', protect, async (req, res) => {
    try {
        const { startDate, endDate, customerId, sellerId } = req.query;

        const dateQuery = {};
        if (startDate || endDate) {
            dateQuery.$gte = startDate ? new Date(startDate) : new Date(0);
            dateQuery.$lte = endDate ? new Date(endDate) : new Date();
        }

        // 1. Fetch Shipments (Expenses)
        const shipmentQuery = {};
        if (startDate || endDate) shipmentQuery.shippedAt = dateQuery;
        if (customerId) shipmentQuery.customer = customerId;
        if (sellerId) shipmentQuery.createdBy = sellerId;

        const shipments = await Shipment.find(shipmentQuery)
            .populate('customer', 'firstName lastName partyName name')
            .populate('order', 'orderNumber paymentStatus total items')
            .populate('createdBy', 'firstName lastName')
            .sort({ shippedAt: -1 });

        // 2. Fetch Payments (Incomes/Outcomes)
        const paymentQuery = {};
        if (startDate || endDate) paymentQuery.transactionDate = dateQuery;
        if (customerId) paymentQuery.customer = customerId;
        if (sellerId) paymentQuery.createdBy = sellerId;

        const payments = await Payment.find(paymentQuery)
            .populate('customer', 'firstName lastName partyName name')
            .populate('order', 'orderNumber status items shipments')
            .populate('createdBy', 'firstName lastName')
            .sort({ transactionDate: -1 });

        // 3. Transform and Merge
        const unified = [
            ...shipments.map(s => ({
                id: s._id,
                date: s.shippedAt || s.createdAt,
                type: 'expense', // 'Расход' - Shipment is taking goods out
                category: 'Отгрузка',
                amount: s.totalAmount || 0,
                description: `Отгрузка #${s.shipmentNumber}`,
                customer: s.customer,
                order: s.order,
                paymentStatus: s.order?.paymentStatus || 'unknown',
                createdBy: s.createdBy,
                referenceId: s.shipmentNumber
            })),
            ...payments.map(p => ({
                id: p._id,
                date: p.transactionDate,
                type: p.type === 'out' ? 'expense' : 'income', // Payment can be in or out
                category: 'Оплата',
                amount: p.amount,
                description: p.notes || `Оплата по заказу #${p.order?.orderNumber || '---'}`,
                customer: p.customer,
                order: p.order,
                paymentStatus: p.order?.paymentStatus || p.status,
                createdBy: p.createdBy,
                referenceId: p.paymentNumber
            }))
        ];

        // Sort by date DESC
        unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.json({
            success: true,
            count: unified.length,
            data: unified
        });
    } catch (error) {
        console.error('Unified finance error:', error);
        res.status(500).json({ success: false, message: 'Ошибка при получении финансовых данных' });
    }
});

export default router;
