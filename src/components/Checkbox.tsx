interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
}

export function Checkbox({ checked, onChange, size = "md" }: CheckboxProps) {
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${dim} shrink-0 rounded-md border flex items-center justify-center transition-colors ${
        checked
          ? "bg-accent border-accent"
          : "bg-white border-line hover:border-accent/60"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none">
          <path
            d="M3.5 8.5L6.5 11.5L12.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
