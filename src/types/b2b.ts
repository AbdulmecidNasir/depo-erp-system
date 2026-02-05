
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
export type ShipmentStatus = 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type ReturnCondition = 'good' | 'damaged' | 'defective';
export type Currency = 'UZS' | 'USD';

export interface B2BSalesItem {
    productId: string;
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    currency: Currency;
    totalPrice: number;
    discount?: number;
}

export interface B2BRequest {
    id: string;
    requestDate: string;
    customerId: string;
    customerName: string;
    priority: 'normal' | 'high' | 'urgent';
    status: RequestStatus;
    items: B2BSalesItem[];
    totalAmountUZS: number;
    totalAmountUSD: number;
    notes?: string;
    createdBy: string;
    approvedBy?: string;
    approvedAt?: string;
}

export interface ShipmentItem {
    productId: string;
    productName: string;
    orderedQty: number;
    shippedQty: number; // For partial shipments
    locationCode?: string; // Where it was picked from
}

export interface B2BShipment {
    id: string;
    requestId: string;
    shipmentDate: string;
    status: ShipmentStatus;
    items: ShipmentItem[];
    trackingNumber?: string;
    carrier?: {
        name: string;
        driverName?: string;
        vehiclePlate?: string;
        phone?: string;
    };
    boxCount?: number;
    weight?: number;
    notes?: string;
}

export interface ReturnItem {
    productId: string;
    quantity: number;
    reason: 'damaged' | 'wrong_item' | 'not_needed' | 'other';
    condition: ReturnCondition;
    description?: string;
}

export interface B2BReturn {
    id: string;
    shipmentId: string; // Linked to a shipment
    customerId: string;
    customerName: string;
    returnDate: string;
    status: ReturnStatus;
    items: ReturnItem[];
    refundAmountUZS?: number;
    refundAmountUSD?: number;
    adminNotes?: string;
}
