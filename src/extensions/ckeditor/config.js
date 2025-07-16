module.exports = {
  editor: {
    toolbar: [
      "heading",
      "|",
      "bold",
      "italic",
      "link",
      "bulletedList",
      "numberedList",
      "|",
      "mediaEmbed",
      "undo",
      "redo",
    ],
    mediaEmbed: {
      previewsInData: true,
    },
    htmlSupport: {
      allow: [
        {
          name: "iframe",
          attributes: true,
          classes: true,
          styles: true,
        },
      ],
    },
  },
};
