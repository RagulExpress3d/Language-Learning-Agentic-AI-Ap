import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { z } from 'zod';

const router = express.Router();

const updateLanguageSchema = z.object({
  language: z.string(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  preferredTheme: z.string().optional(),
  learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'mixed']).optional()
});

// Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update language preferences
router.patch('/language', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { language, level, preferredTheme, learningStyle } = updateLanguageSchema.parse(req.body);
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let langData = user.languages.find(l => l.language === language);
    if (!langData) {
      langData = {
        language,
        level: level || 'beginner',
        xp: 0,
        lessonsCompleted: 0,
        learningStyle: learningStyle || 'mixed',
        difficultyAdjustment: 0
      };
      user.languages.push(langData);
    } else {
      if (level) langData.level = level;
      if (preferredTheme) langData.preferredTheme = preferredTheme;
      if (learningStyle) langData.learningStyle = learningStyle;
    }

    await user.save();
    res.json({ languages: user.languages });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return next(error);
  }
});

// Update XP and hearts
router.patch('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const { xp, hearts, language } = req.body;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (xp !== undefined) {
      user.xp += xp;
      if (language) {
        const langData = user.languages.find(l => l.language === language);
        if (langData) {
          langData.xp += xp;
        }
      }
    }

    if (hearts !== undefined) {
      user.hearts = Math.max(0, Math.min(5, user.hearts + hearts));
    }

    await user.save();
    return res.json({ xp: user.xp, hearts: user.hearts });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update stats' });
  }
});

export default router;
