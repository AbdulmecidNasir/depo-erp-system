import React, { useState } from 'react';
import {
  Plus,
  MapPin,
  Edit,
  Trash2,
  Package,
  BarChart3,
  AlertCircle,
  X
} from 'lucide-react';
import { WarehouseLocation } from '../../types/warehouse';
import { useTheme } from '../../contexts/ThemeContext';

interface LocationManagementProps {
  locations: WarehouseLocation[];
  products: any[];
  onAddLocation: (location: any) => void;
  onEditLocation: (location: WarehouseLocation) => void;
  onDeleteLocation: (locationId: string) => void;
}

const LocationManagement: React.FC<LocationManagementProps> = ({
  locations,
  products,
  onAddLocation,
  onEditLocation,
  onDeleteLocation
}) => {
  const { isDark } = useTheme();
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [newLocation, setNewLocation] = useState({
    code: '',
    name: '',
    description: '',
    capacity: 0,
    zone: 'A',
    level: 1,
    section: 1
  });
  // Controlled string input for capacity to avoid leading zero artifacts like "01"
  const [capacityInput, setCapacityInput] = useState<string>('0');
  const [editCapacityInput, setEditCapacityInput] = useState<string>('0');

  const filteredLocations = locations.filter(location => {
    if (selectedZone === 'all') return true;
    return location.zone === selectedZone;
  });

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'text-red-600 bg-red-100';
    if (utilization >= 75) return 'text-orange-600 bg-orange-100';
    if (utilization >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-emerald-600 bg-emerald-100';
  };

  const getUtilizationText = (utilization: number) => {
    if (utilization >= 90) return 'Переполнена';
    if (utilization >= 75) return 'Высокая загрузка';
    if (utilization >= 50) return 'Средняя загрузка';
    return 'Низкая загрузка';
  };

  // Get quantity of a specific product at a given location using locationStock if available
  const getProductQtyAtLocation = (product: any, locationCode: string): number => {
    const ls: any = product?.locationStock;
    try {
      if (ls) {
        if (typeof ls.get === 'function') {
          // Map
          const qty = ls.get(locationCode);
          if (typeof qty === 'number') return qty;
        } else if (typeof ls === 'object') {
          const qty = (ls as Record<string, number>)[locationCode];
          if (typeof qty === 'number') return qty;
        }
      }
    } catch { }
    // Fallback: if no per-location record, treat primary location as carrying full stock
    return product.location === locationCode ? (product.stock || 0) : 0;
  };

  // Calculate products in each location (with per-location qty)
  const getProductsInLocation = (locationCode: string) => {
    return products
      .map(product => ({ product, qty: getProductQtyAtLocation(product, locationCode) }))
      .filter(item => (item.qty || 0) > 0);
  };

  // Calculate actual occupancy based on per-location quantities
  const getActualOccupancy = (locationCode: string) => {
    const items = getProductsInLocation(locationCode);
    return items.reduce((sum, item) => sum + (item.qty || 0), 0);
  };

  const totalCapacity = locations.reduce((sum, loc) => sum + (loc.capacity || 0), 0);
  const totalOccupancy = locations.reduce((sum, loc) => {
    const actualOccupancy = getActualOccupancy(loc.code);
    return sum + actualOccupancy;
  }, 0);
  const overallUtilization = (totalOccupancy / totalCapacity) * 100;

  const handleEditClick = (location: any) => {
    setEditingLocation(location);
    setEditCapacityInput((location.capacity || 0).toString());
    setShowEditForm(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = Number(editingLocation?.capacity ?? 0);
    if (editingLocation && editingLocation.code && editingLocation.name && capacity >= 0) {
      onEditLocation({ ...editingLocation, capacity });
      setShowEditForm(false);
      setEditingLocation(null);
      setEditCapacityInput('0');
    }
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setEditingLocation(null);
    setEditCapacityInput('0');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
            }`}>Управление локациями</h2>
          <p className={`mt-1 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
            Общая загрузка склада: {overallUtilization.toFixed(1)}% ({totalOccupancy}/{totalCapacity})
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center mt-4 lg:mt-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить локацию
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>Всего локаций</p>
              <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>{locations.length}</p>
            </div>
            <MapPin className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>Общая вместимость</p>
              <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>{totalCapacity}</p>
            </div>
            <Package className="h-8 w-8 text-emerald-600" />
          </div>
        </div>

        <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>Занято мест</p>
              <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>{totalOccupancy}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>Загрузка</p>
              <p className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                }`}>{overallUtilization.toFixed(1)}%</p>
            </div>
            <AlertCircle className={`h-8 w-8 ${overallUtilization >= 80 ? 'text-red-600' : 'text-emerald-600'}`} />
          </div>
        </div>
      </div>

      {/* Zone Filter */}
      <div className={`rounded-lg shadow-md p-6 transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
        }`}>
        <div className="flex items-center space-x-4">
          <label className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>Фильтр по зонам:</label>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
          >
            <option value="all">Все зоны</option>
            <option value="A">Зона A</option>
            <option value="B">Зона B</option>
            <option value="C">Зона C</option>
            <option value="D">Зона D</option>
          </select>
        </div>
      </div>

      {/* Add Location Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Добавить новую локацию</h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (newLocation.code && newLocation.name && newLocation.capacity > 0) {
              onAddLocation({
                ...newLocation,
                currentOccupancy: 0
              });
              setNewLocation({
                code: '',
                name: '',
                description: '',
                capacity: 0,
                zone: 'A',
                level: 1,
                section: 1
              });
              setCapacityInput('0');
              setShowAddForm(false);
            }
          }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Код локации
                </label>
                <input
                  type="text"
                  value={newLocation.code}
                  onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="A1-B1-C1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название
                </label>
                <input
                  type="text"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Название локации"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Зона
                </label>
                <select
                  value={newLocation.zone}
                  onChange={(e) => setNewLocation({ ...newLocation, zone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="A">Зона A</option>
                  <option value="B">Зона B</option>
                  <option value="C">Зона C</option>
                  <option value="D">Зона D</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Вместимость
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={capacityInput}
                  onFocus={(e) => {
                    // If initial value is '0', select it so typing replaces it
                    if (e.currentTarget.value === '0') {
                      e.currentTarget.select();
                    }
                  }}
                  onChange={(e) => {
                    // Allow only digits, strip non-digits
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    // Remove leading zeros
                    const cleaned = raw.replace(/^0+(?=\d)/, '');
                    // If empty, keep it empty in UI but treat as 0 for state
                    setCapacityInput(cleaned === '' ? '' : cleaned);
                    setNewLocation({
                      ...newLocation,
                      capacity: cleaned === '' ? 0 : parseInt(cleaned, 10)
                    });
                  }}
                  onBlur={(e) => {
                    // If user leaves it empty, restore to '0' for placeholder-like behavior
                    if (e.currentTarget.value === '') {
                      setCapacityInput('0');
                      setNewLocation({ ...newLocation, capacity: 0 });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Уровень
                </label>
                <input
                  type="number"
                  value={newLocation.level}
                  onChange={(e) => setNewLocation({ ...newLocation, level: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Секция
                </label>
                <input
                  type="number"
                  value={newLocation.section}
                  onChange={(e) => setNewLocation({ ...newLocation, section: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание
              </label>
              <textarea
                value={newLocation.description}
                onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Описание локации"
                rows={3}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Добавить локацию
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewLocation({
                    code: '',
                    name: '',
                    description: '',
                    capacity: 0,
                    zone: 'A',
                    level: 1,
                    section: 1
                  });
                  setCapacityInput('0');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Location Form Modal */}
      {showEditForm && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl transform transition-all scale-100 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Редактировать локацию</h3>
                <button
                  onClick={handleEditCancel}
                  className={`p-1 rounded-full hover:bg-opacity-10 transition-colors ${isDark ? 'hover:bg-gray-300 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Код локации
                    </label>
                    <input
                      type="text"
                      value={editingLocation.code}
                      onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      placeholder="A1-B1-C1"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Название
                    </label>
                    <input
                      type="text"
                      value={editingLocation.name}
                      onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      placeholder="Название локации"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Зона
                    </label>
                    <select
                      value={editingLocation.zone}
                      onChange={(e) => setEditingLocation({ ...editingLocation, zone: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                    >
                      <option value="A">Зона A</option>
                      <option value="B">Зона B</option>
                      <option value="C">Зона C</option>
                      <option value="D">Зона D</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Вместимость
                    </label>
                    <input
                      type="number"
                      value={editCapacityInput}
                      onFocus={(e) => {
                        if (e.currentTarget.value === '0') {
                          e.currentTarget.select();
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (Number(val) < 0) return;
                        setEditCapacityInput(val);
                        setEditingLocation({
                          ...editingLocation,
                          capacity: val === '' ? 0 : parseInt(val, 10)
                        });
                      }}
                      onBlur={(e) => {
                        if (e.currentTarget.value === '') {
                          setEditCapacityInput('0');
                          setEditingLocation({ ...editingLocation, capacity: 0 });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      placeholder="0"
                      min={0}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Уровень
                    </label>
                    <input
                      type="number"
                      value={editingLocation.level}
                      onChange={(e) => setEditingLocation({ ...editingLocation, level: parseInt(e.target.value) || 1 })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Секция
                    </label>
                    <input
                      type="number"
                      value={editingLocation.section}
                      onChange={(e) => setEditingLocation({ ...editingLocation, section: parseInt(e.target.value) || 1 })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Описание
                  </label>
                  <textarea
                    value={editingLocation.description || ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, description: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    placeholder="Описание локации"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 mt-6 justify-end">
                  <button
                    type="button"
                    onClick={handleEditCancel}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((location) => {
          const itemsInLocation = getProductsInLocation(location.code);
          const actualOccupancy = getActualOccupancy(location.code);
          const capacity = location.capacity || 0;
          const utilization = capacity > 0 ? (actualOccupancy / capacity) * 100 : 0;

          return (
            <div key={location.id} className={`rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow transition-colors duration-300 ${isDark ? 'bg-gray-900' : 'bg-white'
              }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${location.zone === 'A' ? 'bg-blue-500' :
                    location.zone === 'B' ? 'bg-emerald-500' :
                      location.zone === 'C' ? 'bg-orange-500' : 'bg-purple-500'
                    }`} />
                  <div>
                    <h3 className={`text-lg font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
                      }`}>{location.name}</h3>
                    <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>{location.code}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditClick(location)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Редактировать"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDeleteLocation(location.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {location.description && (
                <p className={`text-sm mb-4 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>{location.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>Вместимость:</span>
                  <span className="font-medium">{capacity} мест</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>Занято:</span>
                  <span className="font-medium">{actualOccupancy} мест</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>Свободно:</span>
                  <span className="font-medium">{capacity - actualOccupancy} мест</span>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>Загрузка:</span>
                    <span className={`font-medium px-2 py-1 rounded-full text-xs ${getUtilizationColor(utilization)}`}>
                      {utilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-2 transition-colors duration-300 ${isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                    <div
                      className={`h-2 rounded-full ${utilization >= 90 ? 'bg-red-500' :
                        utilization >= 75 ? 'bg-orange-500' :
                          utilization >= 50 ? 'bg-yellow-500' : 'bg-emerald-500'
                        }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>

                {/* Products in this location */}
                {itemsInLocation.length > 0 && (
                  <div className={`pt-2 border-t transition-colors duration-300 ${isDark ? 'border-gray-800' : 'border-gray-200'
                    }`}>
                    <div className={`text-xs mb-2 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>Товары в локации:</div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {itemsInLocation.slice(0, 5).map((item) => (
                        <div key={item.product.id} className="flex justify-between text-xs">
                          <span className="truncate flex-1 mr-2">{item.product.nameRu}</span>
                          <span className={`${isDark ? 'text-gray-400' : 'text-gray-400'}`}>{item.qty} шт.</span>
                        </div>
                      ))}
                      {itemsInLocation.length > 5 && (
                        <div className={`text-xs transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-400'
                          }`}>
                          и еще {itemsInLocation.length - 5} товаров...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className={`pt-2 border-t transition-colors duration-300 ${isDark ? 'border-gray-800' : 'border-gray-200'
                  }`}>
                  <div className={`flex justify-between text-xs transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                    <span>Уровень: {location.level}</span>
                    <span>Секция: {location.section}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredLocations.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className={`mt-2 text-sm font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'
            }`}>Локации не найдены</h3>
          <p className={`mt-1 text-sm transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
            Нет локаций в выбранной зоне.
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;