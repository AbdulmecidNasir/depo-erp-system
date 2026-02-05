import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import Sale from '../models/Sale.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Add Payment to Order (Finalize Sale)
// @route   POST /api/payments
// @access  Private
router.post('/', protect, restrictTo('admin', 'cashier'), [
    body('orderId').optional().isMongoId(),
    body('order').optional().isMongoId(),
    body('amount').isFloat({ min: 0.01 }).withMessage('Tutar geçersiz'),
    body('method').isIn(['cash', 'card', 'bank_transfer', 'other']).withMessage('Geçersiz ödeme yöntemi')
], async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { orderId, order: orderRef, amount, method, notes, status, type, description } = req.body;
        const targetOrderId = orderId || orderRef;
        if (!targetOrderId) throw new Error('Sipariş ID gerekli');

        const order = await Order.findById(targetOrderId).session(session);
        if (!order) {
            throw new Error('Sipariş bulunamadı');
        }

        // 1. Ödeme Kaydı Oluştur
        const payment = await Payment.create([{
            order: order._id,
            customer: order.customer,
            customerModel: order.customerModel,
            amount,
            method,
            notes,
            status: status || 'completed',
            type: type || 'in',
            description,
            createdBy: req.user.id,
        }], { session });

        // 2. Siparişe Ödemeyi Ekle
        order.payments.push(payment[0]._id);

        // Toplam ödenen tutarı hesapla
        // Mevcut ödemeleri çekip toplamak daha güvenli olabilir ama burada pratiklik için:
        // (Gerçek hayatta Order üzerinde 'paidAmount' gibi kümülatif bir alan tutmak performansı artırır)
        // Burada basitçe yeni ödemeyi ekliyoruz.

        // 3. Sipariş Durumunu Kontrol Et
        // Not: Burada daha önce yapılan ödemeleri de hesaba katmak lazım.
        // Bu örnekte sadece bu payment ile tam kapandığını varsayıyoruz veya kontrol ediyoruz.
        // Basit bir yaklaşım yapalım:

        // Tüm ödemeleri topla (yeni eklenen dahil değil çünkü o return array'de, henüz DB'de commit olmadı ama transaction içinde find yaparsak gelir mi? 
        // En iyisi kümülatif toplama logic'i eklemek.
        // Şimdilik varsayım: Eğer client "Tam Ödeme" diyorsa veya tutar order.total'e eşitse.

        let isFullPayment = false;

        // Mevcut kodda order.payments sadece ID listesi.
        // Hepsini populate etmeden toplamı bilemeyiz.
        // Basitlik adina: Backend'de aggregation yapabiliriz ama şimdilik client responsibility diyelim 
        // veya sale oluşturmayı her ödeme aldığında SALE oluşturarak "Kısmi Sale" yapalım?
        // Hayır, kullanıcı "Konsinye -> Kesin Satış" dediği için, TAM ÖDEME alındığında Sale oluşturmak en temizidir.

        // Diyelim ki bu ödeme ile sipariş tamamen ödenmiş kabul ediliyor mu?
        // Backend hesaplaması:
        // const totalPaid = (await Payment.find({ order: order._id }).session(session)).reduce((acc, curr) => acc + curr.amount, 0) + amount; // (yeni payment zaten create edildi mi? Eve, transaction içinde.)

        // Payment.create yukarıda yapıldı. session ile find yapılabilir.
        const allPayments = await Payment.find({ order: order._id }).session(session);
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        if (totalPaid >= order.total - 0.01) { // Floating point toleransı
            isFullPayment = true;
            order.paymentStatus = 'paid';
            order.status = 'completed'; // Order kapandı
        } else {
            order.paymentStatus = 'partially_paid';
        }

        await order.save({ session });

        // 4. Gelir Kaydı (Sale) Oluşturma (Muhasebeleştirme)
        // Sadece tam ödeme alındığında mı? Yoksa her ödemede mi?
        // Muhasebeciler genelde her tahsilat için "Tahsilat Makbuzu" keser, ama "Fatura" (Invoice) tek olur.
        // Sale modelimiz Invoice gibi duruyor.
        // Eğer isFullPayment ise Faturayı keselim (Sale).

        let sale = null;
        if (isFullPayment && !order.salesRecord) {
            sale = await Sale.create([{
                invoiceNumber: `INV-${order.orderNumber}`, // Sipariş no ile ilişkili
                branchId: 'MAIN', // Varsayılan
                cashierId: req.user.id,
                customerId: order.customer,
                status: 'completed',
                type: 'wholesale', // B2B olduğu için
                totalAmountUZS: order.total, // Currency varsayılan UZS

                // Kalemleri aktar
                items: order.items.map(item => ({
                    productId: item.product, // ID
                    name: 'Product Name Fetch Needed', // Populate gerekebilir veya basitleştirmek için atla
                    quantity: item.quantity,
                    unitPrice: item.price,
                    totalPrice: item.total
                })),

                payments: allPayments.map(p => ({
                    method: p.method,
                    amount: p.amount,
                    currency: p.currency || 'UZS'
                })),

                notes: `Generated from Order #${order.orderNumber}`
            }], { session });

            order.salesRecord = sale[0]._id;
            await order.save({ session });
        }

        await session.commitTransaction();

        res.status(201).json({
            success: true,
            message: 'Ödeme başarıyla alındı',
            data: payment[0],
            isOrderCompleted: isFullPayment,
            saleId: sale ? sale[0]._id : null
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Payment creation error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Ödeme alınırken hata oluştu'
        });
    } finally {
        session.endSession();
    }
});

// @desc    Get Payments for an Order
router.get('/order/:orderId', protect, async (req, res) => {
    try {
        const payments = await Payment.find({ order: req.params.orderId }).populate('createdBy', 'name');
        res.json({ success: true, count: payments.length, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Ödemeler getirilemedi' });
    }
});

// @desc    Get All Payments (with filters)
router.get('/', protect, async (req, res) => {
    try {
        const { startDate, endDate, sellerId, productId, customerId, status, type, limit = 50, page = 1 } = req.query;

        const query = {};

        // Status Filter
        if (status) {
            query.status = status;
        }

        // Type Filter
        if (type) {
            query.type = type;
        }

        // Date Filter
        if (startDate || endDate) {
            query.transactionDate = {};
            if (startDate) query.transactionDate.$gte = new Date(startDate);
            if (endDate) query.transactionDate.$lte = new Date(endDate);
        }

        // Seller Filter
        if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
            query.createdBy = sellerId;
        }

        // Customer Filter
        if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
            query.customer = customerId;
        }

        // Product Filter (Cross-reference via Orders)
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            // Find orders containing this product
            const ordersWithProduct = await Order.find({ 'items.product': productId }).select('_id');
            const orderIds = ordersWithProduct.map(o => o._id);
            query.order = { $in: orderIds };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const payments = await Payment.find(query)
            .populate('customer', 'firstName lastName email partyName name phone') // Support User or Debitor schema fields
            .populate({
                path: 'order',
                select: 'orderNumber total status items createdAt estimatedDelivery shipments',
                populate: [
                    {
                        path: 'items.product',
                        select: 'name nameRu brand model'
                    },
                    {
                        path: 'shipments',
                        select: 'shippedAt deliveredAt status'
                    }
                ]
            })
            .populate('createdBy', 'firstName lastName')
            .sort({ transactionDate: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Payment.countDocuments(query);

        res.json({
            success: true,
            count: payments.length,
            pagination: {
                total,
                limit: Number(limit),
                page: Number(page),
                pages: Math.ceil(total / Number(limit))
            },
            data: payments
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, message: 'Ödemeler getirilemedi' });
    }
});

// @desc    Update Payment
// @route   PUT /api/payments/:id
router.put('/:id', protect, restrictTo('admin', 'cashier'), async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Ödeme bulunamadı' });
        }

        res.json({ success: true, data: payment });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ success: false, message: 'Güncelleme başarısız' });
    }
});

export default router;
