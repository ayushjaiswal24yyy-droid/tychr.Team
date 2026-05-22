const axios = require("axios");

const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function getTeamsAccessToken(refreshToken, userId) {
  let res;
  try {
    res = await axios.post(
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
  } catch (err) {
    const msError = err.response?.data;
    strapi.log.error("[teams] refresh token exchange failed", {
      error: msError?.error,
      description: msError?.error_description,
      client_id_set: !!process.env.MICROSOFT_CLIENT_ID,
      client_secret_set: !!process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token_length: refreshToken?.length,
    });
    throw new Error(
      msError?.error_description || msError?.error || "Error authenticating with Microsoft Teams"
    );
  }

  if (!res.data.access_token) {
    strapi.log.error("[teams] no access_token in response", res.data);
    throw new Error("Microsoft did not return an access token");
  }

  if (res.data.refresh_token && userId) {
    await strapi.entityService.update(
      "plugin::users-permissions.user",
      userId,
      { data: { teams_refresh_token: res.data.refresh_token } }
    );
  }

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token
  };
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
    const status = err.response?.status;
    const graphError = err.response?.data?.error;

    strapi.log.error("[teams] createTeamsMeeting failed", {
      status,
      errorCode: graphError?.code,
      errorMessage: graphError?.message,
    });

    if (status === 401) {
      const e = Object.assign(
        new Error("Microsoft Teams authorization expired. Please reconnect your Teams account."),
        { code: "teams_reauth_required" }
      );
      throw e;
    }
    if (status === 403) {
      // Insufficient permissions — token missing OnlineMeetings.ReadWrite scope
      const e = Object.assign(
        new Error(graphError?.message || "Microsoft Teams permission denied. Please reconnect your Teams account to grant meeting permissions."),
        { code: "teams_reauth_required" }
      );
      throw e;
    }
    if (status === 429) {
      throw new Error("Microsoft Teams rate limit exceeded. Please try again in a moment.");
    }

    const msg = graphError?.message || "Failed to create Microsoft Teams meeting";
    throw new Error(msg);
  }
}

async function getAppAccessToken() {
  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}


module.exports = { getTeamsAccessToken, createTeamsMeeting, getAppAccessToken };