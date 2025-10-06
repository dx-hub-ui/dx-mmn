// tailwind.config.js
module.exports = {
  corePlugins: { preflight: false },
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/app/(app)/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
};
