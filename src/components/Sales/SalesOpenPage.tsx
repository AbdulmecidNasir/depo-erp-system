import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Monitor, ShoppingCart, User, ArrowRight } from 'lucide-react';

// Live carts should support multi-currency totals
const initialOpenCarts: Array<{
  id: string;
  terminal: string;
  cashier: string;
  itemsCount: number;
  totalUZS: number;
  totalUSD: number;
  startTime: string;
  status: string;
}> = [];

const SalesOpenPage: React.FC = () => {
  const { isDark } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [carts, setCarts] = useState(initialOpenCarts);

  const getDuration = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 60000); // minutes
    return diff;
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Monitor className="text-blue-500" />
          Открытые продажи (Live)
        </h1>
        <p className="text-sm opacity-60 mt-1">Мониторинг активных сессий (UZS/USD) на кассах в реальном времени.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {carts.map((cart) => (
          <div key={cart.id} className={`rounded-xl border shadow-sm p-5 relative overflow-hidden transition-all duration-300 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 hover:shadow-md'
            }`}>
            {/* Status Indicator Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${cart.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              }`} />

            <div className="flex justify-between items-start mb-4 pl-2">
              <div>
                <h3 className="font-bold text-lg">{cart.terminal}</h3>
                <div className="flex items-center gap-1 text-xs opacity-60">
                  <User size={12} /> {cart.cashier}
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${getDuration(cart.startTime) > 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                {getDuration(cart.startTime)} мин
              </div>
            </div>

            <div className="flex justify-between items-end pl-2 mb-4">
              <div>
                <div className="text-xs opacity-50 mb-0.5">Товаров</div>
                <div className="font-semibold flex items-center gap-1">
                  <ShoppingCart size={16} className="text-blue-500" />
                  {cart.itemsCount}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-50 mb-0.5">Сумма</div>
                {cart.totalUSD > 0 && (
                  <div className="font-bold text-lg text-green-600 dark:text-green-400">${cart.totalUSD.toLocaleString()}</div>
                )}
                {cart.totalUZS > 0 && (
                  <div className="font-bold text-lg text-blue-600 dark:text-blue-400">{cart.totalUZS.toLocaleString()} сум</div>
                )}
                {cart.totalUSD === 0 && cart.totalUZS === 0 && (
                  <div className="font-bold text-lg opacity-50">0</div>
                )}
              </div>
            </div>

            <div className="pl-2 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700 flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                Перехватить <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Empty State / Add Terminal Placeholder */}
        <div className={`rounded-xl border border-dashed p-5 flex flex-col items-center justify-center text-center opacity-50 hover:opacity-100 transition-opacity cursor-pointer ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'
          }`}>
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
            <Monitor size={24} />
          </div>
          <div className="font-medium text-sm">Подключить терминал</div>
        </div>
      </div>
    </div>
  );
};

export default SalesOpenPage;
