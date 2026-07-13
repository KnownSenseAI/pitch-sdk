import DefaultTheme from "vitepress/theme";
import ApiReference from "./ApiReference.vue";
import "@scalar/api-reference/style.css";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ApiReference", ApiReference);
  },
};
