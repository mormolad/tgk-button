export type QuestionType = 'date' | 'multipleChoice';

export interface BaseQuestion {
  id: string;
  text: string;
  type: QuestionType;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multipleChoice';
  options: { value: string; label: string }[];
}

export interface DateQuestion extends BaseQuestion {
  type: 'date';
}

export type Question = MultipleChoiceQuestion | DateQuestion;

export interface SurveyDefinition {
  questions: Question[];
}
