import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Product } from '../../types';
import { Star, ChevronLeft, Share2, Heart, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatUZS } from '../../utils/currency';

const formatPrice = (value: number) => formatUZS(Number(value || 0));

const Stars: React.FC<{ value: number }> = ({ value }) => {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < full ? 'text-yellow-500 fill-yellow-500' : half && i === full ? 'text-yellow-500' : 'text-gray-300'}`} />
      ))}
    </div>
  );
};

const ImageGallery: React.FC<{ images: string[] }> = ({ images }) => {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const activeSrc = images[active];

  const goPrev = () => setActive((prev) => (prev - 1 + images.length) % images.length);
  const goNext = () => setActive((prev) => (prev + 1) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape' && lightbox) setLightbox(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, images.length]);

  return (
    <div>
      <div className="relative bg-white rounded-lg overflow-hidden border">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          src={activeSrc}
          className="w-full h-96 object-contain bg-white cursor-zoom-in"
          loading="lazy"
          onClick={() => setLightbox(true)}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/800x600?text=Image+not+available'; }}
        />
        {/* Left/Right navigation */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={goPrev}
              className="absolute inset-y-0 left-0 w-10 flex items-center justify-center bg-black/20 hover:bg-black/30 text-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={goNext}
              className="absolute inset-y-0 right-0 w-10 flex items-center justify-center bg-black/20 hover:bg-black/30 text-white"
            >
              ›
            </button>
            <div className="absolute bottom-2 right-2 text-xs text-white bg-black/50 rounded px-2 py-1">
              {active + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {images.map((src, idx) => (
          <button key={idx} onClick={() => setActive(idx)} className={`border rounded-md overflow-hidden ${idx === active ? 'ring-2 ring-blue-600' : ''}`}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={src} className="w-full h-16 object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/160x120?text=No+Image'; }} />
          </button>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightbox(false)}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={activeSrc} className="max-h-[90vh] max-w-[90vw] object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/1200x900?text=No+Image'; }} />
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white text-2xl flex items-center justify-center"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white text-2xl flex items-center justify-center"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const QuantitySelector: React.FC<{ value: number; onChange: (v: number) => void; max?: number }> = ({ value, onChange, max }) => (
  <div className="inline-flex items-center border rounded-md overflow-hidden">
    <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className="px-3 py-2 text-gray-700 hover:bg-gray-50">-</button>
    <div className="px-4 py-2 min-w-12 text-center">{value}</div>
    <button type="button" onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)} className="px-3 py-2 text-gray-700 hover:bg-gray-50">+</button>
  </div>
);

const ProductDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.products.getById(id as string);
        if (active) {
          if (res.success) setProduct(res.data as any);
          else setError('Product not found');
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load product');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (id) load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (product) document.title = `${product.nameRu || product.name} | Shop`;
  }, [product]);

  const images = useMemo(() => {
    const arr: string[] = [];
    const p: any = product || {};
    if (typeof p.image === 'string' && p.image.trim()) arr.push(p.image);
    if (Array.isArray(p.images)) {
      for (const img of p.images) {
        const url = typeof img === 'string' ? img : img?.url;
        if (url && typeof url === 'string' && url.trim()) arr.push(url);
      }
    }
    // de-duplicate and filter invalid
    const unique = Array.from(new Set(arr)).filter(Boolean);
    return unique.length ? unique : ['https://via.placeholder.com/800x600?text=No+Image'];
  }, [product]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="h-96 bg-gray-200 rounded" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-gray-200 rounded" />
            <div className="h-6 w-1/3 bg-gray-200 rounded" />
            <div className="h-32 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-red-600 mb-4">{error || 'Product not found'}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const rating: any = (product as any).rating || { average: 0, count: 0 };
  const inStock = product.stock > 0;
  const isLow = product.stock < product.minStock && inStock;

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Breadcrumbs and back */}
      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
        <nav className="space-x-2">
          <Link to="/" className="hover:underline">Home</Link>
          <span>/</span>
          <span className="capitalize">{product.category}</span>
          <span>/</span>
          <span className="text-gray-900">{product.nameRu || product.name}</span>
        </nav>
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900">
          <ChevronLeft className="h-4 w-4" />
          Back to Products
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <ImageGallery images={images} />

        {/* Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">{product.nameRu || product.name}</h1>
          <div className="flex items-center gap-3 mb-3 text-sm">
            <span className="text-gray-500">Model: {product.model}</span>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <Stars value={rating.average || 0} />
              <span className="text-gray-600">({rating.count || 0})</span>
            </div>
            <button className="ml-auto inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><Share2 className="h-4 w-4" />Share</button>
            <button className="inline-flex items-center gap-1 text-gray-600 hover:text-red-600"><Heart className="h-4 w-4" />Wishlist</button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-end gap-3">
              <div className="text-3xl font-bold text-blue-600">{formatPrice(product.salePrice)}</div>
              {/* Placeholder for strikethrough original price or discount if needed */}
            </div>
            <div className="mt-2 text-sm flex items-center gap-2">
              {inStock ? (
                <span className="inline-flex items-center text-emerald-700"><CheckCircle2 className="h-4 w-4 mr-1" />In Stock</span>
              ) : (
                <span className="inline-flex items-center text-red-600"><AlertTriangle className="h-4 w-4 mr-1" />Out of Stock</span>
              )}
              {isLow && <span className="text-orange-600">Limited quantity</span>}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <QuantitySelector value={qty} onChange={setQty} max={product.stock} />
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md font-medium">Add to Cart</button>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-md font-medium">Buy Now</button>
          </div>

          <div className="prose prose-sm max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-700 whitespace-pre-line">{product.descriptionRu || product.description || '—'}</p>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.keys(product.specifications || {}).length ? (
                Object.entries(product.specifications).map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-white border rounded-md px-3 py-2">
                    <span className="text-gray-500 mr-4">{k}</span>
                    <span className="text-gray-900">{v}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No specifications provided.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Related products placeholder */}
      <div className="mt-12">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">You may also like</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* This can be populated by a related products API later */}
          <div className="h-40 bg-gray-100 rounded-md" />
          <div className="h-40 bg-gray-100 rounded-md" />
          <div className="h-40 bg-gray-100 rounded-md" />
          <div className="h-40 bg-gray-100 rounded-md" />
        </div>
      </div>
    </div>
  );
};

export default ProductDetail; 