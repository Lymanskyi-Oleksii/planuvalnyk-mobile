package com.planuvalnyk.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

// Одне нагадування з плану, який надсилає JS (lib/reminders.ts).
data class Reminder(
  val id: Int,
  val whenMs: Long,
  val title: String,
  val body: String,
  val details: String,
  val color: String,
  val emoji: String,
  val silent: Boolean,
  val channelId: String,
  val date: String,
  val taskId: String,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("whenMs", whenMs)
    .put("title", title)
    .put("body", body)
    .put("details", details)
    .put("color", color)
    .put("emoji", emoji)
    .put("silent", silent)
    .put("channelId", channelId)
    .put("date", date)
    .put("taskId", taskId)

  companion object {
    fun fromJson(o: JSONObject) = Reminder(
      id = o.getInt("id"),
      whenMs = o.getLong("whenMs"),
      title = o.optString("title"),
      body = o.optString("body"),
      details = o.optString("details"),
      color = o.optString("color"),
      emoji = o.optString("emoji"),
      silent = o.optBoolean("silent"),
      channelId = o.optString("channelId"),
      date = o.optString("date"),
      taskId = o.optString("taskId"),
    )
  }
}

// Збереження плану й будильники. Спільне для плагіна, показу сповіщення,
// кнопок і відновлення після перезавантаження телефона.
object ReminderAlarms {
  private const val PREFS = "reminders"
  private const val KEY_LIST = "list"
  const val EXTRA_ID = "id"

  fun parse(arr: JSONArray): List<Reminder> =
    (0 until arr.length()).map { Reminder.fromJson(arr.getJSONObject(it)) }

  fun save(ctx: Context, list: List<Reminder>) {
    val arr = JSONArray()
    list.forEach { arr.put(it.toJson()) }
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY_LIST, arr.toString()).apply()
  }

  fun load(ctx: Context): List<Reminder> {
    val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_LIST, null) ?: return emptyList()
    return try {
      parse(JSONArray(raw))
    } catch (e: Exception) {
      emptyList() // пошкоджений запис — вважаємо, що плану немає
    }
  }

  fun find(ctx: Context, id: Int): Reminder? = load(ctx).firstOrNull { it.id == id }

  /** Ставить будильники на всі нагадування, час яких ще не минув. */
  fun setAll(ctx: Context, list: List<Reminder>) {
    val now = System.currentTimeMillis()
    list.filter { it.whenMs > now }.forEach { set(ctx, it.id, it.whenMs) }
  }

  /** Будильник на нагадування `id` у момент `whenMs`. */
  fun set(ctx: Context, id: Int, whenMs: Long) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pendingIntent(ctx, id)
    // Без дозволу на точні будильники (Android 12+) — неточний, але теж у режимі сну
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
    } else {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
    }
  }

  /** Скасовує будильники збереженого плану й очищає його. */
  fun cancelAll(ctx: Context) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    load(ctx).forEach { am.cancel(pendingIntent(ctx, it.id)) }
    save(ctx, emptyList())
  }

  private fun pendingIntent(ctx: Context, id: Int): PendingIntent {
    val intent = Intent(ctx, ReminderReceiver::class.java).putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(
      ctx,
      id,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
