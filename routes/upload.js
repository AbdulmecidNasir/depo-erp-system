import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import { protect, restrictTo } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

// Configure storage (Cloudinary or local disk)
let storage;
if (isCloudinaryConfigured) {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'erp-products',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto:best' },
        { fetch_format: 'auto' },
        { flags: 'progressive' },
        { dpr: 'auto' }
      ]
    }
  });
} else {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
      cb(null, `${Date.now()}_${base}${ext}`);
    }
  });
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'), false);
    }
  }
});

// @desc    Upload single image
// @route   POST /api/upload/image
// @access  Private (Admin only)
router.post('/image', protect, restrictTo('admin'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Файл изображения не предоставлен'
      });
    }

    // Build response depending on storage
    const data = isCloudinaryConfigured
      ? {
          url: req.file.path,
          publicId: req.file.filename,
          originalName: req.file.originalname
        }
      : {
          url: `${process.env.PUBLIC_BASE_URL || (req.protocol + '://' + req.get('host'))}/uploads/${req.file.filename}`,
          publicId: req.file.filename,
          originalName: req.file.originalname
        };

    res.json({
      success: true,
      message: 'Изображение успешно загружено',
      data
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки изображения'
    });
  }
});

// @desc    Upload multiple images
// @route   POST /api/upload/images
// @access  Private (Admin only)
router.post('/images', protect, restrictTo('admin'), upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Файлы изображений не предоставлены'
      });
    }

    const uploadedImages = req.files.map(file => (
      isCloudinaryConfigured
        ? { url: file.path, publicId: file.filename, originalName: file.originalname }
        : { url: `${process.env.PUBLIC_BASE_URL || (req.protocol + '://' + req.get('host'))}/uploads/${file.filename}`, publicId: file.filename, originalName: file.originalname }
    ));

    res.json({
      success: true,
      message: `${req.files.length} изображений успешно загружено`,
      data: uploadedImages
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки изображений'
    });
  }
});

// @desc    Delete image
// @route   DELETE /api/upload/image/:publicId
// @access  Private (Admin only)
router.delete('/image/:publicId', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { publicId } = req.params;

    // Delete from Cloudinary
    if (isCloudinaryConfigured) {
      const result = await cloudinary.uploader.destroy(publicId);
      if (result.result === 'ok') {
        return res.json({ success: true, message: 'Изображение успешно удалено' });
      }
      return res.status(400).json({ success: false, message: 'Не удалось удалить изображение' });
    } else {
      // Local file delete
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, message: 'Изображение успешно удалено' });
      }
      return res.status(404).json({ success: false, message: 'Файл не найден' });
    }
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления изображения'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Файл слишком большой. Максимальный размер: 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Слишком много файлов. Максимум: 10 файлов'
      });
    }
  }
  
  if (error.message === 'Только изображения разрешены') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  console.error('Upload middleware error:', error);
  res.status(500).json({
    success: false,
    message: 'Ошибка обработки файла'
  });
});

export default router;