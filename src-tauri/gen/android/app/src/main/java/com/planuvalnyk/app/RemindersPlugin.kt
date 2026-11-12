package com.planuvalnyk.app

import android.app.Activity
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray

// Плагін Tauri «reminders»: JS передає весь план нагадувань одним викликом.
// Виклики з JS: plugin:reminders|schedule, |cancel_all, |pending_done, |ack_done
// (Tauri перетворює snake_case на назви методів: cancelAll, pendingDone, ackDone).
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
  // Відповідь: { taskIds: string[] }. Черга НЕ очищається — лише ackDone
  // після успішного запису в базу.
  @Command
  fun pendingDone(invoke: Invoke) {
    try {
      val ids = ReminderAlarms.pendingDone(activity.applicationContext)
      Log.d(ReminderAlarms.TAG, "pendingDone: у черзі ${ids.size}")
      val ret = JSObject()
      ret.put("taskIds", JSONArray(ids))
      invoke.resolve(ret)
    } catch (e: Exception) {
      invoke.reject("Не вдалося прочитати виконані задачі: ${e.message}")
    }
  }

  // Аргументи: { taskIds: string[] } — задачі, вже позначені в базі.
  @Command
  fun ackDone(invoke: Invoke) {
    try {
      val arr = invoke.getArgs().getJSONArray("taskIds")
      val ids = (0 until arr.length()).map { arr.getString(it) }
      ReminderAlarms.ackDone(activity.applicationContext, ids)
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Не вдалося оновити чергу виконаних: ${e.message}")
    }
  }
}
