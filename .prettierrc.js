/** @type {import('prettier').Config} */
const config = {
  trailingComma: 'all',
  semi: true,
  singleQuote: false,
  arrowParens: 'always',
  bracketSpacing: false,
  quoteProps: 'preserve',

  plugins: ['prettier-plugin-jsdoc'],
};

export default config;
