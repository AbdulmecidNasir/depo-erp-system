import React from 'react';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useSettings } from '../../contexts/SettingsContext';

const CartView: React.FC = () => {
  const { items, updateQuantity, removeItem, clearCart, getTotalPrice } = useCart();
  const { formatPrice } = useSettings();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <ShoppingBag className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Корзина пуста</h2>
          <p className="text-gray-500">Добавьте товары из каталога</p>
        </div>
      </div>
    );
  }

  const handleCheckout = () => {
    alert('Заказ оформлен! В реальном приложении здесь был бы процесс оплаты.');
    clearCart();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Корзина покупок</h1>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="divide-y divide-gray-200">
          {items.map((item) => (
            <div key={item.product.id} className="p-6 flex items-center space-x-4">
              <img
                src={item.product.image}
                alt={item.product.nameRu}
                className="w-16 h-16 object-cover rounded-lg"
              />

              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.product.nameRu}</h3>
                <p className="text-sm text-gray-500">{item.product.brand} • {item.product.model}</p>
                <p className="text-lg font-bold text-blue-600 mt-2">
                  {formatPrice(item.product.salePrice)}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="w-12 text-center font-medium">{item.quantity}</span>

                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  disabled={item.quantity >= item.product.stock}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {formatPrice(item.product.salePrice * item.quantity)}
                </p>
              </div>

              <button
                onClick={() => removeItem(item.product.id)}
                className="p-2 text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-gray-900">Итого:</span>
            <span className="text-2xl font-bold text-blue-600">
              {formatPrice(getTotalPrice())}
            </span>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={clearCart}
              className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Очистить корзину
            </button>
            <button
              onClick={handleCheckout}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Оформить заказ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartView;