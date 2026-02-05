import mongoose from 'mongoose';

const cashTransactionSchema = new mongoose.Schema({
    type: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['UZS', 'USD'], required: true },
    reason: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
});

const shiftSchema = new mongoose.Schema({
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: String, required: true },
    terminalId: { type: String, default: 'POS-01' },

    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },

    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },

    // Opening Balances
    openingBalanceUZS: { type: Number, default: 0 },
    openingBalanceUSD: { type: Number, default: 0 },

    // Running Totals (System calculated from Sales)
    totalSalesCashUZS: { type: Number, default: 0 },
    totalSalesCashUSD: { type: Number, default: 0 },

    totalSalesCardUZS: { type: Number, default: 0 },
    totalSalesCardUSD: { type: Number, default: 0 },

    totalReturnsUZS: { type: Number, default: 0 },
    totalReturnsUSD: { type: Number, default: 0 },

    // Closing Balances (Actual Count entered by Cashier)
    closingBalanceActualUZS: { type: Number },
    closingBalanceActualUSD: { type: Number },

    // Closing Balances (Computed Theoretical)
    closingBalanceTheoreticalUZS: { type: Number },
    closingBalanceTheoreticalUSD: { type: Number },

    cashTransactions: [cashTransactionSchema],

    notes: { type: String }
}, {
    timestamps: true
});

// One cashier can only have one open shift at a time usually
shiftSchema.index({ cashierId: 1, status: 1 });

const Shift = mongoose.model('Shift', shiftSchema);

export default Shift;
