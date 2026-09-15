import { CATEGORY_LABELS, type Category } from "@/types";

const STYLES: Record<Category, string> = {
  study: "text-category-study-fg bg-category-study-bg",
  university: "text-category-university-fg bg-category-university-bg",
  work: "text-category-work-fg bg-category-work-bg",
  sport: "text-category-sport-fg bg-category-sport-bg",
  food: "text-category-food-fg bg-category-food-bg",
  health: "text-category-health-fg bg-category-health-bg",
  personal: "text-category-personal-fg bg-category-personal-bg",
  errands: "text-category-errands-fg bg-category-errands-bg",
  other: "text-category-other-fg bg-category-other-bg",
};

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STYLES[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
