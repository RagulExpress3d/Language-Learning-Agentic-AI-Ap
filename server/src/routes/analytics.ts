import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Analytics } from '../models/Analytics.js';
import { z } from 'zod';

const router = express.Router();

const trackEventSchema = z.object({
  eventType: z.enum(['lesson_started', 'lesson_completed', 'quiz_answered', 'voice_practice', 'slide_viewed',
    'image_blocked', 'tts_failed', 'tts_latency_ms', 'quiz_validation_failed']),
  metadata: z.record(z.any()).optional()
});

// Track analytics event
router.post('/track', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { eventType, metadata } = trackEventSchema.parse(req.body);
    
    const analytics = new Analytics({
      userId: req.userId,
      eventType,
      metadata: metadata || {}
    });
    await analytics.save();

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return next(error);
  }
});

// Get user analytics
router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const events = await Analytics.find({
      userId: req.userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 });

    // Aggregate stats
    const stats = {
      totalLessons: events.filter(e => e.eventType === 'lesson_started').length,
      completedLessons: events.filter(e => e.eventType === 'lesson_completed').length,
      quizAnswers: events.filter(e => e.eventType === 'quiz_answered').length,
      voicePractices: events.filter(e => e.eventType === 'voice_practice').length,
      correctAnswers: events.filter(e =>
        e.eventType === 'quiz_answered' && e.metadata?.correct === true
      ).length,
      imageBlocked: events.filter(e => e.eventType === 'image_blocked').length,
      ttsFailed: events.filter(e => e.eventType === 'tts_failed').length,
      quizValidationFailed: events.filter(e => e.eventType === 'quiz_validation_failed').length,
      averageScore: 0,
      timeSpent: 0
    };

    const completedLessons = events.filter(e => e.eventType === 'lesson_completed');
    if (completedLessons.length > 0) {
      const scores = completedLessons
        .map(e => e.metadata?.score)
        .filter((s): s is number => typeof s === 'number');
      stats.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      const times = completedLessons
        .map(e => e.metadata?.timeSpent)
        .filter((t): t is number => typeof t === 'number');
      stats.timeSpent = times.reduce((a, b) => a + b, 0);
    }

    return res.json({ events, stats });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
