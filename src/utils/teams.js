const axios = require("axios");

const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function getTeamsAccessToken(refreshToken, userId) {
  const res = await axios.post(
    MS_TOKEN_URL,
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://graph.microsoft.com/.default",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  if (res.data.refresh_token && userId) {
    await strapi.entityService.update(
      "plugin::users-permissions.user",
      userId,
      { data: { teams_refresh_token: res.data.refresh_token } }
    );
  }

  return res.data.access_token;
}

async function createTeamsMeeting({
  accessToken,
  title,
  startTime,
  endTime,
}) {
  try {
    const res = await axios.post(
      "https://graph.microsoft.com/v1.0/me/onlineMeetings",
      {
        subject: title,
        startDateTime: startTime,
        endDateTime: endTime,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      joinUrl: res.data.joinWebUrl,
      meetingId: res.data.id,
    };
  } catch (err) {
    if (err.response?.status === 401) {
      throw new Error("Microsoft Teams authorization expired");
    }
    if (err.response?.status === 429) {
      throw new Error("Microsoft Teams rate limit exceeded");
    }

    throw new Error(
      err.response?.data?.error?.message ||
      "Failed to create Microsoft Teams meeting"
    );
  }
}


module.exports={getTeamsAccessToken, createTeamsMeeting}