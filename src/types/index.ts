export interface User {
  id: string;
  email: string;
  role: 'admin' | 'customer' | 'sales_manager' | 'warehouse_manager' | 'warehouse_staff' | 'cashier';
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  position?: string;
  bio?: string;
  profilePhotoUrl?: string;
  language?: 'ru' | 'en' | 'tr';
  timezone?: string;
  dateFormat?: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  currency?: 'RUB' | 'USD' | 'EUR' | 'TRY';
  theme?: 'light' | 'dark';
  createdAt: string;
}

export interface ProductImage {
  url: string;
  publicId?: string;
  alt?: string;
}

export interface Product {
  id: string;
  productId: string; // 6-digit product ID
  name: string;
  nameRu: string;
  brand: string;
  model: string;
  variant?: string;
  category: TechCategory;
  barcode: string; // Separate from productId
  location: string;
  image: string;
  images?: ProductImage[];
  purchasePrice: number; // Admin only
  wholesalePrice?: number; // Admin only, optional
  salePrice: number; // Public
  stock: number;
  minStock: number;
  description: string;
  descriptionRu: string;
  specifications: Record<string, string>;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TechCategory =
  | 'processors'
  | 'graphics-cards'
  | 'motherboards'
  | 'memory'
  | 'storage'
  | 'cooling'
  | 'cases'
  | 'power-supplies'
  | 'monitors'
  | 'mishka'
  | 'naushnik'
  | 'klavye'
  | 'mikrofon'
  | 'kovrik'
  | 'laptops'
  | 'smartphones'
  | 'tablets'
  | 'networking';

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Analytics {
  todaySales: number;
  yesterdaySales: number;
  todayCustomers: number;
  yesterdayCustomers: number;
  lowStockProducts: Product[];
  // API response fields
  sales?: {
    today: number;
    yesterday: number;
    change: number;
  };
  customers?: {
    today: number;
    yesterday: number;
    change: number;
    total: number;
  };
  orders?: {
    today: number;
    yesterday: number;
    change: number;
  };
  products?: {
    total: number;
    lowStock: number;
    outOfStock: number;
  };
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type LedgerStatus = 'В ожидании' | 'Оплачено' | 'Не оплачено';

export interface DebitorRecord {
  id: string;
  partyName: string;
  contact?: string;
  amount: number;
  currency: string;
  dueDate?: string;
  status: LedgerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditorRecord extends DebitorRecord { }