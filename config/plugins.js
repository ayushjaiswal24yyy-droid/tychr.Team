module.exports = ({ env }) => ({
  
  upload: {
    
    config: {
      
      provider: "aws-s3",
      providerOptions: {
        accessKeyId: env("AWS_ACCESS_KEY_ID"),
        secretAccessKey: env("AWS_ACCESS_SECRET"),
        region: env("AWS_REGION"),
        params: {
          ACL: env("AWS_ACL", "public-read"),
          signedUrlExpires: env("AWS_SIGNED_URL_EXPIRES", 15 * 60),
          Bucket: env("AWS_BUCKET_NAME"),
        },
      },
      sizeLimit: 10 * 1024 * 1024 * 1024, // 1GB

      breakpoints: {
        sm: 576,
        md: 768,
        lg: 992,
        xl: 1200,
      },
      mimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "video/mp4",
        "video/webm",
        "video/ogg",
      ],
    },
  },
  email: {
    config: {
      provider: "amazon-ses",
      providerOptions: {
        key: env("AWS_ACCESS_KEY_ID"),
        secret: env("AWS_ACCESS_SECRET"),
        amazon: `https://email.${process.env.AWS_REGION}.amazonaws.com`,
      },
      settings: {
        defaultFrom: "contact@tychr.com",
        defaultReplyTo: "contact@tychr.com",
      },
    },
  },
  graphql: {
    config: {
      endpoint: "/graphql",
      shadowCRUD: true,
      playgroundAlways: false,
      depthLimit: 7,
      amountLimit: 100,
      apolloServer: {
        tracing: false,
      },
    },
  },
  "entity-relationship-chart": {
    enabled: true,
    config: {
      // By default all contentTypes and components are included.
      // To exlclude strapi's internal models, use:
      exclude: [
        "strapi::core-store",
        "webhook",
        "admin::permission",
        "admin::user",
        "admin::role",
        "admin::api-token",
        "plugin::upload.file",
        "plugin::i18n.locale",
        "plugin::users-permissions.permission",
        "plugin::users-permissions.role",
      ],
    },
  },

  "content-manager": {
    config: {
      sanitize: {
        enabled: true,
        options: {
          // all the tags you want Strapi to allow
          allowedTags: [
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "p",
            "a",
            "ul",
            "ol",
            "li",
            "strong",
            "em",
            "img",
            "iframe",
          ],
          // and the attributes each tag can have
          allowedAttributes: {
            iframe: [
              "src",
              "width",
              "height",
              "frameborder",
              "allow",
              "allowfullscreen",
              "referrerpolicy",
              "title",
            ],
            a: ["href", "target", "rel", "title"],
            img: ["src", "alt", "width", "height"],
          },
        },
      },
    },
  },
});
