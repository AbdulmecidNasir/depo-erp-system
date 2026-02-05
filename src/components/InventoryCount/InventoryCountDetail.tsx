import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Check, X, AlertTriangle, Printer, ArrowLeft } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const InventoryCountDetail: React.FC = () => {
    const { isDark } = useTheme();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [lines, setLines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    const [session, setSession] = useState<any>(null);

    // Edits
    const [edits, setEdits] = useState<Record<string, number>>({});

    useEffect(() => {
        if (id) loadLines();
    }, [id, filterStatus]);

    const loadLines = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const filter: any = {};
            if (filterStatus === 'uncounted') filter.status = 'uncounted';
            if (filterStatus === 'discrepancy') filter.status = 'discrepancy';

            const res = await api.inventoryCount.getSessionLines(id, filter);
            if (res.success) {
                setLines(res.data);
                if (res.session) setSession(res.session);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (lineId: string, val: string) => {
        // Only allow edits if session is active
        if (session && session.status !== 'active') return;

        const num = parseFloat(val);
        setEdits(prev => ({ ...prev, [lineId]: isNaN(num) ? 0 : num }));
    };

    const saveChanges = async () => {
        if (!id) return;
        const updates = Object.entries(edits).map(([lineId, qty]) => ({
            _id: lineId,
            countedQty: qty
        }));

        if (updates.length === 0) return;

        try {
            const res = await api.inventoryCount.addLine(id, updates);
            if (res.success) {
                alert("Сохранено");
                setEdits({});
                loadLines();
            }
        } catch (error) {
            alert("Ошибка сохранения");
        }
    };

    const submitSession = async () => {
        if (!id || !confirm("Отправить на проверку?")) return;
        try {
            await api.inventoryCount.submitSession(id);
            alert("Отправлено!");
            loadLines(); // Refresh to update status
        } catch (error: any) {
            alert(error?.message || "Ошибка");
        }
    };

    const approveSession = async () => {
        if (!id || !confirm("ВНИМАНИЕ: Стоки будут обновлены! Продолжить?")) return;
        try {
            const res = await api.inventoryCount.approveSession(id);
            alert("Успешно утверждено!");
            loadLines(); // Refresh to update status
        } catch (error: any) {
            alert(error?.message || "Ошибка");
        }
    };

    return (
        <div className={`p-6 h-screen flex flex-col transition-colors duration-300 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
            {/* Header */}
            <div className={`flex justify-between items-center mb-4 p-4 rounded-lg shadow ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/inventory')}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                        title="Назад"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Детали инвентаризации
                            {session && (
                                <span className={`text-xs px-2 py-1 rounded-full ${session.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                                    session.status === 'review' ? 'bg-purple-100 text-purple-800' :
                                        session.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                                    }`}>
                                    {session.status.toUpperCase()}
                                </span>
                            )}
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ID: {session?.sessionCode || id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className={`border rounded p-2outline-none cursor-pointer ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
                    >
                        <option value="all">Все</option>
                        <option value="uncounted">Непосчитанные</option>
                        <option value="discrepancy">Расхождения</option>
                    </select>

                    {session?.status === 'active' && Object.keys(edits).length > 0 && (
                        <button onClick={saveChanges} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1 hover:bg-blue-700">
                            <Save size={16} /> Сохранить ({Object.keys(edits).length})
                        </button>
                    )}

                    {session?.status === 'active' && (
                        <button onClick={submitSession} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
                            Завершить
                        </button>
                    )}

                    {session?.status === 'review' && (
                        <button onClick={approveSession} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                            УТВЕРДИТЬ (АДМИН)
                        </button>
                    )}

                    {session?.status === 'approved' && (
                        <div className="px-4 py-2 bg-green-100 text-green-800 rounded flex items-center gap-2">
                            <Check size={16} /> Подтверждено
                        </div>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className={`flex-1 rounded-lg shadow overflow-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <table className={`min-w-full divide-y relative ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={`sticky top-0 z-10 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                            <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Локация</th>
                            <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Продукт</th>
                            <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Ожидается</th>
                            <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Посчитано</th>
                            <th className={`px-4 py-3 text-center text-xs font-medium uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Разница</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        {loading ? (
                            <tr><td colSpan={5} className="p-4 text-center">Загрузка...</td></tr>
                        ) : lines.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-10 text-center">
                                    <div className={`flex flex-col items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <AlertTriangle className="w-12 h-12 mb-3 opacity-50" />
                                        <h3 className="text-lg font-medium mb-1">Список пуст</h3>
                                        <p className="max-w-md text-sm mb-4">
                                            Похоже, что товаров для инвентаризации не найдено.
                                            Возможно, ваша база данных инвентаря пуста.
                                        </p>
                                        <p className="text-xs opacity-70">
                                            Пожалуйста, вернитесь назад и нажмите кнопку <b>"Синхронизация данных"</b>, затем создайте новую сессию.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : lines.map((line) => {
                            const isCounted = line.countedQty !== null && line.countedQty !== undefined;
                            const isEdited = edits[line._id] !== undefined;
                            // Use edited value for display if exists, otherwise saved value
                            const displayQty = isEdited ? edits[line._id] : (line.countedQty ?? '');

                            // Status logic (based on saved data mainly, but we can hint edits)
                            const diff = line.diffQty;
                            const isMatch = isCounted && diff === 0;
                            const isDiff = isCounted && diff !== 0;

                            return (
                                <tr key={line._id} className={`${!isCounted ? (isDark ? 'bg-gray-800' : 'bg-white') : (isDiff ? (isDark ? 'bg-red-900/20' : 'bg-red-50') : (isDark ? 'bg-green-900/10' : 'bg-green-50'))} ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}>
                                    <td className="px-4 py-3 whitespace-nowrap font-mono text-sm">{line.location?.code} <span className="opacity-50">/ {line.location?.zone}</span></td>
                                    <td className="px-4 py-3">
                                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{line.product?.nameRu || line.product?.name}</div>
                                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{line.product?.barcode}</div>
                                    </td>
                                    <td className={`px-4 py-3 text-center text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {line.systemQty !== undefined ? line.systemQty : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="relative inline-block">
                                            <input
                                                type="number"
                                                className={`border rounded p-1 w-24 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark
                                                        ? 'bg-gray-700 border-gray-600 text-white'
                                                        : 'bg-white border-gray-300 text-gray-900'
                                                    } ${isEdited ? 'border-yellow-500 ring-1 ring-yellow-500' : ''}`}
                                                placeholder="0"
                                                value={displayQty}
                                                onChange={(e) => handleInputChange(line._id, e.target.value)}
                                                min="0"
                                            />
                                            {isEdited && (
                                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full"></div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        {!isCounted ? (
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                                <AlertTriangle className="w-3 h-3 mr-1" />
                                                Ожидает
                                            </span>
                                        ) : isMatch ? (
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`}>
                                                <Check className="w-3 h-3 mr-1" />
                                                OK
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${diff > 0 ? (isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800') : (isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800')}`}>
                                                {diff > 0 ? `+${diff}` : `${diff}`}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InventoryCountDetail;
