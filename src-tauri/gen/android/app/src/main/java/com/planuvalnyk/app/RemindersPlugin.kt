package com.planuvalnyk.app

import android.app.Activity
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject

// Плагін Tauri «reminders»: JS передає весь план нагадувань одним викликом.
// Виклики з JS: plugin:reminders|schedule, |cancel_all, |sign_out, |pending_done, |ack_done,
// |set_auth, |take_open_date (Tauri перетворює snake_case на camelCase-методи).
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

  // Вихід з акаунта: план, будильники, черга «Виконано» й дані входу.
  // Черга належить користувачеві, що вийшов: з токеном наступного RLS змінив би 0 рядків.
  @Command
  fun signOut(invoke: Invoke) {
    try {
      val ctx = activity.applicationContext
      ReminderAlarms.cancelAll(ctx)
      ReminderAlarms.clearPendingDone(ctx)
      ReminderSync.clearAuth(ctx)
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Не вдалося очистити нагадування: ${e.message}")
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

  // Дані входу для запису «Виконано» без відкриття застосунку.
  // Аргументи: { url, anonKey, accessToken, expiresAt (мс) }; порожній accessToken — вийшли.
  @Command
  fun setAuth(invoke: Invoke) {
    try {
      val a = invoke.getArgs()
      val ctx = activity.applicationContext
      val token = a.optString("accessToken")
      if (token.isBlank()) {
        ReminderSync.clearAuth(ctx)
      } else {
        ReminderSync.saveAuth(ctx, a.getString("url"), a.getString("anonKey"), token, a.getLong("expiresAt"))
      }
      invoke.resolve()
    } catch (e: Exception) {
      invoke.reject("Не вдалося зберегти дані входу: ${e.message}")
    }
  }

  // День, який треба відкрити після натискання на сповіщення.
  // Відповідь: { date: string | null }; після виклику скидається.
  @Command
  fun takeOpenDate(invoke: Invoke) {
    val date = MainActivity.pendingOpenDate
    MainActivity.pendingOpenDate = null
    val ret = JSObject()
    ret.put("date", date ?: JSONObject.NULL)
    invoke.resolve(ret)
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
