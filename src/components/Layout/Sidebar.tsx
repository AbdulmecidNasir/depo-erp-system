import React from 'react';

interface SidebarProps {
  selectedBrand: string | null;
  onBrandChange: (brand: string | null) => void;
  brands: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedBrand,
  onBrandChange,
  brands
}) => {
  return (
    <div className="w-64 bg-white shadow-lg h-full overflow-y-auto">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Фильтры</h2>
        
        {/* Brands */}
        <div>
          <h3 className="text-md font-medium text-gray-700 mb-4">Бренды</h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Поиск по бренду..."
              value={selectedBrand || ''}
              onChange={(e) => onBrandChange(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              list="brand-options-sidebar"
            />
            <datalist id="brand-options-sidebar">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <div className="text-xs text-gray-500 mt-1">
              Введите название бренда для фильтрации
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;