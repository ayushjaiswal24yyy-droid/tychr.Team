// module.exports = () => ({
//     bootstrap({ strapi }) {
//       strapi.cron.add({
//         // runs every second
//         myJob: {
//           task: ({ strapi }) => {
//             console.log("hello from plugin");
//             return null;
//           },
//           options: {
//             rule: "* * * * * *",
//           },
//         },
//       });
//     },
//   });