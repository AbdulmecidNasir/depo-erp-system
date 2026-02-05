import { ExtendedProduct, ITCategory, WarehouseLocation, Supplier } from '../types/warehouse';

export const itCategories = {
  computers: 'Компьютеры',
  laptops: 'Ноутбуки',
  servers: 'Серверы',
  processors: 'Процессоры',
  memory: 'Оперативная память',
  storage: 'Накопители',
  'graphics-cards': 'Видеокарты',
  motherboards: 'Материнские платы',
  'power-supplies': 'Блоки питания',
  cooling: 'Системы охлаждения',
  cases: 'Корпуса',
  monitors: 'Мониторы',
  mishka: 'Мышки',
  naushnik: 'Наушники',
  klavye: 'Клавиатуры',
  mikrofon: 'Микрофоны',
  kovrik: 'Коврики',
  printers: 'Принтеры',
  scanners: 'Сканеры',
  'network-equipment': 'Сетевое оборудование',
  cables: 'Кабели',
  adapters: 'Адаптеры',
  accessories: 'Аксессуары',
  consumables: 'Расходные материалы'
};

export const warehouseLocations: WarehouseLocation[] = [
  {
    id: '1',
    code: 'A1-B1-C1',
    name: 'Зона A - Компьютеры',
    description: 'Готовые компьютеры и ноутбуки',
    capacity: 100,
    currentOccupancy: 75,
    zone: 'A',
    level: 1,
    section: 1
  },
  {
    id: '2',
    code: 'A1-B2-C1',
    name: 'Зона A - Комплектующие',
    description: 'Процессоры, память, накопители',
    capacity: 200,
    currentOccupancy: 150,
    zone: 'A',
    level: 1,
    section: 2
  },
  {
    id: '3',
    code: 'B1-B1-C1',
    name: 'Зона B - Периферия',
    description: 'Мониторы, клавиатуры, мыши',
    capacity: 150,
    currentOccupancy: 90,
    zone: 'B',
    level: 1,
    section: 1
  },
  {
    id: '4',
    code: 'C1-B1-C1',
    name: 'Зона C - Расходники',
    description: 'Кабели, адаптеры, расходные материалы',
    capacity: 300,
    currentOccupancy: 180,
    zone: 'C',
    level: 1,
    section: 1
  }
];

export const suppliers: Supplier[] = [
  {
    id: '1',
    name: 'ООО "ТехПоставка"',
    contactPerson: 'Иванов Иван Иванович',
    email: 'ivan@techpostavka.ru',
    phone: '+7 (495) 123-45-67',
    address: 'г. Москва, ул. Технологическая, д. 10',
    taxNumber: '7701234567',
    paymentTerms: '30 дней',
    isActive: true,
    rating: 4.8,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'ИП Петров П.П.',
    contactPerson: 'Петров Петр Петрович',
    email: 'petrov@hardware.ru',
    phone: '+7 (812) 987-65-43',
    address: 'г. Санкт-Петербург, пр. Компьютерный, д. 25',
    paymentTerms: '14 дней',
    isActive: true,
    rating: 4.5,
    createdAt: '2024-01-15T00:00:00Z'
  }
];


