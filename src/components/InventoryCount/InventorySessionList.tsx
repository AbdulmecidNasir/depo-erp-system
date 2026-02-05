import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { Package, Calendar, X, Check, Activity, Layers, Target, RefreshCw, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const InventorySessionList: React.FC = () => {
    const { isDark } = useTheme();
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const navigate = useNavigate();

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSessionType, setNewSessionType] = useState('cycle');
    const [newSessionDescription, setNewSessionDescription] = useState('');

    // Scope Selection
    const [scopeMode, setScopeMode] = useState<'all' | 'zone' | 'location'>('all');
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');

    // Data for dropdowns
    const [availableLocations, setAvailableLocations] = useState<any[]>([]);
    const [availableZones, setAvailableZones] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadSessions();
    }, []);

    // Load locations when modal opens
    useEffect(() => {
        if (showCreateModal) {
            loadLocations();
        }
    }, [showCreateModal]);

    const loadSessions = async () => {
        try {
            const res = await api.inventoryCount.getSessions();
            if (res.success) {
                setSessions(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadLocations = async () => {
        try {
            // Increased limit in backend allows getting all locations now
            const res = await api.locations.getAll({ limit: 10000 });
            if (res.success) {
                // Sort by code for better UX
                const locs = res.data.sort((a: any, b: any) => a.code.localeCompare(b.code));
                setAvailableLocations(locs);

                // Extract unique zones
                const zones = Array.from(new Set(res.data.map((l: any) => l.zone))).filter(Boolean).sort();
                setAvailableZones(zones);
            }
        } catch (error) {
            console.error("Failed to load locations", error);
        }
    };

    const handleSync = async () => {
        if (!confirm("Это действие скопирует текущие остатки Товаров в таблицу Инвентаря. Это необходимо перед первой инвентаризацией. Продолжить?")) return;
        setSyncing(true);
        try {
            const res = await api.inventoryCount.sync();
            if (res.success) {
                alert(res.message || "Синхронизация завершена успешно!");
            }
        } catch (error) {
            alert("Ошибка синхронизации");
        } finally {
            setSyncing(false);
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        const scope: any = {};

        if (scopeMode === 'zone' && selectedZone) {
            scope.zones = [selectedZone];
        } else if (scopeMode === 'location' && selectedLocation) {
            // New backend support for locationCodes
            scope.locationCodes = [selectedLocation];
        }

        try {
            // Ensure description is not empty
            const desc = newSessionDescription ||
                (scopeMode === 'zone' ? `Инвентаризация зоны ${selectedZone}` :
                    scopeMode === 'location' ? `Инвентаризация локации ${selectedLocation}` :
                        getStatusText(newSessionType));

            const res = await api.inventoryCount.createSession({
                type: newSessionType,
                scope: scope,
                description: desc
            });
            if (res.success) {
                setShowCreateModal(false);
                setNewSessionDescription('');
                setSelectedZone('');
                setSelectedLocation('');
                setScopeMode('all');
                loadSessions();
            } else {
                alert("Не удалось создать сессию (возможно, инвентарь пуст. Сначала выполните синхронизацию).");
            }
        } catch (err) {
            alert("Ошибка при создании сессии");
        } finally {
            setCreating(false);
        }
    };

    const getStatusText = (status: string) => {
        const map: any = {
            planned: 'Планируется',
            active: 'Активно',
            review: 'Проверка',
            approved: 'Утверждено',
            completed: 'Завершено',
            cancelled: 'Отменено',
            // Types
            cycle: 'Циклическая',
            full: 'Полная',
            spot: 'Точечная'
        };
        return map[status] || status.toUpperCase();
    };

    const getStatusBadge = (status: string) => {
        const colors: any = {
            planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            active: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
            approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        };
        return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100'}`}>{getStatusText(status)}</span>
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'cycle': return <Activity className="w-4 h-4" />;
            case 'full': return <Layers className="w-4 h-4" />;
            case 'spot': return <Target className="w-4 h-4" />;
            default: return <Package className="w-4 h-4" />;
        }
    };

    return (
        <div className={`p-6 transition-colors duration-300 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="w-6 h-6" />
                    Инвентаризация
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border ${isDark ? 'border-gray-600 hover:bg-gray-700 text-gray-300' : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                        title="Скопировать остатки из Товаров в Инвентарь"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Синхронизация...' : 'Синхронизация данных'}
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Calendar className="w-4 h-4" /> Начать инвентаризацию
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Загрузка...</p>
                </div>
            ) : (
                <div className={`rounded-xl shadow-sm overflow-hidden border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                            <tr>
                                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Код</th>
                                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Тип</th>
                                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Статус</th>
                                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата</th>
                                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Статистика</th>
                                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Действия</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                            {sessions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center opacity-50">
                                        Нет активных сессий инвентаризации
                                    </td>
                                </tr>
                            ) : (
                                sessions.map((session) => (
                                    <tr key={session._id} className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`} onClick={() => navigate(`/inventory/count/${session._id}`)}>
                                        <td className={`px-6 py-4 whitespace-nowrap font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{session.sessionCode}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {getTypeIcon(session.type)}
                                                {getStatusText(session.type)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(session.status)}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {new Date(session.createdAt).toLocaleDateString('ru-RU')}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            <div className="flex flex-col">
                                                <span>Всего позиций: {session.stats?.totalLines || 0}</span>
                                                {session.stats?.discrepancyLines > 0 && (
                                                    <span className="text-red-500 text-xs font-bold">Расхождения: {session.stats.discrepancyLines}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className={`${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'}`}>Подробнее &rarr;</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Session Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl transform transition-all scale-100 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Новая инвентаризация</h3>
                                <button onClick={() => setShowCreateModal(false)} className={`p-1 rounded-full hover:bg-opacity-10 ${isDark ? 'hover:bg-gray-300 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSubmit} className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Тип инвентаризации
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={newSessionType}
                                            onChange={(e) => setNewSessionType(e.target.value)}
                                            className={`w-full p-3 rounded-lg border appearance-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-900'
                                                }`}
                                        >
                                            <option value="cycle">Циклическая (Плановая)</option>
                                            <option value="full">Полная (Вся)</option>
                                            <option value="spot">Точечная (Выборочная)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Область инвентаризации
                                    </label>
                                    <select
                                        value={scopeMode}
                                        onChange={(e) => setScopeMode(e.target.value as any)}
                                        className={`w-full p-3 rounded-lg border appearance-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    >
                                        <option value="all">Весь склад (Все локации)</option>
                                        <option value="zone">По зоне (Зона)</option>
                                        <option value="location">По конкретной локации (Полка/Ячейка)</option>
                                    </select>
                                </div>

                                {scopeMode === 'zone' && (
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Выберите зону
                                        </label>
                                        <select
                                            value={selectedZone}
                                            onChange={(e) => setSelectedZone(e.target.value)}
                                            className={`w-full p-3 rounded-lg border appearance-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-900'
                                                }`}
                                        >
                                            <option value="">-- Выберите зону --</option>
                                            {availableZones.map(z => (
                                                <option key={z} value={z}>{z}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {scopeMode === 'location' && (
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Выберите локацию
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={selectedLocation}
                                                onChange={(e) => setSelectedLocation(e.target.value)}
                                                className={`w-full p-3 rounded-lg border appearance-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark
                                                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                    : 'bg-white border-gray-300 text-gray-900'
                                                    }`}
                                            >
                                                <option value="">-- Выберите локацию --</option>
                                                {availableLocations.map(l => (
                                                    <option key={l.id} value={l.code}>{l.code} {l.description ? `(${l.description})` : ''}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                <svg className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Будут добавлены товары только с выбранной полки/ячейки.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Описание (опционально)
                                    </label>
                                    <input
                                        type="text"
                                        value={newSessionDescription}
                                        onChange={(e) => setNewSessionDescription(e.target.value)}
                                        placeholder="Например: Ежемесячный пересчет"
                                        className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 transition-colors ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    />
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${isDark
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creating}
                                        className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Check className="w-4 h-4" />}
                                        Создать
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventorySessionList;
