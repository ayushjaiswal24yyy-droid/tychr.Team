const externalURI = "www.wiris.net";

module.exports = ({ env }) => [
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        directives: {
          "script-src": [
            "'self'",
            "'unsafe-eval'",
            "'unsafe-inline'",
            externalURI,
          ],
          "script-src-attr": ["'self'", "'unsafe-inline'", externalURI],
          "font-src": [
            "'self'",
            externalURI,
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com",
          ],
          "connect-src": ["'self'", externalURI, "https://*.strapi.io"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            externalURI,
            "https://fonts.googleapis.com",
            "https://cdnjs.cloudflare.com",
            "http://cdn.jsdelivr.net",
          ],
          "img-src": [
            "'self'",
            "blob:",
            "data:",
            externalURI,
            "https://*.strapi.io",
            "https://m.media-amazon.com",
            "https://tychr-strapi.s3.ap-south-1.amazonaws.com",
          ],
          "frame-src": [
            "'self'",
            "https://www.youtube.com",
            "https://player.vimeo.com",
          ],
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      origin: [
        "https://platform.tychr.com",
        "http://localhost:3000",
        "http://localhost:3001",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      headers: ["Content-Type", "Authorization", "Origin", "Accept"],
      keepHeaderOnError: true,
    },
  },
  "strapi::poweredBy",
  "strapi::logger",
  "strapi::query",
  {
    name: "strapi::body",
    config: {
      enabled: true,
      multipart: true,
      textLimit: 10 * 1024 * 1024 * 1024,
      formLimit: 10 * 1024 * 1024 * 1024,
      jsonLimit: 10 * 1024 * 1024 * 1024,
      includeUnparsed: true,
      formidable: {
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10 GB
      },
      providerOptions: {
        sizeLimit: 10 * 1024 * 1024 * 1024, // 10 GB
      },
    },
  },
  "strapi::favicon",
  "strapi::public",
];
