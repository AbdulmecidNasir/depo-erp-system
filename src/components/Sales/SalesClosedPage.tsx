import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sale } from '../../types/sales';
import { api } from '../../services/api';
import { CheckCircle2, DollarSign, CreditCard, Lock, Ban } from 'lucide-react';

const SalesClosedPage: React.FC = () => {
  const { isDark } = useTheme();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch sales from API
  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        // We can filter by status directly in query if API supports it, 
        // or filter client side. Here attempting filtering via API status param.
        const response = await api.sales.getAll({ status: 'completed' });
        if (response.success && response.data) {
          setSales(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch closed sales:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, []);

  const totalClosedUZS = useMemo(() => sales.reduce((acc, curr) => acc + (curr.totalAmountUZS || 0), 0), [sales]);
  const totalClosedUSD = useMemo(() => sales.reduce((acc, curr) => acc + (curr.totalAmountUSD || 0), 0), [sales]);

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" />
            Закрытые продажи
          </h1>
          <p className="text-sm opacity-60 mt-1">Фискально подтвержденные операции (Мультивалютный реестр).</p>
        </div>
        <div className="flex gap-4">
          {totalClosedUZS > 0 && (
            <div className={`px-4 py-2 rounded-lg border flex flex-col items-end ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <span className="text-xs opacity-50 uppercase font-bold tracking-wider">Оборот UZS</span>
              <span className="text-xl font-bold text-blue-500">{totalClosedUZS.toLocaleString()} сум</span>
            </div>
          )}
          {totalClosedUSD > 0 && (
            <div className={`px-4 py-2 rounded-lg border flex flex-col items-end ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <span className="text-xs opacity-50 uppercase font-bold tracking-wider">Оборот USD</span>
              <span className="text-xl font-bold text-green-500">${totalClosedUSD.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase font-semibold border-b ${isDark ? 'bg-gray-700/50 text-gray-300 border-gray-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              <tr>
                <th className="px-5 py-3 w-10"></th>
                <th className="px-5 py-3">Фискальный ID</th>
                <th className="px-5 py-3">Дата Фиксации</th>
                <th className="px-5 py-3">Метод Оплаты</th>
                <th className="px-5 py-3 text-right">Сумма (UZS)</th>
                <th className="px-5 py-3 text-right">Сумма (USD)</th>
                <th className="px-5 py-3 text-center">Статус</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 opacity-50">Загрузка...</td></tr>
              ) : sales.map((sale) => (
                <tr key={sale.id} className={`hover:bg-opacity-50 transition-colors group ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className="px-5 py-3 text-center opacity-30 group-hover:opacity-100">
                    <Lock size={14} className="mx-auto" />
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-blue-500">
                    {sale.invoiceNumber}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {new Date(sale.date || sale.createdAt || Date.now()).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1 items-center text-xs">
                      {sale.payments?.map((p, idx) => (
                        <span key={idx} className={`px-2 py-1 rounded border flex items-center gap-1 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
                          {p.method === 'cash' ? <DollarSign size={10} /> : <CreditCard size={10} />}
                          {p.currency === 'UZS' ? `${p.amount.toLocaleString()} сум` : `$${p.amount.toLocaleString()}`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                    {sale.totalAmountUZS > 0 ? sale.totalAmountUZS.toLocaleString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-600 dark:text-green-400">
                    {sale.totalAmountUSD > 0 ? sale.totalAmountUSD.toLocaleString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 tracking-wider">
                      Оплачено
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center opacity-50 flex flex-col items-center justify-center">
                    <Ban size={24} className="mb-2 opacity-50" />
                    Нет закрытых продаж
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesClosedPage;
