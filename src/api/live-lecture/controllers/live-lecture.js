"use strict";

/**
 * live-lecture controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const axios = require("axios");
const { createTeamsMeeting, getTeamsAccessToken, getAppAccessToken } = require("../../../utils/teams")

const DEFAULT_POPULATE = {
  topic: true,
  classroom: { populate: { students: true, tutor: true } },
};
module.exports = createCoreController(
  "api::live-lecture.live-lecture",
  ({ strapi }) => {
    // Helper method to send notifications asynchronously
    const sendLectureNotifications = async ({
      students,
      subject,
      title,
      description,
      topicname,
      teams_join_url,
      formattedSchedule,
      tutor,
    }) => {
      try {
        const emailPromises = students.map((student) => {
          return strapi.plugins["email"].services.email.send({
            to: student.email,
            from: "tychr@saralgroups.com",
            subject,
            text: `Dear student,

${title}

Topic: ${topicname?.name || "N/A"}
Description: ${description}
Class Link: ${teams_join_url}
Scheduled for: ${formattedSchedule}

Best regards,
${tutor?.fullName || "Your Tutor"}
        `,
            html: `
          <p>Dear student,</p>
          <p>${title}</p>
          <p><strong>Topic:</strong> ${topicname?.name || "N/A"}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Teams Link:</strong> <a href="${teams_join_url}">${teams_join_url}</a></p>
          <p><strong>Scheduled for:</strong> ${formattedSchedule}</p>
          <br/>
          <p>Best regards,<br/>${tutor?.fullName || "Your Tutor"}</p>
        `,
          });
        });

        await Promise.allSettled(emailPromises);
      } catch (err) {
        strapi.log.error("Email send error:", err);
      }
    };


    return {
      async find(ctx) {
        ctx.query.populate = ctx.query.populate || DEFAULT_POPULATE;
        return super.find(ctx);
      },
      async findOne(ctx) {
        ctx.query.populate = ctx.query.populate || DEFAULT_POPULATE;
        return super.findOne(ctx);
      },
      async create(ctx) {
        let response = null;

        try {
          const {
            schedule,
            classroom,  // ✅ Now singular
            title,
            description,
            topic,
          } = ctx.request.body.data;


          // ✅ Simple validation
          if (!classroom) {
            ctx.throw(400, "Classroom is required");
          }

          // 🔒 DUPLICATE PROTECTION
          const existingLecture = await strapi.entityService.findMany(
            "api::live-lecture.live-lecture",
            {
              filters: {
                classroom: classroom,
                schedule: schedule,
              },
            }
          );

          if (existingLecture.length > 0) {
            return ctx.send({
              message: "Lecture already exists for this time slot",
              data: existingLecture[0],
            });
          }


          const classroomData = await strapi.entityService.findOne(
            "api::enrollment.enrollment",
            classroom,
            {
              populate: {
                tutor: true,
                students: true,
              },
            }
          );

          if (!classroomData) {
            ctx.throw(400, "Classroom not found");
          }

          const tutor = classroomData.tutor;
          const students = classroomData.students || [];

          if (!tutor?.teams_refresh_token) {
            ctx.throw(400, "Tutor has not connected Microsoft Teams");
          }

          // Get Teams access token — throws teams_reauth_required if scope missing
          let accessToken;
          try {
            ({ accessToken } = await getTeamsAccessToken(
              tutor.teams_refresh_token,
              tutor.id
            ));
          } catch (err) {
            if (err.code === "teams_reauth_required") {
              return ctx.send(
                { error: { status: 403, code: "teams_reauth_required", message: err.message } },
                403
              );
            }
            throw err;
          }

          // Create Teams meeting
          const start = new Date(schedule);
          const end = new Date(start.getTime() + 60 * 60 * 1000);

          let meeting;
          try {
            meeting = await createTeamsMeeting({
              accessToken,
              title,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            });
          } catch (err) {
            if (err.code === "teams_reauth_required") {
              return ctx.send(
                { error: { status: 403, code: "teams_reauth_required", message: err.message } },
                403
              );
            }
            throw err;
          }

          // ✅ Create lecture with all data at once
          response = await strapi.entityService.create(
            "api::live-lecture.live-lecture",
            {
              data: {
                title,
                description,
                schedule,
                topic,
                classroom,  // ✅ Direct relation
                teams_join_url: meeting.joinUrl,
                teams_meeting_id: meeting.meetingId,
                publishedAt: new Date(),
              },
            }
          );

          // Topic lookup (optional)
          let topicname = null;
          if (topic) {
            topicname = await strapi.entityService.findOne(
              "api::topic.topic",
              topic
            );
          }

          // Format date
          const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(schedule));

          // Send notifications (non-blocking)
          if (students.length > 0) {
            sendLectureNotifications({
              students,
              subject: `New Live Lecture: ${title}`,
              title,
              description,
              topicname,
              teams_join_url: meeting.joinUrl,
              formattedSchedule,
              tutor,
            }).catch((err) =>
              strapi.log.error("Lecture notification failed:", err)
            );
          }

          return ctx.send({
            message: "Live lecture created successfully",
            data: response,
          });
        } catch (error) {
          strapi.log.error("Error creating live lecture:", error);

          if (response) {
            return ctx.send({
              message: "Live lecture created with errors",
              data: response,
              error: error.message,
            });
          }

          ctx.throw(500, error.message || "Failed to create live lecture");
        }
      },
      async sendLectureReminders(ctx) {
        const secret = ctx.request.headers["x-cron-key"];
        if (secret !== process.env.CRON_SECRET) {
          return ctx.unauthorized("Invalid cron key");
        }

        const now = new Date();
        const to = new Date(now.getTime() + 30 * 60 * 1000);

        const lectures = await strapi.entityService.findMany(
          "api::live-lecture.live-lecture",
          {
            filters: {
              schedule: {
                $gt: now,
                $lte: to,
              },
              reminderSent: false,
            },
            populate: {
              topic: true,
              classroom: {  // ✅ Changed from 'classrooms' to 'classroom'
                populate: {
                  students: true,
                  tutor: true,
                },
              },
            },
          }
        );

        let processed = 0;

        for (const lecture of lectures) {
          const classroom = lecture.classroom;  // ✅ Now a single object

          // ✅ Skip if no classroom or no students
          if (!classroom?.students?.length) continue;

          const students = classroom.students;
          const tutor = classroom.tutor;

          const formattedSchedule = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(lecture.schedule));

          await sendLectureNotifications({
            students,
            subject: "⏰ Live Lecture Starting Soon",
            title: "Your class starts in less than 30 minutes",
            description: lecture.description,
            topicname: lecture.topic,
            teams_join_url: lecture.teams_join_url,
            formattedSchedule,
            tutor,
          });

          await strapi.entityService.update(
            "api::live-lecture.live-lecture",
            lecture.id,
            { data: { reminderSent: true } }
          );

          processed++;
        }

        return { ok: true, processed };
      },
      async syncRecordings(ctx) {
        const secret = ctx.request.headers["x-cron-key"];
        if (secret !== process.env.CRON_SECRET) {
          return ctx.unauthorized("Invalid cron key");
        }

        const now = new Date();
        const completionCutoff = new Date(now.getTime() - 15 * 60 * 1000);

        const pendingCompletion = await strapi.entityService.findMany(
          "api::live-lecture.live-lecture",
          {
            filters: {
              lecture_status: { $in: ["scheduled", "rescheduled"] },
              schedule: { $lt: completionCutoff },
              is_cancelled: false,
            },
            fields: ["id"],
          }
        );

        await Promise.all(
          pendingCompletion.map((lecture) =>
            strapi.entityService.update(
              "api::live-lecture.live-lecture",
              lecture.id,
              {
                data: {
                  lecture_status: "completed",
                  recording_status: "pending",
                },
              }
            )
          )
        );

        const lectures = await strapi.entityService.findMany(
          "api::live-lecture.live-lecture",
          {
            filters: {
              lecture_status: "completed",
              recording_status: "pending",
              teams_meeting_id: { $notNull: true },
            },
            populate: {
              classroom: {
                populate: { tutor: true, students: true },
              },
            },
          }
        );

        let processed = 0;
        let updated = 0;
        let failed = 0;
        let transcriptsProcessed = 0;
        let summariesProcessed = 0;

        let appAccessToken;
        try {
          appAccessToken = await getAppAccessToken();
        } catch (err) {
          strapi.log.error("Failed to get app access token:", err?.response?.data || err.message);
          return ctx.badRequest(err?.response?.data?.error_description || "Failed to get app token");
        }

        for (const lecture of lectures) {
          processed++;

          try {
            const tutor = lecture.classroom?.tutor;

            // Step 1: Find call record by joinWebUrl
            const recordsRes = await axios.get(
              `https://graph.microsoft.com/v1.0/communications/callRecords?$filter=joinWebUrl eq '${lecture.teams_join_url}'`,
              { headers: { Authorization: `Bearer ${appAccessToken}` } }
            );

            const callRecords = recordsRes.data.value || [];
            const matched = callRecords[0];

            if (matched) {
              // Step 2: Fetch full detail with sessions + segments
              const detailRes = await axios.get(
                `https://graph.microsoft.com/v1.0/communications/callRecords/${matched.id}?$expand=sessions($expand=segments)`,
                { headers: { Authorization: `Bearer ${appAccessToken}` } }
              );

              const record = detailRes.data;

              // 🎥 Extract recording URL
              let recordingUrl = null;
              for (const session of record.sessions || []) {
                for (const segment of session.segments || []) {
                  const recordingMedia = segment.media?.find((m) => m.label === "recording");
                  if (recordingMedia?.contentUrl) {
                    recordingUrl = recordingMedia.contentUrl;
                    break;
                  }
                }
                if (recordingUrl) break;
              }

              // 👨‍🏫 Extract tutor duration
              let tutorDurationSeconds = 0;
              const tutorEmail = tutor?.email?.toLowerCase();

              for (const session of record.sessions || []) {
                for (const segment of session.segments || []) {
                  for (const participant of segment.participants || []) {
                    if (
                      participant.identity?.user?.userPrincipalName?.toLowerCase() === tutorEmail
                    ) {
                      const start = new Date(segment.startDateTime);
                      const end = new Date(segment.endDateTime);
                      tutorDurationSeconds += (end.getTime() - start.getTime()) / 1000;
                    }
            // Build per-participant duration map (email → seconds in meeting)
            const participantSeconds = {};
            for (const session of record.sessions || []) {
              for (const segment of session.segments || []) {
                const segStart = new Date(segment.startDateTime);
                const segEnd = new Date(segment.endDateTime);
                const segDuration = (segEnd.getTime() - segStart.getTime()) / 1000;
                for (const participant of segment.participants || []) {
                  const email =
                    participant.identity?.user?.userPrincipalName?.toLowerCase() ||
                    participant.identity?.user?.displayName?.toLowerCase();
                  if (email) {
                    participantSeconds[email] = (participantSeconds[email] || 0) + segDuration;
                  }
                }
              }

              const MEETING_DURATION_SECONDS = 60 * 60;
              const tutorDurationMinutes = Math.round(tutorDurationSeconds / 60);
              const isCounted = tutorDurationSeconds >= MEETING_DURATION_SECONDS * 0.8;

              await strapi.entityService.update(
                "api::live-lecture.live-lecture",
                lecture.id,
                {
                  data: {
                    recording_url: recordingUrl,
                    has_recording: !!recordingUrl,
                    recording_status: recordingUrl ? "available" : "pending",
                    recorded_at: recordingUrl ? new Date(record.startDateTime) : null,
                    recording_duration_seconds: record.durationSeconds || null,
                    tutor_duration_minutes: tutorDurationMinutes,
                    is_counted: isCounted,
                    tutor_attendance_status: isCounted ? "passed" : "failed",
                    tutor_attendance_flagged_at: !isCounted ? new Date() : null,
                  },
                }
              );

              updated++;
            } else {
              strapi.log.info(`No call record found yet for lecture ${lecture.id}`);
            }

            const liveLectureService = strapi.service("api::live-lecture.live-lecture");

            const transcript = await liveLectureService.ensureTranscriptForLecture({
              lecture,
              appAccessToken,
            });

            if (transcript) {
              transcriptsProcessed++;
            }

            if (transcript?.transcript_status === "available") {
              const summary = await liveLectureService.ensureSummaryForLecture({
                lecture,
                transcriptText: transcript.transcript_text,
              });

              if (summary) {
                summariesProcessed++;
              }
            }
            // 👨‍🏫 Tutor attendance
            const tutorEmail = tutor?.email?.toLowerCase();
            const tutorDurationSeconds = participantSeconds[tutorEmail] || 0;
            const MEETING_DURATION_SECONDS = 60 * 60;
            const tutorDurationMinutes = Math.round(tutorDurationSeconds / 60);
            const isCounted = tutorDurationSeconds >= MEETING_DURATION_SECONDS * 0.8;

            await strapi.entityService.update(
              "api::live-lecture.live-lecture",
              lecture.id,
              {
                data: {
                  recording_url: recordingUrl,
                  has_recording: !!recordingUrl,
                  recording_status: recordingUrl ? "available" : "pending",
                  recorded_at: recordingUrl ? new Date(record.startDateTime) : null,
                  recording_duration_seconds: record.durationSeconds || null,
                  tutor_duration_minutes: tutorDurationMinutes,
                  is_counted: isCounted,
                  tutor_attendance_status: isCounted ? "passed" : "failed",
                  tutor_attendance_flagged_at: !isCounted ? new Date() : null,
                  lecture_status: "completed",
                },
              }
            );

            // 👨‍🎓 Student attendance — update or create attendance records
            const classroomStudents = lecture.classroom?.students || [];
            for (const student of classroomStudents) {
              const studentEmail = student.email?.toLowerCase();
              const studentSeconds = participantSeconds[studentEmail] || 0;
              const studentMinutes = Math.round(studentSeconds / 60);
              const meetingDurationMinutes = Math.round(MEETING_DURATION_SECONDS / 60);
              const attendancePercent =
                meetingDurationMinutes > 0
                  ? Math.round((studentMinutes / meetingDurationMinutes) * 100)
                  : 0;

              let status = "absent";
              if (studentSeconds > 0) {
                status = studentSeconds >= MEETING_DURATION_SECONDS * 0.5 ? "present" : "late";
              }

              // Find existing attendance record for this student + lecture
              const existing = await strapi.entityService.findMany(
                "api::attendance.attendance",
                {
                  filters: {
                    live_lecture: lecture.id,
                    student: student.id,
                  },
                  limit: 1,
                }
              );

              const attendanceData = {
                status,
                duration_minutes: studentMinutes,
                marked_at: new Date(),
                marked_by: "system",
                notes: `Auto-marked from Graph call record. Time in meeting: ${studentMinutes}min (${attendancePercent}%)`,
              };

              if (existing.length > 0) {
                await strapi.entityService.update(
                  "api::attendance.attendance",
                  existing[0].id,
                  { data: attendanceData }
                );
              } else {
                await strapi.entityService.create("api::attendance.attendance", {
                  data: {
                    ...attendanceData,
                    live_lecture: lecture.id,
                    student: student.id,
                  },
                });
              }
            }

            strapi.log.info(
              `[sync] lecture ${lecture.id}: tutor=${tutorDurationMinutes}min, students=${classroomStudents.length} processed`
            );

            updated++;
          } catch (err) {
            failed++;
            const errorMsg = err?.response?.data
              ? JSON.stringify(err.response.data)
              : err.message;

            strapi.log.error(`Recording sync failed for lecture ${lecture.id}`, errorMsg);

            await strapi.entityService.update(
              "api::live-lecture.live-lecture",
              lecture.id,
              { data: { cancellation_reason: `[sync_error] ${errorMsg}` } }
            );
          }
        }

        return ctx.send({ ok: true, processed, updated, failed, transcriptsProcessed, summariesProcessed });
      },
    };
  }
);