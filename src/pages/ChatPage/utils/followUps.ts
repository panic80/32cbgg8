import type { FollowUpQuestion } from '@/types/chat';

export const mapFollowUpQuestions = (messageId: string, items: any[] = []): FollowUpQuestion[] =>
  items
    .filter(Boolean)
    .map((item, index) => {
      const question = typeof item === 'string' ? item : item.question;
      if (!question) return null;

      const baseId =
        (typeof item === 'string' ? undefined : item.id || item.reference || item.title) ??
        `${messageId}-fu-${index}`;

      return {
        id: baseId,
        question,
        category: item.category || 'general',
        icon: item.icon,
        confidence: item.confidence,
        groundingScore: item.groundingScore,
        sourceGrounding: item.sourceGrounding,
      } as FollowUpQuestion;
    })
    .filter(Boolean) as FollowUpQuestion[];

export const areFollowUpQuestionsEqual = (
  prevQuestions?: FollowUpQuestion[],
  nextQuestions?: FollowUpQuestion[],
) => {
  if (prevQuestions === nextQuestions) {
    return true;
  }
  if (!prevQuestions || !nextQuestions) {
    return !prevQuestions && !nextQuestions;
  }
  if (prevQuestions.length !== nextQuestions.length) {
    return false;
  }

  return prevQuestions.every((prevQuestion, index) => {
    const nextQuestion = nextQuestions[index];
    if (!nextQuestion) {
      return false;
    }
    return (
      prevQuestion.id === nextQuestion.id &&
      prevQuestion.question === nextQuestion.question &&
      prevQuestion.category === nextQuestion.category &&
      prevQuestion.icon === nextQuestion.icon &&
      prevQuestion.confidence === nextQuestion.confidence &&
      prevQuestion.groundingScore === nextQuestion.groundingScore &&
      prevQuestion.sourceGrounding === nextQuestion.sourceGrounding
    );
  });
};
