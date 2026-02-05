// simplified search bar
import React, { useState, useRef, useEffect } from 'react';
import { ShoppingCart, LogOut, Package, ChevronDown, Moon, Globe, UserCircle, Settings, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface HeaderProps {
  onLogoClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onLogoClick,
}) => {
  const { user, logout } = useAuth();
  const { getTotalItems } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const logoUrl = (import.meta as any).env?.VITE_LOGO_URL as string | undefined;
  const brandName = (import.meta as any).env?.VITE_BRAND_NAME as string | undefined;
  const showBrandTextEnv = (import.meta as any).env?.VITE_LOGO_SHOW_TEXT as string | undefined;
  const showBrandText = showBrandTextEnv ? showBrandTextEnv !== 'false' : true;
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideProfile = profileRef.current?.contains(target);
      if (!insideProfile) setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [profileDropdownOpen]);

  return (
    <header className="relative z-50 theme-header">
      <div className="absolute inset-0 opacity-90" />
      <div className="relative w-full pl-0 pr-0">
        <div className="flex items-center h-16 pl-16 sm:pl-24 lg:pl-32 pr-4 sm:pr-6 lg:pr-8">
          {/* Logo */}
          <button
            onClick={() => { onLogoClick ? onLogoClick() : navigate('/admin'); }}
            className="flex items-center gap-1 shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brandName || 'Company logo'}
                className="h-8 sm:h-9 md:h-10 w-auto object-contain flex-shrink-0 drop-shadow"
                draggable={false}
              />
            ) : (
              <Package className="h-8 w-8 text-white" />
            )}
            {showBrandText ? (
              <h1 className="ml-2 text-base md:text-lg font-bold tracking-wide uppercase text-white whitespace-nowrap overflow-hidden text-ellipsis leading-tight max-w-[220px] md:max-w-[320px] lg:max-w-[420px]">
                {brandName || ''}
              </h1>
            ) : null}
          </button>

          {/* Page Title */}
          <div className="hidden md:flex items-center ml-4">
            <div className="text-white/90 font-semibold text-sm sm:text-base truncate max-w-[180px] sm:max-w-[260px]">
              {location.pathname === '/' ? 'Каталог товаров' : null}
            </div>
          </div>

          {/* User Actions - Moved to far right with ml-auto */}
          <div className="flex items-center space-x-4 ml-auto">
            {user?.role === 'customer' && (
              <button
                onClick={() => { navigate('/cart'); }}
                className="relative p-2 text-white/90 hover:text-white transition-colors"
              >
                <ShoppingCart className="h-6 w-6" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-soft">
                    {getTotalItems()}
                  </span>
                )}
              </button>
            )}

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all border border-white/20 backdrop-blur-sm"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow-md overflow-hidden">
                  {user?.profilePhotoUrl ? (
                    <img
                      src={user.profilePhotoUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</span>
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm text-white font-medium">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-white/70">
                    {user?.email}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-white/70 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[var(--bg-card)] rounded-xl shadow-2xl overflow-hidden border border-[var(--border-primary)] animate-fade-in-down z-50">
                  {/* User Profile Section */}
                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white/30 overflow-hidden">
                        {user?.profilePhotoUrl ? (
                          <img
                            src={user.profilePhotoUrl}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-base">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <div className="text-white/80 text-sm">
                          {user?.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {/* Dark Theme Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTheme();
                      }}
                      className="w-full px-4 py-2.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <Moon className="h-4 w-4 text-blue-400" />
                        <span className="text-sm">Тёмная тема</span>
                      </div>
                      <div className={`relative w-11 h-6 rounded-full transition-all duration-300 ${isDark ? 'bg-blue-500' : 'bg-gray-600'}`}>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isDark ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                    </button>

                    {/* Language */}
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        // Handle language change
                      }}
                      className="w-full px-4 py-2.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center space-x-3 group"
                    >
                      <Globe className="h-4 w-4 text-green-400" />
                      <span className="text-sm">Язык</span>
                    </button>

                    <div className="border-t border-[var(--border-primary)] my-2"></div>

                    {/* Show Profile */}
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full px-4 py-2.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center space-x-3 group"
                    >
                      <UserCircle className="h-4 w-4 text-purple-400" />
                      <span className="text-sm">Показать профиль</span>
                    </button>

                    {/* Settings */}
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full px-4 py-2.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center space-x-3 group"
                    >
                      <Settings className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">Настройки</span>
                    </button>

                    {user?.role === 'admin' && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate('/users');
                        }}
                        className="w-full px-4 py-2.5 text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center space-x-3 group"
                      >
                        <Users className="h-4 w-4 text-blue-400" />
                        <span className="text-sm">Управление пользователями</span>
                      </button>
                    )}

                    <div className="border-t border-gray-700 my-2"></div>

                    {/* Logout */}
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full px-4 py-2.5 text-left text-red-500 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center space-x-3 group"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm">Выйти</span>
                    </button>
                  </div>

                  {/* Last Updated Timestamp */}
                  <div className="bg-[var(--bg-tertiary)]/50 px-4 py-2 border-t border-[var(--border-primary)]">
                    <div className="text-xs text-[var(--text-muted)] text-center">
                      Обновлено: {new Date().toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;
