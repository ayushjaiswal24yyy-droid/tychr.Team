const fetch = require("node-fetch");

async function getGraphToken() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  }).toString(); // 🔴 CRITICAL

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Graph token missing: " + JSON.stringify(data));
  }

  return data.access_token;
}

module.exports = { getGraphToken };
