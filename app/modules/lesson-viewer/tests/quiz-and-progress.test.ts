import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { LessonProgressStatus, QuestionType } from "~/db/schema";

const testDb = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("~/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { computeResult, getBestAttempt, getQuizWithQuestions } = await import(
  "../quiz.server"
);
const { getLessonProgress, markLessonComplete, markLessonInProgress } =
  await import("../progress.server");

const NOW = new Date("2026-11-22T12:00:00.000Z");

let db: TestDb;
let userId: number;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  testDb.current = db;
  const base = seedBaseData(db);
  userId = base.user.id;
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Primitive Types", position: 1 })
    .returning()
    .get().id;
});

// ─── Fixtures ───
// The module only reads quizzes; nothing in the app writes them outside the
// seed, so the quiz goes in directly.

function addQuiz(
  questions: Array<{ type: QuestionType; options: boolean[] }>
): { quizId: number; questions: Array<{ id: number; optionIds: number[] }> } {
  const quizId = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get().id;
  return {
    quizId,
    questions: questions.map((question, position) => {
      const id = db
        .insert(schema.quizQuestions)
        .values({
          quizId,
          questionText: `Question ${position}`,
          questionType: question.type,
          position,
        })
        .returning()
        .get().id;
      const optionIds = question.options.map(
        (isCorrect, index) =>
          db
            .insert(schema.quizOptions)
            .values({
              questionId: id,
              optionText: `Option ${index}`,
              isCorrect,
            })
            .returning()
            .get().id
      );
      return { id, optionIds };
    }),
  };
}

describe("computeResult", () => {
  it("grades each answer against the correct option and records the attempt", () => {
    const quiz = addQuiz([
      { type: QuestionType.MultipleChoice, options: [false, true, false] },
      { type: QuestionType.TrueFalse, options: [true, false] },
    ]);
    const [first, second] = quiz.questions;

    const result = computeResult(userId, quiz.quizId, {
      [first.id]: first.optionIds[1],
      [second.id]: second.optionIds[1],
    });

    expect(result).toMatchObject({
      score: 0.5,
      passed: false,
      grade: "F",
      totalCorrect: 1,
      totalQuestions: 2,
      questionResults: [
        {
          questionId: first.id,
          correct: true,
          selectedOptionId: first.optionIds[1],
          correctOptionId: first.optionIds[1],
        },
        {
          questionId: second.id,
          correct: false,
          selectedOptionId: second.optionIds[1],
          correctOptionId: second.optionIds[0],
        },
      ],
    });
    expect(getBestAttempt(userId, quiz.quizId)).toMatchObject({
      id: result?.attemptId,
      score: 0.5,
      passed: false,
    });
    expect(db.select().from(schema.quizAnswers).all()).toHaveLength(2);
  });

  it("passes a fully correct attempt with an A", () => {
    const quiz = addQuiz([
      { type: QuestionType.MultipleChoice, options: [true, false] },
    ]);
    const [only] = quiz.questions;

    const result = computeResult(userId, quiz.quizId, {
      [only.id]: only.optionIds[0],
    });

    expect(result).toMatchObject({ score: 1, passed: true, grade: "A" });
  });

  it("counts an unanswered question as wrong and stores no answer for it", () => {
    const quiz = addQuiz([
      { type: QuestionType.MultipleChoice, options: [true, false] },
      { type: QuestionType.MultipleChoice, options: [true, false] },
    ]);
    const [answered, skipped] = quiz.questions;

    const result = computeResult(userId, quiz.quizId, {
      [answered.id]: answered.optionIds[0],
    });

    expect(result?.questionResults[1]).toEqual({
      questionId: skipped.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    });
    expect(db.select().from(schema.quizAnswers).all()).toEqual([
      expect.objectContaining({
        questionId: answered.id,
        selectedOptionId: answered.optionIds[0],
      }),
    ]);
  });

  it("returns null for a quiz that does not exist", () => {
    expect(computeResult(userId, 9999, {})).toBeNull();
  });
});

describe("getQuizWithQuestions", () => {
  it("returns the questions in position order, each with only its own options", () => {
    const quiz = addQuiz([
      { type: QuestionType.MultipleChoice, options: [true, false, false] },
      { type: QuestionType.TrueFalse, options: [false, true] },
    ]);

    const loaded = getQuizWithQuestions(quiz.quizId);

    expect(
      loaded?.questions.map((question) => ({
        id: question.id,
        optionIds: question.options.map((option) => option.id),
      }))
    ).toEqual(quiz.questions);
  });

  it("returns null for a quiz that does not exist", () => {
    expect(getQuizWithQuestions(9999)).toBeNull();
  });
});

describe("getBestAttempt", () => {
  it("returns the highest-scoring attempt, not the latest", () => {
    const quiz = addQuiz([
      { type: QuestionType.MultipleChoice, options: [true, false] },
    ]);
    const [only] = quiz.questions;

    computeResult(userId, quiz.quizId, { [only.id]: only.optionIds[0] });
    computeResult(userId, quiz.quizId, { [only.id]: only.optionIds[1] });

    expect(getBestAttempt(userId, quiz.quizId)?.score).toBe(1);
  });
});

describe("lesson progress", () => {
  it("marks a lesson complete at the given time", () => {
    markLessonComplete(userId, lessonId, NOW);

    expect(getLessonProgress(userId, lessonId)).toMatchObject({
      status: LessonProgressStatus.Completed,
      completedAt: NOW.toISOString(),
    });
  });

  it("completes a lesson that was already in progress", () => {
    markLessonInProgress(userId, lessonId);
    markLessonComplete(userId, lessonId, NOW);

    expect(getLessonProgress(userId, lessonId)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });

  it("does not move a completed lesson back to in progress", () => {
    markLessonComplete(userId, lessonId, NOW);
    markLessonInProgress(userId, lessonId);

    expect(getLessonProgress(userId, lessonId)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });
});
