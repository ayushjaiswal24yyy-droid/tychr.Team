const fetch = require("node-fetch");
const {getGraphToken}=require("../utils/getGraphToken")
async function createTeamsMeeting({ title, startTime, durationMinutes }) {
  const token = await getGraphToken(); // client_credentials flow

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${process.env.TEAMS_ORGANIZER_EMAIL}/onlineMeetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: title,
      startDateTime: startTime,
      endDateTime: new Date(
        new Date(startTime).getTime() + durationMinutes * 60 * 1000
      ).toISOString(),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Failed to create Teams meeting: " + err);
  }

  return res.json();
}

module.exports = { createTeamsMeeting };
