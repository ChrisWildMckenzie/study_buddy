import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import noUnsanitized from "eslint-plugin-no-unsanitized";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  noUnsanitized.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      "no-unsanitized/property": ["error", {
        escape: { taggedTemplates: ["html"] }
      }]
    }
  },
  {
    ignores: ["dist/**", "node_modules/**"]
  }
);
