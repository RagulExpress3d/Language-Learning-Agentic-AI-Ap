import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Lesson } from '../models/Lesson.js';
import { LessonTemplate } from '../models/LessonTemplate.js';
import { User } from '../models/User.js';
import { generateLesson, generateSlideImage } from '../services/geminiService.js';
import { Analytics } from '../models/Analytics.js';
import { updateStreakAndLastActive } from '../utils/streak.js';
import { z } from 'zod';

const router = express.Router();

const createLessonSchema = z.object({
  language: z.string(),
  theme: z.string(),
  goal: z.string().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional()
});

// Generate new lesson
router.post('/generate', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { language, theme, goal, level } = createLessonSchema.parse(req.body);
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's language preferences for personalization
    const langData = user.languages.find(l => l.language === language);
    const userLevel = level || langData?.level || 'beginner';
    const userGoal = goal || 'Quick Practice';
    
    // Adjust difficulty based on user's performance
    let adjustedLevel = userLevel;
    if (langData?.difficultyAdjustment) {
      if (langData.difficultyAdjustment > 0.3 && userLevel === 'beginner') {
        adjustedLevel = 'intermediate';
      } else if (langData.difficultyAdjustment < -0.3 && userLevel === 'intermediate') {
        adjustedLevel = 'beginner';
      }
    }

    // Reuse for ALL users (signed-in and guest): same words + pictures from DB, no AI call.
    // Key: language + theme + level. LessonTemplate is global (no userId).
    const template = await LessonTemplate.findOne({ language, theme, level: adjustedLevel });
    let lesson;

    if (template) {
      // Prefer reusing this user's existing incomplete lesson for same language+theme+level (no duplicate docs)
      const existing = await Lesson.findOne({
        userId: user._id,
        language,
        theme,
        level: adjustedLevel,
        completed: false,
      }).sort({ createdAt: -1 });

      if (existing) {
        lesson = existing;
      } else {
        // Copy template to user's lesson (words + imageUrls from DB, no AI)
        lesson = new Lesson({
          userId: user._id,
          language: template.language,
          theme: template.theme,
          level: template.level,
          title: template.title,
          slides: template.slides,
          quizzes: template.quizzes,
        });
        await lesson.save();
      }
    } else {
      // First time anyone (guest or signed-in) requested this language+theme+level: generate once, store for reuse.
      const lessonData = await generateLesson(language, theme, userGoal, adjustedLevel);

      const slidesWithImages = await Promise.all(
        lessonData.slides.map(async (slide) => {
          const imageUrl = await generateSlideImage(slide.visualPrompt);
          return { ...slide, imageUrl };
        })
      );

      await LessonTemplate.create({
        language,
        theme,
        level: adjustedLevel,
        title: lessonData.title,
        slides: slidesWithImages,
        quizzes: lessonData.quizzes,
      });

      lesson = new Lesson({
        userId: user._id,
        language,
        theme,
        level: adjustedLevel,
        title: lessonData.title,
        slides: slidesWithImages,
        quizzes: lessonData.quizzes,
      });
      await lesson.save();
    }

    // Track analytics
    await Analytics.create({
      userId: user._id,
      eventType: 'lesson_started',
      metadata: { language, theme, level: adjustedLevel, lessonId: lesson._id.toString() }
    });

    return res.json({ lesson });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return next(error);
  }
});

// List all stored templates (words + images) — read-only, for inspecting saved content
router.get('/templates', async (_req, res) => {
  try {
    const templates = await LessonTemplate.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-slides.visualPrompt')
      .lean();
    return res.json({
      count: templates.length,
      templates: templates.map((t: any) => ({
        id: t._id,
        language: t.language,
        theme: t.theme,
        level: t.level,
        title: t.title,
        slideCount: t.slides?.length ?? 0,
        slides: t.slides?.map((s: any) => ({
          word: s.word,
          translation: s.translation,
          phonetic: s.phonetic,
          hasImage: !!s.imageUrl,
        })),
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get user's lessons
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { language, completed, limit = 20 } = req.query;
    const query: any = { userId: req.userId };
    
    if (language) query.language = language;
    if (completed !== undefined) query.completed = completed === 'true';

    const lessons = await Lesson.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('-slides.visualPrompt'); // Don't send image generation prompts

    return res.json({ lessons });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Get specific lesson
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      userId: req.userId
    }).select('-slides.visualPrompt');

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    return res.json({ lesson });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

// Complete lesson
router.patch('/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const { score, timeSpent } = req.body;
    const lesson = await Lesson.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    lesson.completed = true;
    lesson.completedAt = new Date();
    if (score !== undefined) lesson.score = score;
    if (timeSpent !== undefined) lesson.timeSpent = timeSpent;

    await lesson.save();

    const user = await User.findById(req.userId);
    if (user) {
      const xpGained = Math.floor((score || 0) / 10);
      user.xp += xpGained;

      const langData = user.languages.find(l => l.language === lesson.language);
      if (langData) {
        langData.xp += xpGained;
        langData.lessonsCompleted += 1;
        if (score !== undefined) {
          if (score >= 80) {
            langData.difficultyAdjustment = Math.min(1, (langData.difficultyAdjustment || 0) + 0.1);
          } else if (score < 60) {
            langData.difficultyAdjustment = Math.max(-1, (langData.difficultyAdjustment || 0) - 0.1);
          }
        }
      }
      updateStreakAndLastActive(user);
      await user.save();
    }

    // Track analytics
    await Analytics.create({
      userId: req.userId!,
      eventType: 'lesson_completed',
      metadata: {
        lessonId: lesson._id.toString(),
        language: lesson.language,
        score,
        timeSpent
      }
    });

    return res.json({ lesson });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

export default router;
