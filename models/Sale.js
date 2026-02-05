import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    barcode: { type: String },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    currency: { type: String, enum: ['USD', 'UZS'], default: 'UZS' } // Currency for the item price
});

const paymentSchema = new mongoose.Schema({
    method: { type: String, enum: ['cash', 'card', 'transfer', 'other'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['USD', 'UZS'], required: true },
    exchangeRate: { type: Number, default: 1 } // Rate relative to base currency if needed
});

const saleSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true, index: true },

    branchId: { type: String, required: true, index: true }, // Assuming branches are strings or ObjectIds
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    status: {
        type: String,
        enum: ['completed', 'returned', 'partially_returned', 'cancelled', 'parked', 'pending'],
        default: 'completed',
        index: true
    },

    type: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },

    // Totals
    totalAmountUZS: { type: Number, default: 0 },
    totalAmountUSD: { type: Number, default: 0 },

    taxAmountUZS: { type: Number, default: 0 },
    taxAmountUSD: { type: Number, default: 0 },

    discountAmountUZS: { type: Number, default: 0 },
    discountAmountUSD: { type: Number, default: 0 },

    items: [saleItemSchema],
    payments: [paymentSchema],

    notes: { type: String },

    // For Returns
    originalSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    returnReason: { type: String },

    // Soft Delete / Audit
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deleteReason: { type: String },

    // For Parked Sales
    parkedAt: { type: Date },
    parkedBy: { type: String }, // Name or ID
    parkNote: { type: String }

}, {
    timestamps: true
});

// Indexes for performance
saleSchema.index({ createdAt: -1 });
saleSchema.index({ branchId: 1, createdAt: -1 });
saleSchema.index({ customerId: 1 });
saleSchema.index({ isDeleted: 1 });
// Text index for searching
saleSchema.index({ invoiceNumber: 'text', 'items.name': 'text' });

const Sale = mongoose.model('Sale', saleSchema);

export default Sale;
