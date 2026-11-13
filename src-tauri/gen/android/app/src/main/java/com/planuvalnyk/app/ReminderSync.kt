package com.planuvalnyk.app

import android.content.Context
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

// Запис «Виконано» в Supabase прямо з кнопки сповіщення, без відкриття застосунку.
// Токен входу передає JS (команда set_auth) при кожному вході й оновленні сесії.
// Сам токен тут не оновлюється: це робить лише застосунок, інакше Supabase може
// визнати оновлення повторним і завершити сесію. Прострочений токен — задача
// лишається в черзі й позначиться, коли застосунок відкриють.
object ReminderSync {
  private const val PREFS = "reminders_auth"
  private const val TIMEOUT_MS = 8_000
  private const val EXPIRY_MARGIN_MS = 60_000L

  fun saveAuth(ctx: Context, url: String, anonKey: String, accessToken: String, expiresAtMs: Long) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("url", url)
      .putString("anonKey", anonKey)
      .putString("accessToken", accessToken)
      .putLong("expiresAt", expiresAtMs)
      .apply()
  }

  fun clearAuth(ctx: Context) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
  }

  /** true — задачу позначено в базі; false — лишається в черзі. Викликати не з головного потоку. */
  fun markDoneRemote(ctx: Context, taskId: String): Boolean {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val url = prefs.getString("url", null)
    val anonKey = prefs.getString("anonKey", null)
    val token = prefs.getString("accessToken", null)
    val expiresAt = prefs.getLong("expiresAt", 0)
    if (url.isNullOrBlank() || anonKey.isNullOrBlank() || token.isNullOrBlank()) {
      Log.d(ReminderAlarms.TAG, "sync: немає даних входу — лишаю в черзі")
      return false
    }
    if (System.currentTimeMillis() > expiresAt - EXPIRY_MARGIN_MS) {
      Log.d(ReminderAlarms.TAG, "sync: токен прострочений — лишаю в черзі")
      return false
    }

    var conn: HttpURLConnection? = null
    return try {
      val id = URLEncoder.encode(taskId, "UTF-8")
      conn = URL("${url.trimEnd('/')}/rest/v1/scheduled_tasks?id=eq.$id").openConnection() as HttpURLConnection
      // На Android HttpURLConnection працює через OkHttp і приймає PATCH
      conn.requestMethod = "PATCH"
      conn.setRequestProperty("apikey", anonKey)
      conn.setRequestProperty("Authorization", "Bearer $token")
      conn.setRequestProperty("Content-Type", "application/json")
      conn.setRequestProperty("Prefer", "return=minimal")
      conn.connectTimeout = TIMEOUT_MS
      conn.readTimeout = TIMEOUT_MS
      conn.doOutput = true
      conn.outputStream.use { it.write("""{"done":true}""".toByteArray()) }
      val code = conn.responseCode
      Log.d(ReminderAlarms.TAG, "sync: task=${ReminderAlarms.hidden(taskId)} → HTTP $code")
      code in 200..299
    } catch (e: Exception) {
      Log.d(ReminderAlarms.TAG, "sync: помилка мережі — ${ReminderAlarms.hidden(e.message)}")
      false
    } finally {
      conn?.disconnect()
    }
  }
}
