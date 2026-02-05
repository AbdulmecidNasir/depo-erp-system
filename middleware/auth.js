import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Protect routes - require authentication
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Доступ запрещен. Токен не предоставлен.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Аккаунт деактивирован'
      });
    }

    // Verify session if enabled (optional, but good for "gerçek veri")
    if (decoded.sessionId && user.sessions) {
      const isSessionActive = user.sessions.some(s => s.id === decoded.sessionId);
      if (!isSessionActive) {
        return res.status(401).json({
          success: false,
          message: 'Сессия завершена. Пожалуйста, войдите снова.',
          errorCode: 'SESSION_EXPIRED'
        });
      }
    }

    req.user = user;
    req.sessionId = decoded.sessionId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Срок действия токена истек',
        errorCode: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Недействительный токен',
        errorCode: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Ошибка аутентификации',
      errorCode: 'AUTH_ERROR'
    });
  }
};

// Restrict to specific roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'У вас нет прав для выполнения этого действия'
      });
    }
    next();
  };
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (user && user.isActive) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};