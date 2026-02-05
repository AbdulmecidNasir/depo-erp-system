import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import sendEmail from '../utils/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: fileFilter
});

// Generate JWT token
const generateToken = (id, sessionId) => {
  return jwt.sign({ id, sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('firstName').trim().isLength({ min: 2 }).withMessage('Имя должно содержать минимум 2 символа'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Фамилия должна содержать минимум 2 символа'),
  body('email').isEmail().normalizeEmail().withMessage('Введите корректный email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      sessions: [{
        id: sessionId,
        device: req.headers['user-agent'] || 'Unknown Device',
        location: 'Unknown',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        lastActive: new Date()
      }]
    });

    // Send verification email
    const verificationUrl = `${process.env.BASE_URL}/verify-email?token=${verificationToken}`;
    const message = `Пожалуйста, подтвердите ваш email, перейдя по ссылке: ${verificationUrl}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h1 style="color: #2563eb; text-align: center;">Подтверждение Email</h1>
        <p style="font-size: 16px; color: #374151;">Благодарим за регистрацию в <strong>Infinity Flow</strong>!</p>
        <p style="font-size: 16px; color: #374151;">Пожалуйста, нажмите на кнопку ниже, чтобы подтвердить ваш email:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Подтвердить Email</a>
        </div>
        <p style="font-size: 14px; color: #6b7280;">Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:</p>
        <p style="font-size: 14px; color: #2563eb; word-break: break-all;">${verificationUrl}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Это письмо было отправлено автоматически, на него не нужно отвечать.</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Подтвердите ваш email - Infinity Flow',
        message,
        html
      });

      res.status(201).json({
        success: true,
        message: 'Пользователь зарегистрирован. Пожалуйста, проверьте почту для подтверждения.'
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      res.status(201).json({
        success: true,
        message: 'Пользователь зарегистрирован, но произошла ошибка при отправке письма. Пожалуйста, свяжитесь с поддержкой.'
      });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при регистрации'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Введите корректный email'),
  body('password').notEmpty().withMessage('Пароль обязателен')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Аккаунт деактивирован'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Пожалуйста, подтвердите ваш email перед входом'
      });
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Add session to user
    if (!user.sessions) user.sessions = [];
    user.sessions.push({
      id: sessionId,
      device: req.headers['user-agent'] || 'Unknown Device',
      location: 'Unknown',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      lastActive: new Date()
    });

    await user.save();

    res.json({
      success: true,
      token: generateToken(user._id, sessionId),
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Токен обязателен'
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Неверный или истекший токен'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email успешно подтвержден. Теперь вы можете войти.'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        company: user.company,
        position: user.position,
        bio: user.bio,
        profilePhotoUrl: user.profilePhotoUrl,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения данных пользователя'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('Имя должно содержать минимум 2 символа'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Фамилия должна содержать минимум 2 символа'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Введите корректный email'),
  body('phone').optional().trim(),
  body('company').optional().trim().isLength({ max: 100 }).withMessage('Название компании не может быть длиннее 100 символов'),
  body('position').optional().trim().isLength({ max: 100 }).withMessage('Должность не может быть длиннее 100 символов'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Описание не может быть длиннее 500 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, phone, company, position, bio } = req.body;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email уже используется другим пользователем'
        });
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (company !== undefined) updateData.company = company;
    if (position !== undefined) updateData.position = position;
    if (bio !== undefined) updateData.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Профиль успешно обновлен',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        company: user.company,
        position: user.position,
        bio: user.bio,
        profilePhotoUrl: user.profilePhotoUrl,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления профиля'
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
  body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль должен содержать минимум 6 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({
        success: false,
        message: 'Неверный текущий пароль'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Пароль успешно изменен'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка изменения пароля'
    });
  }
});

// @desc    Upload profile photo
// @route   POST /api/auth/profile/photo
// @access  Private
router.post('/profile/photo', protect, upload.single('profilePhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Пожалуйста, выберите изображение'
      });
    }

    // Delete old photo if exists
    const user = await User.findById(req.user.id);
    if (user.profilePhotoUrl) {
      const oldPhotoPath = path.join(__dirname, '..', user.profilePhotoUrl.replace('/uploads/', ''));
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update user with new photo URL
    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    user.profilePhotoUrl = photoUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Фото профиля успешно загружено',
      photoUrl: photoUrl
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    // Delete uploaded file if error occurs
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки фото'
    });
  }
});

// @desc    Delete profile photo
// @route   DELETE /api/auth/profile/photo
// @access  Private
router.delete('/profile/photo', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.profilePhotoUrl) {
      // Delete photo file
      const photoPath = path.join(__dirname, '..', user.profilePhotoUrl.replace('/uploads/', ''));
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }

      // Remove photo URL from user
      user.profilePhotoUrl = '';
      await user.save();
    }

    res.json({
      success: true,
      message: 'Фото профиля успешно удалено'
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления фото'
    });
  }
});

// @desc    Get user settings
// @route   GET /api/auth/settings
// @access  Private
router.get('/settings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    // Default settings structure
    const settings = {
      // General Settings
      language: user.language || 'ru',
      timezone: user.timezone || 'Europe/Moscow',
      dateFormat: user.dateFormat || 'DD.MM.YYYY',
      currency: user.currency || 'RUB',

      // Appearance Settings
      theme: user.theme || 'light',
      colorScheme: user.colorScheme || 'blue',
      sidebarCollapsed: user.sidebarCollapsed || false,
      fontSize: user.fontSize || 'medium',

      // Account Settings
      emailNotifications: user.emailNotifications !== false,
      twoFactorEnabled: user.twoFactorEnabled || false,

      // Notifications Settings
      pushNotifications: user.pushNotifications !== false,
      notificationFrequency: user.notificationFrequency || 'immediate',
      soundAlerts: user.soundAlerts !== false,

      // Privacy & Security
      dataExportEnabled: user.dataExportEnabled !== false,
      privacyLevel: user.privacyLevel || 'standard',

      // Business Settings
      companyName: user.companyName || '',
      companyAddress: user.companyAddress || '',
      taxId: user.taxId || '',
      invoicePrefix: user.invoicePrefix || 'INV',
      fiscalYearStart: user.fiscalYearStart || '01-01',

      // Integration & API
      apiKeys: user.apiKeys || [],
      connectedServices: user.connectedServices || [],
      webhooks: user.webhooks || []
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки настроек'
    });
  }
});

// @desc    Update user settings
// @route   PUT /api/auth/settings
// @access  Private
router.put('/settings', protect, [
  body('language').optional().isIn(['ru', 'en', 'tr']),
  body('timezone').optional().isString(),
  body('dateFormat').optional().isIn(['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  body('currency').optional().isIn(['RUB', 'USD', 'EUR', 'TRY', 'UZS']),
  body('theme').optional().isIn(['light', 'dark']),
  body('colorScheme').optional().isString(),
  body('sidebarCollapsed').optional().isBoolean(),
  body('fontSize').optional().isIn(['small', 'medium', 'large']),
  body('emailNotifications').optional().isBoolean(),
  body('twoFactorEnabled').optional().isBoolean(),
  body('pushNotifications').optional().isBoolean(),
  body('notificationFrequency').optional().isIn(['immediate', 'hourly', 'daily', 'weekly']),
  body('soundAlerts').optional().isBoolean(),
  body('dataExportEnabled').optional().isBoolean(),
  body('privacyLevel').optional().isIn(['public', 'standard', 'private']),
  body('companyName').optional().isString().isLength({ max: 100 }),
  body('companyAddress').optional().isString().isLength({ max: 500 }),
  body('taxId').optional().isString().isLength({ max: 50 }),
  body('invoicePrefix').optional().isString().isLength({ max: 10 }),
  body('fiscalYearStart').optional().isString().isLength({ max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Неверные данные',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user.id);

    // Update settings fields
    const updateFields = {};
    const allowedFields = [
      'language', 'timezone', 'dateFormat', 'currency',
      'theme', 'colorScheme', 'sidebarCollapsed', 'fontSize',
      'emailNotifications', 'twoFactorEnabled',
      'pushNotifications', 'notificationFrequency', 'soundAlerts',
      'dataExportEnabled', 'privacyLevel',
      'companyName', 'companyAddress', 'taxId', 'invoicePrefix', 'fiscalYearStart'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    // Update user settings
    Object.assign(user, updateFields);
    await user.save();

    res.json({
      success: true,
      message: 'Настройки успешно сохранены',
      data: updateFields
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сохранения настроек'
    });
  }
});

// @desc    Create API key
// @route   POST /api/auth/settings/api-keys
// @access  Private
router.post('/settings/api-keys', protect, [
  body('name').notEmpty().isString().isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Неверные данные',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user.id);

    // Generate API key
    const apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');
    const newApiKey = {
      id: Date.now().toString(),
      name: req.body.name,
      key: apiKey,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    if (!user.apiKeys) {
      user.apiKeys = [];
    }
    user.apiKeys.push(newApiKey);
    await user.save();

    res.json({
      success: true,
      message: 'API ключ успешно создан',
      data: newApiKey
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания API ключа'
    });
  }
});

// @desc    Delete API key
// @route   DELETE /api/auth/settings/api-keys/:keyId
// @access  Private
router.delete('/settings/api-keys/:keyId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.apiKeys) {
      return res.status(404).json({
        success: false,
        message: 'API ключ не найден'
      });
    }

    const keyIndex = user.apiKeys.findIndex(key => key.id === req.params.keyId);
    if (keyIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'API ключ не найден'
      });
    }

    user.apiKeys.splice(keyIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: 'API ключ успешно удален'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления API ключа'
    });
  }
});

// @desc    Get user sessions
// @route   GET /api/auth/sessions
// @access  Private
router.get('/sessions', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Format sessions for frontend
    const sessions = (user.sessions || []).map(session => ({
      id: session.id,
      device: session.device,
      location: session.location || session.ip || 'Unknown',
      lastActive: session.lastActive,
      current: session.id === req.sessionId
    }));

    // Sort: current first, then by last active
    sessions.sort((a, b) => {
      if (a.current) return -1;
      if (b.current) return 1;
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка загрузки сессий'
    });
  }
});

// @desc    Delete session
// @route   DELETE /api/auth/sessions/:sessionId
// @access  Private
router.delete('/sessions/:sessionId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Cannot delete current session this way (should use logout)
    if (req.params.sessionId === req.sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Нельзя завершить текущую сессию через этот эндпоинт'
      });
    }

    user.sessions = user.sessions.filter(s => s.id !== req.params.sessionId);
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Сессия успешно завершена'
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка завершения сессии'
    });
  }
});

// @desc    Export user data
// @route   POST /api/auth/export-data
// @access  Private
router.post('/export-data', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    // In a real app, you'd generate a comprehensive data export
    const exportData = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        company: user.company,
        position: user.position,
        bio: user.bio,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      settings: {
        language: user.language,
        timezone: user.timezone,
        theme: user.theme,
        // ... other settings
      },
      exportedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Экспорт данных начат. Файл будет отправлен на ваш email.',
      data: exportData
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта данных'
    });
  }
});

export default router;