import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { updateStreakAndLastActive } from '../utils/streak.js';
import { z } from 'zod';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = new User({ email, password, name });
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        xp: user.xp,
        hearts: user.hearts,
        streak: user.streak
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    updateStreakAndLastActive(user);
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        xp: user.xp,
        hearts: user.hearts,
        streak: user.streak,
        languages: user.languages
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return next(error);
  }
});

/** Trial / guest login: no user creation. Uses a single shared trial user in DB. */
const TRIAL_USER_EMAIL = 'trial@lingoagent.local';

router.post('/trial', async (_req, res, next) => {
  try {
    let user = await User.findOne({ email: TRIAL_USER_EMAIL });
    if (!user) {
      user = new User({
        email: TRIAL_USER_EMAIL,
        password: crypto.randomBytes(32).toString('hex'),
        name: 'Guest',
        languages: [{ language: 'Spanish', level: 'beginner' }],
      });
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        xp: user.xp ?? 0,
        hearts: user.hearts ?? 5,
        streak: user.streak ?? 0,
        languages: user.languages?.length ? user.languages : [{ language: 'Spanish', level: 'beginner' }],
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      xp: req.user.xp,
      hearts: req.user.hearts,
      streak: req.user.streak,
      languages: req.user.languages
    }
  });
});

export default router;
