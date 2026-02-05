import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, X, User, Mail, Phone, Briefcase, Building2, FileText, Lock, Trash2, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  bio?: string;
  profilePhotoUrl?: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const ProfilePage: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    bio: '',
    profilePhotoUrl: ''
  });

  const [originalData, setOriginalData] = useState<ProfileData>({ ...profileData });
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfileData();
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const response = await api.auth.getMe();
      if (response.success && response.user) {
        const userData = {
          firstName: response.user.firstName || '',
          lastName: response.user.lastName || '',
          email: response.user.email || '',
          phone: response.user.phone || '',
          company: response.user.company || '',
          position: response.user.position || '',
          bio: response.user.bio || '',
          profilePhotoUrl: response.user.profilePhotoUrl || ''
        };
        setProfileData(userData);
        setOriginalData(userData);
        if (userData.profilePhotoUrl) {
          setPhotoPreview(userData.profilePhotoUrl);
        }
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Не удалось загрузить данные профиля');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!profileData.firstName.trim()) {
      newErrors.firstName = 'Имя обязательно';
    }
    if (!profileData.lastName.trim()) {
      newErrors.lastName = 'Фамилия обязательна';
    }
    if (!profileData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      newErrors.email = 'Неверный формат email';
    }
    if (profileData.phone && !/^[\d\s\-\+\(\)]+$/.test(profileData.phone)) {
      newErrors.phone = 'Неверный формат номера телефона';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Введите текущий пароль';
    }
    if (!passwordData.newPassword) {
      newErrors.newPassword = 'Введите новый пароль';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Пароль должен быть не менее 6 символов';
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        showNotification('error', 'Размер файла не должен превышать 20MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showNotification('error', 'Выберите изображение');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/profile/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setProfileData(prev => ({ ...prev, profilePhotoUrl: data.photoUrl }));
        setPhotoPreview(data.photoUrl);

        // Update user context with new photo URL
        if (user) {
          const updatedUser = { ...user, profilePhotoUrl: data.photoUrl };
          updateUserProfile(updatedUser);
        }

        showNotification('success', 'Фото профиля успешно обновлено');
      } else {
        showNotification('error', data.message || 'Не удалось загрузить фото');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Ошибка при загрузке фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/profile/photo`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setProfileData(prev => ({ ...prev, profilePhotoUrl: '' }));
        setPhotoPreview(null);

        // Update user context to remove photo URL
        if (user) {
          const updatedUser = { ...user, profilePhotoUrl: '' };
          updateUserProfile(updatedUser);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
        showNotification('success', 'Фото профиля удалено');
      } else {
        showNotification('error', data.message || 'Не удалось удалить фото');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Ошибка при удалении фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const response = await api.auth.updateProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        company: profileData.company,
        position: profileData.position,
        bio: profileData.bio
      });

      if (response.success) {
        setOriginalData({ ...profileData });

        // Update user context with new profile data
        if (user && response.user) {
          updateUserProfile(response.user);
        }

        showNotification('success', 'Профиль успешно обновлен');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    try {
      setSaving(true);
      const response = await api.auth.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (response.success) {
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowPasswordChange(false);
        showNotification('success', 'Пароль успешно изменен');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Не удалось изменить пароль');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfileData({ ...originalData });
    setPhotoPreview(originalData.profilePhotoUrl || null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasChanges = JSON.stringify(profileData) !== JSON.stringify(originalData);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-[var(--text-secondary)]">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg animate-fade-in-down ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
          {notification.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={`theme-card rounded-xl shadow-md p-6 mb-6 transition-all duration-300`}>
        <h1 className={`text-3xl font-bold transition-colors duration-300 text-[var(--text-primary)]`}>Профиль</h1>
        <p className={`transition-colors duration-300 text-[var(--text-secondary)] mt-2`}>Управляйте своими личными данными и настройками</p>
      </div>

      {/* Profile Photo Section */}
      <div className={`theme-card rounded-xl shadow-md p-6 mb-6 transition-all duration-300`}>
        <h2 className={`text-xl font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Фото профиля</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-4xl shadow-lg overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>{profileData.firstName?.charAt(0)}{profileData.lastName?.charAt(0)}</span>
              )}
            </div>
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <Loader className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                Выбрать фото
              </button>
              {fileInputRef.current?.files?.[0] && (
                <button
                  onClick={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Сохранить фото
                </button>
              )}
              {photoPreview && (
                <button
                  onClick={handleDeletePhoto}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить фото
                </button>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-2">Рекомендуемый размер: 800x800px или больше. Максимум 20MB</p>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="theme-card rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-6">Личная информация</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <User className="h-4 w-4 inline mr-2" />
              Имя
            </label>
            <input
              type="text"
              value={profileData.firstName}
              onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
              className={`input-modern ${errors.firstName ? '!border-red-500' : ''}`}
              placeholder="Введите имя"
            />
            {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <User className="h-4 w-4 inline mr-2" />
              Фамилия
            </label>
            <input
              type="text"
              value={profileData.lastName}
              onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
              className={`input-modern ${errors.lastName ? '!border-red-500' : ''}`}
              placeholder="Введите фамилию"
            />
            {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <Mail className="h-4 w-4 inline mr-2" />
              Email
            </label>
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
              className={`input-modern ${errors.email ? '!border-red-500' : ''}`}
              placeholder="email@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <Phone className="h-4 w-4 inline mr-2" />
              Телефон
            </label>
            <input
              type="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
              className={`input-modern ${errors.phone ? '!border-red-500' : ''}`}
              placeholder="+998 XX XXX XX XX"
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <Building2 className="h-4 w-4 inline mr-2" />
              Компания
            </label>
            <input
              type="text"
              value={profileData.company}
              onChange={(e) => setProfileData(prev => ({ ...prev, company: e.target.value }))}
              className="input-modern"
              placeholder="Название компании"
            />
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <Briefcase className="h-4 w-4 inline mr-2" />
              Должность
            </label>
            <input
              type="text"
              value={profileData.position}
              onChange={(e) => setProfileData(prev => ({ ...prev, position: e.target.value }))}
              className="input-modern"
              placeholder="Ваша должность"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4 inline mr-2" />
            О себе
          </label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
            rows={4}
            className="input-modern resize-none"
            placeholder="Расскажите о себе..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={handleSaveProfile}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 btn-pill-solid disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить изменения
          </button>
          <button
            onClick={handleCancel}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 btn-pill-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="h-4 w-4" />
            Отмена
          </button>
        </div>

        {/* Last Updated */}
        <div className="mt-6 pt-6 border-t border-[var(--border-primary)]">
          <p className="text-sm text-[var(--text-muted)]">
            Последнее обновление: {new Date().toLocaleString('ru-RU', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="theme-card rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Безопасность</h2>
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showPasswordChange ? 'Скрыть' : 'Изменить пароль'}
          </button>
        </div>

        {showPasswordChange && (
          <div className="space-y-4 pt-4 border-t border-[var(--border-primary)]">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                <Lock className="h-4 w-4 inline mr-2" />
                Текущий пароль
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className={`input-modern ${errors.currentPassword ? '!border-red-500' : ''}`}
                placeholder="Введите текущий пароль"
              />
              {errors.currentPassword && <p className="text-red-500 text-sm mt-1">{errors.currentPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Lock className="h-4 w-4 inline mr-2" />
                Новый пароль
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className={`input-modern ${errors.newPassword ? '!border-red-500' : ''}`}
                placeholder="Введите новый пароль"
              />
              {errors.newPassword && <p className="text-red-500 text-sm mt-1">{errors.newPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Lock className="h-4 w-4 inline mr-2" />
                Подтвердите новый пароль
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className={`input-modern ${errors.confirmPassword ? '!border-red-500' : ''}`}
                placeholder="Подтвердите новый пароль"
              />
              {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
            </div>

            <button
              onClick={handleChangePassword}
              disabled={saving}
              className="flex items-center gap-2 btn-pill-solid disabled:opacity-50"
            >
              {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Изменить пароль
            </button>
          </div>
        )}
      </div>

      {/* Delete Account Section */}
      <div className="theme-card rounded-xl shadow-md p-6 border-2 border-red-200/50">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Опасная зона</h2>
        <p className="text-[var(--text-muted)] mb-4">Удаление аккаунта необратимо. Все ваши данные будут удалены.</p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 btn-pill-outline"
        >
          <Trash2 className="h-4 w-4" />
          Удалить аккаунт
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in-down">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-xl font-bold">Подтвердите удаление</h3>
            </div>
            <p className="text-[var(--text-muted)] mb-6">
              Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить, и все ваши данные будут безвозвратно удалены.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  // Handle account deletion
                  setShowDeleteConfirm(false);
                  showNotification('error', 'Функция удаления аккаунта временно недоступна');
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

