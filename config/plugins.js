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
        defaultFrom: "tychr@saralgroups.com",
        defaultReplyTo: "tychr@saralgroups.com",
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

  ckeditor: {
    enabled: true,
    config: {
      plugin: {
        // Ensure media embed plugin is enabled
        mediaEmbed: true,
      },
    },
  },
});
