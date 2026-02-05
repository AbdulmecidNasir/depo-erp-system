import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
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

    quantity: {
        type: Number,
        default: 0,
        min: [0, 'Stok miktarı negatif olamaz']
    },

    reserved: {
        type: Number,
        default: 0,
        min: [0, 'Rezerve miktar negatif olamaz']
    },

    // Opsiyonel olarak Lot/Batch takibi
    batchNumber: {
        type: String,
        trim: true,
        index: true
    },

    expiryDate: {
        type: Date
    },

    lastCountDate: {
        type: Date
    }, // Son sayım tarihi

    lastMovementDate: {
        type: Date
    } // Son hareket tarihi
}, {
    timestamps: true
});

// COMPOUND UNIQUE INDEX: Bir lokasyonda bir üründen (veya aynı batch'ten) tek kayıt olur.
inventorySchema.index({ product: 1, location: 1, batchNumber: 1 }, { unique: true });
inventorySchema.index({ location: 1 }); // Lokasyon bazlı sorgular için
inventorySchema.index({ product: 1 }); // Ürün bazlı sorgular için

export default mongoose.model('Inventory', inventorySchema);
