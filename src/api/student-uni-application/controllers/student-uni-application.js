'use strict';

/**
 * student-uni-application controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::student-uni-application.student-uni-application', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

    const existing = await strapi.entityService.findMany('api::student-uni-application.student-uni-application', {
      filters: {
        student: data.student,
        college: data.college,
        program: data.program,
      },
      limit: 1,
    });

    if (existing.length > 0) {
      console.error('Student has already applied to this college and program');
      return ctx.badRequest('Student has already applied to this college and program');
    }

    return super.create(ctx);
  },
async requestLor(ctx) {
  const { data } = ctx.request.body;

  // Validate required fields
  if (!data.applicationId || !data.teacher_name || !data.teacher_email) {
    return ctx.badRequest('Missing required fields: applicationId, teacher_name, teacher_email');
  }

  // Fetch the existing application
  const application = await strapi.entityService.findOne(
    'api::student-uni-application.student-uni-application',
    data.applicationId,
    {
      populate: ['student', 'college', 'university', 'program', 'lor_requests'],
    }
  );

  if (!application) {
    return ctx.notFound('Application not found');
  }

  const student = application.student;
  const studentName = student?.fullName || student?.username || 'The Student';
  const collegeName = application.college?.name || data.school_name || 'N/A';
  const programName = application.program?.name || 'N/A';
  const requestedAt = new Date().toISOString();

  // Build the new lor_request component entry
  const newLorRequest = {
    teacher_name: data.teacher_name,
    teacher_email: data.teacher_email,
    school_name: data.school_name || collegeName,
    student_notes: data.student_notes || '',
    requested_at: requestedAt,
    locked: true,
  };

  // Append to existing lor_requests array
  const existingLorRequests = (application.lor_requests || []).map((lr) => ({
    teacher_name: lr.teacher_name,
    teacher_email: lr.teacher_email,
    school_name: lr.school_name,
    student_notes: lr.student_notes,
    requested_at: lr.requested_at,
    locked: lr.locked,
  }));

  const updatedApplication = await strapi.entityService.update(
    'api::student-uni-application.student-uni-application',
    data.applicationId,
    {
      data: {
        lor_requests: [...existingLorRequests, newLorRequest],
      },
    }
  );

  // Send email to the teacher
  try {
    await strapi.plugins['email'].services.email.send({
      to: data.teacher_email,
      from: 'tychr@saralgroups.com',
      subject: `Letter of Recommendation Request from ${studentName}`,
      text: `
Dear ${data.teacher_name},

I hope this message finds you well.

My name is ${studentName}, and I am currently applying to ${collegeName} for the ${programName} program. I am reaching out to respectfully request a Letter of Recommendation from you.

${data.student_notes ? `A note from the student:\n"${data.student_notes}"\n` : ''}
Your support and guidance have meant a great deal to me, and I believe your recommendation would greatly strengthen my application.

If you are able to assist, please reach out so we can coordinate any further details. I am happy to provide any additional information you may need.

Thank you sincerely for considering this request.

Warm regards,
${studentName}

---
This request was submitted on: ${new Date(requestedAt).toLocaleString()}
Powered by Tychr
      `,
      html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <tr>
              <td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">TYCHR</h1>
                <p style="margin:6px 0 0;color:#a0a0c0;font-size:13px;">Letter of Recommendation Request</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <p style="margin:0 0 16px;color:#333;font-size:15px;">Dear <strong>${data.teacher_name}</strong>,</p>

                <p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;">
                  I hope this message finds you well. My name is <strong>${studentName}</strong>, and I am currently applying to 
                  <strong>${collegeName}</strong> for the <strong>${programName}</strong> program.
                </p>

                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                  I am writing to respectfully request a <strong>Letter of Recommendation</strong> from you. Your mentorship has had a meaningful impact on my academic journey, and I believe your recommendation would greatly strengthen my application.
                </p>

                ${data.student_notes ? `
                <!-- Student Note -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="background-color:#f0f4ff;border-left:4px solid #4f46e5;padding:16px 20px;border-radius:4px;">
                      <p style="margin:0 0 6px;color:#4f46e5;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Note from ${studentName}</p>
                      <p style="margin:0;color:#444;font-size:14px;line-height:1.6;">${data.student_notes}</p>
                    </td>
                  </tr>
                </table>` : ''}

                <!-- Application Details -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e8e8f0;border-radius:6px;overflow:hidden;">
                  <tr style="background-color:#f8f8fc;">
                    <td colspan="2" style="padding:12px 16px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Application Details</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 16px;font-size:14px;color:#888;width:40%;border-top:1px solid #e8e8f0;">Institution</td>
                    <td style="padding:10px 16px;font-size:14px;color:#333;font-weight:600;border-top:1px solid #e8e8f0;">${collegeName}</td>
                  </tr>
                  <tr style="background-color:#fafafa;">
                    <td style="padding:10px 16px;font-size:14px;color:#888;border-top:1px solid #e8e8f0;">Program</td>
                    <td style="padding:10px 16px;font-size:14px;color:#333;font-weight:600;border-top:1px solid #e8e8f0;">${programName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 16px;font-size:14px;color:#888;border-top:1px solid #e8e8f0;">Requested On</td>
                    <td style="padding:10px 16px;font-size:14px;color:#333;font-weight:600;border-top:1px solid #e8e8f0;">${new Date(requestedAt).toLocaleString()}</td>
                  </tr>
                </table>

                <p style="margin:0 0 32px;color:#555;font-size:15px;line-height:1.6;">
                  If you are able to assist, please feel free to reach out for any additional information you may need. Thank you sincerely for your time and consideration.
                </p>

                <p style="margin:0;color:#333;font-size:15px;">Warm regards,<br/><strong>${studentName}</strong></p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#f4f4f7;padding:24px 40px;text-align:center;border-top:1px solid #e8e8f0;">
                <p style="margin:0;color:#aaa;font-size:12px;">This email was sent via the Tychr platform on behalf of ${studentName}.</p>
                <p style="margin:4px 0 0;color:#aaa;font-size:12px;">© ${new Date().getFullYear()} Tychr · All rights reserved</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    });
  } catch (emailErr) {
    strapi.log.error('LOR request email send error:', emailErr);
    // We don't fail the request if email fails — application is already updated
  }

  return ctx.send({ message: 'LOR request submitted successfully', data: updatedApplication });
},
}));