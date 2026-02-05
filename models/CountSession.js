import mongoose from 'mongoose';

const countSessionSchema = new mongoose.Schema({
    sessionCode: {
        type: String,
        unique: true,
        required: true,
        trim: true
    }, // Örn: CNT-202401-001

    type: {
        type: String,
        enum: ['cycle', 'full', 'spot'], // Periyodik (Döngüsel), Tam Yıl Sonu, Anlık (Spot)
        required: true
    },

    status: {
        type: String,
        enum: ['planned', 'active', 'counting', 'review', 'approved', 'completed', 'cancelled'],
        default: 'planned'
    },

    // Sayım Kapsamı
    scope: {
        warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }, // İleride Warehouse modeli olursa
        zones: [String], // Örn: ['A', 'B']
        abcClasses: [String], // Örn: ['A'] -> Sadece A sınıfı ürünler
        categories: [String], // Kategori bazlı sayım
        specificLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }]
    },

    description: {
        type: String,
        trim: true
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Sayımı yapacak personel

    startedAt: Date,
    completedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // İstatistikler (denormalize - performans için)
    stats: {
        totalLines: { type: Number, default: 0 },
        countedLines: { type: Number, default: 0 },
        discrepancyLines: { type: Number, default: 0 }, // Fark çıkan satır sayısı
        totalValueGap: { type: Number, default: 0 } // Parasal fark değeri
    }
}, {
    timestamps: true
});

countSessionSchema.index({ status: 1 });
countSessionSchema.index({ type: 1, createdAt: -1 });
countSessionSchema.index({ sessionCode: 1 });

export default mongoose.model('CountSession', countSessionSchema);
