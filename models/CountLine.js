import mongoose from 'mongoose';

const countLineSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CountSession',
        required: true
    },

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },

    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true
    },

    // Snapshot Değerleri (Sayım başladığı andaki teorik stok)
    // Bu değer, sayım emri oluşturulduğu an Inventory'den kopyalanır.
    systemQty: {
        type: Number,
        required: true,
        default: 0
    },

    // Sayılan Değer (Personelin girdiği)
    countedQty: {
        type: Number,
        default: null // Henüz sayılmadıysa null
    },

    // Fark (counted - system)
    diffQty: {
        type: Number,
        default: 0
    },

    isDiscrepancy: {
        type: Boolean,
        default: false
    }, // Fark var mı?

    countedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    countedAt: {
        type: Date
    },

    // Tekrar sayım veya notlar
    notes: String,

    recountRequired: {
        type: Boolean,
        default: false
    },

    // Batch/Lot bilgisi (Opsiyonel)
    batchNumber: String

}, {
    timestamps: true
});

// Hızlı erişim için indexler
countLineSchema.index({ session: 1, location: 1 });
countLineSchema.index({ session: 1, isDiscrepancy: 1 }); // Fark raporu için
countLineSchema.index({ session: 1, product: 1 });

export default mongoose.model('CountLine', countLineSchema);
