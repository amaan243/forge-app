import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [{
  files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"],
  languageOptions: { parser, parserOptions: { project: "./tsconfig.json" } },
  plugins: { "@typescript-eslint": tseslint },
  rules: { "@typescript-eslint/no-explicit-any": "error", "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "error" }
}];