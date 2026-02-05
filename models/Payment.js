import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true,
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    // Ödemeyi yapan kişi/kurum
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'customerModel',
        required: true
    },
    customerModel: {
        type: String,
        required: true,
        enum: ['User', 'Debitor', 'Supplier'],
        default: 'User'
    },

    type: {
        type: String,
        enum: ['in', 'out'],
        default: 'in'
    },

    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Tutar 0 dan büyük olmalıdır']
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'UZS', // Proje geneline göre değiştirebiliriz
        enum: ['USD', 'UZS', 'RUB']
    },
    method: {
        type: String,
        enum: ['cash', 'card', 'bank_transfer', 'other'],
        required: true
    },

    status: {
        type: String,
        enum: ['pending', 'completed', 'partially_paid', 'failed', 'refunded'],
        default: 'completed' // Genelde ödeme alındığında kayıt girilir
    },

    transactionDate: {
        type: Date,
        default: Date.now
    },

    notes: String,

    // Eğer bu ödeme bir Satış kaydına (muhasebe) dönüştüyse referansı
    relatedSale: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale'
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Otomatik sequential numara üretme
paymentSchema.pre('validate', async function (next) {
    if (this.isNew && !this.paymentNumber) {
        try {
            const Counter = mongoose.model('Counter');
            const counter = await Counter.findOneAndUpdate(
                { id: 'paymentNumber' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );

            // Format: 000001, 000002, etc.
            this.paymentNumber = counter.seq.toString().padStart(6, '0');
        } catch (error) {
            return next(error);
        }
    }
    next();
});

export default mongoose.model('Payment', paymentSchema);
