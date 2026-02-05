/**
 * Cloudinary Image Optimization Utilities
 * Bu dosya Cloudinary'den gelen görselleri optimize etmek için kullanılır
 */

export interface CloudinaryImageOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'crop' | 'thumb';
  quality?: 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  gravity?: 'auto' | 'face' | 'center' | 'north' | 'south' | 'east' | 'west';
  radius?: number;
  effect?: string;
}

/**
 * Cloudinary URL'ini optimize eder
 * @param publicId - Cloudinary public ID
 * @param options - Optimizasyon seçenekleri
 * @returns Optimize edilmiş Cloudinary URL'i
 */
export function getOptimizedImageUrl(
  publicId: string, 
  options: CloudinaryImageOptions = {}
): string {
  const {
    width,
    height,
    crop = 'limit',
    quality = 'auto:best',
    format = 'auto',
    gravity = 'auto',
    radius,
    effect
  } = options;

  // Base Cloudinary URL
  const baseUrl = `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/image/upload`;

  // Transformation parametrelerini oluştur
  const transformations: string[] = [];

  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (crop) transformations.push(`c_${crop}`);
  if (quality) transformations.push(`q_${quality}`);
  if (format) transformations.push(`f_${format}`);
  if (gravity) transformations.push(`g_${gravity}`);
  if (radius) transformations.push(`r_${radius}`);
  if (effect) transformations.push(`e_${effect}`);

  // Progressive loading için
  transformations.push('fl_progressive');

  // DPR (Device Pixel Ratio) desteği
  transformations.push('dpr_auto');

  const transformationString = transformations.join(',');
  
  return `${baseUrl}/${transformationString}/${publicId}`;
}

/**
 * Responsive image setleri için farklı boyutlarda URL'ler oluşturur
 * @param publicId - Cloudinary public ID
 * @param sizes - Farklı boyutlar
 * @returns Boyutlara göre URL'ler
 */
export function getResponsiveImageUrls(
  publicId: string, 
  sizes: number[] = [320, 640, 800, 1200]
): { size: number; url: string }[] {
  return sizes.map(size => ({
    size,
    url: getOptimizedImageUrl(publicId, { 
      width: size, 
      crop: 'limit',
      quality: 'auto:best'
    })
  }));
}

/**
 * Thumbnail için optimize edilmiş URL
 * @param publicId - Cloudinary public ID
 * @param size - Thumbnail boyutu (varsayılan: 150)
 * @returns Thumbnail URL'i
 */
export function getThumbnailUrl(publicId: string, size: number = 150): string {
  return getOptimizedImageUrl(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good'
  });
}

/**
 * Avatar için optimize edilmiş URL
 * @param publicId - Cloudinary public ID
 * @param size - Avatar boyutu (varsayılan: 100)
 * @returns Avatar URL'i
 */
export function getAvatarUrl(publicId: string, size: number = 100): string {
  return getOptimizedImageUrl(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    radius: size / 2,
    quality: 'auto:best'
  });
}

/**
 * Product image için optimize edilmiş URL
 * @param publicId - Cloudinary public ID
 * @param width - Genişlik (varsayılan: 400)
 * @param height - Yükseklik (varsayılan: 300)
 * @returns Product image URL'i
 */
export function getProductImageUrl(
  publicId: string, 
  width: number = 400, 
  height: number = 300
): string {
  return getOptimizedImageUrl(publicId, {
    width,
    height,
    crop: 'limit',
    gravity: 'auto',
    quality: 'auto:best'
  });
}

/**
 * Cloudinary URL'den public ID'yi çıkarır
 * @param url - Cloudinary URL'i
 * @returns Public ID
 */
export function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:.*\/)?(.+?)(?:\.[^.]+)?$/);
  return match ? match[1] : null;
}

/**
 * Cloudinary URL'inin geçerli olup olmadığını kontrol eder
 * @param url - Kontrol edilecek URL
 * @returns Geçerli mi?
 */
export function isValidCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}
