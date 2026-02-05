import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sale } from '../../types/sales';
import { api } from '../../services/api';
import { Clock, Play, Trash2, StickyNote } from 'lucide-react';

const SalesDelayedPage: React.FC = () => {
  const { isDark } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [delayedSales, setDelayedSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDelayed = async () => {
    try {
      setLoading(true);
      const response = await api.sales.getParked();
      if (response.success && response.data) {
        setDelayedSales(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch delayed sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelayed();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить отложенный чек?')) return;
    try {
      const res = await api.sales.cancel(id, 'Deleted from Delayed List');
      if (res.success) {
        fetchDelayed();
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении');
    }
  };

  const handleRestore = (sale: Sale) => {
    // In a real POS, this would load the items back into the active cart context
    console.log('Restoring sale:', sale);
    alert(`Чек ${sale.invoiceNumber} восстановлен в корзину (Mock Action)`);
    // navigation to POS page or similar would happen here
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-orange-500">
          <Clock />
          Отложенные продажи
        </h1>
        <p className="text-sm opacity-60 mt-1">Здесь хранятся чеки, временно поставленные на паузу.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center opacity-50">Загрузка...</div>
        ) : delayedSales.map((sale) => (
          <div key={sale.id} className={`rounded-xl shadow-sm border p-5 relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{sale.invoiceNumber}</h3>
                <div className="text-xs opacity-50 flex items-center gap-1 mt-1">
                  <Clock size={12} />
                  {new Date(sale.parkedAt || sale.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.parkedBy || 'Unknown'}
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${isDark ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-50 text-orange-700'}`}>
                PAUSED
              </span>
            </div>

            <div className="space-y-3 mb-6">
              {(sale.items || []).slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="opacity-80 truncate max-w-[180px]">{(item.productId as any)?.name || 'Tovari'}</span>
                  <span className="font-medium">
                    {item.quantity} x {item.unitPrice} {item.currency}
                  </span>
                </div>
              ))}
              {(sale.items || []).length > 3 && (
                <div className="text-xs opacity-50 italic">
                  + еще {(sale.items || []).length - 3} позиций...
                </div>
              )}
            </div>

            {sale.notes && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex gap-2 ${isDark ? 'bg-yellow-900/20 text-yellow-200' : 'bg-yellow-50 text-yellow-800'}`}>
                <StickyNote size={16} className="shrink-0 mt-0.5" />
                <span className="italic">{sale.notes}</span>
              </div>
            )}

            <div className="flex flex-col gap-1 mb-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
              {sale.totalAmountUSD > 0 && (
                <div className="flex justify-between font-bold text-green-600 dark:text-green-400">
                  <span>Итого (USD):</span>
                  <span>${sale.totalAmountUSD.toLocaleString()}</span>
                </div>
              )}
              {sale.totalAmountUZS > 0 && (
                <div className="flex justify-between font-bold text-blue-600 dark:text-blue-400">
                  <span>Итого (UZS):</span>
                  <span>{sale.totalAmountUZS.toLocaleString()} сум</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(sale.id)}
                className={`p-2 rounded-lg transition-colors flex-none ${isDark ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                title="Удалить"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={() => handleRestore(sale)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Play size={16} fill="currentColor" />
                <span>Вернуть</span>
              </button>
            </div>
          </div>
        ))}

        {!loading && delayedSales.length === 0 && (
          <div className="col-span-full py-12 text-center opacity-50 flex flex-col items-center">
            <Clock size={48} className="mb-4 opacity-20" />
            <p>Нет отложенных чеков</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesDelayedPage;
