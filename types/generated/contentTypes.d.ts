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
      'oneToOne',
      'api::class.class'
    >;
    teaching: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToMany',
      'api::enrollment.enrollment'
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
    test_series: Attribute.Relation<
      'api::answer.answer',
      'manyToOne',
      'api::test-serie.test-serie'
    >;
    marks: Attribute.Decimal;
    question_n_answer: Attribute.Component<
      'question-bank.question-n-answer',
      true
    >;
    evaluation_status: Attribute.Enumeration<
      ['Completed', 'Need to Evaluate']
    > &
      Attribute.DefaultTo<'Need to Evaluate'>;
    student_feedback: Attribute.Text;
    tutor_feedback: Attribute.Text;
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

export interface ApiClassClass extends Schema.CollectionType {
  collectionName: 'classes';
  info: {
    singularName: 'class';
    pluralName: 'classes';
    displayName: 'Grade';
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
    user: Attribute.Relation<
      'api::class.class',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    is_live: Attribute.Boolean & Attribute.DefaultTo<false>;
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

export interface ApiDoubtSectionDoubtSection extends Schema.CollectionType {
  collectionName: 'doubt_sections';
  info: {
    singularName: 'doubt-section';
    pluralName: 'doubt-sections';
    displayName: 'Doubt_Section';
    description: '';
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
    displayName: 'Classroom';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    enrollment_date: Attribute.Date;
    isPaid: Attribute.Boolean & Attribute.DefaultTo<true>;
    payment_amount: Attribute.Decimal;
    payment_date: Attribute.Date;
    tutors: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToMany',
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
    topics: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToMany',
      'api::topic.topic'
    >;
    startDate: Attribute.Date;
    endDate: Attribute.Date;
    duration: Attribute.Integer;
    image: Attribute.Media<'images', true>;
    status: Attribute.Enumeration<['Pending', 'Approved']>;
    grade_subject: Attribute.Relation<
      'api::enrollment.enrollment',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    classroom_type: Attribute.Enumeration<['one-on-one', 'group']>;
    group_limit: Attribute.Integer & Attribute.DefaultTo<10>;
    notification: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'api::notification.notification'
    >;
    days: Attribute.Component<'classroom.days', true>;
    isAssist: Attribute.Boolean & Attribute.DefaultTo<false>;
    assistant: Attribute.Relation<
      'api::enrollment.enrollment',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    demo_booking_time: Attribute.Component<
      'notification.demo-booking-time',
      true
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
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

export interface ApiGradeSubjectGradeSubject extends Schema.CollectionType {
  collectionName: 'grade_subjects';
  info: {
    singularName: 'grade-subject';
    pluralName: 'grade-subjects';
    displayName: 'Grade Subject';
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
    subject_group: Attribute.String;
    test_series: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::test-serie.test-serie'
    >;
    recorded_lectures: Attribute.Relation<
      'api::grade-subject.grade-subject',
      'oneToMany',
      'api::recorded-lecture.recorded-lecture'
    >;
    is_live: Attribute.Boolean & Attribute.DefaultTo<false>;
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

export interface ApiIbProgramIbProgram extends Schema.CollectionType {
  collectionName: 'ib_programs';
  info: {
    singularName: 'ib-program';
    pluralName: 'ib-programs';
    displayName: 'IB_program';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    name: Attribute.Enumeration<
      ['PYP', 'MYP', 'DP', 'consulting', 'IGCSE', 'AS/A Levels', 'SAT/ACT/AP']
    >;
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
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
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
    title: Attribute.String;
    description: Attribute.Text;
    zoom_url: Attribute.String;
    schedule: Attribute.DateTime;
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
    displayName: 'Notes';
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
    displayName: 'Enquiries';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    user: Attribute.Relation<
      'api::notification.notification',
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    classroom: Attribute.Relation<
      'api::notification.notification',
      'oneToOne',
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
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
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
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amount: Attribute.Decimal;
    live_lecture: Attribute.Relation<
      'api::payment.payment',
      'manyToOne',
      'api::live-lecture.live-lecture'
    >;
    recorded_lecture: Attribute.Relation<
      'api::payment.payment',
      'manyToOne',
      'api::recorded-lecture.recorded-lecture'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
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
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::post.post', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::post.post', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiQnAQnA extends Schema.CollectionType {
  collectionName: 'qn_as';
  info: {
    singularName: 'qn-a';
    pluralName: 'qn-as';
    displayName: 'QnA';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    users: Attribute.Relation<
      'api::qn-a.qn-a',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    attachment: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    grade_subject: Attribute.Relation<
      'api::qn-a.qn-a',
      'oneToOne',
      'api::grade-subject.grade-subject'
    >;
    post: Attribute.Relation<'api::qn-a.qn-a', 'oneToOne', 'api::post.post'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::qn-a.qn-a', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::qn-a.qn-a', 'oneToOne', 'admin::user'> &
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
    draftAndPublish: true;
  };
  attributes: {
    marks: Attribute.Integer;
    parts: Attribute.Component<'question-bank.parts', true>;
    title: Attribute.String;
    question: Attribute.RichText;
    note: Attribute.Relation<
      'api::question-bank.question-bank',
      'manyToOne',
      'api::note.note'
    >;
    test_series: Attribute.Relation<
      'api::question-bank.question-bank',
      'manyToMany',
      'api::test-serie.test-serie'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
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
    displayName: 'Recorded_Lecture';
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
    price: Attribute.Decimal;
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

export interface ApiSubtopicSubtopic extends Schema.CollectionType {
  collectionName: 'subtopics';
  info: {
    singularName: 'subtopic';
    pluralName: 'subtopics';
    displayName: 'Topics';
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

export interface ApiTestSerieTestSerie extends Schema.CollectionType {
  collectionName: 'test_series';
  info: {
    singularName: 'test-serie';
    pluralName: 'test-series';
    displayName: 'Test_Serie';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    grade_subject: Attribute.Relation<
      'api::test-serie.test-serie',
      'manyToOne',
      'api::grade-subject.grade-subject'
    >;
    title: Attribute.String;
    test_duration: Attribute.Integer;
    pass_mark: Attribute.Integer;
    question_banks: Attribute.Relation<
      'api::test-serie.test-serie',
      'manyToMany',
      'api::question-bank.question-bank'
    >;
    test_type: Attribute.Enumeration<['Practice Test', 'Test Series']>;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    year: Attribute.Integer;
    answers: Attribute.Relation<
      'api::test-serie.test-serie',
      'oneToMany',
      'api::answer.answer'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
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

export interface ApiTopicTopic extends Schema.CollectionType {
  collectionName: 'topics';
  info: {
    singularName: 'topic';
    pluralName: 'topics';
    displayName: 'Units';
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
    classrooms: Attribute.Relation<
      'api::topic.topic',
      'manyToMany',
      'api::enrollment.enrollment'
    >;
    isPaid: Attribute.Boolean & Attribute.DefaultTo<true>;
    doubt_sections: Attribute.Relation<
      'api::topic.topic',
      'oneToMany',
      'api::doubt-section.doubt-section'
    >;
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

export interface ApiTutorPlanTutorPlan extends Schema.CollectionType {
  collectionName: 'tutor_plans';
  info: {
    singularName: 'tutor-plan';
    pluralName: 'tutor-plans';
    displayName: 'tutorPlan';
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
      'api::answer.answer': ApiAnswerAnswer;
      'api::class.class': ApiClassClass;
      'api::comment.comment': ApiCommentComment;
      'api::community.community': ApiCommunityCommunity;
      'api::course-plan.course-plan': ApiCoursePlanCoursePlan;
      'api::doubt-section.doubt-section': ApiDoubtSectionDoubtSection;
      'api::enrollment.enrollment': ApiEnrollmentEnrollment;
      'api::grade-subject.grade-subject': ApiGradeSubjectGradeSubject;
      'api::ib-program.ib-program': ApiIbProgramIbProgram;
      'api::live-lecture.live-lecture': ApiLiveLectureLiveLecture;
      'api::message.message': ApiMessageMessage;
      'api::note.note': ApiNoteNote;
      'api::notification.notification': ApiNotificationNotification;
      'api::payment.payment': ApiPaymentPayment;
      'api::post.post': ApiPostPost;
      'api::qn-a.qn-a': ApiQnAQnA;
      'api::question-bank.question-bank': ApiQuestionBankQuestionBank;
      'api::recorded-lecture.recorded-lecture': ApiRecordedLectureRecordedLecture;
      'api::subject.subject': ApiSubjectSubject;
      'api::subtopic.subtopic': ApiSubtopicSubtopic;
      'api::test-serie.test-serie': ApiTestSerieTestSerie;
      'api::topic.topic': ApiTopicTopic;
      'api::tutor-plan.tutor-plan': ApiTutorPlanTutorPlan;
    }
  }
}
