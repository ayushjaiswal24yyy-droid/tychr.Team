import favicon from "./extensions/favicon.png"

const config = {
  head: {
    favicon: favicon,
    title: 'TyChr',
    meta: [
      { name: 'description', content: 'Admin Panel for TyChr' },
    ],
  },
  auth: {
    logo: favicon
  },
  menu: {
    logo: favicon
  },
  tutorials: false,
  theme: {
    // overwrite light theme properties
    light: {
      colors: {
        primary100: "#DAFFFB",
        primary200: "#B9EDDD",
        primary500: "#159895",
        primary600: "#1A5F7A",
        primary700: "#002B5B", // highlighted
        danger700: "#b72b1a",
      },
    },

    // overwrite dark theme properties
    dark: {
      colors: {
        primary100: "#DAFFFB",
        primary200: "#B9EDDD",
        primary500: "#159895",
        primary600: "#1A5F7A", //text
        primary700: "#002B5B", // highlighted
        danger700: "#b72b1a",
      },
    },
  },
  translations: {
    en: {
      "Auth.form.welcome.subtitle": "Log in to your TyChr admin account",
      "Auth.form.welcome.title": "Welcome to TyChr!",
      "app.components.LeftMenu.navbrand.workplace": "TyChr",
      "app.components.LeftMenu.navbrand.title": "TyChr Dashboard",
      "app.components.HomePage.welcomeBlock.content.again": "This is TyChr admin panel.",
      admin: {
        app: {
          name: 'TyChr',
        },
      },
    },
  },
};

const bootstrap = (app) => {
  console.log(app);

  const strapiTheme = () => {
    const LIGHT_THEME = "light";
    const DARK_THEME = "dark";

    const themeKey = 'STRAPI_THEME'
    const forceSetKey = 'STRAPI_THEME_FORCE_CHANGE';
    const defaultTheme = LIGHT_THEME;

    const currentTheme = localStorage.getItem(themeKey);
    const forceSet = localStorage.getItem(forceSetKey);

    if (!currentTheme) {
      localStorage.setItem(themeKey, defaultTheme);
      return;
    }

    if (!forceSet && currentTheme === DARK_THEME) {
      localStorage.setItem(themeKey, defaultTheme);
      localStorage.setItem(forceSetKey, 'true');
    }
  }

  strapiTheme();

};

export default {
  config,
  bootstrap,
};
