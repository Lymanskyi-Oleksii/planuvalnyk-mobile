#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Відомий баг WebView2 на Windows: вікно чорніє після згортання/розгортання
    // через апаратне прискорення GPU. Вимикаємо його для вебв'ю — це усуває проблему.
    #[cfg(target_os = "windows")]
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(target_os = "android")]
    let builder = builder.plugin(reminders_plugin());

    builder
        .run(tauri::generate_context!())
        .expect("помилка під час запуску Планувальника");
}

// Нагадування з власним макетом на Android: команди обробляє Kotlin-клас
// RemindersPlugin (gen/android/.../RemindersPlugin.kt), Rust лише реєструє його.
#[cfg(target_os = "android")]
fn reminders_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("reminders")
        .setup(|_app, api| {
            api.register_android_plugin("com.planuvalnyk.app", "RemindersPlugin")?;
            Ok(())
        })
        .build()
}
