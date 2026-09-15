// Ховаємо консольне вікно на Windows у релізній збірці
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    planuvalnyk_lib::run();
}
