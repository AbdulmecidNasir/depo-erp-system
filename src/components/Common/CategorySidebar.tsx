import React from 'react';
import {
  Monitor,
  Cpu,
  Laptop,
  Server,
  HardDrive,
  BatteryCharging,
  Snowflake,
  Box,
  Mouse,
  Headphones,
  Keyboard,
  Mic,
  Printer,
  ChevronRight,
} from 'lucide-react';

// Fallbacks for icons not existing in some lucide versions
const Icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Computers: Monitor,
  Laptops: Laptop,
  Servers: Server,
  Processors: Cpu,
  RAM: HardDrive,
  Storage: HardDrive,
  'Graphic Cards': Monitor,
  Motherboards: Cpu,
  'Power Supplies': BatteryCharging,
  'Cooling Systems': Snowflake,
  Cases: Box,
  Monitors: Monitor,
  Mice: Mouse,
  Headphones: Headphones,
  Keyboards: Keyboard,
  Microphones: Mic,
  'Mouse Pads': Mouse,
  Printers: Printer,
};

export type CategoryItem = {
  id: string;
  name: string;
};

interface Props {
  title?: string;
  items: CategoryItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  isDark?: boolean;
}

const CategorySidebar: React.FC<Props> = ({
  title = 'Categories',
  items,
  activeId,
  onSelect,
  isDark,
}) => {
  const baseText = isDark ? 'text-gray-200' : 'text-gray-700';
  const hoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
  const activeBg = 'bg-gradient-to-r from-[#0D47A1] to-[#1565C0] text-white shadow-md';

  return (
    <div
      className={`rounded-lg border ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      } w-64`}
    >
      <div className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </div>
      <div className="px-2 pb-3">
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
        {items.map((c) => {
          const Icon = Icons[c.name] || ChevronRight;
          const active = String(activeId || '') === String(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onSelect && onSelect(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
                active ? activeBg : `${baseText} ${hoverBg}`
              } ${active ? 'translate-x-0' : 'hover:translate-x-0.5'}`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left truncate">{c.name}</span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;


