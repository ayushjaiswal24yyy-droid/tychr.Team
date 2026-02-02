import type { Schema, Attribute } from '@strapi/strapi';

export interface WhyChooseTutorWhyChooseTutor extends Schema.Component {
  collectionName: 'components_why_choose_tutor_why_choose_tutors';
  info: {
    displayName: 'why_choose_tutor';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.Text;
    features: Attribute.Component<'features.features', true>;
    right_box_title: Attribute.String;
    cta_text: Attribute.String;
    cta_link: Attribute.String;
    enabled: Attribute.Boolean;
    theme: Attribute.Enumeration<['light', 'dark']>;
    bullet_points: Attribute.JSON;
  };
}

export interface WhyChooseDataWhyChooseData extends Schema.Component {
  collectionName: 'components_why_choose_data_why_choose_data';
  info: {
    displayName: 'why_choose_data';
  };
  attributes: {
    string: Attribute.Text;
  };
}

export interface WhyTychrWhyTychr extends Schema.Component {
  collectionName: 'components_why_tychr_why_tychrs';
  info: {
    displayName: 'why_tychr';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.String;
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

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

export interface UniversityTutionFees extends Schema.Component {
  collectionName: 'components_university_tution_fees';
  info: {
    displayName: 'tution-fees';
    description: '';
  };
  attributes: {
    ug_int: Attribute.BigInteger;
    ug_domestic: Attribute.Integer;
    grad_int: Attribute.Integer;
    grad_domestic: Attribute.Integer;
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

export interface TutorPriceTutorPrice extends Schema.Component {
  collectionName: 'components_tutor_price_tutor_prices';
  info: {
    displayName: 'tutor_price';
  };
  attributes: {
    inr_price: Attribute.Decimal;
    usd_price: Attribute.Decimal;
    studentCount: Attribute.Integer;
    tychr_usd_price: Attribute.Decimal;
    tychr_inr_price: Attribute.Decimal;
  };
}

export interface TopCollegesTopColleges extends Schema.Component {
  collectionName: 'components_top_colleges_top_colleges';
  info: {
    displayName: 'top_colleges';
  };
  attributes: {
    images: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
    name: Attribute.String;
    description: Attribute.String;
    tags: Attribute.Component<'tags.tags', true>;
  };
}

export interface TimeSlotsTimeSlots extends Schema.Component {
  collectionName: 'components_time_slots_time_slots';
  info: {
    displayName: 'time_slots';
    description: '';
  };
  attributes: {
    day: Attribute.Enumeration<
      [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
      ]
    >;
    start_time: Attribute.Time;
    end_time: Attribute.Time;
  };
}

export interface TagsTags extends Schema.Component {
  collectionName: 'components_tags_tags';
  info: {
    displayName: 'tags';
  };
  attributes: {
    label: Attribute.String;
    color: Attribute.String;
  };
}

export interface SyllabusIbSubjects extends Schema.Component {
  collectionName: 'components_syllabus_ib_subjects';
  info: {
    displayName: 'IB_subjects';
  };
  attributes: {
    course_name: Attribute.String;
    course_description: Attribute.Text;
    curriculum: Attribute.Component<'curriculum.curriculum', true>;
    external_assessments: Attribute.Component<
      'external-assessments.external-assessments',
      true
    >;
    internal_assessments: Attribute.Component<
      'internal-assessments.internal-assessments',
      true
    >;
    provider_name: Attribute.String;
    canonical_url: Attribute.String;
    provider_url: Attribute.String;
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

export interface SubjectExcellenceSubjectExcellence extends Schema.Component {
  collectionName: 'components_subject_excellence_subject_excellences';
  info: {
    displayName: 'Subject Excellence';
  };
  attributes: {
    heading: Attribute.String;
    subheading: Attribute.String;
    stats: Attribute.Component<'excellence-stats.stats', true>;
    subjects: Attribute.JSON;
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

export interface StudentsBySubjectsStudentBySubjects extends Schema.Component {
  collectionName: 'components_students_by_subjects_student_by_subjects';
  info: {
    displayName: 'Student By Subjects';
  };
  attributes: {
    category: Attribute.String;
    student_data: Attribute.Component<'student-data.student-data', true>;
  };
}

export interface StudentDataStudentData extends Schema.Component {
  collectionName: 'components_student_data_student_data';
  info: {
    displayName: 'Student Data';
  };
  attributes: {
    name: Attribute.String;
    score: Attribute.String;
    img: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
  };
}

export interface StepsSteps extends Schema.Component {
  collectionName: 'components_steps_steps';
  info: {
    displayName: 'steps';
  };
  attributes: {
    number: Attribute.String;
    title: Attribute.String;
    desc: Attribute.Text;
  };
}

export interface StatsStats extends Schema.Component {
  collectionName: 'components_stats_stats';
  info: {
    displayName: 'Stats';
  };
  attributes: {
    statNumber: Attribute.String;
    statDescription: Attribute.String;
  };
}

export interface StatItemStatItem extends Schema.Component {
  collectionName: 'components_stat_item_stat_items';
  info: {
    displayName: 'stat_item';
  };
  attributes: {
    value: Attribute.String;
    label: Attribute.String;
  };
}

export interface StandOutFeatureStandOutFeature extends Schema.Component {
  collectionName: 'components_stand_out_feature_stand_out_features';
  info: {
    displayName: 'stand_out_feature';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.String;
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
  };
}

export interface StandOutStandOut extends Schema.Component {
  collectionName: 'components_stand_out_stand_outs';
  info: {
    displayName: 'Stand_Out';
  };
  attributes: {
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Attribute.String;
    description: Attribute.Text;
    link_text: Attribute.String;
  };
}

export interface SemestersSemesters extends Schema.Component {
  collectionName: 'components_semesters_semesters';
  info: {
    displayName: 'semesters';
  };
  attributes: {
    label: Attribute.String;
    steps: Attribute.Component<'steps.steps', true>;
  };
}

export interface ResultsDataResultsData extends Schema.Component {
  collectionName: 'components_results_data_results_data';
  info: {
    displayName: 'Results_Data';
  };
  attributes: {
    name: Attribute.String;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    text: Attribute.String;
  };
}

export interface SchemaSchemaVideo extends Schema.Component {
  collectionName: 'components_schema_schema_videos';
  info: {
    displayName: 'schema_video';
  };
  attributes: {
    name: Attribute.String;
    description: Attribute.String;
    thumbnail: Attribute.String;
    uploadDate: Attribute.Date;
    url: Attribute.String;
  };
}

export interface SchemaSchemaReviews extends Schema.Component {
  collectionName: 'components_schema_schema_reviews';
  info: {
    displayName: 'schema_reviews';
  };
  attributes: {
    author: Attribute.String;
    rating: Attribute.Decimal;
    text: Attribute.String;
  };
}

export interface SchemaSchemaResults extends Schema.Component {
  collectionName: 'components_schema_schema_results';
  info: {
    displayName: 'schema-results';
  };
  attributes: {
    year: Attribute.String;
    global: Attribute.String;
    tychr: Attribute.String;
  };
}

export interface SchemaSchemaFaqs extends Schema.Component {
  collectionName: 'components_schema_schema_faqs';
  info: {
    displayName: 'schema-faqs';
  };
  attributes: {
    q: Attribute.String;
    a: Attribute.String;
  };
}

export interface ResourcesResources extends Schema.Component {
  collectionName: 'components_resources_resources';
  info: {
    displayName: 'Resources';
    description: '';
  };
  attributes: {
    category: Attribute.String;
    Subject: Attribute.String;
    Icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    Boards: Attribute.JSON;
  };
}

export interface RequestedByRequestedBy extends Schema.Component {
  collectionName: 'components_requested_by_requested_bies';
  info: {
    displayName: 'requested_by';
  };
  attributes: {
    role: Attribute.Enumeration<['Student', 'Tutor']>;
    user: Attribute.Relation<
      'requested-by.requested-by',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
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

export interface QuestionBankRightItemsSection extends Schema.Component {
  collectionName: 'components_question_bank_right_items_section_s';
  info: {
    displayName: 'RightItemsSection ';
    icon: 'collapse';
  };
  attributes: {
    item_id: Attribute.String;
    content: Attribute.RichText;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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
    part_evaluations: Attribute.Component<'evaluation.evaluation', true>;
    question_awarded_marks: Attribute.Decimal;
    question_feedback: Attribute.Text;
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
        'Data Interpretation',
        'Fill In The Blanks'
      ]
    >;
    marks: Attribute.Integer & Attribute.Required;
    question_text: Attribute.RichText;
    original_question_text: Attribute.Text;
    content_format: Attribute.Enumeration<
      ['html', 'markdown', 'richtext', 'canvas']
    > &
      Attribute.DefaultTo<'richtext'>;
    options: Attribute.RichText;
    correct_answer: Attribute.RichText;
    original_correct_answer: Attribute.Text;
    multiple_correct_answers: Attribute.JSON;
    hints: Attribute.Component<'question-bank.hints', true>;
    attachments: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    correctMatchingPairs: Attribute.JSON;
    left_items: Attribute.Component<'question-bank.left-items-section', true>;
    right_items: Attribute.Component<'question-bank.right-items-section', true>;
    word_limit: Attribute.Integer;
  };
}

export interface QuestionBankMatchingPairQuestions extends Schema.Component {
  collectionName: 'components_question_bank_matching_pair_questions';
  info: {
    displayName: 'matchingPairQuestions';
    icon: 'file';
  };
  attributes: {
    title: Attribute.String;
  };
}

export interface QuestionBankLeftItemsSection extends Schema.Component {
  collectionName: 'components_question_bank_left_items_sections';
  info: {
    displayName: 'leftItemsSection';
  };
  attributes: {
    itemId: Attribute.String;
    content: Attribute.RichText;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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

export interface OnlineTutorsBestOnlineTutors extends Schema.Component {
  collectionName: 'components_online_tutors_best_online_tutors';
  info: {
    displayName: 'Best Online Tutors';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.Text;
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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

export interface LorLorSubmission extends Schema.Component {
  collectionName: 'components_lor_lor_submissions';
  info: {
    displayName: 'LOR Submission';
    icon: 'check';
  };
  attributes: {
    facultyname: Attribute.String;
    facultydomain: Attribute.String;
    facultysubject: Attribute.String;
    status: Attribute.Enumeration<['in progress', 'accepted', 'rejected']>;
    file: Attribute.Media;
    submitted_at: Attribute.DateTime;
    college_lor_id: Attribute.Integer;
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

export interface IgcseEntailIgcseEntail extends Schema.Component {
  collectionName: 'components_igcse_entail_igcse_entails';
  info: {
    displayName: 'igcse_entail';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.String;
    description: Attribute.Blocks;
    features: Attribute.Component<'features.features', true>;
    stats: Attribute.Component<'stat-item.stat-item', true>;
    cta_buttons: Attribute.Component<'cta-button.cta-buttons', true>;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

export interface InternalAssessmentsInternalAssessments
  extends Schema.Component {
  collectionName: 'components_internal_assessments_internal_assessments';
  info: {
    displayName: 'internal_assessments';
  };
  attributes: {
    name: Attribute.String;
    duration: Attribute.String;
    description: Attribute.String;
  };
}

export interface IgPaperStructureIgcsePaperStructure extends Schema.Component {
  collectionName: 'components_ig_paper_structure_igcse_paper_structures';
  info: {
    displayName: 'IGCSE Paper Structure';
    description: '';
  };
  attributes: {
    description: Attribute.Text;
    requirement: Attribute.String;
    prediction: Attribute.String;
    number: Attribute.Integer;
    title: Attribute.String;
  };
}

export interface HowItWorksHowItWorks extends Schema.Component {
  collectionName: 'components_how_it_works_how_it_works';
  info: {
    displayName: 'How It Works';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    step: Attribute.String;
    position: Attribute.Enumeration<['left', 'right']>;
  };
}

export interface FutureCategoryFutureCategory extends Schema.Component {
  collectionName: 'components_future_category_future_categories';
  info: {
    displayName: 'Future Category';
  };
  attributes: {
    items: Attribute.Blocks;
    title: Attribute.String;
  };
}

export interface FututeCategoryFutureCategory extends Schema.Component {
  collectionName: 'components_futute_category_future_categories';
  info: {
    displayName: 'Future Category';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    items: Attribute.JSON;
  };
}

export interface FreeResourcesFreeResourced extends Schema.Component {
  collectionName: 'components_free_resources_free_resourceds';
  info: {
    displayName: 'Free Resourced';
  };
  attributes: {
    heading: Attribute.String;
    subheading: Attribute.String;
    categories: Attribute.JSON;
    resources: Attribute.Component<'resources.resources', true>;
  };
}

export interface ForumChildSecureForum extends Schema.Component {
  collectionName: 'components_forum_child_secure_forums';
  info: {
    displayName: 'Child_Secure_Forum';
  };
  attributes: {
    title: Attribute.String;
  };
}

export interface FinestTutorsFinestTutors extends Schema.Component {
  collectionName: 'components_finest_tutors_finest_tutors';
  info: {
    displayName: 'Finest Tutors';
  };
  attributes: {
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Attribute.String;
    description: Attribute.Text;
  };
}

export interface FeaturesFeatures extends Schema.Component {
  collectionName: 'components_features_features';
  info: {
    displayName: 'features';
  };
  attributes: {
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Attribute.String;
    description: Attribute.Text;
  };
}

export interface FaqSectionFaq extends Schema.Component {
  collectionName: 'components_faq_section_faqs';
  info: {
    displayName: 'FAQ';
  };
  attributes: {
    question: Attribute.Text;
    answer: Attribute.Text;
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

export interface ExcellenceStatsStats extends Schema.Component {
  collectionName: 'components_excellence_stats_stats';
  info: {
    displayName: 'stats';
  };
  attributes: {
    value: Attribute.String;
    label: Attribute.String;
  };
}

export interface EvaluationEvaluation extends Schema.Component {
  collectionName: 'components_evaluation_evaluations';
  info: {
    displayName: 'evaluation';
  };
  attributes: {
    part_index: Attribute.Integer;
    awarded_marks: Attribute.Decimal;
    feedback: Attribute.Text;
  };
}

export interface EssaysTitleOption extends Schema.Component {
  collectionName: 'components_shared_title_options';
  info: {
    displayName: 'Title Option';
    description: 'A single essay title option';
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
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
    type: Attribute.Enumeration<['main', 'supplementary']>;
  };
}

export interface EssaysEssayTitleOptions extends Schema.Component {
  collectionName: 'components_college_essay_title_options';
  info: {
    displayName: 'Essay Title Options';
    description: 'Predefined essay title options for dropdown selection';
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
  };
}

export interface EssaysEssaySubmission extends Schema.Component {
  collectionName: 'components_essays_essay_submissions';
  info: {
    displayName: 'Essay Submission';
    description: '';
    icon: 'feather';
  };
  attributes: {
    essay_type: Attribute.String;
    file: Attribute.Media;
    submitted_at: Attribute.DateTime;
    status: Attribute.Enumeration<['pending', 'submitted', 'reviewed']>;
    college_essay_id: Attribute.Integer;
    essay: Attribute.Blocks;
  };
}

export interface ExternalAssessmentsExternalAssessments
  extends Schema.Component {
  collectionName: 'components_external_assessments_external_assessments';
  info: {
    displayName: 'external_assessments';
  };
  attributes: {
    name: Attribute.String;
    description: Attribute.String;
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

export interface CurriculumCurriculum extends Schema.Component {
  collectionName: 'components_curriculum_curricula';
  info: {
    displayName: 'curriculum';
  };
  attributes: {
    part: Attribute.String;
    title: Attribute.String;
    notes: Attribute.String;
  };
}

export interface CtaButtonCtaButtons extends Schema.Component {
  collectionName: 'components_cta_button_cta_buttons';
  info: {
    displayName: 'cta_buttons';
  };
  attributes: {
    string: Attribute.String;
    url: Attribute.String;
    variant: Attribute.Enumeration<['primary', 'secondary']>;
  };
}

export interface CollegesColleges extends Schema.Component {
  collectionName: 'components_colleges_colleges';
  info: {
    displayName: 'colleges';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    description: Attribute.Text;
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
    description: '';
  };
  attributes: {
    url: Attribute.Text;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Attribute.String;
    description: Attribute.Text;
  };
}

export interface ClassroomNotices extends Schema.Component {
  collectionName: 'components_classroom_notices';
  info: {
    displayName: 'notices';
    description: '';
  };
  attributes: {};
}

export interface ClassroomDays extends Schema.Component {
  collectionName: 'components_classroom_days';
  info: {
    displayName: 'days';
  };
  attributes: {
    days: Attribute.Enumeration<
      [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ]
    >;
    startTime: Attribute.Time;
  };
}

export interface ClaimsClaims extends Schema.Component {
  collectionName: 'components_claims_claims';
  info: {
    displayName: 'claims';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
    highlight: Attribute.Text;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
  };
}

export interface CertifiedTutorsCertifiedTutors extends Schema.Component {
  collectionName: 'components_certified_tutors_certified_tutors';
  info: {
    displayName: 'Certified Tutors';
  };
  attributes: {
    profile_image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    Name: Attribute.String;
    role: Attribute.String;
    years_of_experience: Attribute.String;
  };
}

export interface BlogSectionBlog extends Schema.Component {
  collectionName: 'components_blog_section_blogs';
  info: {
    displayName: 'Blog';
    description: '';
  };
  attributes: {
    subject: Attribute.String;
    time_to_read: Attribute.String;
    full_subject_name: Attribute.String;
    title: Attribute.Text;
    description: Attribute.Text;
    bgcolor: Attribute.String;
    category: Attribute.String;
  };
}

export interface BestTutorsDataBestTutorsData extends Schema.Component {
  collectionName: 'components_best_tutors_data_best_tutors_data';
  info: {
    displayName: 'best_tutors_data';
    description: '';
  };
  attributes: {
    icon: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Attribute.String;
    subtitle: Attribute.Text;
  };
}

export interface BestTutorsBestTutors extends Schema.Component {
  collectionName: 'components_best_tutors_best_tutors';
  info: {
    displayName: 'Best Tutors';
  };
  attributes: {
    heading: Attribute.String;
    description: Attribute.Text;
    best_tutors_data: Attribute.Component<
      'best-tutors-data.best-tutors-data',
      true
    >;
    why_choose_heading: Attribute.String;
    why_choose_data: Attribute.JSON;
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

export interface ApFutureApFuture extends Schema.Component {
  collectionName: 'components_ap_future_ap_futures';
  info: {
    displayName: 'AP Future';
    description: '';
  };
  attributes: {
    future_category: Attribute.Component<
      'futute-category.future-category',
      true
    >;
    heading: Attribute.String;
    subheading: Attribute.Text;
  };
}

export interface ApEntailApEntail extends Schema.Component {
  collectionName: 'components_ap_entail_ap_entails';
  info: {
    displayName: 'ap_entail';
  };
  attributes: {
    heading: Attribute.String;
    paragraph: Attribute.Text;
  };
}

export interface AchieversAchiever extends Schema.Component {
  collectionName: 'components_achievers_achievers';
  info: {
    displayName: 'Achiever';
  };
  attributes: {
    src: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    alt: Attribute.String;
  };
}

export interface ApCollegesApColleges extends Schema.Component {
  collectionName: 'components_ap_colleges_ap_colleges';
  info: {
    displayName: 'AP Colleges';
    description: '';
  };
  attributes: {
    heading: Attribute.String;
    subheading: Attribute.Text;
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
      'why-choose-tutor.why-choose-tutor': WhyChooseTutorWhyChooseTutor;
      'why-choose-data.why-choose-data': WhyChooseDataWhyChooseData;
      'why-tychr.why-tychr': WhyTychrWhyTychr;
      'user.user-experience': UserUserExperience;
      'user.student-plan': UserStudentPlan;
      'user.extra-activity': UserExtraActivity;
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
      'tutors-website.best-online-tutors': TutorsWebsiteBestOnlineTutors;
      'tutor-price.tutor-price': TutorPriceTutorPrice;
      'top-colleges.top-colleges': TopCollegesTopColleges;
      'time-slots.time-slots': TimeSlotsTimeSlots;
      'tags.tags': TagsTags;
      'syllabus.ib-subjects': SyllabusIbSubjects;
      'subtopic.qn-a': SubtopicQnA;
      'subtopic.heading': SubtopicHeading;
      'subject-excellence.subject-excellence': SubjectExcellenceSubjectExcellence;
      'subject.refrence-books': SubjectRefrenceBooks;
      'students-by-subjects.student-by-subjects': StudentsBySubjectsStudentBySubjects;
      'student-data.student-data': StudentDataStudentData;
      'steps.steps': StepsSteps;
      'stats.stats': StatsStats;
      'stat-item.stat-item': StatItemStatItem;
      'stand-out-feature.stand-out-feature': StandOutFeatureStandOutFeature;
      'stand-out.stand-out': StandOutStandOut;
      'semesters.semesters': SemestersSemesters;
      'results-data.results-data': ResultsDataResultsData;
      'schema.schema-video': SchemaSchemaVideo;
      'schema.schema-reviews': SchemaSchemaReviews;
      'schema.schema-results': SchemaSchemaResults;
      'schema.schema-faqs': SchemaSchemaFaqs;
      'resources.resources': ResourcesResources;
      'requested-by.requested-by': RequestedByRequestedBy;
      'recorded-lectures.progress': RecordedLecturesProgress;
      'question-bank.right-items-section': QuestionBankRightItemsSection;
      'question-bank.question-n-answer': QuestionBankQuestionNAnswer;
      'question-bank.parts': QuestionBankParts;
      'question-bank.matching-pair-questions': QuestionBankMatchingPairQuestions;
      'question-bank.left-items-section': QuestionBankLeftItemsSection;
      'question-bank.hints': QuestionBankHints;
      'plan.grade-plan': PlanGradePlan;
      'online-tutors.best-online-tutors': OnlineTutorsBestOnlineTutors;
      'notification.notes': NotificationNotes;
      'notification.history': NotificationHistory;
      'notification.demo-booking-time': NotificationDemoBookingTime;
      'mentor.mentor-questions': MentorMentorQuestions;
      'lor.lor': LorLor;
      'lor.lor-submission': LorLorSubmission;
      'lectures.lecture-header': LecturesLectureHeader;
      'igcse-entail.igcse-entail': IgcseEntailIgcseEntail;
      'internal-assessments.internal-assessments': InternalAssessmentsInternalAssessments;
      'ig-paper-structure.igcse-paper-structure': IgPaperStructureIgcsePaperStructure;
      'how-it-works.how-it-works': HowItWorksHowItWorks;
      'future-category.future-category': FutureCategoryFutureCategory;
      'futute-category.future-category': FututeCategoryFutureCategory;
      'free-resources.free-resourced': FreeResourcesFreeResourced;
      'forum.child-secure-forum': ForumChildSecureForum;
      'finest-tutors.finest-tutors': FinestTutorsFinestTutors;
      'features.features': FeaturesFeatures;
      'faq-section.faq': FaqSectionFaq;
      'external-users.position': ExternalUsersPosition;
      'external-users.org-details': ExternalUsersOrgDetails;
      'external-users.founder': ExternalUsersFounder;
      'excellence-stats.stats': ExcellenceStatsStats;
      'evaluation.evaluation': EvaluationEvaluation;
      'essays.title-option': EssaysTitleOption;
      'essays.tags': EssaysTags;
      'essays.essay': EssaysEssay;
      'essays.essay-title-options': EssaysEssayTitleOptions;
      'essays.essay-submission': EssaysEssaySubmission;
      'external-assessments.external-assessments': ExternalAssessmentsExternalAssessments;
      'cycles.cycle': CyclesCycle;
      'curriculum.curriculum': CurriculumCurriculum;
      'cta-button.cta-buttons': CtaButtonCtaButtons;
      'colleges.colleges': CollegesColleges;
      'college.requirement': CollegeRequirement;
      'college.programs': CollegePrograms;
      'classroom.resources': ClassroomResources;
      'classroom.notices': ClassroomNotices;
      'classroom.days': ClassroomDays;
      'claims.claims': ClaimsClaims;
      'certified-tutors.certified-tutors': CertifiedTutorsCertifiedTutors;
      'blog-section.blog': BlogSectionBlog;
      'best-tutors-data.best-tutors-data': BestTutorsDataBestTutorsData;
      'best-tutors.best-tutors': BestTutorsBestTutors;
      'availability.time-slot': AvailabilityTimeSlot;
      'availability.day-availability': AvailabilityDayAvailability;
      'ap-future.ap-future': ApFutureApFuture;
      'ap-entail.ap-entail': ApEntailApEntail;
      'achievers.achiever': AchieversAchiever;
      'ap-colleges.ap-colleges': ApCollegesApColleges;
      'academics.acad-performance': AcademicsAcadPerformance;
    }
  }
}
