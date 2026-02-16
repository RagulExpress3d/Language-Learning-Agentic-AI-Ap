/**
 * Sync, in-memory quiz validation and fix. No extra API calls.
 */

export interface QuizItem {
  type: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface LessonDataWithQuizzes {
  title: string;
  slides: unknown[];
  quizzes: QuizItem[];
}

function norm(s: string): string {
  return String(s).trim().toLowerCase();
}

/** Read-only: count how many quizzes have correctAnswer in options and min 2 options. */
export function getQuizValidationSummary(quizzes: QuizItem[]): { validCount: number; totalCount: number } {
  if (!Array.isArray(quizzes)) return { validCount: 0, totalCount: 0 };
  let validCount = 0;
  for (const quiz of quizzes) {
    if (!quiz || typeof quiz !== 'object') continue;
    const question = String(quiz.question ?? '').trim();
    const correctAnswer = String(quiz.correctAnswer ?? '').trim();
    const options = Array.isArray(quiz.options) ? quiz.options.map((o: string) => String(o).trim()) : [];
    if (!question || !correctAnswer) continue;
    const correctNorm = norm(correctAnswer);
    const hasCorrect = options.some((o) => norm(o) === correctNorm);
    if (hasCorrect && options.length >= 2) validCount++;
  }
  return { validCount, totalCount: quizzes.length };
}

/**
 * Ensures correctAnswer is in options (case-insensitive); if not, adds it.
 * Ensures each quiz has at least 2 options and non-empty question and correctAnswer.
 * Mutates lessonData.quizzes in place.
 */
export function validateAndFixQuizzes(lessonData: LessonDataWithQuizzes): void {
  if (!lessonData.quizzes || !Array.isArray(lessonData.quizzes)) return;

  for (const quiz of lessonData.quizzes) {
    if (!quiz || typeof quiz !== 'object') continue;

    const question = String(quiz.question ?? '').trim();
    const correctAnswer = String(quiz.correctAnswer ?? '').trim();
    let options = Array.isArray(quiz.options) ? quiz.options.map((o: string) => String(o).trim()) : [];

    if (!question || !correctAnswer) continue;

    const correctNorm = norm(correctAnswer);
    const optionsNorm = new Set(options.map((o) => norm(o)));
    if (!optionsNorm.has(correctNorm)) {
      options.push(correctAnswer);
      quiz.options = options;
    }

    if (options.length < 2) {
      while (options.length < 2) {
        options.push(options.length === 0 ? correctAnswer : '');
      }
      quiz.options = options;
    }

    quiz.question = question;
    quiz.correctAnswer = correctAnswer;
  }
}
