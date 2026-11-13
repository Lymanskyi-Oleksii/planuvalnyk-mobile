// Кольори задано CSS-змінними (src/index.css): світла тема в :root, темна в .dark.
// Значення змінної — «R G B», щоб працювала прозорість: bg-accent/90.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const category = (name) => ({ fg: v(`${name}-fg`), bg: v(`${name}-bg`) });

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
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
        canvas: v("canvas"),
        panel: v("panel"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        accent: {
          DEFAULT: v("accent"),
          soft: v("accent-soft"),
        },
        // Помилки й небезпечні дії
        danger: {
          DEFAULT: v("danger"), // текст
          soft: v("danger-soft"), // фон
          line: v("danger-line"), // рамка
          strong: v("danger-strong"), // суцільна кнопка з білим текстом
        },
        // Затемнення під модальними вікнами
        scrim: v("scrim"),
        // Текст на суцільних кольорах: на accent, на небезпечній кнопці й на темних кольорах категорій, на світлих кольорах категорій
        on: {
          accent: v("on-accent"),
          solid: v("on-solid"),
          light: v("on-light"),
        },
        category: {
          study: category("study"),
          university: category("university"),
          work: category("work"),
          sport: category("sport"),
          food: category("food"),
          health: category("health"),
          personal: category("personal"),
          errands: category("errands"),
          other: category("other"),
        },

        done: {
          fg: v("done-fg"),
          bg: v("done-bg"), // помітно сірий, а не білуватий відтінок
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
