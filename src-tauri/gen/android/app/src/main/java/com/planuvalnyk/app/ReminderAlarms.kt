package com.planuvalnyk.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
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
  // Відкладене кнопкою «Відкласти на 10 хв»: переживає нове планування з JS
  val snoozed: Boolean = false,
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
    .put("snoozed", snoozed)

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
      snoozed = o.optBoolean("snoozed"),
    )
  }
}

// Збереження плану, будильники й черга «Виконано». Спільне для плагіна, показу
// сповіщення, кнопок і відновлення після перезавантаження телефона.
object ReminderAlarms {
  const val TAG = "Reminders" // тег для Logcat
  private const val PREFS = "reminders"
  private const val KEY_LIST = "list"
  private const val KEY_PENDING_DONE = "pending_done"
  const val EXTRA_ID = "id"

  fun parse(arr: JSONArray): List<Reminder> =
    (0 until arr.length()).map { Reminder.fromJson(arr.getJSONObject(it)) }

  fun save(ctx: Context, list: List<Reminder>) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY_LIST, toJsonArray(list)).apply()
  }

  // Синхронний запис — для receiver-ів, після яких процес може зупинитись
  private fun saveNow(ctx: Context, list: List<Reminder>) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY_LIST, toJsonArray(list)).commit()
  }

  private fun toJsonArray(list: List<Reminder>): String {
    val arr = JSONArray()
    list.forEach { arr.put(it.toJson()) }
    return arr.toString()
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
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    if (exact) {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
    }
    Log.d(TAG, "set: id=$id на ${java.util.Date(whenMs)}, точний=$exact (SDK ${Build.VERSION.SDK_INT})")
  }

  /**
   * Новий план із JS замінює попередній. Відкладені нагадування, яких у новому
   * плані немає (їхній початковий час уже минув), лишаються.
   */
  fun replacePlan(ctx: Context, plan: List<Reminder>) {
    val now = System.currentTimeMillis()
    val old = load(ctx)
    val keep = old.filter { r -> r.snoozed && r.whenMs > now && plan.none { it.id == r.id } }
    cancel(ctx, old)
    val merged = plan + keep
    save(ctx, merged)
    setAll(ctx, merged)
    Log.d(TAG, "replacePlan: нових ${plan.size}, збережено відкладених ${keep.size}")
  }

  /** Скасовує будильники збереженого плану й очищає його. */
  fun cancelAll(ctx: Context) {
    val old = load(ctx)
    cancel(ctx, old)
    save(ctx, emptyList())
    Log.d(TAG, "cancelAll: скасовано ${old.size}")
  }

  /** «Відкласти»: те саме нагадування ще раз через `delayMs`. */
  fun snooze(ctx: Context, id: Int, delayMs: Long) {
    val list = load(ctx)
    val r = list.firstOrNull { it.id == id } ?: return
    val moved = r.copy(whenMs = System.currentTimeMillis() + delayMs, snoozed = true)
    saveNow(ctx, list.map { if (it.id == id) moved else it })
    set(ctx, id, moved.whenMs)
    Log.d(TAG, "snooze: id=$id до ${java.util.Date(moved.whenMs)}")
  }

  /** «Виконано»: прибрати всі нагадування задачі й запам'ятати її для JS. */
  fun markDone(ctx: Context, taskId: String) {
    val list = load(ctx)
    val (task, rest) = list.partition { it.taskId == taskId }
    cancel(ctx, task)
    saveNow(ctx, rest)

    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val queue = readQueue(prefs.getString(KEY_PENDING_DONE, null))
    if (taskId !in queue) queue.add(taskId)
    // commit: процес після receiver-а може бути зупинений будь-якої миті
    prefs.edit().putString(KEY_PENDING_DONE, JSONArray(queue).toString()).commit()
    Log.d(TAG, "markDone: task=$taskId, знято будильників ${task.size}, у черзі ${queue.size}")
  }

  /** Черга задач, позначених кнопкою «Виконано». Не очищається: див. ackDone. */
  fun pendingDone(ctx: Context): List<String> =
    readQueue(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PENDING_DONE, null))

  /** Прибирає з черги задачі, які JS уже записав у базу. */
  fun ackDone(ctx: Context, taskIds: List<String>) {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val queue = readQueue(prefs.getString(KEY_PENDING_DONE, null))
    queue.removeAll(taskIds.toSet())
    // commit, а не apply: черга має бути на диску до відповіді в JS
    prefs.edit().putString(KEY_PENDING_DONE, JSONArray(queue).toString()).commit()
    Log.d(TAG, "ackDone: ${taskIds.size} підтверджено, у черзі лишилось ${queue.size}")
  }

  private fun readQueue(raw: String?): MutableList<String> {
    if (raw == null) return mutableListOf()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { arr.getString(it) }.toMutableList()
    } catch (e: Exception) {
      mutableListOf()
    }
  }

  private fun cancel(ctx: Context, list: List<Reminder>) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    list.forEach { am.cancel(pendingIntent(ctx, it.id)) }
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
