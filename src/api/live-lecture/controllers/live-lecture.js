"use strict";

/**
 * live-lecture controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const axios = require("axios");
const { createTeamsMeeting, getTeamsAccessToken } = require("../../../utils/teams")
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

          // Get Teams access token
          const { accessToken } = await getTeamsAccessToken(
            tutor.teams_refresh_token,
            tutor.id
          );

          // Create Teams meeting
          const start = new Date(schedule);
          const end = new Date(start.getTime() + 60 * 60 * 1000);

          const meeting = await createTeamsMeeting({
            accessToken,
            title,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          });

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
                populate: { tutor: true },
              },
            },
          }
        );

        let processed = 0;
        let updated = 0;
        let failed = 0;

        for (const lecture of lectures) {
          processed++;

          try {
            const tutor = lecture.classroom?.tutor;

            if (!tutor?.teams_refresh_token) {
              failed++;
              continue;
            }

            const { accessToken } = await getTeamsAccessToken(
              tutor.teams_refresh_token,
              tutor.id
            );

            const recordsRes = await axios.get(
              "https://graph.microsoft.com/v1.0/communications/callRecords",
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const callRecords = recordsRes.data.value || [];

            const matched = callRecords.find(
              (r) => r.meetingId === lecture.teams_meeting_id
            );

            if (!matched) continue;

            // 🎥 Extract recording
            let recordingMedia = null;
            for (const session of matched.sessions || []) {
              for (const segment of session.segments || []) {
                recordingMedia = segment.media?.find((m) => m.label === "recording");
                if (recordingMedia) break;
              }
              if (recordingMedia) break;
            }

            if (!recordingMedia?.contentUrl) continue;

            // 👨‍🏫 Extract tutor duration
            let tutorDurationSeconds = 0;
            const tutorEmail = tutor.email?.toLowerCase();

            for (const session of matched.sessions || []) {
              for (const segment of session.segments || []) {
                for (const participant of segment.participants || []) {
                  if (
                    participant.identity?.user?.userPrincipalName?.toLowerCase() === tutorEmail
                  ) {
                    const start = new Date(segment.startDateTime);
                    const end = new Date(segment.endDateTime);
                    tutorDurationSeconds += (end.getTime() - start.getTime()) / 1000;
                  }
                }
              }
            }

            const MEETING_DURATION_SECONDS = 60 * 60;
            const tutorDurationMinutes = Math.round(tutorDurationSeconds / 60);
            const isCounted = tutorDurationSeconds >= MEETING_DURATION_SECONDS * 0.8;

            // 💾 Single update with everything
            await strapi.entityService.update(
              "api::live-lecture.live-lecture",
              lecture.id,
              {
                data: {
                  recording_url: recordingMedia.contentUrl,
                  has_recording: true,
                  recording_status: "available",
                  recorded_at: new Date(matched.startDateTime),
                  recording_duration_seconds: recordingMedia.duration
                    ? parseInt(recordingMedia.duration.replace(/\D/g, ""))
                    : null,
                  tutor_duration_minutes: tutorDurationMinutes,
                  is_counted: isCounted,
                  tutor_attendance_status: isCounted ? "passed" : "failed",
                  tutor_attendance_flagged_at: !isCounted ? new Date() : null,
                },
              }
            );

            updated++;
          } catch (err) {
            failed++;
            strapi.log.error(`Recording sync failed for lecture ${lecture.id}`, err);

            // Temporarily save error to lecture for debugging
            await strapi.entityService.update('api::live-lecture.live-lecture', lecture.id, {
              data: { cancellation_reason: err?.message || JSON.stringify(err) }
            });
          }
        }

        return ctx.send({ ok: true, processed, updated, failed });
      },
    };
  }
);