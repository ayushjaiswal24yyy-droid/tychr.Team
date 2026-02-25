// src/api/student-uni-application/content-types/student-uni-application/lifecycles.js
//
// Drop this file at:
// src/api/student-uni-application/content-types/student-uni-application/lifecycles.js
//
// This hook fires AFTER a new studentUniApplication is created and
// auto-generates the standard tasks scoped to that application.

"use strict";

/**
 * Returns the default predefined tasks for every new application.
 * Each returns { title, description, taskCategory, priority }
 */
function getDefaultTasks(applicationId, studentId) {
  const base = {
    student: studentId ?? null,
    student_uni_application: applicationId,
    status: "not_started",
    progress: 0,
    isImportant: false,
    publishedAt: new Date().toISOString(), // needed because tasks use draftAndPublish
  };

  return [
    {
      ...base,
      title: "Upload Resume",
      description:
        "Upload an up-to-date resume/CV to your application. Ensure it highlights relevant academic and extracurricular achievements.",
      taskCategory: "others",
      priority: "high",
      isImportant: true,
    },
    {
      ...base,
      title: "Upload Statement of Purpose",
      description:
        "Write and upload your Statement of Purpose (SOP). Clearly articulate your academic goals, motivation, and fit for the program.",
      taskCategory: "essay",
      priority: "high",
      isImportant: true,
    },
    {
      ...base,
      title: "Submit Letters of Recommendation",
      description:
        "Request and submit Letters of Recommendation (LORs) from professors or professional references familiar with your work.",
      taskCategory: "lor",
      priority: "high",
      isImportant: true,
    },
    {
      ...base,
      title: "Complete Application Essays",
      description:
        "Write and submit all required application essays for this university. Check the college portal for specific prompts and word limits.",
      taskCategory: "essay",
      priority: "medium",
    },
    {
      ...base,
      title: "Verify Academic Transcripts",
      description:
        "Ensure your official academic transcripts are ready and meet the university's formatting and attestation requirements.",
      taskCategory: "academics",
      priority: "medium",
    },
    {
      ...base,
      title: "Review & Submit Final Application",
      description:
        "Do a final review of all submitted documents and officially submit the application before the deadline.",
      taskCategory: "others",
      priority: "critical",
      isImportant: true,
    },
  ];
}

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;

    // Pull IDs from the created application
    const applicationId = result.id;
    const studentId = params?.data?.student ?? null;
    const tasks = getDefaultTasks(applicationId, studentId);

    try {
      // Create all tasks in parallel
      await Promise.all(
        tasks.map((taskData) =>
          strapi.entityService.create("api::task.task", { data: taskData })
        )
      );

      strapi.log.info(
        `[tasks] Created ${tasks.length} default tasks for application #${applicationId}`
      );
    } catch (err) {
      // Non-fatal — log but don't block the application creation response
      strapi.log.error(
        `[tasks] Failed to auto-create tasks for application #${applicationId}: ${err.message}`
      );
    }
  },
};