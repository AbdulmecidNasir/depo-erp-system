import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Search, Shield, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface User {
    _id: string; // API returns _id
    id?: string; // Transformed might have id
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    profilePhotoUrl?: string;
}

const ROLES = [
    { value: 'admin', label: 'Администратор' },
    { value: 'sales_manager', label: 'Менеджер продаж' },
    { value: 'warehouse_manager', label: 'Завсклад' },
    { value: 'warehouse_staff', label: 'Кладовщик' },
    { value: 'cashier', label: 'Кассир' },
    { value: 'customer', label: 'Клиент' }
];

const UsersPage: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.users.getAll();
            if (response.success) {
                setUsers(response.data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [currentUser]); // Reload when current user context changes/loads

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            const response = await api.users.update(userId, { role: newRole });
            if (response.success) {
                toast.success('Роль пользователя обновлена');
                setUsers(users.map(u => (u._id === userId || u.id === userId) ? { ...u, role: newRole } : u));
            }
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error('Не удалось обновить роль');
        }
    };

    const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
        try {
            const response = await api.users.update(userId, { isActive: !currentStatus });
            if (response.success) {
                toast.success(`Пользователь ${!currentStatus ? 'активирован' : 'деактивирован'}`);
                setUsers(users.map(u => (u._id === userId || u.id === userId) ? { ...u, isActive: !currentStatus } : u));
            }
        } catch (error) {
            toast.error('Ошибка изменения статуса');
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            (user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter ? user.role === roleFilter : true;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Управление пользователями
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Назначение ролей и управление доступом сотрудников
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white outline-none w-64"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                        <option value="">Все роли</option>
                        {ROLES.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-700 bg-gray-800/80">
                                <th className="px-6 py-4 text-gray-400 font-medium text-sm">Пользователь</th>
                                <th className="px-6 py-4 text-gray-400 font-medium text-sm">Email</th>
                                <th className="px-6 py-4 text-gray-400 font-medium text-sm">Роль</th>
                                <th className="px-6 py-4 text-gray-400 font-medium text-sm">Статус</th>
                                <th className="px-6 py-4 text-gray-400 font-medium text-sm text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        Загрузка...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        Пользователи не найдены
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user._id || user.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                                                    {user.profilePhotoUrl ? (
                                                        <img src={user.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span>{(user.firstName || '?')[0]}{(user.lastName || '?')[0]}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{user.firstName} {user.lastName}</p>
                                                    <p className="text-xs text-gray-500">ID: {(user._id || user.id || '').slice(-6)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <div className="relative">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user._id || user.id!, e.target.value)}
                                                    className={`
                            appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium border-0 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors
                            ${user.role === 'admin' ? 'bg-red-500/10 text-red-400' :
                                                            user.role === 'customer' ? 'bg-gray-700 text-gray-300' :
                                                                'bg-blue-500/10 text-blue-400'}
                          `}
                                                >
                                                    {ROLES.map(role => (
                                                        <option key={role.value} value={role.value} className="bg-gray-800 text-white">
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Shield className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 opacity-50 pointer-events-none" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleStatusToggle(user._id || user.id!, user.isActive)}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${user.isActive
                                                        ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                                                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                    }`}
                                            >
                                                {user.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                                {user.isActive ? 'Активен' : 'Неактивен'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {/* More actions if needed */}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UsersPage;
