import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

interface SettingsContextType {
    currency: string;
    language: string;
    theme: 'light' | 'dark';
    dateFormat: string;
    timezone: string;
    updateCurrency: (currency: string) => void;
    updateLanguage: (language: string) => void;
    updateSettings: (settings: any) => Promise<void>;
    formatPrice: (amount: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, updateUserProfile } = useAuth();

    const [currency, setCurrency] = useState<string>(user?.currency || 'RUB');
    const [language, setLanguage] = useState<string>(user?.language || 'ru');
    const [theme, setTheme] = useState<'light' | 'dark'>(user?.theme || 'light');
    const [dateFormat, setDateFormat] = useState<string>(user?.dateFormat || 'DD.MM.YYYY');
    const [timezone, setTimezone] = useState<string>(user?.timezone || 'Europe/Moscow');

    useEffect(() => {
        if (user) {
            if (user.currency) setCurrency(user.currency);
            if (user.language) setLanguage(user.language);
            if (user.theme) setTheme(user.theme);
            if (user.dateFormat) setDateFormat(user.dateFormat);
            if (user.timezone) setTimezone(user.timezone);
        }
    }, [user]);

    const updateCurrency = async (newCurrency: string) => {
        setCurrency(newCurrency);
        if (user) {
            try {
                const response = await api.auth.updateSettings({ currency: newCurrency });
                if (response.success) {
                    updateUserProfile({ ...user, currency: newCurrency as any });
                }
            } catch (error) {
                console.error('Failed to update currency:', error);
            }
        }
    };

    const updateLanguage = async (newLanguage: string) => {
        setLanguage(newLanguage);
        if (user) {
            try {
                const response = await api.auth.updateSettings({ language: newLanguage });
                if (response.success) {
                    updateUserProfile({ ...user, language: newLanguage as any });
                }
            } catch (error) {
                console.error('Failed to update language:', error);
            }
        }
    };

    const updateSettings = async (newSettings: any) => {
        if (newSettings.currency) setCurrency(newSettings.currency);
        if (newSettings.language) setLanguage(newSettings.language);
        if (newSettings.theme) setTheme(newSettings.theme);
        if (newSettings.dateFormat) setDateFormat(newSettings.dateFormat);
        if (newSettings.timezone) setTimezone(newSettings.timezone);

        if (user) {
            try {
                const response = await api.auth.updateSettings(newSettings);
                if (response.success) {
                    updateUserProfile({ ...user, ...newSettings });
                }
            } catch (error) {
                console.error('Failed to update settings:', error);
            }
        }
    };

    const formatPrice = (amount: number): string => {
        const currencyConfigs: Record<string, { locale: string; symbol: string }> = {
            'RUB': { locale: 'ru-RU', symbol: '₽' },
            'USD': { locale: 'en-US', symbol: '$' },
            'EUR': { locale: 'de-DE', symbol: '€' },
            'TRY': { locale: 'tr-TR', symbol: '₺' },
            'UZS': { locale: 'uz-UZ', symbol: 'сўм' }
        };

        const config = currencyConfigs[currency] || currencyConfigs['RUB'];

        try {
            const formatted = new Intl.NumberFormat(config.locale, {
                maximumFractionDigits: 0
            }).format(amount);

            return config.symbol === 'сўм'
                ? `${formatted} ${config.symbol}`
                : `${config.symbol}${formatted}`;
        } catch (e) {
            return `${config.symbol}${amount.toLocaleString()}`;
        }
    };

    return (
        <SettingsContext.Provider value={{
            currency,
            language,
            theme,
            dateFormat,
            timezone,
            updateCurrency,
            updateLanguage,
            updateSettings,
            formatPrice
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
