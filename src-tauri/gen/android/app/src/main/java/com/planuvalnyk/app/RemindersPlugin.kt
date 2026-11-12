package com.planuvalnyk.app

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

// Плагін Tauri «reminders»: JS передає весь план нагадувань одним викликом.
// Виклики з JS: plugin:reminders|schedule і plugin:reminders|cancel_all
// (Tauri перетворює cancel_all на cancelAll).
@TauriPlugin
class RemindersPlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun schedule(invoke: Invoke) {
    try {
      val list = ReminderAlarms.parse(invoke.getArgs().getJSONArray("reminders"))
      val ctx = activity.applicationContext
      // Новий план повністю замінює попередній
      ReminderAlarms.cancelAll(ctx)
      ReminderAlarms.save(ctx, list)
      ReminderAlarms.setAll(ctx, list)
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Не вдалося запланувати нагадування: ${e.message}")
    }
  }

  @Command
  fun cancelAll(invoke: Invoke) {
    try {
      ReminderAlarms.cancelAll(activity.applicationContext)
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Не вдалося скасувати нагадування: ${e.message}")
    }
  }
}
