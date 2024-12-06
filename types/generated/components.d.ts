import type { Schema, Attribute } from '@strapi/strapi';

export interface SubtopicQnA extends Schema.Component {
  collectionName: 'components_subtopic_qn_as';
  info: {
    displayName: 'QnA';
    icon: 'quote';
    description: '';
  };
  attributes: {
    question: Attribute.String;
    answer: Attribute.Blocks;
    format: Attribute.Enumeration<['one_line', 'md_file']>;
  };
}

export interface SubtopicHeading extends Schema.Component {
  collectionName: 'components_subtopic_headings';
  info: {
    displayName: 'Heading';
    icon: 'bulletList';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    content: Attribute.Blocks;
    qna: Attribute.Component<'subtopic.qn-a', true>;
  };
}

export interface SubjectRefrenceBooks extends Schema.Component {
  collectionName: 'components_subject_refrence_books';
  info: {
    displayName: 'Refrence Books';
    icon: 'book';
  };
  attributes: {
    title: Attribute.String;
    author: Attribute.String;
    publication_year: Attribute.Integer;
  };
}

export interface QuestionBankParts extends Schema.Component {
  collectionName: 'components_question_bank_parts';
  info: {
    displayName: 'Parts';
    icon: 'feather';
    description: '';
  };
  attributes: {
    answer_type: Attribute.Enumeration<
      ['Single Correct', 'Integer', 'Small Text', 'Large Text']
    >;
    marks: Attribute.Integer;
    one_liner: Attribute.RichText;
    options: Attribute.RichText;
    correct_answer: Attribute.RichText;
    hints: Attribute.Component<'question-bank.hints', true>;
  };
}

export interface QuestionBankHints extends Schema.Component {
  collectionName: 'components_question_bank_hints';
  info: {
    displayName: 'hints';
    description: '';
  };
  attributes: {
    type: Attribute.Enumeration<['text', 'media']>;
    media: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
    content: Attribute.Text;
  };
}

export interface PlanGradePlan extends Schema.Component {
  collectionName: 'components_plan_grade_plans';
  info: {
    displayName: 'Grade Plan';
    icon: 'crown';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    price: Attribute.Decimal;
    currency: Attribute.Enumeration<['USD', 'INR']>;
    recorded_lectures: Attribute.Boolean & Attribute.DefaultTo<true>;
    live_lectures: Attribute.Boolean & Attribute.DefaultTo<false>;
    qna: Attribute.Boolean & Attribute.DefaultTo<true>;
  };
}

export interface LecturesLectureHeader extends Schema.Component {
  collectionName: 'components_lectures_lecture_headers';
  info: {
    displayName: 'Lecture Header';
    icon: 'attachment';
  };
  attributes: {
    label: Attribute.Enumeration<
      ['Content', 'Recordings', 'Live', 'QnA', 'Test', 'Doubt', 'Practice']
    >;
    show: Attribute.Boolean;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'subtopic.qn-a': SubtopicQnA;
      'subtopic.heading': SubtopicHeading;
      'subject.refrence-books': SubjectRefrenceBooks;
      'question-bank.parts': QuestionBankParts;
      'question-bank.hints': QuestionBankHints;
      'plan.grade-plan': PlanGradePlan;
      'lectures.lecture-header': LecturesLectureHeader;
    }
  }
}
