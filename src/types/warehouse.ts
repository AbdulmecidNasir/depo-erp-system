export interface WarehouseLocation {
  id: string;
  code: string; // A1-B2-C3
  name: string;
  description?: string;
  capacity: number;
  currentOccupancy: number;
  zone: 'A' | 'B' | 'C' | 'D';
  level: number;
  section: number;
}

export interface SerialNumber {
  id: string;
  serialNumber: string;
  productId: string;
  status: 'available' | 'sold' | 'defective' | 'reserved';
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  purchaseDate: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  productId: string | { _id: string; nameRu: string; brand: string; model: string; location: string };
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reason: string;
  userId: string | { _id: string; firstName: string; lastName: string; email: string };
  timestamp: string;
  batchNumber?: string;
  serialNumbers?: string[];
  notes?: string;
  userLocation?: string;
  warehouseLocation?: string;
  status?: 'completed' | 'draft' | 'pending';
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxNumber?: string;
  paymentTerms: string;
  isActive: boolean;
  rating: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  totalAmount: number;
  notes?: string;
  createdBy: string;
}

export interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity?: number;
}

export interface UserRequest {
  id: string;
  requestNumber: string;
  userId: string;
  items: RequestItem[];
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestDate: string;
  approvedBy?: string;
  approvedDate?: string;
  fulfilledDate?: string;
  reason: string;
  notes?: string;
}

export interface RequestItem {
  productId?: string;
  description: string;
  quantity: number;
  urgency: 'normal' | 'urgent';
  justification: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  type: 'low_stock' | 'out_of_stock' | 'overstock' | 'expiring_warranty';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  createdAt: string;
}

export interface WarehouseAnalytics {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  topMovingProducts: Array<{
    productId: string;
    name: string;
    movementCount: number;
  }>;
  stockTurnoverRate: number;
  warehouseUtilization: number;
  monthlyMovements: Array<{
    month: string;
    inbound: number;
    outbound: number;
  }>;
}

export interface ITEquipmentSpecs {
  // Общие характеристики
  brand: string;
  model: string;
  partNumber?: string;

  // Процессоры
  cores?: number;
  threads?: number;
  baseClock?: string;
  boostClock?: string;
  socket?: string;

  // Память
  capacity?: string;
  type?: string; // DDR4, DDR5
  speed?: string;
  latency?: string;

  // Накопители
  storageType?: 'HDD' | 'SSD' | 'NVMe';
  interface?: string; // SATA, PCIe
  readSpeed?: string;
  writeSpeed?: string;

  // Видеокарты
  gpu?: string;
  vram?: string;
  memoryType?: string;

  // Мониторы
  screenSize?: string;
  resolution?: string;
  refreshRate?: string;
  panelType?: string;

  // Общие
  powerConsumption?: string;
  dimensions?: string;
  weight?: string;
  warranty?: string;
}

export type UserRole = 'admin' | 'warehouse_manager' | 'warehouse_staff' | 'user' | 'customer';

export interface ExtendedUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  department?: string;
  position?: string;
  permissions: string[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface ExtendedProduct {
  id: string;
  productId: string; // 6-digit product ID
  name: string;
  nameRu: string;
  brand: string;
  model: string;
  variant?: string;
  category: ITCategory;
  subCategory?: string;
  barcode: string; // Separate from productId
  qrCode?: string;
  location: string;
  alternativeLocations?: string[];
  images: string[];
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  maxStock: number;
  reservedStock: number;
  availableStock: number;
  description: string;
  descriptionRu: string;
  specifications: ITEquipmentSpecs;
  supplierId?: string;
  serialNumbers: SerialNumber[];
  isActive: boolean;
  isSerialTracked: boolean;
  hasWarranty: boolean;
  warrantyPeriod?: number; // months
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastMovement?: string;
}

export type ITCategory =
  | 'computers'
  | 'laptops'
  | 'servers'
  | 'processors'
  | 'memory'
  | 'storage'
  | 'graphics-cards'
  | 'motherboards'
  | 'power-supplies'
  | 'cooling'
  | 'cases'
  | 'monitors'
  | 'mishka'
  | 'naushnik'
  | 'klavye'
  | 'mikrofon'
  | 'kovrik'
  | 'printers'
  | 'scanners'
  | 'network-equipment'
  | 'cables'
  | 'adapters'
  | 'accessories'
  | 'consumables';