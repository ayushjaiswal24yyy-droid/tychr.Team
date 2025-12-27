import type { Schema, Attribute } from '@strapi/strapi';

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    name: 'Permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    name: 'User';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    username: Attribute.String;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    registrationToken: Attribute.String & Attribute.Private;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    preferedLanguage: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    name: 'Role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    name: 'Api Token';
    singularName: 'api-token';
    pluralName: 'api-tokens';
    displayName: 'Api Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    name: 'API Token Permission';
    description: '';
    singularName: 'api-token-permission';
    pluralName: 'api-token-permissions';
    displayName: 'API Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    name: 'Transfer Token';
    singularName: 'transfer-token';
    pluralName: 'transfer-tokens';
    displayName: 'Transfer Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    name: 'Transfer Token Permission';
    description: '';
    singularName: 'transfer-token-permission';
    pluralName: 'transfer-token-permissions';
    displayName: 'Transfer Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    singularName: 'file';
    pluralName: 'files';
    displayName: 'File';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    alternativeText: Attribute.String;
    caption: Attribute.String;
    width: Attribute.Integer;
    height: Attribute.Integer;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    ext: Attribute.String;
    mime: Attribute.String & Attribute.Required;
    size: Attribute.Decimal & Attribute.Required;
    url: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    singularName: 'folder';
    pluralName: 'folders';
    displayName: 'Folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    singularName: 'release';
    pluralName: 'releases';
    displayName: 'Release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    timezone: Attribute.String;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    singularName: 'release-action';
    pluralName: 'release-actions';
    displayName: 'Release Action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    contentType: Attribute.String & Attribute.Required;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    isEntryValid: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginChartbrewChartbrew extends Schema.SingleType {
  collectionName: 'chartbrews';
  info: {
    singularName: 'chartbrew';
    pluralName: 'chartbrews';
    displayName: 'Chartbrew';
  };
  options: {
    draftAndPublish: false;
    comment: '';
  };
  attributes: {
    host: Attribute.String & Attribute.Required;
    token: Attribute.String & Attribute.Required;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::chartbrew.chartbrew',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::chartbrew.chartbrew',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: 'i18n_locale';
  info: {
    singularName: 'locale';
    pluralName: 'locales';
    collectionName: 'locales';
    displayName: 'Locale';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 50;
        },
        number
      >;
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    name: 'permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    name: 'role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    description: Attribute.String;
    type: Attribute.String & Attribute.Unique;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    name: 'user';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Attribute.String;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    fullName: Attribute.String & Attribute.Unique;
    uuid: Attribute.String & Attribute.Unique;
    otp: Attribute.BigInteger;
    avatar: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    phoneNumber: Attribute.String & Attribute.Unique;
    fav_topics: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToMany',
      'api::topic.topic'
    >;
    onBoarded: Attribute.Boolean & Attribute.DefaultTo<false>;
    grade: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'api::class.class'
    >;
    studying: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToMany',
      'api::enrollment.enrollment'
    >;
    title: Attribute.Enumeration<['IB Facilitator', 'IB Examiner']>;
    ib_program: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'api::ib-program.ib-program'
    >;
    grade_score: Attribute.Integer;
    dream_profession: Attribute.String;
    dream_profession_secondary: Attribute.String;
    dream_university: Attribute.String;
    fav_subject: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'api::subject.subject'
    >;
    college_name: Attribute.String;
    tutor_plan: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'api::tutor-plan.tutor-plan'
    >;
    nationality: Attribute.String;
    lastUploaded: Attribute.Date;
    experience: Attribute.Integer;
    cv: Attribute.Media<'images' | 'videos' | 'audios' | 'files'>;
    biography: Attribute.Text;
    tutor_video: Attribute.Media<'videos'>;
    classroom_limit: Attribute.Integer & Attribute.DefaultTo<5>;
    communities: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToMany',
      'api::community.community'
    >;
    subject_guidances: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::subject.subject'
    >;
    highest_educational_qualification: Attribute.String;
    teaching_certifications: Attribute.String;
    graduated_from: Attribute.String;
    field_of_study: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'api::subject.subject'
    >;
    linkedIn_url: Attribute.String;
    subject_of_expertise: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'api::subject.subject'
    >;
    confirmTutor: Attribute.Boolean & Attribute.DefaultTo<false>;
    tutor_o2o_cost_inr: Attribute.Decimal;
    tutor_o2o_cost_usd: Attribute.Decimal;
    tutor_group_cost_inr: Attribute.Decimal;
    tutor_group_cost_usd: Attribute.Decimal;
    messages: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::message.message'
    >;
    tutor_status: Attribute.Enumeration<['Pending', 'Rejected', 'Approved']>;
    tutor_type: Attribute.Enumeration<['Counsellors', 'Faculty', 'Trainer']>;
    notifications: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::notification.notification'
    >;
    tutor_grade_subject: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'api::grade-subject.grade-subject'
    >;
    answers: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::answer.answer'
    >;
    classroom: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'api::enrollment.enrollment'
    >;
    student_plan: Attribute.Component<'user.student-plan', true>;
    isCreateByAdmin: Attribute.Boolean & Attribute.DefaultTo<false>;
    recorded_lectures: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToMany',
      'api::recorded-lecture.recorded-lecture'
    >;
    live_lectures_meetings: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::live-lectures-meeting.live-lectures-meeting'
    >;
    demo_booking_time: Attribute.Component<'classroom.days', true>;
    tutor_role: Attribute.Enumeration<['tutor', 'buddy', 'mentor']>;
    third_party_role: Attribute.Enumeration<
      ['professor', 'startup_mentor', 'student_org', 'ngo', 'corporate_firm']
    >;
    user_plans: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::user-plan.user-plan'
    >;
    premium_plans_created: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::premium-plan.premium-plan'
    >;
    experiencesOfUser: Attribute.Component<'user.user-experience', true>;
    written_articles: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::article.article'
    >;
    student_uni_applications: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::student-uni-application.student-uni-application'
    >;
    student_meetings_scheduled: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::student-meeting.student-meeting'
    >;
    meeting_scheduled_with_student: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::student-meeting.student-meeting'
    >;
    admin_transaction_outs: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::transaction-out.transaction-out'
    >;
    user_demo_classes_grade_plans: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::user-grade-plan.user-grade-plan'
    >;
    payments: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::payment.payment'
    >;
    mentor_availabilities: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::mentor-availability.mentor-availability'
    >;
    third_party_offerings: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::third-party-offering.third-party-offering'
    >;
    tp_applicants: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::tp-applicant.tp-applicant'
    >;
    add_on_orders: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::add-on-order.add-on-order'
    >;
    publications: Attribute.JSON;
    schoolname: Attribute.String;
    yearOfApplication: Attribute.Integer;
    prospectiveCareer: Attribute.String;
    majors: Attribute.String;
    activities: Attribute.JSON;
    acad: Attribute.Component<'academics.acad-performance'>;
    extracurricularActivities: Attribute.Component<'user.extra-activity', true>;
    student_notifications: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::student-notification.student-notification'
    >;
    class_requests: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::class-request.class-request'
    >;
    support_tickets: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::support-ticket.support-ticket'
    >;
    is_test_user: Attribute.Boolean & Attribute.DefaultTo<false>;
    teaching: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::enrollment.enrollment'
    >;
    live_lecture_purchases: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToMany',
      'api::live-lecture-purchase.live-lecture-purchase'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAddOnAddOn extends Schema.CollectionType {
  collectionName: 'add_ons';
  info: {
    singularName: 'add-on';
    pluralName: 'add-ons';
    displayName: 'add-on';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ib_program: Attribute.Relation<
      'api::add-on.add-on',
      'manyToOne',
      'api::ib-program.ib-program'
    >;
    Title: Attribute.String;
    add_on_contents: Attribute.Relation<
      'api::add-on.add-on',
      'oneToMany',
      'api::add-on-content.add-on-content'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::add-on.add-on',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::add-on.add-on',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAddOnContentAddOnContent extends Schema.CollectionType {
  collectionName: 'add_on_contents';
  info: {
    singularName: 'add-on-content';
    pluralName: 'add-on-contents';
    displayName: 'add-on-content';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    description: Attribute.Text & Attribute.Required;
    price: Attribute.Decimal;
    is_free: Attribute.Boolean & Attribute.DefaultTo<false>;
    contents: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
    validity_in_months: Attribute.Integer;
    other_information: Attribute.Text;
    add_on: Attribute.Relation<
      'api::add-on-content.add-on-content',
      'manyToOne',
      'api::add-on.add-on'
    >;
    orders: Attribute.Relation<
      'api::add-on-content.add-on-content',
      'oneToOne',
      'api::add-on-order.add-on-order'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::add-on-content.add-on-content',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::add-on-content.add-on-content',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAddOnOrderAddOnOrder extends Schema.CollectionType {
  collectionName: 'add_on_orders';
  info: {
    singularName: 'add-on-order';
    pluralName: 'add-on-orders';
    displayName: 'Add-On: Orders';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    add_on_content: Attribute.Relation<
      'api::add-on-order.add-on-order',
      'oneToOne',
      'api::add-on-content.add-on-content'
    >;
    users_permissions_user: Attribute.Relation<
      'api::add-on-order.add-on-order',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    price: Attribute.Decimal;
    purchased_at: Attribute.DateTime;
    expires_at: Attribute.DateTime;
    is_active: Attribute.Boolean &
      Attribute.Required &
      Attribute.DefaultTo<true>;
    razorpay_payment_id: Attribute.String;
    razorpay_order_id: Attribute.String;
    razorpay_signature: Attribute.String;
    price_at_purchase: Attribute.Decimal & Attribute.Required;
    commission_percentage_applied: Attribute.Decimal & Attribute.Required;
    commission_amount: Attribute.Decimal & Attribute.Required;
    total_paid: Attribute.Decimal & Attribute.Required;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::add-on-order.add-on-order',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::add-on-order.add-on-order',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiAnswerAnswer extends Schema.CollectionType {
  collectionName: 'answers';
  info: {
    singularName: 'answer';
    pluralName: 'answers';
    displayName: 'Answer';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    student: Attribute.Relation<
      'api::answer.answer',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    submission_type: Attribute.Enumeration<['online', 'offline', 'hybrid']> &
      Attribute.DefaultTo<'online'>;
    marks: Attribute.Decimal;
    question_n_answer: Attribute.Component<
      'question-bank.question-n-answer',
      true
    >;
    uploaded_answer_sheet: Attribute.Media<'images' | 'files'>;
    submission_date: Attribute.DateTime;
    time_taken: Attribute.Integer;
    evaluation_status: Attribute.Enumeration<['evaluated', 'pending']> &
      Attribute.DefaultTo<'pending'>;
    student_feedback: Attribute.Text;
    tutor_feedback: Attribute.Text;
    tutor_classroom: Attribute.Relation<
      'api::answer.answer',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    test_series: Attribute.Relation<
      'api::answer.answer',
      'manyToOne',
      'api::test-serie.test-serie'
    >;
    online_answers: Attribute.JSON;
    completed: Attribute.Boolean & Attribute.Required;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::answer.answer',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::answer.answer',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiArticleArticle extends Schema.CollectionType {
  collectionName: 'articles';
  info: {
    singularName: 'article';
    pluralName: 'articles';
    displayName: 'article';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String;
    written_by: Attribute.Relation<
      'api::article.article',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    university: Attribute.Relation<
      'api::article.article',
      'manyToOne',
      'api::university.university'
    >;
    subTitle: Attribute.Text;
    readingTime: Attribute.Integer;
    permalink: Attribute.String;
    image_caption: Attribute.String;
    image_desc: Attribute.String;
    image_alt_text: Attribute.String;
    attachment_url: Attribute.String;
    categories: Attribute.String;
    seo_title: Attribute.String;
    wpseo_desc: Attribute.Text;
    estimated_reading_time_minutes: Attribute.String;
    primaryImage: Attribute.JSON;
    videos: Attribute.JSON;
    thumbnail: Attribute.String;
    tags: Attribute.JSON;
    date: Attribute.Date;
    image_title: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::article.article',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::article.article',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiClassClass extends Schema.CollectionType {
  collectionName: 'classes';
  info: {
    singularName: 'class';
    pluralName: 'classes';
    displayName: '\u2B50Lecture: Grade';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    grade: Attribute.Integer;
    grade_subjects: Attribute.Relation<
      'api::class.class',
      'oneToMany',
      'api::grade-subject.grade-subject'
    >;
    ib_programs: Attribute.Relation<
      'api::class.class',
      'manyToMany',
      'api::ib-program.ib-program'
    >;
    course_plans: Attribute.Relation<
      'api::class.class',
      'manyToMany',
      'api::course-plan.course-plan'
    >;
    is_live: Attribute.Boolean & Attribute.DefaultTo<false>;
    users: Attribute.Relation<
      'api::class.class',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::class.class',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::class.class',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiClassRequestClassRequest extends Schema.CollectionType {
  collectionName: 'class_requests';
  info: {
    singularName: 'class-request';
    pluralName: 'class-requests';
    displayName: 'class_requests';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    request_type: Attribute.Enumeration<
      ['reschedule', 'cancellation', 'extra_class']
    > &
      Attribute.Required;
    status: Attribute.Enumeration<
      ['pending', 'approved', 'rejected', 'cancelled']
    > &
      Attribute.DefaultTo<'pending'>;
    reason: Attribute.Text;
    new_schedule: Attribute.DateTime;
    live_lecture: Attribute.Relation<
      'api::class-request.class-request',
      'manyToOne',
      'api::live-lecture.live-lecture'
    >;
    tutor: Attribute.Relation<
      'api::class-request.class-request',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    classroom: Attribute.Relation<
      'api::class-request.class-request',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    processed_at: Attribute.DateTime;
    tutor_note: Attribute.Text;
    notification_sent: Attribute.Boolean & Attribute.DefaultTo<false>;
    requested_by: Attribute.Component<'requested-by.requested-by'>;
    topic: Attribute.Relation<
      'api::class-request.class-request',
      'oneToOne',
      'api::topic.topic'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::class-request.class-request',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::class-request.class-request',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCollegeCollege extends Schema.CollectionType {
  collectionName: 'colleges';
  info: {
    singularName: 'college';
    pluralName: 'colleges';
    displayName: 'College';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    college_name: Attribute.Text;
    college_type: Attribute.String;
    student_uni_applications: Attribute.Relation<
      'api::college.college',
      'oneToMany',
      'api::student-uni-application.student-uni-application'
    >;
    programs: Attribute.Relation<
      'api::college.college',
      'manyToMany',
      'api::program.program'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::college.college',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::college.college',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCommentComment extends Schema.CollectionType {
  collectionName: 'comments';
  info: {
    singularName: 'comment';
    pluralName: 'comments';
    displayName: 'Comments';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    comment: Attribute.Text;
    author: Attribute.Relation<
      'api::comment.comment',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    post: Attribute.Relation<
      'api::comment.comment',
      'manyToOne',
      'api::post.post'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::comment.comment',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::comment.comment',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCommissionSettingCommissionSetting
  extends Schema.CollectionType {
  collectionName: 'commission_settings';
  info: {
    singularName: 'commission-setting';
    pluralName: 'commission-settings';
    displayName: 'Admin: Comission Setting';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    commission_percentage: Attribute.Decimal;
    effective_from: Attribute.Date;
    is_active: Attribute.Boolean;
    system_plan: Attribute.Enumeration<['mentor', 'classroom']> &
      Attribute.Required;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::commission-setting.commission-setting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::commission-setting.commission-setting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCommunityCommunity extends Schema.CollectionType {
  collectionName: 'communities';
  info: {
    singularName: 'community';
    pluralName: 'communities';
    displayName: 'Communities';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    Name: Attribute.String;
    description: Attribute.Text;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    members: Attribute.Relation<
      'api::community.community',
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    posts: Attribute.Relation<
      'api::community.community',
      'oneToMany',
      'api::post.post'
    >;
    classroom: Attribute.Relation<
      'api::community.community',
      'oneToOne',
      'api::enrollment.enrollment'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::community.community',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::community.community',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCoursePlanCoursePlan extends Schema.CollectionType {
  collectionName: 'course_plans';
  info: {
    singularName: 'course-plan';
    pluralName: 'course-plans';
    displayName: 'Course Plan';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String;
    live_lectures: Attribute.Boolean &
      Attribute.Required &
      Attribute.DefaultTo<false>;
    recorded_lectures: Attribute.Boolean & Attribute.DefaultTo<true>;
    price: Attribute.Decimal;
    qna: Attribute.Boolean & Attribute.DefaultTo<true>;
    currency: Attribute.Enumeration<['USD', 'INR']>;
    description: Attribute.Text;
    ib_programs: Attribute.Relation<
      'api::course-plan.course-plan',
      'manyToMany',
      'api::ib-program.ib-program'
    >;
    grades: Attribute.Relation<
      'api::course-plan.course-plan',
      'manyToMany',
      'api::class.class'
    >;
    classrooms: Attribute.Relation<
      'api::course-plan.course-plan',
      'oneToMany',
      'api::enrollment.enrollment'
    >;
    tier: Attribute.Enumeration<['Basic', 'Premium', 'Advanced']>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::course-plan.course-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::course-plan.course-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCredentialCredential extends Schema.CollectionType {
  collectionName: 'credentials';
  info: {
    singularName: 'credential';
    pluralName: 'credentials';
    displayName: 'credentials';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    email_smtp: Attribute.Text;
    whatsapp_wati: Attribute.Text;
    razorpay: Attribute.Text;
    stripe: Attribute.Text;
    google_auth: Attribute.Text;
    sns_messages: Attribute.Text;
    google_meet: Attribute.Text;
    microsoft_teams: Attribute.Text;
    user: Attribute.Relation<
      'api::credential.credential',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    custom_prompt: Attribute.Text &
      Attribute.DefaultTo<'Provide direct notes for the International Baccalaureate (IB) {program_name} curriculum, Grade {grade_name}, subject: {subject_name}. Topic: {topic_name}, Subtopic: {sub_topic_name}. Please start directly with\u00A0the\u00A0content.'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::credential.credential',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::credential.credential',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDemoBookingDemoBooking extends Schema.CollectionType {
  collectionName: 'demo_bookings';
  info: {
    singularName: 'demo-booking';
    pluralName: 'demo-bookings';
    displayName: 'Demo_Booking';
    description: 'This content type is used to manage demo bookings made by students. It allows students to book demo sessions with tutors, providing details such as booking date, status, duration, and notes. The booking can be linked to a specific enrollment and grade subject.';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    student: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'plugin::users-permissions.user'
    > &
      Attribute.Required;
    booking_date: Attribute.DateTime;
    status: Attribute.Enumeration<
      ['Requested', 'Confirmed', 'Completed', 'Cancelled', 'No-show']
    > &
      Attribute.DefaultTo<'Requested'>;
    duration: Attribute.Integer & Attribute.DefaultTo<30>;
    notes: Attribute.Text;
    meeting_link: Attribute.String;
    enrollment: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'api::enrollment.enrollment'
    >;
    grade_subject: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'api::grade-subject.grade-subject'
    >;
    created_by: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    tutor: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::demo-booking.demo-booking',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDemoVideoDemoVideo extends Schema.CollectionType {
  collectionName: 'demo_videos';
  info: {
    singularName: 'demo-video';
    pluralName: 'demo-videos';
    displayName: 'Turor: Demo Video';
    description: ' This content type is used to manage demo videos created by tutors. It allows tutors to upload videos related to specific topics, providing students with additional resources for learning.';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    video: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    topic: Attribute.Relation<
      'api::demo-video.demo-video',
      'oneToOne',
      'api::subtopic.subtopic'
    >;
    tutor: Attribute.Relation<
      'api::demo-video.demo-video',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    grade_subject: Attribute.Relation<
      'api::demo-video.demo-video',
      'oneToOne',
      'api::grade-subject.grade-subject'
    >;
    classroom: Attribute.Relation<
      'api::demo-video.demo-video',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    title: Attribute.Text;
    description: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::demo-video.demo-video',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::demo-video.demo-video',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDoubtSectionDoubtSection extends Schema.CollectionType {
  collectionName: 'doubt_sections';
  info: {
    singularName: 'doubt-section';
    pluralName: 'doubt-sections';
    displayName: 'Student: Doubt Section';
    description: 'This content type is used to manage student doubts related to topics. It allows students to ask questions, attach relevant files, and link their doubts to specific topics for better organization and tracking.';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    question: Attribute.Text;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    topic: Attribute.Relation<
      'api::doubt-section.doubt-section',
      'manyToOne',
      'api::topic.topic'
    >;
    student: Attribute.Relation<
      'api::doubt-section.doubt-section',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::doubt-section.doubt-section',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::doubt-section.doubt-section',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiEnrollmentEnrollment extends Schema.CollectionType {
  collectionName: 'enrollments';
  info: {
    singularName: 'enrollment';
    pluralName: 'enrollments';
    displayName: '\u2B50Tutor: Classroom';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    enrollment_date: Attribute.Date;
    isPaid: Attribute.Boolean & Attribute.DefaultTo<true>;
    lecture_price: Attribute.Decimal & Attribute.Required;
    payment_date: Attribute.Date;
    tutor: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    students: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    classroom_name: Attribute.String;
    course_plan: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToOne',
      'api::course-plan.course-plan'
    >;
    live_lectures: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToMany',
      'api::live-lecture.live-lecture'
    >;
    tabs: Attribute.Component<'lectures.lecture-header', true>;
    recorded_lectures: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToMany',
      'api::recorded-lecture.recorded-lecture'
    >;
    topic: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToOne',
      'api::subtopic.subtopic'
    >;
    startDate: Attribute.Date & Attribute.Required;
    endDate: Attribute.Date & Attribute.Required;
    duration: Attribute.Integer;
    image: Attribute.Media<'images', true>;
    status: Attribute.Enumeration<
      ['Requested', 'Approved', 'Responded', 'Requested Demo', 'Rejected']
    > &
      Attribute.DefaultTo<'Requested'>;
    rejection_feedback: Attribute.String;
    grade_subject: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    classroom_type: Attribute.Enumeration<['one-on-one', 'group']> &
      Attribute.Required;
    group_limit: Attribute.Integer & Attribute.DefaultTo<2>;
    days: Attribute.Component<'classroom.days', true> & Attribute.Required;
    isAssist: Attribute.Boolean & Attribute.DefaultTo<false>;
    assistant: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    notifications: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToMany',
      'api::notification.notification'
    >;
    community: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'api::community.community'
    >;
    demo_video: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'api::recorded-lecture.recorded-lecture'
    >;
    ib_program: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'api::ib-program.ib-program'
    >;
    grade: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'api::class.class'
    >;
    additional_resources: Attribute.Component<'classroom.resources', true>;
    answers: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToMany',
      'api::answer.answer'
    >;
    student_notifications: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToMany',
      'api::student-notification.student-notification'
    >;
    class_schedule_requests: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToMany',
      'api::class-request.class-request'
    >;
    notices: Attribute.JSON;
    classroom_demo_videos: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToMany',
      'api::demo-video.demo-video'
    >;
    base_price: Attribute.Decimal;
    live_lecture_purchases: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToMany',
      'api::live-lecture-purchase.live-lecture-purchase'
    >;
    payments: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToMany',
      'api::payment.payment'
    >;
    lecture_count: Attribute.Integer;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiExternalUserExternalUser extends Schema.CollectionType {
  collectionName: 'external_users';
  info: {
    singularName: 'external-user';
    pluralName: 'external-users';
    displayName: 'External User';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    user: Attribute.Relation<
      'api::external-user.external-user',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    type: Attribute.Enumeration<['student_org', 'ngo', 'corporate_firm']>;
    org_details: Attribute.Component<'external-users.org-details'>;
    founder_details: Attribute.Component<'external-users.founder'>;
    position_details: Attribute.Component<'external-users.position'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::external-user.external-user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::external-user.external-user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiGradeSubjectGradeSubject extends Schema.CollectionType {
  collectionName: 'grade_subjects';
  info: {
    singularName: 'grade-subject';
    pluralName: 'grade-subjects';
    displayName: '\u2B50Lecture: Grade Subject';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    isRequired: Attribute.Boolean & Attribute.DefaultTo<true>;
    topics: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::topic.topic'
    >;
    reference_books: Attribute.Component<'subject.refrence-books', true>;
    subject: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'manyToOne',
      'api::subject.subject'
    >;
    grade: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'manyToOne',
      'api::class.class'
    >;
    name: Attribute.String;
    level: Attribute.Enumeration<['SL', 'HL', 'None']>;
    classrooms: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::enrollment.enrollment'
    >;
    recorded_lectures: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::recorded-lecture.recorded-lecture'
    >;
    is_live: Attribute.Boolean & Attribute.DefaultTo<false>;
    posts: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::post.post'
    >;
    enquiries: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::notification.notification'
    >;
    subject_group: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'manyToOne',
      'api::subject-group.subject-group'
    >;
    user_demo_classes_grade_plans: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::user-grade-plan.user-grade-plan'
    >;
    test_series: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::test-serie.test-serie'
    >;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiGstGst extends Schema.SingleType {
  collectionName: 'gsts';
  info: {
    singularName: 'gst';
    pluralName: 'gsts';
    displayName: 'gst';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    gst_rate: Attribute.Decimal;
    is_active: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::gst.gst', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::gst.gst', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiIbProgramIbProgram extends Schema.CollectionType {
  collectionName: 'ib_programs';
  info: {
    singularName: 'ib-program';
    pluralName: 'ib-programs';
    displayName: 'IB_program';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String;
    grade_range: Attribute.String;
    description: Attribute.Text;
    course_plans: Attribute.Relation<
      'api::ib-program.ib-program',
      'manyToMany',
      'api::course-plan.course-plan'
    >;
    grades: Attribute.Relation<
      'api::ib-program.ib-program',
      'manyToMany',
      'api::class.class'
    >;
    user: Attribute.Relation<
      'api::ib-program.ib-program',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    is_live: Attribute.Boolean & Attribute.DefaultTo<false>;
    subject_groups: Attribute.Relation<
      'api::ib-program.ib-program',
      'oneToMany',
      'api::subject-group.subject-group'
    >;
    add_ons: Attribute.Relation<
      'api::ib-program.ib-program',
      'oneToMany',
      'api::add-on.add-on'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::ib-program.ib-program',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::ib-program.ib-program',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiIndividualUserIndividualUser extends Schema.CollectionType {
  collectionName: 'individual_users';
  info: {
    singularName: 'individual-user';
    pluralName: 'individual-users';
    displayName: 'Individual Users';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    user: Attribute.Relation<
      'api::individual-user.individual-user',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    type: Attribute.Enumeration<['professor', 'startup_mentor']>;
    university_name: Attribute.Text;
    startup_name: Attribute.Text;
    specialization: Attribute.Text;
    industry: Attribute.Text;
    experience: Attribute.String;
    linkedin_url: Attribute.Text;
    description: Attribute.Text;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::individual-user.individual-user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::individual-user.individual-user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiLiveLectureLiveLecture extends Schema.CollectionType {
  collectionName: 'live_lectures';
  info: {
    singularName: 'live-lecture';
    pluralName: 'live-lectures';
    displayName: 'Live_Lecture';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text;
    zoom_url: Attribute.String & Attribute.Required;
    schedule: Attribute.DateTime & Attribute.Required;
    isFree: Attribute.Boolean & Attribute.DefaultTo<false>;
    price: Attribute.Decimal;
    payments: Attribute.Relation<
      'api::live-lecture.live-lecture',
      'oneToMany',
      'api::payment.payment'
    >;
    topic: Attribute.Relation<
      'api::live-lecture.live-lecture',
      'manyToOne',
      'api::topic.topic'
    >;
    classrooms: Attribute.Relation<
      'api::live-lecture.live-lecture',
      'manyToMany',
      'api::enrollment.enrollment'
    >;
    class_requests: Attribute.Relation<
      'api::live-lecture.live-lecture',
      'oneToMany',
      'api::class-request.class-request'
    >;
    is_cancelled: Attribute.Boolean & Attribute.DefaultTo<false>;
    cancellation_reason: Attribute.Text;
    is_resheduled: Attribute.Boolean;
    reschedule_count: Attribute.Integer & Attribute.DefaultTo<0>;
    allow_reschedule: Attribute.Boolean & Attribute.DefaultTo<true>;
    reschedule_deadline_hours: Attribute.Integer & Attribute.DefaultTo<24>;
    lecture_status: Attribute.Enumeration<
      ['scheduled', 'rescheduled', 'cancelled', 'completed']
    > &
      Attribute.DefaultTo<'scheduled'>;
    status_history: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::live-lecture.live-lecture',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::live-lecture.live-lecture',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiLiveLecturePurchaseLiveLecturePurchase
  extends Schema.CollectionType {
  collectionName: 'live_lecture_purchases';
  info: {
    singularName: 'live-lecture-purchase';
    pluralName: 'live-lecture-purchases';
    displayName: 'live_lecture_purchases';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    lectures_purchased: Attribute.JSON;
    purchase_date: Attribute.DateTime;
    valid_from: Attribute.Date;
    valid_until: Attribute.Date;
    is_active: Attribute.Boolean & Attribute.DefaultTo<true>;
    payment: Attribute.Relation<
      'api::live-lecture-purchase.live-lecture-purchase',
      'oneToOne',
      'api::payment.payment'
    >;
    users_permissions_user: Attribute.Relation<
      'api::live-lecture-purchase.live-lecture-purchase',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tutor_classroom: Attribute.Relation<
      'api::live-lecture-purchase.live-lecture-purchase',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::live-lecture-purchase.live-lecture-purchase',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::live-lecture-purchase.live-lecture-purchase',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiLiveLecturesMeetingLiveLecturesMeeting
  extends Schema.CollectionType {
  collectionName: 'live_lectures_meetings';
  info: {
    singularName: 'live-lectures-meeting';
    pluralName: 'live-lectures-meetings';
    displayName: 'Live_Lectures_Meeting';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    students: Attribute.Relation<
      'api::live-lectures-meeting.live-lectures-meeting',
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    tutor: Attribute.Relation<
      'api::live-lectures-meeting.live-lectures-meeting',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    live_lecture: Attribute.Relation<
      'api::live-lectures-meeting.live-lectures-meeting',
      'oneToOne',
      'api::live-lecture.live-lecture'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::live-lectures-meeting.live-lectures-meeting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::live-lectures-meeting.live-lectures-meeting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiLogLog extends Schema.CollectionType {
  collectionName: 'logs';
  info: {
    singularName: 'log';
    pluralName: 'logs';
    displayName: 'log';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    user: Attribute.Relation<
      'api::log.log',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    Action: Attribute.Enumeration<
      [
        'Login',
        'Logout',
        'Test_Taken',
        'Add_Classroom',
        'Joined_Classroom',
        'Add_Lecture',
        'Add_Live_Class'
      ]
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::log.log', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::log.log', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiMentorApplicationMentorApplication
  extends Schema.CollectionType {
  collectionName: 'mentor_applications';
  info: {
    singularName: 'mentor-application';
    pluralName: 'mentor-applications';
    displayName: 'Mentor: Mentor Applications';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    user: Attribute.Relation<
      'api::mentor-application.mentor-application',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    status: Attribute.Enumeration<['pending', 'approved']> &
      Attribute.DefaultTo<'pending'>;
    questions: Attribute.Component<'mentor.mentor-questions', true>;
    video: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::mentor-application.mentor-application',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::mentor-application.mentor-application',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiMentorAvailabilityMentorAvailability
  extends Schema.CollectionType {
  collectionName: 'mentor_availabilities';
  info: {
    singularName: 'mentor-availability';
    pluralName: 'mentor-availabilities';
    displayName: 'Mentor-Availability';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    mentor: Attribute.Relation<
      'api::mentor-availability.mentor-availability',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    setToDefault: Attribute.Boolean;
    days: Attribute.Component<'availability.day-availability', true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::mentor-availability.mentor-availability',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::mentor-availability.mentor-availability',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiMessageMessage extends Schema.CollectionType {
  collectionName: 'messages';
  info: {
    singularName: 'message';
    pluralName: 'messages';
    displayName: 'Messages';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    sender: Attribute.Relation<
      'api::message.message',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    receiver: Attribute.Relation<
      'api::message.message',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    message: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::message.message',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::message.message',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiNoteNote extends Schema.CollectionType {
  collectionName: 'notes';
  info: {
    singularName: 'note';
    pluralName: 'notes';
    displayName: 'Admin: Notes';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    prompt_status: Attribute.Enumeration<
      ['pending ', 'under_progress', 'generated']
    >;
    topics: Attribute.Relation<
      'api::note.note',
      'manyToMany',
      'api::subtopic.subtopic'
    >;
    question_banks: Attribute.Relation<
      'api::note.note',
      'oneToMany',
      'api::question-bank.question-bank'
    >;
    note: Attribute.RichText;
    recorded_lectures: Attribute.Relation<
      'api::note.note',
      'oneToMany',
      'api::recorded-lecture.recorded-lecture'
    >;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
    note_type: Attribute.Enumeration<['strapi', 'wordpress']>;
    wordpress_url: Attribute.String;
    demo_video: Attribute.Media<'videos'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::note.note', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::note.note', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiNotificationNotification extends Schema.CollectionType {
  collectionName: 'notifications';
  info: {
    singularName: 'notification';
    pluralName: 'notifications';
    displayName: 'Notifications/Enquiries';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    user: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    classrooms: Attribute.Relation<
      'api::notification.notification',
      'manyToMany',
      'api::enrollment.enrollment'
    >;
    status: Attribute.Enumeration<['Pending', 'Converted', 'Rejected']> &
      Attribute.DefaultTo<'Pending'>;
    payment_status: Attribute.Enumeration<['Failed', 'Success', 'Pending']>;
    parent_name: Attribute.String;
    parent_phonenumber: Attribute.String;
    preferred_classroom_time: Attribute.Enumeration<
      ['Morning', 'Afternoon', 'Evening']
    >;
    comment: Attribute.Text;
    conversion_history: Attribute.Component<'notification.history', true>;
    tracking_status: Attribute.Enumeration<
      [
        'New Lead',
        'Contacted',
        'Demo Booking',
        'Demo Done',
        'Demo Unattended',
        'Decision Pending 1',
        'Decision Pending 2',
        'Success',
        'Failed'
      ]
    > &
      Attribute.DefaultTo<'New Lead'>;
    demo_feedback: Attribute.Text;
    student_plan: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'api::course-plan.course-plan'
    >;
    grade_subject: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    enquiry_type: Attribute.Enumeration<['Classroom', 'Student Plan']>;
    classroom_limit: Attribute.Enumeration<['offline', 'online']>;
    classroom_type: Attribute.Enumeration<['Offline', 'Online']>;
    parent_location: Attribute.String;
    enquiryNotes: Attribute.Component<'notification.notes', true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPaymentPayment extends Schema.CollectionType {
  collectionName: 'payments';
  info: {
    singularName: 'payment';
    pluralName: 'payments';
    displayName: 'Payment';
    description: 'Manage payments for classrooms and live lectures';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    payment_type: Attribute.Enumeration<
      ['classroom_only', 'classroom_with_live', 'live_only']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'classroom_only'>;
    amount: Attribute.Decimal & Attribute.Required;
    status: Attribute.Enumeration<
      ['pending', 'completed', 'failed', 'refunded']
    > &
      Attribute.DefaultTo<'pending'>;
    student: Attribute.Relation<
      'api::payment.payment',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    razorpay_payment_id: Attribute.String;
    razorpay_order_id: Attribute.String & Attribute.Unique;
    razorpay_signature: Attribute.String;
    purchased_at: Attribute.DateTime;
    completed_at: Attribute.DateTime;
    price_at_purchase: Attribute.Decimal;
    commission_percentage_applied: Attribute.Decimal & Attribute.DefaultTo<0>;
    commission_amount: Attribute.Decimal & Attribute.DefaultTo<0>;
    gst_amount: Attribute.Decimal & Attribute.DefaultTo<0>;
    total_amount_paid: Attribute.Decimal & Attribute.Required;
    live_lectures_included: Attribute.Boolean & Attribute.DefaultTo<false>;
    live_lectures_price: Attribute.Decimal & Attribute.DefaultTo<0>;
    number_of_live_lectures: Attribute.Integer & Attribute.DefaultTo<0>;
    purchased_lectures: Attribute.JSON;
    metadata: Attribute.JSON;
    classroom: Attribute.Relation<
      'api::payment.payment',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    tutor_classroom: Attribute.Relation<
      'api::payment.payment',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::payment.payment',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::payment.payment',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPostPost extends Schema.CollectionType {
  collectionName: 'posts';
  info: {
    singularName: 'post';
    pluralName: 'posts';
    displayName: 'Posts';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    post: Attribute.Text;
    author: Attribute.Relation<
      'api::post.post',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    community: Attribute.Relation<
      'api::post.post',
      'manyToOne',
      'api::community.community'
    >;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    comments: Attribute.Relation<
      'api::post.post',
      'oneToMany',
      'api::comment.comment'
    >;
    grade_subject: Attribute.Relation<
      'api::post.post',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::post.post', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::post.post', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiPremiumPlanPremiumPlan extends Schema.CollectionType {
  collectionName: 'premium_plans';
  info: {
    singularName: 'premium-plan';
    pluralName: 'premium-plans';
    displayName: '\u2B50PremiumPlan';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text;
    type: Attribute.Enumeration<['mentor', 'counselor']> & Attribute.Required;
    price: Attribute.Decimal & Attribute.Required;
    hours_included: Attribute.Integer;
    active: Attribute.Boolean;
    user_plans: Attribute.Relation<
      'api::premium-plan.premium-plan',
      'oneToMany',
      'api::user-plan.user-plan'
    >;
    currency: Attribute.Enumeration<['INR', 'USD']>;
    created_by_user: Attribute.Relation<
      'api::premium-plan.premium-plan',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::premium-plan.premium-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::premium-plan.premium-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiProgramProgram extends Schema.CollectionType {
  collectionName: 'programs';
  info: {
    singularName: 'program';
    pluralName: 'programs';
    displayName: 'Program';
    description: '';
  };
  options: {
    draftAndPublish: true;
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
    student_uni_applications: Attribute.Relation<
      'api::program.program',
      'oneToMany',
      'api::student-uni-application.student-uni-application'
    >;
    colleges: Attribute.Relation<
      'api::program.program',
      'manyToMany',
      'api::college.college'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::program.program',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::program.program',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiProgressProgress extends Schema.CollectionType {
  collectionName: 'progresses';
  info: {
    singularName: 'progress';
    pluralName: 'progresses';
    displayName: 'Progress';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    student: Attribute.Relation<
      'api::progress.progress',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    recorded_lecture: Attribute.Relation<
      'api::progress.progress',
      'manyToOne',
      'api::recorded-lecture.recorded-lecture'
    >;
    progress: Attribute.Decimal;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::progress.progress',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::progress.progress',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiQuestionBankQuestionBank extends Schema.CollectionType {
  collectionName: 'question_banks';
  info: {
    singularName: 'question-bank';
    pluralName: 'question-banks';
    displayName: 'Question Bank';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    question: Attribute.RichText & Attribute.Required;
    content_format: Attribute.Enumeration<['html', 'markdown', 'richtext']> &
      Attribute.DefaultTo<'richtext'>;
    question_type: Attribute.Enumeration<
      [
        'mcq',
        'mcq_multiple',
        'short_answer',
        'long_answer',
        'match_columns',
        'drag_drop',
        'ranking',
        'data_interpretation',
        'multimedia'
      ]
    > &
      Attribute.Required;
    marks: Attribute.Integer & Attribute.Required;
    is_offline: Attribute.Boolean & Attribute.DefaultTo<false>;
    parts: Attribute.Component<'question-bank.parts', true>;
    test_series: Attribute.Relation<
      'api::question-bank.question-bank',
      'manyToMany',
      'api::test-serie.test-serie'
    >;
    unit: Attribute.Relation<
      'api::question-bank.question-bank',
      'oneToOne',
      'api::topic.topic'
    >;
    attachments: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    note: Attribute.Relation<
      'api::question-bank.question-bank',
      'manyToOne',
      'api::note.note'
    >;
    word_limit: Attribute.Integer;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::question-bank.question-bank',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::question-bank.question-bank',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiRecordedLectureRecordedLecture
  extends Schema.CollectionType {
  collectionName: 'recorded_lectures';
  info: {
    singularName: 'recorded-lecture';
    pluralName: 'recorded-lectures';
    displayName: '\u2B50Recorded_Lecture';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
    video: Attribute.Media<'videos'>;
    isFree: Attribute.Boolean & Attribute.DefaultTo<false>;
    price: Attribute.Decimal & Attribute.Required & Attribute.DefaultTo<0>;
    payments: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToMany',
      'api::payment.payment'
    >;
    topic: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'manyToOne',
      'api::topic.topic'
    >;
    order: Attribute.Integer;
    qna: Attribute.Component<'subtopic.qn-a', true>;
    content: Attribute.Blocks;
    thumbnail: Attribute.Media<'images'>;
    classrooms: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'manyToMany',
      'api::enrollment.enrollment'
    >;
    grade_subject: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    liked_by: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    progresses: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToMany',
      'api::progress.progress'
    >;
    isPremium: Attribute.Boolean & Attribute.DefaultTo<false>;
    note: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'manyToOne',
      'api::note.note'
    >;
    tutor: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    subtopic: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToOne',
      'api::subtopic.subtopic'
    >;
    program: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToOne',
      'api::ib-program.ib-program'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::recorded-lecture.recorded-lecture',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiResourceResource extends Schema.CollectionType {
  collectionName: 'resources';
  info: {
    singularName: 'resource';
    pluralName: 'resources';
    displayName: 'resources';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.Text;
    type: Attribute.Enumeration<['article', 'guide']>;
    context: Attribute.Enumeration<['essay', 'interview', 'financial_aid']>;
    files: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
    link: Attribute.Text;
    detail: Attribute.Text;
    mentor: Attribute.Relation<
      'api::resource.resource',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    country: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::resource.resource',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::resource.resource',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiStudentMeetingStudentMeeting extends Schema.CollectionType {
  collectionName: 'student_meetings';
  info: {
    singularName: 'student-meeting';
    pluralName: 'student-meetings';
    displayName: '\u2B50Student: Meeting';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text;
    link: Attribute.String & Attribute.Required;
    date: Attribute.Date & Attribute.Required;
    start_time: Attribute.Time & Attribute.Required;
    duration_in_minutes: Attribute.Integer &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 15;
          max: 120;
        },
        number
      >;
    student: Attribute.Relation<
      'api::student-meeting.student-meeting',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    meeting_with: Attribute.Relation<
      'api::student-meeting.student-meeting',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    user_plan: Attribute.Relation<
      'api::student-meeting.student-meeting',
      'manyToOne',
      'api::user-plan.user-plan'
    >;
    status: Attribute.Enumeration<
      ['scheduled', 'in_progress', 'completed', 'canceled', 'no_show']
    > &
      Attribute.DefaultTo<'scheduled'>;
    meeting_notes: Attribute.Text;
    admin_transaction_out: Attribute.Relation<
      'api::student-meeting.student-meeting',
      'oneToOne',
      'api::transaction-out.transaction-out'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::student-meeting.student-meeting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::student-meeting.student-meeting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiStudentNotificationStudentNotification
  extends Schema.CollectionType {
  collectionName: 'student_notifications';
  info: {
    singularName: 'student-notification';
    pluralName: 'student-notifications';
    displayName: 'student-notification';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    message: Attribute.Text;
    type: Attribute.Enumeration<
      [
        'class_schedule',
        'new_content',
        'announcement',
        'grade_update',
        'assignment',
        'reminder',
        'system'
      ]
    > &
      Attribute.Required &
      Attribute.DefaultTo<'announcement'>;
    student: Attribute.Relation<
      'api::student-notification.student-notification',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    classroom: Attribute.Relation<
      'api::student-notification.student-notification',
      'manyToOne',
      'api::enrollment.enrollment'
    >;
    related_entity: Attribute.String;
    related_entity_id: Attribute.String;
    is_read: Attribute.Boolean &
      Attribute.Required &
      Attribute.DefaultTo<false>;
    is_archived: Attribute.Boolean &
      Attribute.Required &
      Attribute.DefaultTo<false>;
    action_url: Attribute.String;
    metadata: Attribute.JSON;
    scheduled_time: Attribute.DateTime;
    priority: Attribute.Enumeration<['low', 'medium', 'high', 'urgent']>;
    users_permissions_user: Attribute.Relation<
      'api::student-notification.student-notification',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::student-notification.student-notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::student-notification.student-notification',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiStudentUniApplicationStudentUniApplication
  extends Schema.CollectionType {
  collectionName: 'student_uni_applications';
  info: {
    singularName: 'student-uni-application';
    pluralName: 'student-uni-applications';
    displayName: 'studentUniApplication';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    student: Attribute.Relation<
      'api::student-uni-application.student-uni-application',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    status: Attribute.Enumeration<
      ['dream', 'target', 'safety', 'reach', 'others']
    >;
    progress: Attribute.Integer;
    universityDecision: Attribute.Enumeration<
      ['Pending', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred']
    >;
    Deadline: Attribute.Date;
    Category: Attribute.Enumeration<['Submitted', 'In Progress', 'Rejected']>;
    university: Attribute.Relation<
      'api::student-uni-application.student-uni-application',
      'manyToOne',
      'api::university.university'
    >;
    college: Attribute.Relation<
      'api::student-uni-application.student-uni-application',
      'manyToOne',
      'api::college.college'
    >;
    applicationcycle: Attribute.Component<
      'university.application-cycle-deadline',
      true
    >;
    program: Attribute.Relation<
      'api::student-uni-application.student-uni-application',
      'manyToOne',
      'api::program.program'
    >;
    personalstatementessay: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    whyusessay: Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
    activityessay: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    lor: Attribute.Component<'lor.lor', true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::student-uni-application.student-uni-application',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::student-uni-application.student-uni-application',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSubjectSubject extends Schema.CollectionType {
  collectionName: 'subjects';
  info: {
    singularName: 'subject';
    pluralName: 'subjects';
    displayName: 'Subject';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String;
    grade_subjects: Attribute.Relation<
      'api::subject.subject',
      'oneToMany',
      'api::grade-subject.grade-subject'
    >;
    description: Attribute.Text;
    image: Attribute.Media<'images', true>;
    users_fav_subject: Attribute.Relation<
      'api::subject.subject',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    subject_group: Attribute.String;
    user: Attribute.Relation<
      'api::subject.subject',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::subject.subject',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::subject.subject',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSubjectGroupSubjectGroup extends Schema.CollectionType {
  collectionName: 'subject_groups';
  info: {
    singularName: 'subject-group';
    pluralName: 'subject-groups';
    displayName: 'Subject_Group';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ib_program: Attribute.Relation<
      'api::subject-group.subject-group',
      'manyToOne',
      'api::ib-program.ib-program'
    >;
    name: Attribute.String;
    description: Attribute.Text;
    grade_subjects: Attribute.Relation<
      'api::subject-group.subject-group',
      'oneToMany',
      'api::grade-subject.grade-subject'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::subject-group.subject-group',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::subject-group.subject-group',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSubtopicSubtopic extends Schema.CollectionType {
  collectionName: 'subtopics';
  info: {
    singularName: 'subtopic';
    pluralName: 'subtopics';
    displayName: '\u2B50Lectures: sub-topics';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String;
    topic: Attribute.Relation<
      'api::subtopic.subtopic',
      'manyToOne',
      'api::topic.topic'
    >;
    headings: Attribute.Component<'subtopic.heading', true>;
    notes: Attribute.Relation<
      'api::subtopic.subtopic',
      'manyToMany',
      'api::note.note'
    >;
    classrooms: Attribute.Relation<
      'api::subtopic.subtopic',
      'oneToMany',
      'api::enrollment.enrollment'
    >;
    thumbnail: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::subtopic.subtopic',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::subtopic.subtopic',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSupportTicketSupportTicket extends Schema.CollectionType {
  collectionName: 'support_tickets';
  info: {
    singularName: 'support-ticket';
    pluralName: 'support-tickets';
    displayName: 'Support Ticket';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text & Attribute.Required;
    media: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    type: Attribute.Enumeration<['technical', 'non-technical']> &
      Attribute.Required;
    admin_message: Attribute.Text;
    status: Attribute.Enumeration<
      [
        'New',
        'Open',
        'In Progress',
        'Waiting on Customer',
        'Resolved',
        'Closed'
      ]
    > &
      Attribute.Required &
      Attribute.DefaultTo<'New'>;
    admin_media: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    user: Attribute.Relation<
      'api::support-ticket.support-ticket',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::support-ticket.support-ticket',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::support-ticket.support-ticket',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTaskTask extends Schema.CollectionType {
  collectionName: 'tasks';
  info: {
    singularName: 'task';
    pluralName: 'tasks';
    displayName: '\u2B50tasks';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.Text & Attribute.Required;
    status: Attribute.Enumeration<['not_started', 'in_progress', 'completed']> &
      Attribute.DefaultTo<'not_started'>;
    date: Attribute.DateTime;
    time: Attribute.Time;
    description: Attribute.Text;
    user: Attribute.Relation<
      'api::task.task',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    student: Attribute.Relation<
      'api::task.task',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    university: Attribute.Relation<
      'api::task.task',
      'manyToOne',
      'api::university.university'
    >;
    progress: Attribute.Integer &
      Attribute.SetMinMax<
        {
          max: 100;
        },
        number
      > &
      Attribute.DefaultTo<0>;
    priority: Attribute.Enumeration<['low', 'medium', 'high', 'critical']> &
      Attribute.DefaultTo<'low'>;
    taskCategory: Attribute.Enumeration<
      [
        'essay',
        'academics',
        'interview',
        'financial-ain-consultation',
        'lor',
        'others'
      ]
    > &
      Attribute.Required;
    isImportant: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::task.task', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::task.task', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiTestTest extends Schema.SingleType {
  collectionName: 'tests';
  info: {
    singularName: 'test';
    pluralName: 'tests';
    displayName: 'Test';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    Test: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::test.test', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::test.test', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiTestSerieTestSerie extends Schema.CollectionType {
  collectionName: 'test_series';
  info: {
    singularName: 'test-serie';
    pluralName: 'test-series';
    displayName: 'Test Series';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    program_type: Attribute.Enumeration<
      ['IB_PYP', 'IB_MYP', 'IB_DP', 'AP', 'SAT', 'ACT', 'AS_A_LEVELS', 'IGCSE']
    >;
    test_mode: Attribute.Enumeration<['online', 'offline', 'hybrid']> &
      Attribute.Required &
      Attribute.DefaultTo<'online'>;
    test_type: Attribute.Enumeration<['Practice Test', 'Test Series']>;
    year: Attribute.Integer;
    test_duration: Attribute.Decimal;
    instructions: Attribute.RichText;
    allowed_question_types: Attribute.JSON;
    grade_subject: Attribute.Relation<
      'api::test-serie.test-serie',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    pass_mark: Attribute.Decimal;
    question_banks: Attribute.Relation<
      'api::test-serie.test-serie',
      'manyToMany',
      'api::question-bank.question-bank'
    >;
    test_papers: Attribute.Media<'images' | 'files', true>;
    is_global: Attribute.Boolean & Attribute.DefaultTo<false>;
    title: Attribute.String;
    answers: Attribute.Relation<
      'api::test-serie.test-serie',
      'oneToMany',
      'api::answer.answer'
    >;
    formula_booklet: Attribute.Media<'images' | 'files', true>;
    instruction_booklet: Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::test-serie.test-serie',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::test-serie.test-serie',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiThirdPartyMeetingThirdPartyMeeting
  extends Schema.CollectionType {
  collectionName: 'third_party_meetings';
  info: {
    singularName: 'third-party-meeting';
    pluralName: 'third-party-meetings';
    displayName: 'Third Party Meetings';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.Text;
    date: Attribute.Date;
    time: Attribute.Time;
    description: Attribute.Text;
    meeting_link: Attribute.String;
    student: Attribute.Relation<
      'api::third-party-meeting.third-party-meeting',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    mentor: Attribute.Relation<
      'api::third-party-meeting.third-party-meeting',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::third-party-meeting.third-party-meeting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::third-party-meeting.third-party-meeting',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiThirdPartyOfferingThirdPartyOffering
  extends Schema.CollectionType {
  collectionName: 'third_party_offerings';
  info: {
    singularName: 'third-party-offering';
    pluralName: 'third-party-offerings';
    displayName: '\u2B50Third Party Offering';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
    eligibility: Attribute.Text;
    startDate: Attribute.Date;
    endDate: Attribute.Date;
    weekly_time_commitment: Attribute.Decimal;
    total_duration: Attribute.Decimal;
    compensation: Attribute.Text;
    Location: Attribute.String;
    selection_process: Attribute.Text;
    benefits: Attribute.JSON;
    application_process: Attribute.JSON;
    created_by_user: Attribute.Relation<
      'api::third-party-offering.third-party-offering',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    tp_applicants: Attribute.Relation<
      'api::third-party-offering.third-party-offering',
      'oneToMany',
      'api::tp-applicant.tp-applicant'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::third-party-offering.third-party-offering',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::third-party-offering.third-party-offering',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTopicTopic extends Schema.CollectionType {
  collectionName: 'topics';
  info: {
    singularName: 'topic';
    pluralName: 'topics';
    displayName: 'Lectures: Units';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.String;
    subtopics: Attribute.Relation<
      'api::topic.topic',
      'oneToMany',
      'api::subtopic.subtopic'
    >;
    recorded_lectures: Attribute.Relation<
      'api::topic.topic',
      'oneToMany',
      'api::recorded-lecture.recorded-lecture'
    >;
    live_lectures: Attribute.Relation<
      'api::topic.topic',
      'oneToMany',
      'api::live-lecture.live-lecture'
    >;
    fav_users: Attribute.Relation<
      'api::topic.topic',
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    grade_subject: Attribute.Relation<
      'api::topic.topic',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    isPaid: Attribute.Boolean & Attribute.DefaultTo<true>;
    doubt_sections: Attribute.Relation<
      'api::topic.topic',
      'oneToMany',
      'api::doubt-section.doubt-section'
    >;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::topic.topic',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::topic.topic',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTpApplicantTpApplicant extends Schema.CollectionType {
  collectionName: 'tp_applicants';
  info: {
    singularName: 'tp-applicant';
    pluralName: 'tp-applicants';
    displayName: 'tp-applicants';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    applied_by: Attribute.Relation<
      'api::tp-applicant.tp-applicant',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    third_party_offering: Attribute.Relation<
      'api::tp-applicant.tp-applicant',
      'manyToOne',
      'api::third-party-offering.third-party-offering'
    >;
    is_accepted: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::tp-applicant.tp-applicant',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::tp-applicant.tp-applicant',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTransactionOutTransactionOut extends Schema.CollectionType {
  collectionName: 'transaction_outs';
  info: {
    singularName: 'transaction-out';
    pluralName: 'transaction-outs';
    displayName: 'Admin: Transaction Out';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    student_meeting: Attribute.Relation<
      'api::transaction-out.transaction-out',
      'oneToOne',
      'api::student-meeting.student-meeting'
    >;
    meeting_scheduled_with: Attribute.Relation<
      'api::transaction-out.transaction-out',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    user_plan: Attribute.Relation<
      'api::transaction-out.transaction-out',
      'manyToOne',
      'api::user-plan.user-plan'
    >;
    transaction_date: Attribute.DateTime;
    amount: Attribute.Decimal;
    currency: Attribute.Enumeration<['INR', 'USD']>;
    duration_minutes: Attribute.Integer;
    payment_status: Attribute.Enumeration<
      ['pending', 'processing', 'paid', 'failed']
    > &
      Attribute.DefaultTo<'pending'>;
    payment_reference: Attribute.String;
    payment_method: Attribute.String;
    notes: Attribute.Text;
    calculated_rate_per_minute: Attribute.Decimal;
    total_plan_minutes: Attribute.Decimal;
    total_plan_amount: Attribute.Decimal;
    commission_deducted: Attribute.Decimal;
    net_amount: Attribute.Decimal;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::transaction-out.transaction-out',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::transaction-out.transaction-out',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTutorPlanTutorPlan extends Schema.CollectionType {
  collectionName: 'tutor_plans';
  info: {
    singularName: 'tutor-plan';
    pluralName: 'tutor-plans';
    displayName: '\u2B50tutorPlan';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    recorded_lectures: Attribute.Integer;
    live_lectures: Attribute.Integer;
    classrooms: Attribute.Integer;
    name: Attribute.String;
    tier: Attribute.Enumeration<['gold', 'silver', 'bronze']>;
    users: Attribute.Relation<
      'api::tutor-plan.tutor-plan',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::tutor-plan.tutor-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::tutor-plan.tutor-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTutorsTutors extends Schema.SingleType {
  collectionName: 'dynamic_tutors';
  info: {
    singularName: 'tutors';
    pluralName: 'dynamic-tutors';
    displayName: 'Dynamic tutors';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    hero_description: Attribute.Text;
    Why_Tychr: Attribute.Component<'why-tychr.why-tychr', true>;
    result_year: Attribute.String;
    stand_out: Attribute.Component<'stand-out.stand-out', true>;
    tutors: Attribute.Component<'certified-tutors.certified-tutors', true>;
    how_it_works: Attribute.Component<'how-it-works.how-it-works', true>;
    finest_tutors: Attribute.Component<'finest-tutors.finest-tutors', true>;
    faq: Attribute.Component<'faq-section.faq', true>;
    blog: Attribute.Component<'blog-section.blog', true>;
    stats: Attribute.Component<'stats.stats', true>;
    achievers: Attribute.Component<'achievers.achiever', true>;
    results_data: Attribute.Component<'results-data.results-data', true>;
    free_resources: Attribute.Component<'free-resources.free-resourced'>;
    subject_excellence: Attribute.Component<'subject-excellence.subject-excellence'>;
    students_by_subjects: Attribute.Component<
      'students-by-subjects.student-by-subjects',
      true
    >;
    claims: Attribute.Component<'claims.claims', true>;
    best_tutors: Attribute.Component<'best-tutors.best-tutors'>;
    elite_tutors: Attribute.Component<'claims.claims', true>;
    learn_and_repeat: Attribute.Component<'claims.claims', true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::tutors.tutors',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::tutors.tutors',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiTutorsWebsiteTutorsWebsite extends Schema.CollectionType {
  collectionName: 'tutors_websites';
  info: {
    singularName: 'tutors-website';
    pluralName: 'tutors-websites';
    displayName: 'tutors-website';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    city: Attribute.String;
    name: Attribute.String;
    hero_title: Attribute.String;
    hero_description: Attribute.Text;
    tutor_type: Attribute.Enumeration<['IB', 'AP', 'SAT', 'IGCSE']>;
    is_myp: Attribute.Boolean & Attribute.DefaultTo<false>;
    subject: Attribute.String;
    ap_future: Attribute.Component<'ap-future.ap-future'>;
    ap_top_colleges: Attribute.Component<'ap-colleges.ap-colleges'>;
    top_colleges: Attribute.Component<'top-colleges.top-colleges', true>;
    ig_paper_structure: Attribute.Component<
      'ig-paper-structure.igcse-paper-structure',
      true
    >;
    semesters: Attribute.Component<'semesters.semesters', true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::tutors-website.tutors-website',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::tutors-website.tutors-website',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUniversityUniversity extends Schema.CollectionType {
  collectionName: 'universities';
  info: {
    singularName: 'university';
    pluralName: 'universities';
    displayName: 'Admin: university';
    description: 'Admin will add universities';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    essays: Attribute.Component<'essays.essay', true>;
    intakes: Attribute.Component<'cycles.cycle', true>;
    basic: Attribute.Component<'university.basic-info'>;
    stats: Attribute.Component<'university.key-stats'>;
    global_ranking: Attribute.Component<'university.global-ranking'>;
    subject_ranking: Attribute.Component<'university.subject-ranking'>;
    overview: Attribute.Component<'university.overview'>;
    lors: Attribute.Component<'university.lor', true>;
    admission_requirements: Attribute.Component<'university.admission-requirements'>;
    tution_fees: Attribute.Component<'university.tution-fees'>;
    financial_aids: Attribute.Component<'university.financial-aids'>;
    additional_costs: Attribute.Component<'university.additional-costs'>;
    student_application_tasks: Attribute.Relation<
      'api::university.university',
      'oneToMany',
      'api::task.task'
    >;
    university_articles: Attribute.Relation<
      'api::university.university',
      'oneToMany',
      'api::article.article'
    >;
    student_uni_applications: Attribute.Relation<
      'api::university.university',
      'oneToMany',
      'api::student-uni-application.student-uni-application'
    >;
    colleges: Attribute.Relation<
      'api::university.university',
      'oneToMany',
      'api::college.college'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::university.university',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::university.university',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserGradePlanUserGradePlan extends Schema.CollectionType {
  collectionName: 'user_grade_plans';
  info: {
    singularName: 'user-grade-plan';
    pluralName: 'user-grade-plans';
    displayName: '\u2B50Student: Demo Classes (Grade) Plan';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    grade_subject: Attribute.Relation<
      'api::user-grade-plan.user-grade-plan',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    student: Attribute.Relation<
      'api::user-grade-plan.user-grade-plan',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    expires_at: Attribute.DateTime;
    purchased_at: Attribute.DateTime;
    status: Attribute.Enumeration<['active', 'expired', 'used_up']> &
      Attribute.DefaultTo<'active'>;
    razorpay_payment_id: Attribute.String;
    razorpay_order_id: Attribute.String;
    razorpay_signature: Attribute.String;
    price_at_purchase: Attribute.Decimal & Attribute.Required;
    commission_percentage_applied: Attribute.Decimal & Attribute.Required;
    commission_amount: Attribute.Decimal & Attribute.Required;
    total_paid: Attribute.Decimal & Attribute.Required;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-grade-plan.user-grade-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::user-grade-plan.user-grade-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiUserPlanUserPlan extends Schema.CollectionType {
  collectionName: 'user_plans';
  info: {
    singularName: 'user-plan';
    pluralName: 'user-plans';
    displayName: '\u2B50Student: UserPlan';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    student: Attribute.Relation<
      'api::user-plan.user-plan',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    premium_plan: Attribute.Relation<
      'api::user-plan.user-plan',
      'manyToOne',
      'api::premium-plan.premium-plan'
    >;
    remaining_hours: Attribute.Decimal;
    expires_at: Attribute.DateTime;
    purchased_at: Attribute.DateTime;
    status: Attribute.Enumeration<['active', 'expired', 'used_up']> &
      Attribute.DefaultTo<'active'>;
    razorpay_payment_id: Attribute.String;
    razorpay_order_id: Attribute.String;
    razorpay_signature: Attribute.String;
    price_at_purchase: Attribute.Decimal & Attribute.Required;
    commission_percentage_applied: Attribute.Decimal & Attribute.Required;
    commission_amount: Attribute.Decimal & Attribute.Required;
    total_paid: Attribute.Decimal & Attribute.Required;
    student_meetings: Attribute.Relation<
      'api::user-plan.user-plan',
      'oneToMany',
      'api::student-meeting.student-meeting'
    >;
    admin_transaction_outs: Attribute.Relation<
      'api::user-plan.user-plan',
      'oneToMany',
      'api::transaction-out.transaction-out'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::user-plan.user-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::user-plan.user-plan',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiWhatsNewWhatsNew extends Schema.CollectionType {
  collectionName: 'whats_news';
  info: {
    singularName: 'whats-new';
    pluralName: 'whats-news';
    displayName: 'whats-new';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    text: Attribute.Text;
    heading: Attribute.Text;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::whats-new.whats-new',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::whats-new.whats-new',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::permission': AdminPermission;
      'admin::user': AdminUser;
      'admin::role': AdminRole;
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::chartbrew.chartbrew': PluginChartbrewChartbrew;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
      'api::add-on.add-on': ApiAddOnAddOn;
      'api::add-on-content.add-on-content': ApiAddOnContentAddOnContent;
      'api::add-on-order.add-on-order': ApiAddOnOrderAddOnOrder;
      'api::answer.answer': ApiAnswerAnswer;
      'api::article.article': ApiArticleArticle;
      'api::class.class': ApiClassClass;
      'api::class-request.class-request': ApiClassRequestClassRequest;
      'api::college.college': ApiCollegeCollege;
      'api::comment.comment': ApiCommentComment;
      'api::commission-setting.commission-setting': ApiCommissionSettingCommissionSetting;
      'api::community.community': ApiCommunityCommunity;
      'api::course-plan.course-plan': ApiCoursePlanCoursePlan;
      'api::credential.credential': ApiCredentialCredential;
      'api::demo-booking.demo-booking': ApiDemoBookingDemoBooking;
      'api::demo-video.demo-video': ApiDemoVideoDemoVideo;
      'api::doubt-section.doubt-section': ApiDoubtSectionDoubtSection;
      'api::enrollment.enrollment': ApiEnrollmentEnrollment;
      'api::external-user.external-user': ApiExternalUserExternalUser;
      'api::grade-subject.grade-subject': ApiGradeSubjectGradeSubject;
      'api::gst.gst': ApiGstGst;
      'api::ib-program.ib-program': ApiIbProgramIbProgram;
      'api::individual-user.individual-user': ApiIndividualUserIndividualUser;
      'api::live-lecture.live-lecture': ApiLiveLectureLiveLecture;
      'api::live-lecture-purchase.live-lecture-purchase': ApiLiveLecturePurchaseLiveLecturePurchase;
      'api::live-lectures-meeting.live-lectures-meeting': ApiLiveLecturesMeetingLiveLecturesMeeting;
      'api::log.log': ApiLogLog;
      'api::mentor-application.mentor-application': ApiMentorApplicationMentorApplication;
      'api::mentor-availability.mentor-availability': ApiMentorAvailabilityMentorAvailability;
      'api::message.message': ApiMessageMessage;
      'api::note.note': ApiNoteNote;
      'api::notification.notification': ApiNotificationNotification;
      'api::payment.payment': ApiPaymentPayment;
      'api::post.post': ApiPostPost;
      'api::premium-plan.premium-plan': ApiPremiumPlanPremiumPlan;
      'api::program.program': ApiProgramProgram;
      'api::progress.progress': ApiProgressProgress;
      'api::question-bank.question-bank': ApiQuestionBankQuestionBank;
      'api::recorded-lecture.recorded-lecture': ApiRecordedLectureRecordedLecture;
      'api::resource.resource': ApiResourceResource;
      'api::student-meeting.student-meeting': ApiStudentMeetingStudentMeeting;
      'api::student-notification.student-notification': ApiStudentNotificationStudentNotification;
      'api::student-uni-application.student-uni-application': ApiStudentUniApplicationStudentUniApplication;
      'api::subject.subject': ApiSubjectSubject;
      'api::subject-group.subject-group': ApiSubjectGroupSubjectGroup;
      'api::subtopic.subtopic': ApiSubtopicSubtopic;
      'api::support-ticket.support-ticket': ApiSupportTicketSupportTicket;
      'api::task.task': ApiTaskTask;
      'api::test.test': ApiTestTest;
      'api::test-serie.test-serie': ApiTestSerieTestSerie;
      'api::third-party-meeting.third-party-meeting': ApiThirdPartyMeetingThirdPartyMeeting;
      'api::third-party-offering.third-party-offering': ApiThirdPartyOfferingThirdPartyOffering;
      'api::topic.topic': ApiTopicTopic;
      'api::tp-applicant.tp-applicant': ApiTpApplicantTpApplicant;
      'api::transaction-out.transaction-out': ApiTransactionOutTransactionOut;
      'api::tutor-plan.tutor-plan': ApiTutorPlanTutorPlan;
      'api::tutors.tutors': ApiTutorsTutors;
      'api::tutors-website.tutors-website': ApiTutorsWebsiteTutorsWebsite;
      'api::university.university': ApiUniversityUniversity;
      'api::user-grade-plan.user-grade-plan': ApiUserGradePlanUserGradePlan;
      'api::user-plan.user-plan': ApiUserPlanUserPlan;
      'api::whats-new.whats-new': ApiWhatsNewWhatsNew;
    }
  }
}
