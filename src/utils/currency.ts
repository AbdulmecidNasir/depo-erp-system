export const formatCurrency = (value: number | string, currency: string = 'RUB'): string => {
  const num = typeof value === 'number' ? value : parseFloat(value as string) || 0;

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
    }).format(num);

    return config.symbol === 'сўм'
      ? `${formatted} ${config.symbol}`
      : `${config.symbol}${formatted}`;
  } catch (e) {
    const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
    return `${config.symbol}${formatted}`;
  }
};

/** @deprecated Use formatCurrency instead */
export const formatUZS = (value: number | string) => formatCurrency(value, 'UZS');

export const formatNumber = (value: number | string): string => {
  const num = typeof value === 'number' ? value : parseFloat(value as string) || 0;
  return new Intl.NumberFormat('uz-UZ').format(num);
};


