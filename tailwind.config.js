/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        canvas: "#F7F8FA",
        panel: "#FFFFFF",
        line: "#E6E8EC",
        ink: "#1B2029",
        muted: "#6B7280",
        accent: {
          DEFAULT: "#2F6FED",
          soft: "#EAF1FF",
        },
        category: {
          study: { fg: "#2563EB", bg: "#E9F0FE" },
          university: { fg: "#4F46E5", bg: "#ECEBFD" },
          work: { fg: "#9333EA", bg: "#F5EAFE" },
          sport: { fg: "#F97316", bg: "#FEEEDD" },
          food: { fg: "#CA8A04", bg: "#FBF3D6" },
          health: { fg: "#E11D6B", bg: "#FDEAF1" },
          personal: { fg: "#16A34A", bg: "#E9F9EF" },
          errands: { fg: "#0891B2", bg: "#E3F6FA" },
          other: { fg: "#64748B", bg: "#EEF1F4" },
        },
      },
      borderRadius: {
        xl2: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
