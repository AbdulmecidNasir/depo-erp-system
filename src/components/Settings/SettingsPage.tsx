import React, { useState, useEffect, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Palette,
  User,
  Bell,
  Shield,
  Building2,
  Zap,
  Save,
  RotateCcw,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Trash2,
  Download,
  Key,
  Clock,
  Lock,
  Mail,
  X,
  Check,
  Loader,
  Monitor,
  MapPin,
  Calendar,
  DollarSign,
  Volume2,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';

interface SettingsData {
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  theme: 'light' | 'dark';
  colorScheme: string;
  sidebarCollapsed: boolean;
  fontSize: string;
  emailNotifications: boolean;
  passwordChanged: boolean;
  twoFactorEnabled: boolean;
  sessions: Array<{
    id: string;
    device: string;
    location: string;
    lastActive: string;
    current: boolean;
  }>;
  pushNotifications: boolean;
  notificationFrequency: string;
  soundAlerts: boolean;
  dataExportEnabled: boolean;
  privacyLevel: string;
  companyName: string;
  companyAddress: string;
  taxId: string;
  invoicePrefix: string;
  fiscalYearStart: string;
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsed: string;
  }>;
  connectedServices: Array<{
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
    lastSync: string;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    events: string[];
    active: boolean;
  }>;
}

// Modern Custom Dropdown Component
const ModernDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; icon?: string }>;
  label: string;
  icon?: React.ReactNode;
}> = ({ value, onChange, options, label, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium mb-1.5 flex items-center gap-1.5 text-[var(--text-secondary)]">
        {icon}
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 rounded-lg border text-sm text-left flex items-center justify-between transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
      >
        <span className="flex items-center gap-2 font-medium">
          {selectedOption?.icon && <span className="text-base">{selectedOption.icon}</span>}
          {selectedOption?.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 rounded-lg border shadow-xl overflow-hidden animate-slide-down bg-[var(--bg-card)] border-[var(--border-primary)]">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-sm text-left flex items-center gap-2 transition-all duration-150 ${option.value === value
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
              >
                {option.icon && <span className="text-base">{option.icon}</span>}
                <span className="flex-1">{option.label}</span>
                {option.value === value && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Modern Toggle Switch Component
const ModernToggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}> = ({ checked, onChange, label, description, icon }) => {
  return (
    <div className="group rounded-lg border p-4 transition-all duration-200 hover:shadow-md bg-[var(--bg-card)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2.5 flex-1">
          {icon && (
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              {icon}
            </div>
          )}
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">{label}</h4>
            {description && (
              <p className="text-xs mt-0.5 text-[var(--text-muted)]">{description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${checked
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 focus:ring-blue-500/30'
            : 'bg-gray-300 dark:bg-gray-600 focus:ring-gray-500/30'
            }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'
              }`}
          />
        </button>
      </div>
    </div>
  );
};

// Success/Error Toast Component
const Toast: React.FC<{
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border-2 ${type === 'success'
        ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-green-400 text-white'
        : 'bg-gradient-to-r from-red-500 to-pink-500 border-red-400 text-white'
        }`}>
        {type === 'success' ? (
          <CheckCircle className="h-6 w-6 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
        )}
        <p className="font-semibold">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 hover:bg-white/20 rounded-lg p-1 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const { updateSettings: syncGlobalSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<SettingsData>({
    language: 'ru',
    timezone: 'Europe/Moscow',
    dateFormat: 'DD.MM.YYYY',
    currency: 'RUB',
    theme: 'light',
    colorScheme: 'blue',
    sidebarCollapsed: false,
    fontSize: 'medium',
    emailNotifications: true,
    passwordChanged: false,
    twoFactorEnabled: false,
    sessions: [],
    pushNotifications: true,
    notificationFrequency: 'immediate',
    soundAlerts: true,
    dataExportEnabled: true,
    privacyLevel: 'standard',
    companyName: '',
    companyAddress: '',
    taxId: '',
    invoicePrefix: 'INV',
    fiscalYearStart: '01-01',
    apiKeys: [],
    connectedServices: [],
    webhooks: []
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const tabs = [
    { id: 'general', label: 'Общие', icon: Globe, color: 'from-blue-500 to-cyan-500' },
    { id: 'appearance', label: 'Внешний вид', icon: Palette, color: 'from-purple-500 to-pink-500' },
    { id: 'account', label: 'Аккаунт', icon: User, color: 'from-green-500 to-emerald-500' },
    { id: 'notifications', label: 'Уведомления', icon: Bell, color: 'from-yellow-500 to-orange-500' },
    { id: 'privacy', label: 'Конфиденциальность', icon: Shield, color: 'from-red-500 to-pink-500' },
    { id: 'business', label: 'Бизнес', icon: Building2, color: 'from-indigo-500 to-purple-500' },
    { id: 'integrations', label: 'Интеграции', icon: Zap, color: 'from-amber-500 to-yellow-500' }
  ];

  const languages = [
    { value: 'ru', label: 'Русский', icon: '🇷🇺' },
    { value: 'en', label: 'English', icon: '🇺🇸' },
    { value: 'tr', label: 'Türkçe', icon: '🇹🇷' }
  ];

  const currencies = [
    { value: 'RUB', label: '₽ Российский рубль', icon: '₽' },
    { value: 'USD', label: '$ US Dollar', icon: '$' },
    { value: 'EUR', label: '€ Euro', icon: '€' },
    { value: 'TRY', label: '₺ Turkish Lira', icon: '₺' },
    { value: 'UZS', label: 'сўм Uzbek Som', icon: 'сўм' }
  ];

  const timezones = [
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Istanbul', label: 'Стамбул (UTC+3)' },
    { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
    { value: 'Europe/London', label: 'Лондон (UTC+0)' }
  ];

  const dateFormats = [
    { value: 'DD.MM.YYYY', label: '31.12.2024 (DD.MM.YYYY)' },
    { value: 'MM/DD/YYYY', label: '12/31/2024 (MM/DD/YYYY)' },
    { value: 'YYYY-MM-DD', label: '2024-12-31 (YYYY-MM-DD)' }
  ];

  const fontSizes = [
    { value: 'small', label: 'Маленький' },
    { value: 'medium', label: 'Средний' },
    { value: 'large', label: 'Большой' }
  ];

  const notificationFrequencies = [
    { value: 'immediate', label: 'Немедленно' },
    { value: 'hourly', label: 'Каждый час' },
    { value: 'daily', label: 'Ежедневно' },
    { value: 'weekly', label: 'Еженедельно' }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, sessionsRes] = await Promise.all([
        api.auth.getSettings(),
        api.auth.getSessions().catch(() => ({ success: false, data: [] }))
      ]);

      if (settingsRes.success && settingsRes.data) {
        setSettings({
          ...settingsRes.data,
          sessions: sessionsRes.success ? sessionsRes.data : [],
          apiKeys: settingsRes.data.apiKeys || [],
          connectedServices: settingsRes.data.connectedServices || [],
          webhooks: settingsRes.data.webhooks || []
        });
      } else {
        throw new Error('Не удалось загрузить настройки');
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setNotification({ type: 'error', message: error.message || 'Ошибка загрузки настроек' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // syncGlobalSettings handles both the API call and global state update
      await syncGlobalSettings(settings);
      setNotification({ type: 'success', message: 'Настройки успешно сохранены' });
      setHasUnsavedChanges(false);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setNotification({ type: 'error', message: error.message || 'Ошибка сохранения настроек' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateApiKey = async (name: string) => {
    try {
      const response = await api.auth.createApiKey(name);
      if (response.success && response.data) {
        setSettings(prev => ({
          ...prev,
          apiKeys: [...(prev.apiKeys || []), response.data]
        }));
        setNotification({ type: 'success', message: 'API ключ успешно создан' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Ошибка создания API ключа' });
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      const response = await api.auth.deleteApiKey(keyId);
      if (response.success) {
        setSettings(prev => ({
          ...prev,
          apiKeys: (prev.apiKeys || []).filter(key => key.id !== keyId)
        }));
        setNotification({ type: 'success', message: 'API ключ успешно удален' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Ошибка удаления API ключа' });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await api.auth.deleteSession(sessionId);
      if (response.success) {
        setSettings(prev => ({
          ...prev,
          sessions: (prev.sessions || []).filter(session => session.id !== sessionId)
        }));
        setNotification({ type: 'success', message: 'Сессия успешно завершена' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Ошибка завершения сессии' });
    }
  };

  const updateSetting = (key: keyof SettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const renderGeneralSettings = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModernDropdown
          value={settings.language}
          onChange={(val) => updateSetting('language', val)}
          options={languages}
          label="Язык интерфейса"
          icon={<Globe className="h-3.5 w-3.5" />}
        />

        <ModernDropdown
          value={settings.currency}
          onChange={(val) => updateSetting('currency', val)}
          options={currencies}
          label="Валюта"
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />

        <ModernDropdown
          value={settings.timezone}
          onChange={(val) => updateSetting('timezone', val)}
          options={timezones}
          label="Часовой пояс"
          icon={<MapPin className="h-3.5 w-3.5" />}
        />

        <ModernDropdown
          value={settings.dateFormat}
          onChange={(val) => updateSetting('dateFormat', val)}
          options={dateFormats}
          label="Формат даты"
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModernDropdown
          value={settings.fontSize}
          onChange={(val) => updateSetting('fontSize', val)}
          options={fontSizes}
          label="Размер шрифта"
          icon={<Palette className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="mt-4">
        <ModernToggle
          checked={settings.sidebarCollapsed}
          onChange={(val) => updateSetting('sidebarCollapsed', val)}
          label="Свернутая боковая панель"
          description="Автоматически сворачивать боковое меню при запуске"
          icon={<Palette className="h-4 w-4" />}
        />
      </div>
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-4 animate-fade-in">
      <ModernToggle
        checked={settings.emailNotifications}
        onChange={(val) => updateSetting('emailNotifications', val)}
        label="Email уведомления"
        description="Получать уведомления на электронную почту"
        icon={<Mail className="h-4 w-4" />}
      />

      {/* Password Change Section */}
      <div className="rounded-lg border p-4 transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 text-white">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
              Изменить пароль
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Обновите пароль для безопасности
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
              Новый пароль
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
                placeholder="Введите новый пароль"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-500 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
              Подтвердите пароль
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
              placeholder="Подтвердите новый пароль"
            />
          </div>

          <button
            onClick={() => {
              if (newPassword && newPassword === confirmPassword) {
                setNotification({ type: 'success', message: 'Пароль успешно изменен' });
                setNewPassword('');
                setConfirmPassword('');
              } else if (newPassword !== confirmPassword) {
                setNotification({ type: 'error', message: 'Пароли не совпадают' });
              }
            }}
            className="w-full mt-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-[1.01] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            Изменить пароль
          </button>
        </div>
      </div>

      <ModernToggle
        checked={settings.twoFactorEnabled}
        onChange={(val) => updateSetting('twoFactorEnabled', val)}
        label="Двухфакторная аутентификация"
        description="Дополнительная защита вашего аккаунта с помощью 2FA"
        icon={<Shield className="h-4 w-4" />}
      />

      {/* Active Sessions */}
      <div className="rounded-lg border p-4 transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <Monitor className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
              Активные сессии
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Управление устройствами и входами
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {settings.sessions.length === 0 ? (
            <p className="text-sm text-center py-6 text-[var(--text-muted)]">
              Нет активных сессий
            </p>
          ) : (
            settings.sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border transition-all duration-200 bg-[var(--bg-input)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-[var(--text-muted)]" />
                  <div>
                    <p className="font-medium text-sm text-[var(--text-primary)]">
                      {session.device}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {session.location}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Последняя активность: {session.lastActive}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.current && (
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Текущая
                    </span>
                  )}
                  {!session.current && (
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-1.5 rounded-lg transition-colors text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderNotificationsSettings = () => (
    <div className="space-y-4 animate-fade-in">
      <ModernToggle
        checked={settings.pushNotifications}
        onChange={(val) => updateSetting('pushNotifications', val)}
        label="Push уведомления"
        description="Получать push уведомления в браузере"
        icon={<Bell className="h-4 w-4" />}
      />

      <ModernDropdown
        value={settings.notificationFrequency}
        onChange={(val) => updateSetting('notificationFrequency', val)}
        options={notificationFrequencies}
        label="Частота уведомлений"
        icon={<Clock className="h-3.5 w-3.5" />}
      />

      <ModernToggle
        checked={settings.soundAlerts}
        onChange={(val) => updateSetting('soundAlerts', val)}
        label="Звуковые уведомления"
        description="Воспроизводить звук при получении уведомлений"
        icon={<Volume2 className="h-4 w-4" />}
      />
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-4 animate-fade-in">
      <ModernToggle
        checked={settings.dataExportEnabled}
        onChange={(val) => updateSetting('dataExportEnabled', val)}
        label="Экспорт данных"
        description="Разрешить экспорт ваших данных"
        icon={<Download className="h-4 w-4" />}
      />

      {/* Privacy Level */}
      <div className="rounded-lg border p-4 transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
              Уровень конфиденциальности
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Выберите уровень защиты данных
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {['public', 'standard', 'private'].map((level) => (
            <button
              key={level}
              onClick={() => updateSetting('privacyLevel', level)}
              className={`w-full p-3 rounded-lg border text-left text-sm transition-all duration-200 ${settings.privacyLevel === level
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-card)]'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text-primary)]">
                  {level === 'public' ? 'Публичный' : level === 'standard' ? 'Стандартный' : 'Приватный'}
                </span>
                {settings.privacyLevel === level && (
                  <Check className="h-4 w-4 text-blue-500" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Export Data */}
      <div className="rounded-lg border p-4 transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
        <h4 className="font-semibold text-sm mb-1 text-[var(--text-primary)]">
          Экспорт данных
        </h4>
        <p className="text-xs mb-3 text-[var(--text-muted)]">
          Скачайте копию всех ваших данных в формате JSON
        </p>
        <button
          onClick={() => setNotification({ type: 'success', message: 'Экспорт данных начат. Файл будет отправлен на ваш email.' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
        >
          <Download className="h-3.5 w-3.5" />
          Экспортировать данные
        </button>
      </div>
    </div>
  );

  const renderBusinessSettings = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            Название компании
          </label>
          <input
            type="text"
            value={settings.companyName}
            onChange={(e) => updateSetting('companyName', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
            placeholder="Введите название компании"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            Налоговый ID
          </label>
          <input
            type="text"
            value={settings.taxId}
            onChange={(e) => updateSetting('taxId', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
            placeholder="Введите налоговый ID"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
          Адрес компании
        </label>
        <textarea
          value={settings.companyAddress}
          onChange={(e) => updateSetting('companyAddress', e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
          rows={3}
          placeholder="Введите адрес компании"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            Префикс инвойсов
          </label>
          <input
            type="text"
            value={settings.invoicePrefix}
            onChange={(e) => updateSetting('invoicePrefix', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
            placeholder="INV"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            Начало фискального года
          </label>
          <input
            type="text"
            value={settings.fiscalYearStart}
            onChange={(e) => updateSetting('fiscalYearStart', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm transition-all duration-200 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-[var(--bg-input)] border-[var(--border-primary)] text-[var(--text-primary)]"
            placeholder="MM-DD"
          />
        </div>
      </div>
    </div>
  );

  const renderIntegrationsSettings = () => (
    <div className="space-y-4 animate-fade-in">
      {/* API Keys */}
      <div className="rounded-lg border p-4 transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                API Ключи
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Управление API ключами
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCreateApiKey('Production API Key')}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
          >
            Создать ключ
          </button>
        </div>

        <div className="space-y-2">
          {settings.apiKeys.length === 0 ? (
            <p className="text-sm text-center py-6 text-[var(--text-muted)]">
              Нет API ключей
            </p>
          ) : (
            settings.apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-3 rounded-lg border transition-all duration-200 bg-[var(--bg-input)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
              >
                <div>
                  <p className="font-medium text-sm text-[var(--text-primary)]">
                    {apiKey.name}
                  </p>
                  <p className="text-xs font-mono text-[var(--text-secondary)]">
                    {apiKey.key}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Создан: {apiKey.createdAt}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteApiKey(apiKey.id)}
                  className="p-1.5 rounded-lg transition-colors text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Connected Services */}
      <div className="rounded-lg border p-4 transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
              Подключенные сервисы
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              Интеграции сторонних сервисов
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {settings.connectedServices.length === 0 ? (
            <p className="text-sm text-center py-6 text-[var(--text-muted)]">
              Нет подключенных сервисов
            </p>
          ) : (
            settings.connectedServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-[var(--bg-input)] border-[var(--border-primary)]"
              >
                <div>
                  <p className="font-medium text-sm text-[var(--text-primary)]">
                    {service.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Статус: {service.status === 'connected' ? 'Подключен' : 'Отключен'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Последняя синхронизация: {service.lastSync}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${service.status === 'connected'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                  >
                    {service.status === 'connected' ? 'Активен' : 'Неактивен'}
                  </span>
                  <button className="p-1.5 rounded-lg transition-colors text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'account':
        return renderAccountSettings();
      case 'notifications':
        return renderNotificationsSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'business':
        return renderBusinessSettings();
      case 'integrations':
        return renderIntegrationsSettings();
      default:
        return renderGeneralSettings();
    }
  };

  const filteredTabs = tabs.filter((tab) =>
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen transition-colors duration-300 bg-[var(--bg-primary)]">
        <div className="text-center">
          <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 font-medium text-[var(--text-primary)]">
            Загрузка настроек...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="rounded-xl p-6 border shadow-lg transition-colors duration-300 bg-[var(--bg-card)] border-[var(--border-primary)]">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg shadow-md">
                  <SettingsIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                    Настройки
                  </h1>
                  <p className="text-sm mt-0.5 text-[var(--text-muted)]">
                    Управляйте настройками вашего аккаунта
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Несохраненные изменения
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Сохранить
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Поиск настроек..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 input-modern`}
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64">
            <nav className="space-y-1.5 sticky top-8">
              {filteredTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all duration-200 ${isActive
                      ? 'bg-gradient-to-r ' + tab.color + ' text-white shadow-lg'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-blue-500'}`} />
                      <span className="font-medium text-sm">{tab.label}</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'translate-x-0.5' : ''}`} />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="rounded-xl border p-6 transition-colors duration-300 shadow-lg bg-[var(--bg-card)] border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                  </h2>
                  <p className="text-sm mt-0.5 text-[var(--text-muted)]">
                    Настройте параметры для этого раздела
                  </p>
                </div>
                <button
                  onClick={() => loadSettings()}
                  className="px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Сбросить
                </button>
              </div>

              <div className="border-t pt-6 border-[var(--border-primary)]">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <Toast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default SettingsPage;
