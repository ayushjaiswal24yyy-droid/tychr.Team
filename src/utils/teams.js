const axios = require("axios");

const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function getTeamsAccessToken(refreshToken) {
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

  return res.data.access_token;
}

async function createTeamsMeeting({
  accessToken,
  title,
  startTime,
  endTime,
}) {
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
}

module.exports={getTeamsAccessToken, createTeamsMeeting}