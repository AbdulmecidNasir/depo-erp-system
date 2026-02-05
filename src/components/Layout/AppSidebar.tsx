import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, BarChart3, ArrowRightToLine, ArrowLeftToLine, Users, ChevronDown, ChevronRight, ShoppingCart, List, ArrowLeftRight, ClipboardCheck, PackagePlus, TrendingDown, Warehouse, Package, LayoutDashboard, Trash2, FileText, Share, RotateCcw, Store, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface NavChild {
  id: string;
  name: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  allowedRoles?: string[];
}

interface NavItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: NavChild[];
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', name: 'Дашборд', icon: LayoutDashboard, path: '/admin', allowedRoles: ['admin'] },
  {
    id: 'products-services',
    name: 'ПРОДУКТЫ И УСЛУГИ',
    icon: Package,
    children: [
      { id: 'catalog', name: 'Управление товарами', path: '/products', icon: List, allowedRoles: ['admin', 'warehouse_manager', 'warehouse_staff', 'sales_manager'] },
      { id: 'product-transfer', name: 'Перемещения товаров', path: '/movements', icon: ArrowLeftRight, allowedRoles: ['admin', 'warehouse_manager', 'warehouse_staff'] },
      { id: 'inventory', name: 'Инвентаризация', path: '/inventory', icon: ClipboardCheck, allowedRoles: ['admin', 'warehouse_manager', 'warehouse_staff'] },
      { id: 'incoming', name: 'Приход', path: '/incoming', icon: PackagePlus, allowedRoles: ['admin', 'warehouse_manager'] },
      { id: 'outgoing', name: 'Списанные товары', path: '/outgoing', icon: TrendingDown, allowedRoles: ['admin', 'warehouse_manager'] },
    ],
    allowedRoles: ['admin', 'warehouse_manager', 'warehouse_staff', 'sales_manager'],
  },
  { id: 'warehouse', name: 'ОСТАТКИ НА СКЛАДЕ', icon: Warehouse, path: '/warehouse', allowedRoles: ['admin', 'warehouse_manager', 'sales_manager'] },
  { id: 'suppliers', name: 'ПОСТАВЩИКИ', icon: Users, path: '/suppliers', allowedRoles: ['admin', 'warehouse_manager', 'sales_manager'] },
  {
    id: 'sales',
    name: 'ПРОДАЖИ',
    icon: ShoppingCart,
    children: [
      { id: 'sales-all', name: 'Все платежи', path: '/sales', icon: CreditCard, allowedRoles: ['admin', 'sales_manager', 'cashier'] },
      { id: 'sales-request', name: 'Заявка', path: '/sales/requests', icon: FileText, allowedRoles: ['admin', 'sales_manager'] },
      { id: 'sales-shipment', name: 'Отгрузка', path: '/sales/shipments', icon: Share, allowedRoles: ['admin', 'sales_manager', 'warehouse_manager'] },
      { id: 'sales-return', name: 'Возврат', path: '/sales/returns', icon: RotateCcw, allowedRoles: ['admin', 'sales_manager'] },
      { id: 'sales-showcase', name: 'Витрина', path: '/sales/showcase', icon: Store, allowedRoles: ['admin', 'sales_manager'] },
    ],
    allowedRoles: ['admin', 'sales_manager', 'warehouse_manager', 'cashier'],
  },
  {
    id: 'finance',
    name: 'ФИНАНСЫ',
    icon: BarChart3,
    children: [
      { id: 'ledger', name: 'Финансы', path: '/ledger', icon: BarChart3, allowedRoles: ['admin', 'cashier'] },
    ],
    allowedRoles: ['admin', 'cashier', 'sales_manager'],
  },
  { id: 'locations', name: 'ЛОКАЦИИ', icon: MapPin, path: '/locations', allowedRoles: ['admin', 'warehouse_manager'] },
  { id: 'deleted-transactions', name: 'УДАЛЕННЫЕ ОПЕРАЦИИ', icon: Trash2, path: '/deleted-transactions', allowedRoles: ['admin'] },
];

// Tooltip/Popover component for sidebar items
interface TooltipProps {
  item: NavItem;
  children: React.ReactNode;
  collapsed: boolean;
  isDark: boolean;
  user: any;
  navigate: any;
  location: any;
}

const SidebarTooltip: React.FC<TooltipProps> = ({ item, children, collapsed, isDark, user, navigate, location }) => {
  // Disable hover dropdown/tooltip animations (requested)
  const enableHoverTooltips = false;
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const showTooltip = (collapsed || hasChildren);

  useEffect(() => {
    if (show && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 8, // 8px gap from the sidebar
      });
    }
  }, [show]);

  const handleMouseEnter = () => {
    if (!showTooltip) return;

    timeoutRef.current = setTimeout(() => {
      setShow(true);
    }, 250); // 250ms delay for better UX
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShow(false);
  };

  const tooltipContent = () => {
    if (collapsed && !hasChildren) {
      // Simple tooltip for collapsed items without children
      return (
        <div className="px-3 py-2 text-sm font-medium whitespace-nowrap">
          {item.name}
        </div>
      );
    }

    if (hasChildren) {
      // Show submenu items
      const visibleChildren = item.children!.filter((child) => {
        if (child.allowedRoles) {
          return child.allowedRoles.includes(user?.role || '');
        }
        return true;
      });
      return (
        <div className="py-2">
          <div className="px-3 py-1.5 text-xs font-semibold opacity-60 uppercase tracking-wide">
            {item.name}
          </div>
          <div className="mt-1 space-y-0.5">
            {visibleChildren.map((child) => {
              const childActive = location.pathname === child.path;
              const ChildIcon = child.icon;
              return (
                <button
                  key={child.id}
                  onClick={() => {
                    navigate(child.path);
                    setShow(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-all duration-200 flex items-center gap-2 rounded-md ${childActive
                    ? (isDark ? 'bg-blue-600 text-white' : 'bg-brand-100 text-brand-700')
                    : (isDark ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                    }`}
                >
                  {ChildIcon && <ChildIcon className="h-4 w-4 flex-shrink-0" />}
                  <span className="whitespace-nowrap">{child.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  if (!enableHoverTooltips) {
    return (
      <div ref={buttonRef} className="relative">
        {children}
      </div>
    );
  }

  return (
    <div ref={buttonRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative">
      {children}
      {show && showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] animate-fade-in"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={`absolute -left-2 top-4 w-0 h-0 border-t-[6px] border-b-[6px] border-r-[8px] border-transparent ${isDark ? 'border-r-gray-800' : 'border-r-white'
              }`}
            style={{ filter: 'drop-shadow(-1px 0 2px rgba(0, 0, 0, 0.1))' }}
          />
          <div
            className={`rounded-lg shadow-xl border transition-all duration-200 ${isDark ? 'bg-gray-800 border-gray-700 text-white shadow-gray-900/50' : 'bg-white border-gray-200 text-gray-900 shadow-lg'
              }`}
            style={{ minWidth: '180px', maxWidth: '280px' }}
          >
            {tooltipContent()}
          </div>
        </div>
      )}
    </div>
  );
};

const AppSidebar: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  // Extra dynamic section (e.g., Categories) provided by pages via CustomEvent
  const [extra, setExtra] = useState<null | {
    title?: string;
    items: Array<{ id: string; name: string }>;
    selectedId?: string;
  }>(null);
  // Flag to allow/deny page-provided categories affecting the AppSidebar
  const allowPageCategories = false;

  // Listen for page-provided extra section (categories)
  useEffect(() => {
    if (!allowPageCategories) return;
    const onSet = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const detail = ce.detail || null;
      if (detail && Array.isArray(detail.items)) {
        setExtra({ title: detail.title || 'Категории', items: detail.items, selectedId: detail.selectedId });
      }
    };
    const onClear = () => setExtra(null);
    window.addEventListener('sidebar:set-categories', onSet as any);
    window.addEventListener('sidebar:clear-categories', onClear as any);
    return () => {
      window.removeEventListener('sidebar:set-categories', onSet as any);
      window.removeEventListener('sidebar:clear-categories', onClear as any);
    };
  }, [allowPageCategories]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleItems = navItems.filter((item) => {
    if (item.allowedRoles) {
      return item.allowedRoles.includes(user?.role || '');
    }
    return true; // if no roles defined, accessible to all
  });

  return (
    <>
      <aside className={`fixed top-0 left-0 h-screen theme-sidebar transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} z-50`}>
        <div className="h-full flex flex-col">
          <div className="p-2 flex justify-end">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`p-2 rounded-full border transition-all duration-300 ${isDark
                ? 'border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'border-white/40 bg-white/60 hover:bg-white/80 text-gray-700'
                } shadow-soft`}
              title={collapsed ? 'Раскрыть' : 'Свернуть'}
            >
              {collapsed ? <ArrowRightToLine className="h-5 w-5" /> : <ArrowLeftToLine className="h-5 w-5" />}
            </button>
          </div>

          <nav className="px-2 pb-4 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.path ? location.pathname === item.path : false;
              const hasChildren = Array.isArray(item.children) && item.children.length > 0;
              const isOpen = !!openSections[item.id];

              return (
                <div key={item.id}>
                  <SidebarTooltip
                    item={item}
                    collapsed={collapsed}
                    isDark={isDark}
                    user={user}
                    navigate={navigate}
                    location={location}
                  >
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          toggleSection(item.id);
                        } else if (item.path) {
                          navigate(item.path);
                        }
                      }}
                      className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${isActive
                        ? (isDark ? 'bg-blue-600 text-white' : 'bg-brand-100 text-brand-700')
                        : (isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-white/60')
                        }`}
                    >
                      <Icon className="h-5 w-5" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between gap-2">
                          <span className="text-left leading-tight whitespace-normal break-words">{item.name}</span>
                          {hasChildren && (
                            <span className={`ml-2 transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </SidebarTooltip>

                  {hasChildren && !collapsed && isOpen && (
                    <div className="mt-1 ml-7 space-y-1">
                      {item.children!.filter((child) => {
                        if (child.allowedRoles) {
                          return child.allowedRoles.includes(user?.role || '');
                        }
                        return true;
                      }).map((child) => {
                        const childActive = location.pathname === child.path;
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.id}
                            onClick={() => navigate(child.path)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-300 flex items-center gap-2 ${childActive
                              ? (isDark ? 'bg-blue-700 text-white' : 'bg-brand-50 text-brand-700')
                              : (isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-white/70')
                              }`}
                          >
                            {ChildIcon && <ChildIcon className="h-4 w-4 flex-shrink-0" />}
                            <span>{child.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Dynamic extra section (disabled) */}
            {allowPageCategories && extra && (
              <div className="mt-4">
                {!collapsed && (
                  <div className={`px-3 py-1.5 text-xs font-semibold opacity-60 uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {extra.title || 'Категории'}
                  </div>
                )}
                <div className="mt-1 space-y-1">
                  {extra.items.map((it) => {
                    const selected = extra.selectedId && String(extra.selectedId) === String(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('sidebar:category-selected', { detail: { id: it.id } }));
                        }}
                        title={it.name}
                        className={`${collapsed ? 'w-10 h-8 justify-center' : 'w-full px-3'} flex items-center gap-2 py-2 rounded-md text-sm transition-all duration-200 ${selected
                          ? (isDark ? 'bg-blue-600 text-white' : 'bg-brand-100 text-brand-700')
                          : (isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-white/60')
                          }`}
                      >
                        {/* Bullet icon substitute when collapsed */}
                        <span className={`inline-block h-2 w-2 rounded-full ${selected ? 'bg-blue-400' : (isDark ? 'bg-gray-500' : 'bg-gray-400')}`}></span>
                        {!collapsed && <span className="truncate">{it.name}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>
        </div>
      </aside>
      {/* spacer to preserve layout width next to fixed sidebar */}
      <div aria-hidden className={`${collapsed ? 'w-16' : 'w-60'} flex-none`}></div>
    </>
  );
};

export default AppSidebar;
