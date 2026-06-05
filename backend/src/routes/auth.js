const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

const router = express.Router();

// Helper to generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, username: user.username },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// SIGN UP Endpoint
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 1. Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please provide username, email, and password.' });
    }

    // 2. Check password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // 3. Check if user already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // 4. Create and save new user (password auto-hashed on save)
    const newUser = new User({
      username: username.trim(),
      email: email.trim(),
      password
    });
    await newUser.save();

    // 5. Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: error.message });
  }
});

// LOGIN Endpoint
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Please provide username/email and password.' });
    }

    const searchKey = usernameOrEmail.toLowerCase().trim();
    
    // Find by username or email
    const user = await User.findOne({
      $or: [
        { username: searchKey },
        { email: searchKey }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Compare Password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

// requireAuth middleware
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User no longer exists' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authorization middleware error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = {
  router,
  requireAuth
};
