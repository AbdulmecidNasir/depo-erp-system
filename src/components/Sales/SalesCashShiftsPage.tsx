import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Shift } from '../../types/sales';
import { api } from '../../services/api';
import { Wallet, Clock, Archive, CheckCircle2 } from 'lucide-react';

const SalesCashShiftsPage: React.FC = () => {
  const { isDark } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showZReportModal, setShowZReportModal] = useState(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      // Fetch current
      const currentRes = await api.shifts.getCurrent();
      if (currentRes.success) {
        setActiveShift(currentRes.data);
      } else {
        setActiveShift(null);
      }

      // Fetch history
      const historyRes = await api.shifts.getHistory({ limit: 10 });
      if (historyRes.success) {
        // Filter out the active one if it appears in history or just display closed ones
        setPastShifts(historyRes.data.filter(s => s.status === 'closed'));
      }
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleStartShift = async () => {
    try {
      // In a real app, open a modal to ask for opening balance
      const openingBalanceUZS = Number(prompt('Открытие кассы UZS:', '0'));
      const openingBalanceUSD = Number(prompt('Открытие кассы USD:', '0'));

      if (isNaN(openingBalanceUZS) || isNaN(openingBalanceUSD)) return;

      const res = await api.shifts.start({ openingBalanceUZS, openingBalanceUSD });
      if (res.success) {
        fetchShifts(); // Refresh
      } else {
        alert('Не удалось открыть смену');
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка при открытии смены');
    }
  };

  const handleCloseShift = async () => {
    // In a real app, use the modal
    if (!confirm('Закрыть смену и сформировать Z-отчет?')) return;

    // In real app, these values come from user input (counting cash)
    const actualUZS = Number(prompt('Фактическая сумма в кассе (UZS):', '0'));
    const actualUSD = Number(prompt('Фактическая сумма в кассе (USD):', '0'));

    try {
      const res = await api.shifts.end({
        closingBalanceActualUZS: actualUZS,
        closingBalanceActualUSD: actualUSD
      });
      if (res.success) {
        alert('Смена закрыта!');
        fetchShifts();
        setShowZReportModal(false);
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при закрытии смены');
    }
  };

  return (
    <div className={`p-6 min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Кассовые смены</h1>
          <p className="text-sm opacity-60 mt-1">Управление сменами и Z-отчеты (Мультивалютная касса)</p>
        </div>

        {!activeShift && !loading && (
          <button
            onClick={handleStartShift}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            <Wallet size={18} />
            <span>Открыть смену</span>
          </button>
        )}
      </div>

      {/* Active Shift Card */}
      {loading ? (
        <div className="mb-8 p-8 text-center opacity-50">Загрузка данных смены...</div>
      ) : activeShift ? (
        <div className={`mb-8 p-6 rounded-xl border relative overflow-hidden ${isDark ? 'bg-gray-800 border-blue-500/30' : 'bg-white border-blue-200'}`}>
          <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl text-xs font-bold uppercase tracking-wider ${isDark ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
            Активная смена
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <div className="text-sm opacity-60 mb-1">Кассир</div>
              <div className="font-semibold text-lg">{activeShift.cashierName}</div>
              <div className="text-xs opacity-50 flex items-center gap-1 mt-1">
                <Clock size={12} />
                Начало: {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* UZS Cash */}
            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Касса (UZS)</div>
              <div className="font-bold text-2xl flex flex-col">
                <span>{(activeShift.openingBalanceUZS + activeShift.totalSalesCashUZS).toLocaleString()} <span className="text-xs">сум</span></span>
              </div>
              <div className="text-xs opacity-50 mt-1">
                Нач: {activeShift.openingBalanceUZS.toLocaleString()} + Прод: {activeShift.totalSalesCashUZS.toLocaleString()}
              </div>
            </div>

            {/* USD Cash */}
            <div className="bg-green-50/50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
              <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Касса (USD)</div>
              <div className="font-bold text-2xl flex flex-col">
                <span>{activeShift.openingBalanceUSD + activeShift.totalSalesCashUSD} <span className="text-xs">$</span></span>
              </div>
              <div className="text-xs opacity-50 mt-1">
                Нач: {activeShift.openingBalanceUSD} + Прод: {activeShift.totalSalesCashUSD}
              </div>
            </div>

            {/* Card Totals */}
            <div>
              <div className="text-sm opacity-60 mb-1">Безнал (Терминал)</div>
              <div className="font-semibold text-lg text-gray-700 dark:text-gray-200">
                {activeShift.totalSalesCardUZS.toLocaleString()} сум
              </div>
              <div className="font-semibold text-lg text-gray-700 dark:text-gray-200">
                {activeShift.totalSalesCardUSD.toLocaleString()} $
              </div>
            </div>

            <div className="flex flex-col justify-center items-end">
              <button
                onClick={handleCloseShift}
                className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-medium shadow-lg shadow-red-500/20 transition-all mb-2"
              >
                Z-отчет
              </button>
              <div className="flex gap-2 w-full">
                <button className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                  Внести
                </button>
                <button className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                  Изъять
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`mb-8 p-8 rounded-xl border border-dashed flex flex-col items-center justify-center text-center ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-500'}`}>
          <Archive size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">Нет активной смены</p>
          <p className="text-sm opacity-70 max-w-md mt-2">Чтобы начать продажи, необходимо открыть новую кассовую смену. Подготовьте разменную монету (UZS/USD).</p>
        </div>
      )}

      {/* Past Shifts History */}
      <div>
        <h2 className="text-lg font-semibold mb-4">История смен</h2>

        <div className={`rounded-xl shadow-sm border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase font-semibold ${isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-50 text-gray-500'}`}>
              <tr>
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">Кассир / Время</th>
                <th className="px-4 py-4 text-right bg-blue-50/10">Выручка (UZS)</th>
                <th className="px-4 py-4 text-right bg-green-50/10">Выручка (USD)</th>
                <th className="px-4 py-4 text-right">Расхождение</th>
                <th className="px-4 py-4 text-center">Статус</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {pastShifts.map((shift, index) => {
                const varianceUZS = (shift.closingBalanceActualUZS || 0) - (shift.closingBalanceTheoreticalUZS || 0);
                const varianceUSD = (shift.closingBalanceActualUSD || 0) - (shift.closingBalanceTheoreticalUSD || 0);
                const hasVariance = varianceUZS !== 0 || varianceUSD !== 0;

                return (
                  <tr key={shift.id || index} className={`hover:bg-opacity-50 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-4 font-mono text-xs text-blue-500">#{shift.id?.toString().substring(0, 8).toUpperCase() || 'N/A'}</td>
                    <td className="px-4 py-4">
                      {/* Assuming ID populated to user obj or kept as ID string */}
                      <div className="font-medium">{shift.cashierName || 'Kassir'}</div>
                      <div className="text-xs opacity-50">
                        {new Date(shift.startTime).toLocaleString('ru-RU', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right bg-blue-50/5">
                      <div className="font-medium">{shift.totalSalesCashUZS.toLocaleString()}</div>
                      <div className="text-xs opacity-50">Карта: {shift.totalSalesCardUZS.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4 text-right bg-green-50/5">
                      <div className="font-medium">${shift.totalSalesCashUSD.toLocaleString()}</div>
                      <div className="text-xs opacity-50">Карта: ${shift.totalSalesCardUSD.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {!hasVariance ? (
                        <span className="text-emerald-500 flex items-center justify-end gap-1"><CheckCircle2 size={14} /> OK</span>
                      ) : (
                        <div className="flex flex-col items-end text-red-500 font-bold text-xs">
                          {varianceUZS !== 0 && <span>{varianceUZS > 0 ? '+' : ''}{varianceUZS} UZS</span>}
                          {varianceUSD !== 0 && <span>{varianceUSD > 0 ? '+' : ''}{varianceUSD} USD</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        Закрыта
                      </span>
                    </td>
                  </tr>
                );
              })}
              {pastShifts.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-8 opacity-50">История смен пуста</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default SalesCashShiftsPage;
