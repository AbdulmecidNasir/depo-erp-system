import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    action: { type: String, required: true, index: true }, // e.g., 'DELETE_SALE', 'UPDATE_PRICE', 'SHIFT_CLOSE_FORCE'
    entity: { type: String, required: true }, // 'Sale', 'Product', 'Shift'
    entityId: { type: String, required: true, index: true },

    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: String },

    details: { type: mongoose.Schema.Types.Mixed }, // JSON object with changes or snapshot

    ipAddress: { type: String },
    userAgent: { type: String }
}, {
    timestamps: { createdAt: true, updatedAt: false } // Immutable logs usually
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
