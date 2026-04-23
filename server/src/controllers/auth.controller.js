import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/supabase.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const { data: existingUser } = await db.users.findByEmail(email);
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const { data: user, error } = await db.users.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword
  });

  if (error) {
    console.error('User creation error:', error);
    throw new ApiError(500, 'Failed to create user');
  }

  // Generate token
  const token = generateToken(user.id);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url
      },
      token
    }
  });
});

// Login user
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const { data: user, error } = await db.users.findByEmail(email);
  
  if (error || !user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Generate token
  const token = generateToken(user.id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url
      },
      token
    }
  });
});

// Logout user (client-side token removal)
export const logout = asyncHandler(async (req, res) => {
  // Token is removed client-side, but we can do server-side cleanup if needed
  // For now, just acknowledge the logout
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

// Get current user
export const getCurrentUser = asyncHandler(async (req, res) => {
  const { data: user, error } = await db.users.findById(req.user.id);

  if (error || !user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      }
    }
  });
});

// Update user profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar_url } = req.body;
  const updates = {};

  if (name) updates.name = name.trim();
  if (avatar_url) updates.avatar_url = avatar_url;

  const { data: user, error } = await db.users.update(req.user.id, updates);

  if (error) {
    throw new ApiError(500, 'Failed to update profile');
  }

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url
      }
    }
  });
});

// Change password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const { data: user, error } = await db.users.findById(req.user.id);
  if (error || !user) {
    throw new ApiError(404, 'User not found');
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  // Hash new password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update password in database
  const { error: updateError } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', req.user.id);

  if (updateError) {
    throw new ApiError(500, 'Failed to update password');
  }

  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
});
