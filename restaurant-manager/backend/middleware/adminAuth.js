// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(401).json({ error: 'Token invalid' });
    if (!user.isActive) return res.status(401).json({ error: 'Account deactivated' });
    if (user.role !== 'super_admin') return res.status(403).json({ error: 'Admin access required' });

    req.user = {
      userId: user._id,
      role: user.role,
      data: user
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid' });
  }
};


module.exports = { adminAuth };