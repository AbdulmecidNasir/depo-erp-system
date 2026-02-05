import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Create a shipment (Dispatch goods)
// @route   POST /api/shipments
// @access  Private
router.post('/', protect, restrictTo('admin', 'sales_manager', 'warehouse_manager'), [
    body('orderId').isMongoId().withMessage('Geçersiz Sipariş ID'),
    body('items').isArray({ min: 1 }).withMessage('En az bir ürün seçilmelidir'),
    body('items.*.product').isMongoId().withMessage('Geçersiz Ürün ID'),
    body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Miktar geçersiz')
], async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { orderId, items, notes, trackingNumber } = req.body;

        // 1. Siparişi bul
        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new Error('Sipariş bulunamadı');
        }

        // 2. Stok Kontrolü ve Düşümü
        const shipmentItems = [];

        for (const item of items) {
            const product = await Product.findById(item.product).session(session);
            if (!product) {
                throw new Error(`Ürün bulunamadı: ${item.product}`);
            }

            if (product.stock < item.quantity) {
                throw new Error(`Yetersiz stok: ${product.nameRu}. Mevcut: ${product.stock}, İstenen: ${item.quantity}`);
            }

            // Stok Düşümü (Fiziksel Hareket)
            product.stock -= item.quantity;
            product.soldCount = (product.soldCount || 0) + item.quantity;
            await product.save({ session });

            // StockMovement Kaydı (Denetim izi için)
            const movement = await StockMovement.create([{
                productId: product._id,
                type: 'out',
                quantity: item.quantity,
                fromLocation: 'Warehouse', // Varsayılan depo
                toLocation: 'Customer',
                userId: req.user.id,
                notes: `Shipment for Order #${order.orderNumber}`,
                status: 'completed'
            }], { session });

            shipmentItems.push({
                product: product._id,
                quantity: item.quantity,
                stockMovementId: movement[0]._id
            });
        }

        // 3. Shipment Belgesi Oluştur
        let totalAmount = 0;
        let totalCost = 0;

        for (const item of items) {
            const product = await Product.findById(item.product).session(session);
            // find original order price for this product
            const orderItem = order.items.find(oi => oi.product.toString() === item.product.toString());
            const price = orderItem ? orderItem.price : (product.salePrice || 0);

            totalAmount += price * item.quantity;
            totalCost += (product.purchasePrice || 0) * item.quantity;
        }

        const shipment = await Shipment.create([{
            order: order._id,
            shipmentNumber: `SHP-${Date.now()}`, // Model hook'u olsa da burada da set edebiliriz
            customer: order.customer,
            customerModel: order.customerModel,
            items: shipmentItems,
            status: 'shipped',
            shippedAt: new Date(),
            trackingNumber,
            notes,
            totalAmount,
            totalCost,
            warehouseManager: req.user.id,
            createdBy: order.createdBy // Fix salesperson from original order
        }], { session });

        // 4. Sipariş Durumunu Güncelle
        order.shipments.push(shipment[0]._id);

        // Basit bir mantıkla: Eğer sipariş edilen ürünlerin hepsi sevk edildiyse 'shipped', yoksa 'partially_shipped'
        // Detaylı kontrol gerekirse siparişin tüm itemlarını looplayıp karşılaştırmak gerekir.
        // Şimdilik basitleştirilmiş:
        order.fulfillmentStatus = 'shipped';
        order.status = 'shipped';

        await order.save({ session });

        await session.commitTransaction();

        res.status(201).json({
            success: true,
            message: 'Sevkiyat başarıyla oluşturuldu',
            data: shipment[0]
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Shipment creation error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Sevkiyat oluşturulurken hata oluştu'
        });
    } finally {
        session.endSession();
    }
});

// @desc    Get Shipments for an Order
// @route   GET /api/shipments/order/:orderId
router.get('/order/:orderId', protect, async (req, res) => {
    try {
        const shipments = await Shipment.find({ order: req.params.orderId })
            .populate('items.product', 'nameRu brand model')
            .populate('createdBy', 'name');

        res.json({ success: true, count: shipments.length, data: shipments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Sevkiyatlar getirilemedi' });
    }
});

// @desc    Get All Shipments
// @route   GET /api/shipments
router.get('/', protect, async (req, res) => {
    try {
        const shipments = await Shipment.find()
            .populate({
                path: 'order',
                select: 'orderNumber total items createdBy',
                populate: { path: 'createdBy', select: 'firstName lastName' }
            })
            .populate('customer', 'firstName lastName partyName name')
            .populate('items.product', 'nameRu brand model stock salePrice')
            .populate('warehouseManager', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: shipments.length, data: shipments });
    } catch (error) {
        console.error('Error fetching shipments:', error);
        res.status(500).json({ success: false, message: 'Sevkiyatlar getirilemedi' });
    }
});

export default router;
