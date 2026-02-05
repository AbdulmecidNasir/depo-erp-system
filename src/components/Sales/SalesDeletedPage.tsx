import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sale } from '../../types/sales';
import { api } from '../../services/api';
import { Trash2, UserX, Calendar, Package, ShoppingCart, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

const SalesDeletedPage: React.FC = () => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'sales' | 'stock'>('stock');
  const [deletedSales, setDeletedSales] = useState<Sale[]>([]);
  const [deletedStock, setDeletedStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const response = await api.sales.getDeleted();
        if (response.success && response.data) {
          setDeletedSales(response.data);
        }
      } else {
        const response = await api.stockMovements.getDeleted();
        if (response.success && response.data) {
          setDeletedStock(response.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch deleted items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in': return <ArrowDownToLine size={16} className="text-green-500" />;
      case 'out': return <ArrowUpFromLine size={16} className="text-red-500" />;
      case 'transfer': return <ArrowRightLeft size={16} className="text-blue-500" />;
      default: return <Package size={16} />;
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'in': return 'Приход';
      case 'out': return 'Расход';
      case 'transfer': return 'Перемещение';
      case 'adjustment': return 'Корректировка';
      default: return type;
    }
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-red-600">
          <Trash2 />
          Удаленные операции
        </h1>
        <p className="text-sm opacity-60 mt-1">Журнал аудита отмененных и удаленных операций.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-2 px-4 font-medium text-sm flex items-center gap-2 transition-colors relative ${activeTab === 'stock'
            ? 'text-blue-500'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          <Package size={18} />
          Склад
          {activeTab === 'stock' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-2 px-4 font-medium text-sm flex items-center gap-2 transition-colors relative ${activeTab === 'sales'
            ? 'text-blue-500'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          <ShoppingCart size={18} />
          Продажи
          {activeTab === 'sales' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full" />
          )}
        </button>
      </div>

      <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`text-xs uppercase font-semibold ${isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-50 text-gray-500'}`}>
              <tr>
                {activeTab === 'sales' ? (
                  <>
                    <th className="px-6 py-4">ID Продажи</th>
                    <th className="px-6 py-4">Сумма (UZS)</th>
                    <th className="px-6 py-4">Сумма (USD)</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Тип</th>
                    <th className="px-6 py-4">Товар</th>
                    <th className="px-6 py-4">Количество</th>
                    <th className="px-6 py-4">Партия</th>
                  </>
                )}
                <th className="px-6 py-4">Кем удалено</th>
                <th className="px-6 py-4">Причина</th>
                <th className="px-6 py-4">Дата удаления</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 opacity-50">Загрузка...</td></tr>
              ) : (activeTab === 'sales' ? deletedSales : deletedStock).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center opacity-50">
                    Записей не найдено
                  </td>
                </tr>
              ) : (
                activeTab === 'sales' ? (
                  deletedSales.map((sale) => (
                    <tr key={sale.id} className={`hover:bg-opacity-50 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 font-mono text-sm opacity-70">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-500">
                        {sale.totalAmountUZS > 0 ? sale.totalAmountUZS.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-green-500">
                        {sale.totalAmountUSD > 0 ? `$${sale.totalAmountUSD.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserX size={16} className="text-red-400" />
                          {typeof sale.deletedBy === 'object' ? (sale.deletedBy as any).firstName : (sale.deletedBy || 'Unknown')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                          {sale.deleteReason || sale.returnReason || 'Удалено'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm opacity-60 flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(sale.deletedAt || Date.now()).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  deletedStock.map((item) => (
                    <tr key={item.id || item._id} className={`hover:bg-opacity-50 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getMovementIcon(item.type)}
                          <span className="font-medium text-sm">{getMovementLabel(item.type)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">
                          {item.productId?.nameRu || 'Удаленный товар'}
                        </div>
                        <div className="text-xs opacity-60">
                          {item.productId?.brand} {item.productId?.model}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {item.quantity} шт.
                      </td>
                      <td className="px-6 py-4 text-xs font-mono opacity-60">
                        {item.batchNumber || item.movementId || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserX size={16} className="text-red-400" />
                          <span className="text-sm">
                            {item.deletedBy?.firstName || 'Unknown'} {item.deletedBy?.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                          {item.deleteReason || 'Удалено'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm opacity-60 flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(item.deletedAt || item.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesDeletedPage;
