const axios = require("axios");

const MS_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_GRAPH_ME = "https://graph.microsoft.com/v1.0/me";

module.exports = {
  async redirect(ctx) {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: "code",
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
      response_mode: "query",
      scope:
        "openid profile email offline_access User.Read OnlineMeetings.ReadWrite",
    });

    ctx.redirect(`${MS_AUTH_URL}?${params.toString()}`);
  },

  async callback(ctx) {
    const { code } = ctx.query;

    if (!code) {
      return ctx.badRequest("Missing authorization code");
    }

    try {
      // 1️⃣ Exchange code → tokens
      const tokenRes = await axios.post(
        MS_TOKEN_URL,
        new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const { access_token, refresh_token } = tokenRes.data;

      // 2️⃣ Get Teams user info
      const meRes = await axios.get(MS_GRAPH_ME, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { id, mail, userPrincipalName } = meRes.data;
      const email = mail || userPrincipalName;

      // 3️⃣ Identify logged-in Strapi user
      const jwt = ctx.cookies.get("jwt");

      if (!jwt) {
        return ctx.unauthorized("Not authenticated");
      }

      const user = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(jwt);

      // 4️⃣ Save Teams data
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        {
          data: {
            teams_id: id,
            teams_email: email,
            teams_refresh_token: refresh_token,
          },
        }
      );

      // 5️⃣ Redirect back to frontend
      ctx.redirect(
        `${process.env.FRONTEND_URL}/dashboard?teams=connected`
      );
    } catch (err) {
      console.error("Microsoft OAuth error:", err?.response?.data || err);
      ctx.redirect(
        `${process.env.FRONTEND_URL}/dashboard?teams=error`
      );
    }
  },
};
