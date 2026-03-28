'use strict';

// Lead times in days — cron will call this endpoint daily and we check all windows
const REMINDER_LEAD_DAYS = [30, 14, 7, 3, 1];

module.exports = {
  /**
   * POST /api/deadline-reminders/send
   * Called by Plesk cron daily.
   * Optionally accepts { lead_days: [30, 14, 7] } in body to override defaults.
   * Protect this with a secret header in Plesk: X-Cron-Secret: <your_secret>
   */
  async send(ctx) {
    const cronSecret = process.env.CRON_SECRET;
    const incomingSecret = ctx.request.headers['x-cron-secret'];

    if (cronSecret && incomingSecret !== cronSecret) {
      return ctx.unauthorized('Invalid cron secret');
    }

    const leadDays = ctx.request.body?.lead_days ?? REMINDER_LEAD_DAYS;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build date targets: today + N days for each lead time
    const targetDates = leadDays.map((days) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return { days, iso: d.toISOString().split('T')[0] };
    });

    const results = { sent: [], skipped: [], errors: [] };

    for (const { days, iso } of targetDates) {
      // Find all applications with this exact deadline date
      const applications = await strapi.entityService.findMany(
        'api::student-uni-application.student-uni-application',
        {
          filters: {
            Deadline: { $eq: iso },
            // Only remind for active applications — not already rejected/accepted
            universityDecision: {
              $notIn: ['Accepted', 'Rejected', 'Accepted By Student', 'Rejected by student'],
            },
          },
          populate: {
            student: {
              fields: ['id', 'username', 'email', 'firstName', 'lastName'],
            },
            university: {
              fields: ['university_name'],
            },
            college: {
              fields: ['college_name'],
            },
            program: {
              fields: ['program_name', 'program_type'],
            },
          },
        }
      );

      for (const app of applications) {
        const student = app.student;
        if (!student?.email) {
          results.skipped.push({ application_id: app.id, reason: 'no student email' });
          continue;
        }

        const studentName =
          student.firstName
            ? `${student.firstName} ${student.lastName || ''}`.trim()
            : student.username;

        const universityName = app.university?.university_name ?? 'the university';
        const collegeName = app.college?.college_name ?? null;
        const programName = app.program?.program_name ?? 'your program';

        const subject = `Reminder: ${universityName} application deadline in ${days} day${days === 1 ? '' : 's'}`;

        const htmlBody = buildEmailHtml({
          studentName,
          universityName,
          collegeName,
          programName,
          daysLeft: days,
          deadline: iso,
          applicationId: app.id,
        });

        try {
          await strapi.plugin('email').service('email').send({
            to: student.email,
            subject,
            html: htmlBody,
          });

          results.sent.push({
            application_id: app.id,
            student_email: student.email,
            deadline: iso,
            days_before: days,
          });
        } catch (err) {
          strapi.log.error(`Failed to send reminder for application ${app.id}: ${err.message}`);
          results.errors.push({
            application_id: app.id,
            student_email: student.email,
            error: err.message,
          });
        }
      }
    }

    strapi.log.info(
      `Deadline reminders: ${results.sent.length} sent, ${results.skipped.length} skipped, ${results.errors.length} errors`
    );

    ctx.body = {
      data: {
        summary: {
          sent: results.sent.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
          lead_days_checked: leadDays,
          run_date: today.toISOString().split('T')[0],
        },
        details: results,
      },
    };
  },
};

function buildEmailHtml({ studentName, universityName, collegeName, programName, daysLeft, deadline, applicationId }) {
  const urgencyColor = daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#2563eb';
  const urgencyLabel = daysLeft === 1 ? 'TOMORROW' : `${daysLeft} DAYS LEFT`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:28px 36px;">
              <p style="margin:0;color:#93c5fd;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Tychr Counselling</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Application Deadline Reminder</h1>
            </td>
          </tr>

          <!-- Urgency banner -->
          <tr>
            <td style="background:${urgencyColor};padding:12px 36px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:1px;">${urgencyLabel}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi <strong>${studentName}</strong>,</p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                This is a reminder that your application deadline for the following program is approaching:
              </p>

              <!-- Application card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">University</p>
                    <p style="margin:0 0 14px;color:#1e293b;font-size:16px;font-weight:700;">${universityName}</p>
                    ${collegeName ? `
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">College</p>
                    <p style="margin:0 0 14px;color:#1e293b;font-size:15px;font-weight:500;">${collegeName}</p>
                    ` : ''}
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Program</p>
                    <p style="margin:0 0 14px;color:#1e293b;font-size:15px;font-weight:500;">${programName}</p>
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Deadline</p>
                    <p style="margin:0;color:${urgencyColor};font-size:16px;font-weight:700;">${deadline}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Please log in to your Tychr dashboard to review your checklist and ensure all documents are uploaded before the deadline.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1e3a5f;border-radius:8px;">
                    <a href="${process.env.FRONTEND_URL || 'https://app.tychr.com'}/applications/${applicationId}"
                       style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      View Application →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                You're receiving this because you have an active application on Tychr. 
                This is an automated reminder — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}