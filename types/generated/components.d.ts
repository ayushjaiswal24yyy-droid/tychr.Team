import type { Schema, Attribute } from '@strapi/strapi';

export interface UserStudentPlan extends Schema.Component {
  collectionName: 'components_user_student_plans';
  info: {
    displayName: 'student_plan';
  };
  attributes: {
    course_plan: Attribute.Relation<
      'user.student-plan',
      'oneToOne',
      'api::course-plan.course-plan'
    >;
    grade_subject: Attribute.Relation<
      'user.student-plan',
      'oneToOne',
      'api::grade-subject.grade-subject'
    >;
  };
}

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

export interface RecordedLecturesProgress extends Schema.Component {
  collectionName: 'components_recorded_lectures_progresses';
  info: {
    displayName: 'progress';
  };
  attributes: {
    student: Attribute.Relation<
      'recorded-lectures.progress',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    progress_time: Attribute.Decimal;
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

export interface QuestionBankQuestionNAnswer extends Schema.Component {
  collectionName: 'components_question_bank_question_n_answers';
  info: {
    displayName: 'question_n_answer';
    description: '';
  };
  attributes: {
    question: Attribute.Relation<
      'question-bank.question-n-answer',
      'oneToOne',
      'api::question-bank.question-bank'
    >;
    answer: Attribute.JSON;
    question_n_answer: Attribute.RichText;
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
  };
  attributes: {
    hint: Attribute.RichText;
  };
}

export interface NotificationHistory extends Schema.Component {
  collectionName: 'components_notification_histories';
  info: {
    displayName: 'history';
    description: '';
  };
  attributes: {
    history: Attribute.Text;
    time_stamp: Attribute.Date;
  };
}

export interface NotificationDemoBookingTime extends Schema.Component {
  collectionName: 'components_notification_demo_booking_times';
  info: {
    displayName: 'demo_booking_time';
    description: '';
  };
  attributes: {
    schedule_time: Attribute.DateTime;
  };
}

export interface MentorMentorQuestions extends Schema.Component {
  collectionName: 'components_mentor_mentor_questions';
  info: {
    displayName: 'Mentor Questions';
  };
  attributes: {
    question: Attribute.Text;
    answer: Attribute.Text;
  };
}

export interface ClassroomNotices extends Schema.Component {
  collectionName: 'components_classroom_notices';
  info: {
    displayName: 'notices';
  };
  attributes: {
    notices: Attribute.RichText;
  };
}

export interface ClassroomDays extends Schema.Component {
  collectionName: 'components_classroom_days';
  info: {
    displayName: 'days';
  };
  attributes: {
    days: Attribute.Enumeration<
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    >;
    startTime: Attribute.Time;
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
      'user.student-plan': UserStudentPlan;
      'subtopic.qn-a': SubtopicQnA;
      'subtopic.heading': SubtopicHeading;
      'subject.refrence-books': SubjectRefrenceBooks;
      'recorded-lectures.progress': RecordedLecturesProgress;
      'plan.grade-plan': PlanGradePlan;
      'question-bank.question-n-answer': QuestionBankQuestionNAnswer;
      'question-bank.parts': QuestionBankParts;
      'question-bank.hints': QuestionBankHints;
      'notification.history': NotificationHistory;
      'notification.demo-booking-time': NotificationDemoBookingTime;
      'mentor.mentor-questions': MentorMentorQuestions;
      'classroom.notices': ClassroomNotices;
      'classroom.days': ClassroomDays;
      'lectures.lecture-header': LecturesLectureHeader;
    }
  }
}
