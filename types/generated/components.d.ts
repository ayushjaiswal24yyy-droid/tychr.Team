import type { Schema, Attribute } from '@strapi/strapi';

export interface UserUserExperience extends Schema.Component {
  collectionName: 'components_user_user_experiences';
  info: {
    displayName: 'userExperience';
    icon: 'bulletList';
  };
  attributes: {
    company_name: Attribute.String;
    company_type: Attribute.Enumeration<['private', 'government']>;
    position: Attribute.String;
    start_date: Attribute.Date;
    end_date: Attribute.Date;
    employment_type: Attribute.Enumeration<
      ['Full time', 'Part time', 'Contract', 'Internship', 'Freelance']
    >;
    description: Attribute.Text;
    responsibilities: Attribute.JSON;
  };
}

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

export interface UserExtraActivity extends Schema.Component {
  collectionName: 'components_user_extra_activities';
  info: {
    displayName: 'ExtraActivity';
  };
  attributes: {
    ActivityTitle: Attribute.String;
    Position: Attribute.String;
    org_name: Attribute.String;
    start_date: Attribute.Date;
    end_date: Attribute.Date;
    description: Attribute.Text;
  };
}

export interface TutorsWebsiteBestOnlineTutors extends Schema.Component {
  collectionName: 'components_tutors_website_best_online_tutors';
  info: {
    displayName: 'best_online_tutors';
    icon: 'code';
    description: '';
  };
  attributes: {
    title: Attribute.Text;
  };
}

export interface UniversityTutionFees extends Schema.Component {
  collectionName: 'components_university_tution_fees';
  info: {
    displayName: 'tution-fees';
  };
  attributes: {
    ug_int: Attribute.BigInteger;
    ug_uk: Attribute.Integer;
    grad_int: Attribute.Integer;
    grad_uk: Attribute.Integer;
  };
}

export interface UniversitySubjectRanking extends Schema.Component {
  collectionName: 'components_university_subject_rankings';
  info: {
    displayName: 'subject-ranking';
  };
  attributes: {
    arts: Attribute.Integer;
    engineering: Attribute.Integer;
    life_science: Attribute.Integer;
    physical_science: Attribute.Integer;
  };
}

export interface UniversityStudentApplication extends Schema.Component {
  collectionName: 'components_university_student_applications';
  info: {
    displayName: 'Student Application';
    icon: 'file';
  };
  attributes: {
    student: Attribute.Relation<
      'university.student-application',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    college: Attribute.Relation<
      'university.student-application',
      'oneToOne',
      'api::college.college'
    >;
    application_cycle: Attribute.Component<'university.application-cycle-deadline'>;
    category: Attribute.Enumeration<['in  progress', 'submitted', 'completed']>;
    status: Attribute.Enumeration<['Safety', 'Target', 'Reach']>;
    course_major: Attribute.String;
    university_decision: Attribute.Enumeration<
      ['pending', 'accepted', 'rejected', 'waitlisted']
    > &
      Attribute.DefaultTo<'pending'>;
    student_decision: Attribute.Enumeration<['pending', 'accept', 'decline']> &
      Attribute.DefaultTo<'pending'>;
    application_materials: Attribute.Component<
      'university.application-materials',
      true
    >;
  };
}

export interface UniversityOverview extends Schema.Component {
  collectionName: 'components_university_overviews';
  info: {
    displayName: 'overview';
  };
  attributes: {
    university_overview: Attribute.Text;
    research_excellence: Attribute.Text;
    global_impact: Attribute.Text;
  };
}

export interface UniversityLor extends Schema.Component {
  collectionName: 'components_university_lors';
  info: {
    displayName: 'LOR';
  };
  attributes: {
    type: Attribute.String;
    requirements: Attribute.Text;
  };
}

export interface UniversityKeyStats extends Schema.Component {
  collectionName: 'components_university_key_stats';
  info: {
    displayName: 'key-stats';
    description: '';
  };
  attributes: {
    total_students: Attribute.BigInteger;
    int_students: Attribute.BigInteger;
    research_funding: Attribute.BigInteger;
    student_faculty_ratio: Attribute.String;
  };
}

export interface UniversityGlobalRanking extends Schema.Component {
  collectionName: 'components_university_global_rankings';
  info: {
    displayName: 'global-ranking';
    description: '';
  };
  attributes: {
    times_rank: Attribute.Integer;
    us_news_rank: Attribute.BigInteger;
    arwu_rank: Attribute.Integer;
    qs_rank: Attribute.Integer;
  };
}

export interface UniversityFinancialAids extends Schema.Component {
  collectionName: 'components_university_financial_aids';
  info: {
    displayName: 'financial-aids';
  };
  attributes: {
    rhodes: Attribute.Boolean;
    claderon: Attribute.Boolean;
    oxford_weidenfeld: Attribute.Boolean;
    reach_oxford: Attribute.Boolean;
    oxford_bursary: Attribute.Boolean;
    college_specific_support: Attribute.Boolean;
  };
}

export interface UniversityBasicInfo extends Schema.Component {
  collectionName: 'components_university_basic_infos';
  info: {
    displayName: 'basic-info';
    description: '';
  };
  attributes: {
    university_name: Attribute.Text;
    location: Attribute.String;
    university_type: Attribute.String;
    year_of_establishment: Attribute.Integer;
    world_rank: Attribute.Integer;
    acceptance_rate: Attribute.String;
  };
}

export interface UniversityApplicationMaterials extends Schema.Component {
  collectionName: 'components_university_application_materials';
  info: {
    displayName: 'application_materials';
    icon: 'attachment';
  };
  attributes: {
    material_type: Attribute.String & Attribute.Required;
    submitted: Attribute.Boolean & Attribute.DefaultTo<false>;
    submission_date: Attribute.DateTime;
  };
}

export interface UniversityApplicationCycleDeadline extends Schema.Component {
  collectionName: 'components_university_application_cycle_deadlines';
  info: {
    displayName: 'Application Cycle Deadline';
    icon: 'collapse';
  };
  attributes: {
    cycle_type: Attribute.Enumeration<
      [
        'early decision',
        'regular decision',
        'early action',
        'rolling admission'
      ]
    > &
      Attribute.Required;
    deadline: Attribute.Date & Attribute.Required;
  };
}

export interface UniversityAdmissionRequirements extends Schema.Component {
  collectionName: 'components_university_admission_requirements';
  info: {
    displayName: 'admission_requirements';
    description: '';
  };
  attributes: {
    high_school_diploma: Attribute.Boolean;
    sat: Attribute.Boolean;
    ap: Attribute.Boolean;
    subject_specific_requirements: Attribute.Boolean;
    ielts_score: Attribute.Decimal;
    toefl_score: Attribute.Integer;
    cambridge_score: Attribute.String;
    duolingo_score: Attribute.Decimal;
    min_gpa: Attribute.String;
  };
}

export interface UniversityAdditionalCosts extends Schema.Component {
  collectionName: 'components_university_additional_costs';
  info: {
    displayName: 'additional_costs';
  };
  attributes: {
    accomodation_min: Attribute.String;
    accomodation_max: Attribute.String;
    books_min: Attribute.String;
    books_max: Attribute.String;
    living_expense_min: Attribute.String;
    living_expense_max: Attribute.String;
    insurance_min: Attribute.String;
    insurance_max: Attribute.String;
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
    description: '';
  };
  attributes: {
    answer_type: Attribute.Enumeration<
      [
        'Single Correct',
        'Multiple Correct',
        'Integer',
        'Short Text',
        'Long Text',
        'Match Columns',
        'Drag Drop',
        'Ranking',
        'Data Interpretation'
      ]
    >;
    marks: Attribute.Integer & Attribute.Required;
    question_text: Attribute.RichText;
    options: Attribute.RichText;
    correct_answer: Attribute.RichText;
    hints: Attribute.Component<'question-bank.hints', true>;
    attachments: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
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

export interface NotificationNotes extends Schema.Component {
  collectionName: 'components_notification_notes';
  info: {
    displayName: 'notes';
    icon: 'arrowUp';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
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

export interface LorLor extends Schema.Component {
  collectionName: 'components_lor_lors';
  info: {
    displayName: 'LOR';
    icon: 'feather';
    description: '';
  };
  attributes: {
    facultyname: Attribute.String;
    facultydomain: Attribute.String;
    facultysubject: Attribute.String;
    status: Attribute.Enumeration<['accepted', 'rejected', 'in progress']>;
    lor: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
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

export interface ExternalUsersPosition extends Schema.Component {
  collectionName: 'components_external_users_positions';
  info: {
    displayName: 'position';
  };
  attributes: {
    title: Attribute.String;
    duration: Attribute.String;
    start_date: Attribute.Date;
    end_date: Attribute.Date;
    description: Attribute.Text;
    compensation: Attribute.String;
    eligibility: Attribute.String;
    location: Attribute.String;
    time_commitment: Attribute.String;
    selection_process: Attribute.Text;
    benefits: Attribute.Text;
  };
}

export interface ExternalUsersOrgDetails extends Schema.Component {
  collectionName: 'components_external_users_org_details';
  info: {
    displayName: 'org_details';
  };
  attributes: {
    org_name: Attribute.String;
    description: Attribute.Text;
    years_running: Attribute.String;
    location: Attribute.String;
    website: Attribute.String;
    cause: Attribute.String;
    facebook: Attribute.String;
    twitter: Attribute.String;
    linkedin: Attribute.String;
    instagram: Attribute.String;
    tiktok: Attribute.String;
    company_type: Attribute.String;
    industry: Attribute.String;
  };
}

export interface ExternalUsersFounder extends Schema.Component {
  collectionName: 'components_external_users_founders';
  info: {
    displayName: 'founder';
  };
  attributes: {
    name: Attribute.String;
    university: Attribute.String;
    email: Attribute.Email;
    linkedin: Attribute.String;
    phone: Attribute.String;
    yoe: Attribute.String;
    description: Attribute.String;
  };
}

export interface EssaysTags extends Schema.Component {
  collectionName: 'components_essays_tags';
  info: {
    displayName: 'tags';
    icon: 'check';
  };
  attributes: {
    name: Attribute.String;
  };
}

export interface EssaysEssay extends Schema.Component {
  collectionName: 'components_essays_essays';
  info: {
    displayName: 'Essay';
    description: '';
  };
  attributes: {
    prompt: Attribute.String;
    word_count: Attribute.Integer;
    title: Attribute.String;
  };
}

export interface CyclesCycle extends Schema.Component {
  collectionName: 'components_cycles_cycles';
  info: {
    displayName: 'cycle';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    early_decision: Attribute.String;
    regular_decision: Attribute.String;
    early_action: Attribute.String;
  };
}

export interface CollegeRequirement extends Schema.Component {
  collectionName: 'components_college_requirements';
  info: {
    displayName: 'requirement';
  };
  attributes: {
    requirement: Attribute.String;
  };
}

export interface CollegePrograms extends Schema.Component {
  collectionName: 'components_college_programs';
  info: {
    displayName: 'programs';
    description: '';
  };
  attributes: {
    program_name: Attribute.String;
    program_type: Attribute.String;
    department: Attribute.String;
    duration: Attribute.String;
    annual_fee: Attribute.String;
    intake: Attribute.String;
    program_overview: Attribute.Text;
    career_prospects: Attribute.Text;
    application_deadlines: Attribute.Component<
      'university.application-cycle-deadline',
      true
    >;
    requirement: Attribute.Component<'college.requirement', true>;
    student_applications: Attribute.Component<
      'university.student-application',
      true
    >;
  };
}

export interface ClassroomResources extends Schema.Component {
  collectionName: 'components_classroom_resources';
  info: {
    displayName: 'resources';
    icon: 'apps';
  };
  attributes: {
    url: Attribute.Text;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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

export interface AvailabilityTimeSlot extends Schema.Component {
  collectionName: 'components_availability_time_slots';
  info: {
    displayName: 'timeSlot';
    description: '';
  };
  attributes: {
    start: Attribute.String;
    end: Attribute.String;
  };
}

export interface AvailabilityDayAvailability extends Schema.Component {
  collectionName: 'components_availability_day_availabilities';
  info: {
    displayName: 'dayAvailability';
  };
  attributes: {
    day: Attribute.Enumeration<
      [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      ]
    >;
    enabled: Attribute.Boolean;
    slots: Attribute.Component<'availability.time-slot', true>;
  };
}

export interface AcademicsAcadPerformance extends Schema.Component {
  collectionName: 'components_academics_acad_performances';
  info: {
    displayName: 'acad-performance';
  };
  attributes: {
    GPA: Attribute.Integer;
    class_rank: Attribute.Integer;
    SAT: Attribute.Integer;
    ACT: Attribute.Integer;
    IELTS: Attribute.Integer;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'user.user-experience': UserUserExperience;
      'user.student-plan': UserStudentPlan;
      'user.extra-activity': UserExtraActivity;
      'tutors-website.best-online-tutors': TutorsWebsiteBestOnlineTutors;
      'university.tution-fees': UniversityTutionFees;
      'university.subject-ranking': UniversitySubjectRanking;
      'university.student-application': UniversityStudentApplication;
      'university.overview': UniversityOverview;
      'university.lor': UniversityLor;
      'university.key-stats': UniversityKeyStats;
      'university.global-ranking': UniversityGlobalRanking;
      'university.financial-aids': UniversityFinancialAids;
      'university.basic-info': UniversityBasicInfo;
      'university.application-materials': UniversityApplicationMaterials;
      'university.application-cycle-deadline': UniversityApplicationCycleDeadline;
      'university.admission-requirements': UniversityAdmissionRequirements;
      'university.additional-costs': UniversityAdditionalCosts;
      'subtopic.qn-a': SubtopicQnA;
      'subtopic.heading': SubtopicHeading;
      'subject.refrence-books': SubjectRefrenceBooks;
      'recorded-lectures.progress': RecordedLecturesProgress;
      'question-bank.question-n-answer': QuestionBankQuestionNAnswer;
      'question-bank.parts': QuestionBankParts;
      'question-bank.hints': QuestionBankHints;
      'plan.grade-plan': PlanGradePlan;
      'notification.notes': NotificationNotes;
      'notification.history': NotificationHistory;
      'notification.demo-booking-time': NotificationDemoBookingTime;
      'mentor.mentor-questions': MentorMentorQuestions;
      'lor.lor': LorLor;
      'lectures.lecture-header': LecturesLectureHeader;
      'external-users.position': ExternalUsersPosition;
      'external-users.org-details': ExternalUsersOrgDetails;
      'external-users.founder': ExternalUsersFounder;
      'essays.tags': EssaysTags;
      'essays.essay': EssaysEssay;
      'cycles.cycle': CyclesCycle;
      'college.requirement': CollegeRequirement;
      'college.programs': CollegePrograms;
      'classroom.resources': ClassroomResources;
      'classroom.notices': ClassroomNotices;
      'classroom.days': ClassroomDays;
      'availability.time-slot': AvailabilityTimeSlot;
      'availability.day-availability': AvailabilityDayAvailability;
      'academics.acad-performance': AcademicsAcadPerformance;
    }
  }
}
