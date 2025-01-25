
const externalURI = "www.wiris.net"
module.exports = ({ env }) => [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'","'unsafe-eval'", "'unsafe-inline'",  externalURI],
          'script-src-attr': ["'self'", "'unsafe-inline'", externalURI],
          'font-src': ["'self'",  externalURI, "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          'connect-src': ["'self'", externalURI, "https://*.strapi.io"],
          'style-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", externalURI, "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "http://cdn.jsdelivr.net"],
          'img-src': ["'self'", "blob:", "data:", externalURI, "https://*.strapi.io"],
        },
      }
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::favicon',
  'strapi::public',
];     