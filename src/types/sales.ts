export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type SaleStatus = 'completed' | 'returned' | 'partially_returned' | 'cancelled' | 'pending';
export type SaleType = 'retail' | 'wholesale';
export type ShiftStatus = 'open' | 'closed';
export type Currency = 'UZS' | 'USD';

export interface SaleItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    discount: number;
    tax: number;
    barcode?: string;
    sku?: string;
    currency: Currency; // The currency the item was priced in
}

export interface SalePayment {
    method: PaymentMethod;
    amount: number;
    currency: Currency;
    exchangeRate?: number; // Rate if payment currency differs from item currency
}

export interface Sale {
    id: string;
    invoiceNumber: string;
    customerId?: string;
    customerName?: string;
    branchId: string;
    branchName: string;
    cashierId: string;
    cashierName: string;
    items: SaleItem[];

    // Totals kept in both currencies for easier reporting
    // If sale was pure USD, UZS might be calculated via rate, or 0 if not relevant
    totalAmountUZS: number;
    totalAmountUSD: number;

    taxAmountUZS: number;
    taxAmountUSD: number;

    discountAmountUZS: number;
    discountAmountUSD: number;

    payments: SalePayment[];
    status: SaleStatus;
    type: SaleType;
    date: string;
    createdAt?: string;
    updatedAt?: string;
    parkedAt?: string;
    parkedBy?: string | any; // Sometimes object or string
    deletedBy?: string | any;
    deletedAt?: string;
    deleteReason?: string;
    notes?: string;
    originalSaleId?: string; // For returns
    returnReason?: string;
}

export interface CashTransaction {
    id: string;
    type: 'in' | 'out'; // Cash In / Cash Out
    amount: number;
    currency: Currency;
    reason: string;
    timestamp: string;
    userId: string;
}

export interface Shift {
    id: string;
    cashierId: string;
    cashierName: string;
    branchId: string;
    startTime: string;
    endTime?: string;

    // Balances for UZS
    openingBalanceUZS: number;
    closingBalanceTheoreticalUZS?: number;
    closingBalanceActualUZS?: number;
    totalSalesCashUZS: number;
    totalSalesCardUZS: number;

    // Balances for USD
    openingBalanceUSD: number;
    closingBalanceTheoreticalUSD?: number;
    closingBalanceActualUSD?: number;
    totalSalesCashUSD: number;
    totalSalesCardUSD: number;

    // Aggregated stats
    totalReturnsUZS: number;
    totalReturnsUSD: number;

    cashTransactions: CashTransaction[];
    status: ShiftStatus;
    notes?: string;
}

export interface DelayedSale {
    id: string;
    name: string; // "Grocery Cart 1"
    items: SaleItem[];
    savedAt: string;
    savedBy: string;

    totalAmountUZS: number;
    totalAmountUSD: number;

    note?: string;
}

export interface DeletedSaleLog {
    saleId: string;
    originalData: Sale;
    deletedAt: string;
    deletedBy: string;
    reason: string;
}
