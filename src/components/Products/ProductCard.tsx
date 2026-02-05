/*
 * TEMPORARILY DISABLED - Product Detail Pages
 * Date: 2025-09-20
 * Reason: Not needed for current phase
 * To re-enable: Set PRODUCT_DETAIL_ENABLED to true in src/config/features.ts
 * and search for "PRODUCT_DETAIL_DISABLED" comments in this file to restore Links.
 */
import React from 'react';
import { ShoppingCart, MapPin, BarChart2, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Product } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Link } from 'react-router-dom';
import { PRODUCT_DETAIL_ENABLED } from '../../config/features';
import { getProductImageUrl, isValidCloudinaryUrl } from '../../utils/cloudinary';

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  categories: Record<string, string>;
  // Grouped view support
  groupedLocations?: Array<{ name: string; qty: number }>;
  totalStock?: number;
  overrideCategory?: string;
  overrideImage?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete, categories, groupedLocations, totalStock, overrideCategory, overrideImage }) => {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isDark } = useTheme();
  const { formatPrice } = useSettings();

  const handleAddToCart = () => {
    if (product.stock > 0) {
      addItem(product, 1);
    }
  };

  const effectiveStock = typeof totalStock === 'number' ? totalStock : product.stock;
  const isLowStock = effectiveStock < product.minStock;
  const isOutOfStock = effectiveStock === 0;

  // Optimize image URL for Cloudinary
  const getOptimizedImageUrl = (imageUrl: string) => {
    if (isValidCloudinaryUrl(imageUrl)) {
      return getProductImageUrl(imageUrl, 400, 300);
    }
    return imageUrl;
  };

  const optimizedImageUrl = getOptimizedImageUrl(overrideImage || product.image);

  return (
    <div className={`rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${isLowStock ? 'border-l-4 border-orange-400' : ''} ${isOutOfStock ? 'border-l-4 border-red-400' : ''} bg-white`}>
      {/* Product Image */}
      <div className="relative">
        {/* PRODUCT_DETAIL_DISABLED: The Link below is disabled via feature flag */}
        {PRODUCT_DETAIL_ENABLED ? (
          <Link to={`/product/${product.id}`}>
            <img
              src={optimizedImageUrl}
              alt={product.nameRu}
              className="w-full h-48 object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback to original image if optimized fails
                if (e.currentTarget.src !== (overrideImage || product.image)) {
                  e.currentTarget.src = overrideImage || product.image;
                }
              }}
            />
          </Link>
        ) : (
          // Non-interactive image wrapper to preserve visuals without navigation
          <div>
            <img
              src={optimizedImageUrl}
              alt={product.nameRu}
              className="w-full h-48 object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback to original image if optimized fails
                if (e.currentTarget.src !== (overrideImage || product.image)) {
                  e.currentTarget.src = overrideImage || product.image;
                }
              }}
            />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {categories?.[overrideCategory ?? product.category] ?? (overrideCategory ?? product.category)}
          </span>
        </div>
        {isLowStock && !isOutOfStock && (
          <div className="absolute top-3 left-3">
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Мало товара
            </span>
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-full">
              Нет в наличии
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* PRODUCT_DETAIL_DISABLED: The title Link is disabled via feature flag */}
        {PRODUCT_DETAIL_ENABLED ? (
          <Link to={`/product/${product.id}`} className="block">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800">{product.brand}</span>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">ID: {product.productId}</span>
                <span className="text-xs text-gray-400">#{product.barcode}</span>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-gray-900">
              {product.nameRu}
            </h3>
          </Link>
        ) : (
          <div className="block">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800">{product.brand}</span>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">ID: {product.productId}</span>
                <span className="text-xs text-gray-400">#{product.barcode}</span>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-gray-900">
              {product.nameRu}
            </h3>
          </div>
        )}

        <p className="text-sm mb-3 line-clamp-2 text-gray-800">
          {product.descriptionRu}
        </p>

        {/* Locations (Admin only) */}
        {user?.role === 'admin' && (
          <div className={`text-xs mb-3 transition-colors duration-300 ${isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
            <div className="flex items-center mb-1">
              <MapPin className="h-4 w-4 mr-1" />
              <span>Локации:</span>
            </div>
            {Array.isArray(groupedLocations) && groupedLocations.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {groupedLocations.slice(0, 4).map((l) => (
                  <span key={l.name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                    }`}>
                    {l.name}: {l.qty}
                  </span>
                ))}
                {groupedLocations.length > 4 ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs transition-colors duration-300 ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-800'
                    }`}>+{groupedLocations.length - 4}</span>
                ) : null}
              </div>
            ) : (
              <div className={`flex items-center transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                <span>{product.location || '-'}</span>
              </div>
            )}
          </div>
        )}

        {/* Stock Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-sm">
            {user?.role === 'admin' ? (
              <div className="flex items-center">
                <BarChart2 className="h-4 w-4 mr-1 text-gray-500" />
                <span className={`font-medium ${isLowStock ? 'text-orange-600' : 'text-gray-800'}`}>
                  Склад: {effectiveStock} шт.
                </span>
              </div>
            ) : (
              <span className={`text-sm font-medium ${isOutOfStock ? 'text-red-600' : 'text-emerald-500'}`}>
                {isOutOfStock ? 'Нет в наличии' : 'В наличии'}
              </span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="mb-4">
          {user?.role === 'admin' ? (
            <div className="space-y-1">
              <div className="text-sm text-gray-800">
                Закупка: {formatPrice(product.purchasePrice)}
              </div>
              {(product as any).wholesalePrice ? (
                <div className="text-sm text-gray-800">
                  Опт: {formatPrice((product as any).wholesalePrice)}
                </div>
              ) : null}
              <div className="text-lg font-bold text-blue-600">
                Продажа: {formatPrice(product.salePrice)}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-blue-600">
              {formatPrice(product.salePrice)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {user?.role === 'admin' ? (
            <>
              <button
                onClick={() => onEdit?.(product)}
                className="flex-1 btn-pill-solid text-sm flex items-center justify-center"
              >
                <Edit className="h-4 w-4 mr-1" />
                Изменить
              </button>
              <button
                onClick={() => onDelete?.(product.id)}
                className="btn-pill-outline text-sm"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="w-full btn-pill-solid text-sm flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isOutOfStock ? 'Нет в наличии' : 'В корзину'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;