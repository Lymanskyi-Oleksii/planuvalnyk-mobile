#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Відомий баг WebView2 на Windows: вікно чорніє після згортання/розгортання
    // через апаратне прискорення GPU. Вимикаємо його для вебв'ю — це усуває проблему.
    #[cfg(target_os = "windows")]
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu");

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .run(tauri::generate_context!())
        .expect("помилка під час запуску Планувальника");
}
