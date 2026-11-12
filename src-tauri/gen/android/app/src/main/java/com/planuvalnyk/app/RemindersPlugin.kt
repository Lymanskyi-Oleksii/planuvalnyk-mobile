package com.planuvalnyk.app

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray

// Плагін Tauri «reminders»: JS передає весь план нагадувань одним викликом.
// Виклики з JS: plugin:reminders|schedule, |cancel_all, |take_pending_done
// (Tauri перетворює snake_case на назви методів: cancelAll, takePendingDone).
@TauriPlugin
class RemindersPlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun schedule(invoke: Invoke) {
    try {
      val list = ReminderAlarms.parse(invoke.getArgs().getJSONArray("reminders"))
      // Новий план замінює попередній (крім відкладених кнопкою нагадувань)
      ReminderAlarms.replacePlan(activity.applicationContext, list)
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

  // Задачі, позначені кнопкою «Виконано», поки застосунок був закритий.
  // Відповідь: { taskIds: string[] }; черга після цього порожня.
  @Command
  fun takePendingDone(invoke: Invoke) {
    try {
      val ids = ReminderAlarms.takePendingDone(activity.applicationContext)
      val ret = JSObject()
      ret.put("taskIds", JSONArray(ids))
      invoke.resolve(ret)
    } catch (e: Exception) {
      invoke.reject("Не вдалося прочитати виконані задачі: ${e.message}")
    }
  }
}
