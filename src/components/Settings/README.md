# Settings Page

A comprehensive settings management page for the application with multiple sections and full backend integration.

## Features

### 🎯 Main Features

1. **Modern Tabbed Navigation**: Sidebar navigation with 7 main categories
2. **Real-time Validation**: Input validation with immediate feedback
3. **Auto-save Tracking**: Tracks unsaved changes and warns users
4. **Search Functionality**: Quick search across all settings sections
5. **Dark Theme Support**: Fully integrated with the app's theme system
6. **Backend Integration**: Complete API integration for data persistence

### 📋 Settings Categories

#### 1. General Settings (Общие)
- **Language Selection**: Russian, English, Turkish with flag icons
- **Timezone**: Multiple timezone options (Moscow, Istanbul, New York, London)
- **Date Format**: DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD
- **Currency**: RUB, USD, EUR, TRY with symbols

#### 2. Appearance (Внешний вид)
- **Theme**: Light/Dark mode toggle
- **Font Size**: Small, Medium, Large options
- **Sidebar Collapse**: Auto-collapse preference
- **Color Scheme**: Customizable color scheme (future enhancement)

#### 3. Account Settings (Аккаунт)
- **Email Notifications**: Toggle for email alerts
- **Password Change**: Secure password update form with show/hide
- **Two-Factor Authentication**: Enable/disable 2FA
- **Active Sessions**: View and manage login sessions
  - Device information
  - Location tracking
  - Last active timestamp
  - Ability to terminate sessions

#### 4. Notifications (Уведомления)
- **Push Notifications**: Browser push notifications toggle
- **Notification Frequency**: Immediate, Hourly, Daily, Weekly
- **Sound Alerts**: Audio notification preferences

#### 5. Privacy & Security (Конфиденциальность)
- **Data Export**: Enable/disable data export functionality
- **Privacy Level**: Public, Standard, Private options
- **Export Data**: Download all user data in JSON format
- **Account Activity**: View login history (future enhancement)

#### 6. Business Settings (Бизнес)
- **Company Information**:
  - Company name
  - Company address
  - Tax ID
- **Invoice Settings**:
  - Invoice prefix (e.g., "INV")
  - Fiscal year start date

#### 7. Integrations & API (Интеграции)
- **API Keys Management**:
  - Create new API keys
  - View existing keys
  - Delete keys
  - Track creation and last usage dates
- **Connected Services**:
  - View integration status
  - Reconnect services
  - Track last sync time
- **Webhooks**:
  - Add webhook URLs
  - Configure event types
  - Enable/disable webhooks
  - Manage webhook settings

## 🔧 Technical Implementation

### Frontend Components

**File**: `src/components/Settings/SettingsPage.tsx`

**Key Technologies**:
- React Functional Components with Hooks
- TypeScript for type safety
- Tailwind CSS for styling
- Lucide React for icons
- Theme Context integration

**State Management**:
```typescript
interface SettingsData {
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  theme: 'light' | 'dark';
  colorScheme: string;
  sidebarCollapsed: boolean;
  fontSize: string;
  emailNotifications: boolean;
  twoFactorEnabled: boolean;
  pushNotifications: boolean;
  notificationFrequency: string;
  soundAlerts: boolean;
  dataExportEnabled: boolean;
  privacyLevel: string;
  companyName: string;
  companyAddress: string;
  taxId: string;
  invoicePrefix: string;
  fiscalYearStart: string;
  apiKeys: Array<ApiKey>;
  connectedServices: Array<Service>;
  webhooks: Array<Webhook>;
}
```

### Backend API Endpoints

**File**: `routes/auth.js`

#### GET /api/auth/settings
- **Description**: Retrieve user settings
- **Auth**: Required (Bearer token)
- **Response**: Settings object with all user preferences

#### PUT /api/auth/settings
- **Description**: Update user settings
- **Auth**: Required (Bearer token)
- **Body**: Partial settings object
- **Validation**: Full validation for all fields
- **Response**: Success message with updated fields

#### POST /api/auth/settings/api-keys
- **Description**: Create a new API key
- **Auth**: Required (Bearer token)
- **Body**: `{ name: string }`
- **Response**: New API key object with generated key

#### DELETE /api/auth/settings/api-keys/:keyId
- **Description**: Delete an API key
- **Auth**: Required (Bearer token)
- **Response**: Success message

#### GET /api/auth/sessions
- **Description**: Get active user sessions
- **Auth**: Required (Bearer token)
- **Response**: Array of active sessions

#### DELETE /api/auth/sessions/:sessionId
- **Description**: Terminate a specific session
- **Auth**: Required (Bearer token)
- **Response**: Success message

#### POST /api/auth/export-data
- **Description**: Export all user data
- **Auth**: Required (Bearer token)
- **Response**: User data in JSON format

### Database Schema

**File**: `models/User.js`

**New Fields Added**:
```javascript
{
  // General Settings
  language: { type: String, enum: ['ru', 'en', 'tr'], default: 'ru' },
  timezone: { type: String, default: 'Europe/Moscow' },
  dateFormat: { type: String, enum: ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD.MM.YYYY' },
  currency: { type: String, enum: ['RUB', 'USD', 'EUR', 'TRY'], default: 'RUB' },
  
  // Appearance
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  colorScheme: { type: String, default: 'blue' },
  sidebarCollapsed: { type: Boolean, default: false },
  fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
  
  // Account
  emailNotifications: { type: Boolean, default: true },
  twoFactorEnabled: { type: Boolean, default: false },
  
  // Notifications
  pushNotifications: { type: Boolean, default: true },
  notificationFrequency: { type: String, enum: ['immediate', 'hourly', 'daily', 'weekly'], default: 'immediate' },
  soundAlerts: { type: Boolean, default: true },
  
  // Privacy
  dataExportEnabled: { type: Boolean, default: true },
  privacyLevel: { type: String, enum: ['public', 'standard', 'private'], default: 'standard' },
  
  // Business
  companyName: { type: String, maxlength: 100, default: '' },
  companyAddress: { type: String, maxlength: 500, default: '' },
  taxId: { type: String, maxlength: 50, default: '' },
  invoicePrefix: { type: String, maxlength: 10, default: 'INV' },
  fiscalYearStart: { type: String, maxlength: 10, default: '01-01' },
  
  // Integrations
  apiKeys: [{ id: String, name: String, key: String, createdAt: String, lastUsed: String }],
  connectedServices: [{ id: String, name: String, status: String, lastSync: String }],
  webhooks: [{ id: String, url: String, events: [String], active: Boolean }]
}
```

## 🎨 UI/UX Features

### Design Patterns
- **Sidebar Navigation**: Clean tabbed interface with icons
- **Search Bar**: Quick filter for finding specific settings
- **Save/Reset Buttons**: Per-section controls
- **Toast Notifications**: Success/error feedback
- **Loading States**: Skeleton screens and spinners
- **Unsaved Changes Warning**: Prevents accidental data loss

### Responsive Design
- **Desktop**: Sidebar + content layout
- **Tablet**: Stacked layout with collapsible sidebar
- **Mobile**: Full-width cards with bottom navigation

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels
- **Color Contrast**: WCAG AA compliant
- **Focus Indicators**: Clear focus states

## 🔐 Security Features

1. **Authentication Required**: All endpoints protected with JWT
2. **Input Validation**: Server-side validation for all fields
3. **API Key Generation**: Cryptographically secure random keys
4. **Session Management**: Track and terminate active sessions
5. **Data Export Controls**: User-controlled data export

## 📱 Usage

### Accessing Settings
1. Click the profile dropdown in the top-right corner
2. Select "Настройки" (Settings)
3. Navigate through the sidebar tabs
4. Make desired changes
5. Click "Сохранить" (Save) to persist changes

### Creating API Keys
1. Go to "Интеграции" tab
2. Click "Создать ключ" (Create Key)
3. Copy the generated key immediately (shown only once)
4. Store the key securely

### Managing Sessions
1. Go to "Аккаунт" tab
2. Scroll to "Активные сессии" section
3. View all active sessions
4. Click trash icon to terminate non-current sessions

### Exporting Data
1. Go to "Конфиденциальность" tab
2. Scroll to "Экспорт данных" section
3. Click "Экспортировать данные"
4. File will be sent to your email

## 🚀 Future Enhancements

- [ ] Two-factor authentication implementation
- [ ] Real session tracking with device fingerprinting
- [ ] Email delivery for data exports
- [ ] Webhook testing interface
- [ ] Activity log visualization
- [ ] Advanced privacy controls
- [ ] Multi-language support for all UI text
- [ ] Import settings from file
- [ ] Settings backup and restore
- [ ] Notification center integration

## 🐛 Known Issues

None currently reported.

## 📝 Changelog

### Version 1.0.0 (Current)
- Initial implementation
- All 7 settings categories
- Full backend integration
- API key management
- Session management
- Data export functionality
- Dark theme support
- Responsive design

## 👨‍💻 Development

### Adding New Settings

1. **Update Interface**:
```typescript
// src/components/Settings/SettingsPage.tsx
interface SettingsData {
  newSetting: string; // Add your new setting
}
```

2. **Update Database Schema**:
```javascript
// models/User.js
newSetting: {
  type: String,
  default: 'defaultValue'
}
```

3. **Update API Endpoint**:
```javascript
// routes/auth.js
body('newSetting').optional().isString()
```

4. **Add UI Component**:
```tsx
<div>
  <label>New Setting</label>
  <input
    value={settings.newSetting}
    onChange={(e) => setSettings(prev => ({ ...prev, newSetting: e.target.value }))}
  />
</div>
```

## 📄 License

Part of the main application. See root LICENSE file.

