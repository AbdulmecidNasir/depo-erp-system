import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
// import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Product } from '../../types';
import { Shift } from '../../types/sales';
import {
    Search, Scan, ShoppingCart, Trash2,
    CreditCard, Banknote, X, RefreshCw
} from 'lucide-react';

// Temporary types until they are in a shared file if not already
interface POSCartItem {
    product: Product;
    quantity: number;
    price: number; // Unit price (can be overridden)
    discount: number; // Percentage or fixed amount? Let's say percentage for now
}

const SalesPOSPage: React.FC = () => {
    const { isDark } = useTheme();
    // const { user } = useAuth();

    // State
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [loadingShift, setLoadingShift] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<Record<string, string>>({});

    const [cart, setCart] = useState<POSCartItem[]>([]);
    // const [selectedCustomer] = useState<any | null>(null); // Extended functionality for later

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mixed'>('cash');
    const [paymentCurrency] = useState<'UZS' | 'USD'>('UZS');

    // Load initial data
    useEffect(() => {
        fetchShiftStatus();
        fetchCategories();
        fetchProducts();
    }, []);

    const fetchShiftStatus = async () => {
        try {
            setLoadingShift(true);
            const res = await api.shifts.getCurrent();
            if (res.success) {
                setActiveShift(res.data);
            } else {
                setActiveShift(null);
            }
        } catch (error) {
            console.error('Error fetching shift:', error);
        } finally {
            setLoadingShift(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.products.getCategories();
            if (res.success) {
                setCategories(res.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoadingProducts(true);
            const res = await api.products.getAll({
                limit: 100, // Fetch more for POS
                search: searchQuery,
                category: selectedCategory || undefined
            });
            if (res.success) {
                setProducts(res.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedCategory]);

    // Cart operations
    const addToCart = (product: Product) => {
        if (product.stock <= 0) {
            alert('Нет в наличии');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    alert('Достигнут лимит остатка');
                    return prev;
                }
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1, price: product.salePrice, discount: 0 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = item.quantity + delta;
                if (newQty <= 0) return item;
                if (newQty > item.product.stock) {
                    alert('Достигнут лимит остатка');
                    return item;
                }
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    // Calculations
    const calculateTotal = () => {
        return cart.reduce((sum, item) => {
            const itemTotal = item.price * item.quantity;
            const discountAmount = (itemTotal * item.discount) / 100;
            return sum + (itemTotal - discountAmount);
        }, 0);
    };

    const totalAmount = calculateTotal();

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!activeShift) {
            alert('Смена не открыта! Пожалуйста, откройте кассовую смену.');
            return;
        }

        setShowPaymentModal(true);
        setPaymentAmount(totalAmount.toString());
    };

    const confirmPayment = async () => {
        try {
            const saleData = {
                items: cart.map(item => ({
                    productId: item.product.id,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    discount: item.discount
                })),
                payment: {
                    method: paymentMethod,
                    amount: Number(paymentAmount),
                    currency: paymentCurrency
                },
                totalAmountUZS: paymentCurrency === 'UZS' ? Number(paymentAmount) : 0,
                totalAmountUSD: paymentCurrency === 'USD' ? Number(paymentAmount) : 0,
                customerId: undefined // selectedCustomer?.id
            };

            const res = await api.sales.create(saleData);
            if (res.success) {
                alert('Продажа успешно создана!');
                setCart([]);
                setShowPaymentModal(false);
            } else {
                alert('Ошибка при создании продажи');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Ошибка при оформлении');
        }
    };

    if (loadingShift) {
        return <div className="p-8 text-center">Загрузка данных...</div>;
    }

    return (
        <div className={`flex flex-col h-[calc(100vh-2rem)] ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>

            {/* Header / Top Bar */}
            <div className="flex justify-between items-center mb-4 px-2">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <ShoppingCart className="text-blue-500" /> POS Терминал
                </h1>
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded text-sm font-medium border ${activeShift ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
                        {activeShift ? `Смена открыта: ${activeShift.cashierName}` : 'СМЕНА ЗАКРЫТА'}
                    </div>
                    <button
                        onClick={() => fetchProducts()}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Обновить товары"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">

                {/* Left Side: Product Catalog */}
                <div className={`flex-1 flex flex-col rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                    {/* Search Bar */}
                    <div className="p-4 border-b dark:border-gray-700 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Поиск по названию или штрихкоду..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                                autoFocus
                            />
                        </div>
                        <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Scan size={20} />
                        </button>
                    </div>

                    {/* Categories */}
                    <div className="px-4 py-2 flex gap-2 overflow-x-auto border-b dark:border-gray-700 no-scrollbar">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'}`}
                        >
                            Все
                        </button>
                        {Object.entries(categories).map(([id, name]) => (
                            <button
                                key={id}
                                onClick={() => setSelectedCategory(id)}
                                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loadingProducts ? (
                            <div className="flex justify-center items-center h-full opacity-50">Loading products...</div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {products.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className={`cursor-pointer rounded-lg border p-3 flex flex-col justify-between transition-all hover:shadow-md active:scale-95 ${product.stock <= 0 ? 'opacity-50 grayscale pointer-events-none' :
                                                isDark ? 'bg-gray-700 border-gray-600 hover:border-gray-500' : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                                            }`}
                                    >
                                        <div className="h-24 w-full bg-gray-200 dark:bg-gray-600 rounded mb-2 overflow-hidden flex items-center justify-center">
                                            {product.image ? (
                                                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <ShoppingCart size={24} className="opacity-20" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-sm line-clamp-2 leading-tight mb-1">{product.name}</h3>
                                            <div className="flex justify-between items-end">
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{product.salePrice.toLocaleString()}</span>
                                                <span className="text-xs opacity-60 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                                    {product.stock} шт
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Cart / Checkout */}
                <div className={`w-96 flex flex-col rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>

                    {/* Cart items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                                <ShoppingCart size={48} className="mb-2" />
                                <p>Корзина пуста</p>
                            </div>
                        ) : (
                            cart.map((item, index) => (
                                <div key={index} className={`p-2 rounded-lg border flex gap-2 group ${isDark ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium line-clamp-1">{item.product.name}</div>
                                        <div className="text-xs opacity-60 mb-2 truncate">{item.product.barcode || '---'}</div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center border rounded dark:border-gray-600">
                                                <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1); }} className="px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-600">-</button>
                                                <span className="px-2 text-sm font-bold min-w-[30px] text-center">{item.quantity}</span>
                                                <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1); }} className="px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-600">+</button>
                                            </div>
                                            <span className="text-sm font-mono">x {item.price.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between items-end">
                                        <button onClick={() => removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="font-bold">
                                            {(item.price * item.quantity).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals Section */}
                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="space-y-1 mb-4 text-sm">
                            <div className="flex justify-between opacity-70">
                                <span>Позиций:</span>
                                <span>{cart.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xl font-bold mt-2">
                                <span>ИТОГО:</span>
                                <span className="text-blue-600">{totalAmount.toLocaleString()} сум</span>
                            </div>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className={`w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${cart.length === 0
                                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                                    : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 active:scale-[0.98]'
                                }`}
                        >
                            <CreditCard size={20} />
                            Оплатить {totalAmount > 0 && `(${totalAmount.toLocaleString()})`}
                        </button>
                    </div>
                </div>

            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-lg font-bold">Оплата</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="text-center">
                                <p className="text-sm opacity-60 mb-1">К оплате</p>
                                <div className="text-3xl font-bold text-blue-600">{totalAmount.toLocaleString()} сум</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-transparent bg-gray-100 dark:bg-gray-700 opacity-60'
                                        }`}
                                >
                                    <Banknote size={24} className="mb-2" />
                                    <span className="font-bold">Наличные</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${paymentMethod === 'card' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'border-transparent bg-gray-100 dark:bg-gray-700 opacity-60'
                                        }`}
                                >
                                    <CreditCard size={24} className="mb-2" />
                                    <span className="font-bold">Карта / Терминал</span>
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Сумма оплаты</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className={`w-full p-3 rounded-lg border text-lg font-mono ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                                />
                            </div>

                            <button
                                onClick={confirmPayment}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-600/20"
                            >
                                Подтвердить оплату
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SalesPOSPage;
