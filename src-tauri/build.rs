fn main() {
    // Плагін «reminders» живе всередині застосунку (Kotlin на Android),
    // тож його команди й дозвіл reminders:default оголошуємо тут.
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "reminders",
            tauri_build::InlinedPlugin::new()
                .commands(&["schedule", "cancel_all", "pending_done", "ack_done", "set_auth", "take_open_date"])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("помилка під час збірки Планувальника");
}
