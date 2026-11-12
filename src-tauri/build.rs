fn main() {
    // Плагін «reminders» живе всередині застосунку (Kotlin на Android),
    // тож його команди й дозвіл reminders:default оголошуємо тут.
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "reminders",
            tauri_build::InlinedPlugin::new()
                .commands(&["schedule", "cancel_all"])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("помилка під час збірки Планувальника");
}
