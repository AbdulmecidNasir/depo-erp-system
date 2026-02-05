import React, { useMemo } from 'react';
import { Product } from '../../types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onEditProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  categories: Record<string, string>;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, onEditProduct, onDeleteProduct, categories }) => {
  const grouped = useMemo(() => {
    const normalize = (v: string | undefined | null) => String(v || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9\u0400-\u04FF]/gi, '');
    type Group = { key: string; items: Product[]; totalStock: number; locations: Array<{ name: string; qty: number }>; category?: string; image?: string };
    const byKey = new Map<string, Group>();
    for (const p of products) {
      const namePref = (p as any).nameRu || (p as any).name;
      const key = p.barcode || `${normalize(p.brand)}|${normalize(p.model)}|${normalize(namePref)}`;
      if (!byKey.has(key)) byKey.set(key, { key, items: [], totalStock: 0, locations: [], category: (p as any).category, image: (p as any).image });
      const g = byKey.get(key)!;
      g.items.push(p);
      const stock = (p as any).stock ?? 0;
      g.totalStock += stock;
      const locationStock = (p as any).locationStock as Map<string, number> | Record<string, number> | undefined;
      const locAgg = new Map<string, number>();
      if (locationStock && typeof (locationStock as any).forEach === 'function') {
        (locationStock as Map<string, number>).forEach((qty, name) => {
          locAgg.set(name, (locAgg.get(name) || 0) + (qty || 0));
        });
      } else if (locationStock && typeof locationStock === 'object') {
        Object.entries(locationStock as Record<string, number>).forEach(([name, qty]) => {
          locAgg.set(name, (locAgg.get(name) || 0) + (qty || 0));
        });
      } else {
        const name = (p as any).location || '-';
        locAgg.set(name, (locAgg.get(name) || 0) + stock);
      }
      // Fallback: if locationStock was present but empty, use primary location
      if (locAgg.size === 0) {
        const name = (p as any).location || '-';
        locAgg.set(name, (locAgg.get(name) || 0) + stock);
      }
      for (const [name, qty] of locAgg.entries()) {
        const existing = g.locations.find(l => l.name === name);
        if (existing) existing.qty += qty; else g.locations.push({ name, qty });
      }
      if (!g.image && (p as any).image) g.image = (p as any).image as any;
    }
    for (const g of byKey.values()) {
      g.locations.sort((a, b) => (b.qty || 0) - (a.qty || 0));
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
      g.category = bestCat || g.category;
    }
    return Array.from(byKey.values());
  }, [products]);
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Товары не найдены</h3>
          <p className="text-gray-500">Попробуйте изменить параметры поиска или фильтрации</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 overflow-x-auto overflow-y-hidden pb-2">
      {grouped.map((g) => {
        const p = g.items[0];
        return (
          <div key={g.key} className="w-72 flex-shrink-0">
            <ProductCard
              product={p}
              onEdit={onEditProduct}
              onDelete={onDeleteProduct}
              categories={categories}
              groupedLocations={g.locations}
              totalStock={g.totalStock}
              overrideCategory={g.category}
              overrideImage={g.image}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ProductGrid;