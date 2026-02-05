import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Product } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';

interface ProductTableProps {
  products: Product[];
  categories: Record<string, string>;
  onEditProduct?: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, categories, onEditProduct }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { formatPrice } = useSettings();
  const isAdmin = user?.role === 'admin';

  if (products.length === 0) {
    return (
      <div className={`rounded-lg shadow-md p-6 text-center transition-all duration-300 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'
        }`}>
        Товары не найдены. Измените параметры поиска.
      </div>
    );
  }

  // Group same product across different locations to avoid duplicates and aggregate location quantities
  const grouped = useMemo(() => {
    const normalize = (v: string | undefined | null) => String(v || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9\u0400-\u04FF]/gi, '');
    type Group = { key: string; items: Product[]; totalStock: number; locations: Array<{ name: string; qty: number }>; category?: string };
    const byKey = new Map<string, Group>();
    for (const p of products) {
      const namePref = (p as any).nameRu || (p as any).name;
      const key = p.barcode || `${normalize(p.brand)}|${normalize(p.model)}|${normalize(namePref)}`;
      if (!byKey.has(key)) byKey.set(key, { key, items: [], totalStock: 0, locations: [] });
      const g = byKey.get(key)!;
      g.items.push(p);

      const stock = (p as any).stock ?? 0;
      g.totalStock += stock;

      const locAggregate = new Map<string, number>();
      const locationStock = (p as any).locationStock as Map<string, number> | Record<string, number> | undefined;
      if (locationStock && typeof (locationStock as any).forEach === 'function') {
        (locationStock as Map<string, number>).forEach((qty, name) => {
          locAggregate.set(name, (locAggregate.get(name) || 0) + (qty || 0));
        });
      } else if (locationStock && typeof locationStock === 'object') {
        Object.entries(locationStock as Record<string, number>).forEach(([name, qty]) => {
          locAggregate.set(name, (locAggregate.get(name) || 0) + (qty || 0));
        });
      } else {
        const name = (p as any).location || '-';
        locAggregate.set(name, (locAggregate.get(name) || 0) + stock);
      }
      // Fallback: if locationStock exists but is empty, use primary location
      if (locAggregate.size === 0) {
        const name = (p as any).location || '-';
        locAggregate.set(name, (locAggregate.get(name) || 0) + stock);
      }

      for (const [name, qtyRaw] of locAggregate.entries()) {
        const qty = Math.max(0, Number(qtyRaw || 0));
        const existing = g.locations.find(l => l.name === name);
        if (existing) existing.qty += qty; else g.locations.push({ name, qty });
      }
    }
    for (const g of byKey.values()) {
      g.locations.sort((a, b) => (b.qty || 0) - (a.qty || 0));
      // choose representative category by frequency
      const freq = new Map<string, number>();
      for (const it of g.items) {
        const c = (it as any).category as string;
        if (!c) continue;
        freq.set(c, (freq.get(c) || 0) + 1);
      }
      let bestCat: string | undefined;
      let bestCnt = -1;
      for (const [c, cnt] of freq.entries()) {
        if (cnt > bestCnt) { bestCat = c; bestCnt = cnt; }
      }
      g.category = bestCat || (g.items[0] as any).category;
    }
    return Array.from(byKey.values());
  }, [products]);

  return (
    <div className={`rounded-lg shadow-md overflow-hidden transition-all duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
      <div className="overflow-x-auto">
        <table className={`min-w-full table-fixed divide-y transition-colors duration-300 ${isDark ? 'divide-gray-700' : 'divide-gray-200'
          }`}>
          <thead className={`transition-colors duration-300 ${isDark ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-2/5 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                }`}>Товар</th>
              <th className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider w-40 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                }`}>Категория</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                }`}>Бренд / Модель</th>
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                }`}>ID / Штрихкод</th>
              {isAdmin ? (
                <>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>Закупка</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>Опт</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                    }`}>Продажа</th>
                </>
              ) : (
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>Цена</th>
              )}
              <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                }`}>Наличие</th>
              {isAdmin ? (
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-500'
                  }`}>Локации</th>
              ) : null}
            </tr>
          </thead>
          <tbody className={`divide-y transition-colors duration-300 ${isDark ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'
            }`}>
            {grouped.map((g) => {
              const p = g.items[0]; const displayImage = (g.items.find(i => (i as any).image)?.image as any) || (p as any).image; return (
                <tr
                  key={g.key}
                  className={`hover:bg-gray-50 ${isAdmin && onEditProduct ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (isAdmin && onEditProduct) onEditProduct(p); }}
                  title={isAdmin && onEditProduct ? 'Редактировать товар' : undefined}
                >
                  <td className="pl-4 pr-3 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {displayImage ? (
                        <img src={displayImage} alt={p.nameRu} className="h-10 w-10 rounded-lg object-cover mr-2" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 mr-2" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 max-w-[240px] truncate">{p.nameRu}</div>
                        {p.descriptionRu ? (
                          <div className="text-xs text-gray-500 line-clamp-1 max-w-[260px]">{p.descriptionRu}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="pl-3 pr-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {categories[(g.category as string)] || g.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {p.brand} {p.model ? `• ${p.model}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex flex-col">
                      <span className="font-medium text-blue-600">ID: {(p as any).productId || '-'}</span>
                      <span className="text-xs text-gray-500">#{p.barcode || '-'}</span>
                    </div>
                  </td>
                  {isAdmin ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 transition-colors duration-300">
                        {formatPrice((p as any).purchasePrice ?? 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 transition-colors duration-300">
                        {(((p as any).wholesalePrice ?? 0) > 0)
                          ? formatPrice((p as any).wholesalePrice)
                          : null}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium transition-colors duration-300 ${isDark ? 'text-blue-400' : 'text-gray-900'
                        }`}>
                        {formatPrice(p.salePrice)}
                      </td>
                    </>
                  ) : (
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium transition-colors duration-300 ${isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                      {formatPrice(p.salePrice)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAdmin ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${g.totalStock === 0
                          ? 'bg-red-100 text-red-800'
                          : g.totalStock > 0 && g.totalStock <= ((p as any).minStock ?? 0)
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                        {g.totalStock === 0
                          ? 'Нет в наличии'
                          : g.totalStock <= ((p as any).minStock ?? 0)
                            ? `Низкий остаток (${g.totalStock})`
                            : `В наличии (${g.totalStock})`}
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {(p as any).stockStatus || (g.totalStock > 0 ? 'В наличии' : 'Нет в наличии')}
                      </span>
                    )}
                  </td>
                  {isAdmin ? (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-wrap gap-1">
                        {g.locations.slice(0, 3).map((l) => (
                          <span key={l.name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-700'
                            }`}>
                            {l.name}: {l.qty}
                          </span>
                        ))}
                        {g.locations.length > 3 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                            }`}>+{g.locations.length - 3}</span>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductTable;


