import { useEffect, useState } from "react";
import { loadView, subscribeView, type ViewSettings } from "@/lib/settings";

// Режим розкладу (список/календар) з підпискою: кнопка в шапці, налаштування й App бачать одне й те саме.
export function useView(): ViewSettings {
  const [view, setView] = useState<ViewSettings>(() => loadView());
  useEffect(() => subscribeView(setView), []);
  return view;
}
