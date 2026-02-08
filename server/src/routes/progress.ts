import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Lesson } from '../models/Lesson.js';

const router = express.Router();

// Get user progress summary
router.get('/summary', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalLessons = await Lesson.countDocuments({ userId: req.userId, completed: true });
    const lessonsByLanguage = await Lesson.aggregate([
      { $match: { userId: user._id, completed: true } },
      { $group: { _id: '$language', count: { $sum: 1 } } }
    ]);

    return res.json({
      totalXP: user.xp,
      hearts: user.hearts,
      streak: user.streak,
      totalLessons,
      languages: user.languages,
      lessonsByLanguage: lessonsByLanguage.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Get learning streak info
router.get('/streak', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      currentStreak: user.streak,
      streakStart: user.currentStreakStart,
      lastActiveDate: user.lastActiveDate
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch streak info' });
  }
});

export default router;
