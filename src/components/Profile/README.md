# Profile Page Feature

## Overview
A complete, modern profile management system that allows users to view and edit their personal information, upload profile photos, change passwords, and manage their account settings.

## Features Implemented

### ✅ User Interface
- **Modern, sleek design** with clean layout and professional appearance
- **Responsive design** that works on all devices
- **Smooth animations** and transitions for better UX
- **Real-time validation** with user-friendly error messages
- **Loading states** during data fetch and save operations
- **Success/error notifications** for user feedback

### ✅ Profile Photo Management
- Upload new profile photo with file picker
- Photo preview before saving
- Delete/remove existing photo
- Automatic circular avatar with user initials fallback
- File size validation (max 20MB)
- File type validation (images only)
- Photos stored in `/uploads/profiles/` directory

### ✅ Editable User Information
All fields support real-time editing with validation:
- **First Name** (required, min 2 characters)
- **Last Name** (required, min 2 characters)
- **Email** (required, valid email format)
- **Phone** (optional, phone format validation)
- **Company** (optional, max 100 characters)
- **Position** (optional, max 100 characters)
- **Bio/Description** (optional, max 500 characters, textarea)

### ✅ Security Features
- **Password change section** with collapsible UI
- Requires current password verification
- New password validation (min 6 characters)
- Password confirmation matching
- Secure password hashing on backend

### ✅ Additional Features
- **Last updated timestamp** display
- **Save/Cancel buttons** for profile changes
- **Delete account section** with confirmation modal
- **Account activity tracking** (last login)
- **Change detection** - buttons only enabled when data changes

## Backend Implementation

### Database Schema (User Model)
Extended user schema with new fields:
```javascript
{
  firstName: String (required),
  lastName: String (required),
  email: String (required, unique),
  phone: String (optional),
  company: String (optional, max 100 chars),
  position: String (optional, max 100 chars),
  bio: String (optional, max 500 chars),
  profilePhotoUrl: String,
  password: String (hashed),
  role: String (enum: admin/customer),
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### API Endpoints

#### GET `/api/auth/me`
Get current user profile data
- **Auth**: Required (JWT token)
- **Returns**: Complete user profile including all fields

#### PUT `/api/auth/profile`
Update user profile information
- **Auth**: Required
- **Body**: `{ firstName?, lastName?, email?, phone?, company?, position?, bio? }`
- **Validation**: Email uniqueness check, field length validation
- **Returns**: Updated user object

#### PUT `/api/auth/password`
Change user password
- **Auth**: Required
- **Body**: `{ currentPassword, newPassword }`
- **Validation**: Current password verification, new password strength
- **Returns**: Success message

#### POST `/api/auth/profile/photo`
Upload profile photo
- **Auth**: Required
- **Body**: FormData with `profilePhoto` file
- **Validation**: File type (images only), file size (max 20MB)
- **Storage**: Local filesystem at `/uploads/profiles/`
- **Returns**: New photo URL

#### DELETE `/api/auth/profile/photo`
Delete profile photo
- **Auth**: Required
- **Action**: Removes photo file and clears URL from database
- **Returns**: Success message

## File Structure

```
src/components/Profile/
├── ProfilePage.tsx        # Main profile page component
└── README.md             # This documentation

models/
└── User.js               # Extended user schema

routes/
└── auth.js               # Updated with new profile endpoints

uploads/profiles/         # Profile photos storage (auto-created)
```

## Usage

### Accessing the Profile Page
1. Click on the user avatar in the top-right corner
2. Select "Показать профиль" (Show Profile) from dropdown menu
3. Or navigate directly to `/profile` route

### Editing Profile
1. Navigate to profile page
2. Edit any fields you want to update
3. Click "Сохранить изменения" (Save Changes) button
4. Receive success notification

### Uploading Photo
1. Click "Выбрать фото" (Choose Photo) button
2. Select an image file (max 20MB)
3. Preview the photo
4. Click "Сохранить фото" (Save Photo) to upload
5. Photo is immediately displayed

### Changing Password
1. Click "Изменить пароль" (Change Password) to expand section
2. Enter current password
3. Enter new password (min 6 characters)
4. Confirm new password
5. Click "Изменить пароль" (Change Password) button

## Technical Details

### State Management
- Local state with React hooks (`useState`, `useEffect`)
- Separate state for profile data, password data, and UI states
- Original data tracking for change detection
- Error state management for field-level validation

### Form Validation
- **Client-side**: Real-time validation with visual feedback
- **Server-side**: Additional validation with detailed error messages
- **Email**: Format and uniqueness validation
- **Phone**: Format validation with regex
- **Password**: Length and matching validation

### File Upload
- Uses multer middleware for handling multipart/form-data
- Automatic unique filename generation
- Old photo cleanup on new upload
- Error handling with automatic file cleanup

### Notifications
- Auto-dismiss after 5 seconds
- Smooth fade-in animation
- Color-coded (green for success, red for error)
- Icon-based visual feedback

### Responsive Design
- Mobile-first approach
- Flexbox and grid layouts
- Adaptive font sizes and spacing
- Touch-friendly button sizes

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only edit their own profile
3. **Password Hashing**: BCrypt with salt rounds
4. **File Validation**: Type and size checks on both client and server
5. **Email Uniqueness**: Prevents duplicate accounts
6. **XSS Protection**: Input sanitization and validation
7. **CSRF Protection**: Token-based authentication

## Future Enhancements

Potential improvements for future versions:
- [ ] Two-factor authentication (2FA)
- [ ] Social media account linking
- [ ] Profile visibility settings
- [ ] Activity log/audit trail
- [ ] Profile photo cropping tool
- [ ] Multiple profile photos
- [ ] Theme preferences persistence
- [ ] Language selection functionality
- [ ] Export profile data
- [ ] Account deletion with grace period

## Dependencies

### Frontend
- React 18+
- React Router DOM
- Lucide React (icons)
- TypeScript

### Backend
- Express.js
- MongoDB + Mongoose
- Multer (file uploads)
- BCrypt (password hashing)
- JSON Web Token (JWT)
- Express Validator

## Environment Variables

Required in `.env` file:
```
MONGODB_URI=mongodb://localhost:27017/yourdb
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d
NODE_ENV=development
VITE_API_URL=http://localhost:5000/api
```

## Testing

To test the profile page:
1. Start the backend server: `npm run server`
2. Start the frontend: `npm run dev`
3. Login to the application
4. Navigate to profile page
5. Test all features:
   - Edit profile information
   - Upload profile photo
   - Delete profile photo
   - Change password
   - Cancel changes
   - Try validation errors

## Troubleshooting

### Photo upload fails
- Check upload directory permissions
- Verify file size is under 20MB
- Ensure file is a valid image format
- Check server logs for detailed error

### Profile updates not saving
- Verify JWT token is valid
- Check network tab for API errors
- Ensure all required fields are filled
- Check validation error messages

### Password change fails
- Verify current password is correct
- Ensure new password meets requirements
- Check server logs for authentication errors

## Support

For issues or questions:
1. Check this documentation
2. Review console and network logs
3. Check backend server logs
4. Verify database connection
5. Contact development team

---

**Last Updated**: October 18, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅

