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
    list.filter { it.whenMs > now }.forEach { set(ctx, it.id, it.whenMs, alarmClock = it.snoozed) }
  }

  /**
   * Будильник на нагадування `id` у момент `whenMs`.
   * alarmClock — для відкладених: setAlarmClock система вважає будильником і не
   * затримує навіть на HyperOS (Logcat: звичайний точний прийшов на 92 с пізніше,
   * лише коли відкрили застосунок). Мінус — значок будильника в рядку стану.
   */
  fun set(ctx: Context, id: Int, whenMs: Long, alarmClock: Boolean = false) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pendingIntent(ctx, id)
    // Без дозволу на точні будильники (Android 12+) — неточний, але теж у режимі сну
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    val kind = when {
      exact && alarmClock -> {
        am.setAlarmClock(AlarmManager.AlarmClockInfo(whenMs, openAppIntent(ctx)), pi)
        "будильник"
      }
      exact -> {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
        "точний"
      }
      else -> {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
        "неточний"
      }
    }
    Log.d(TAG, "set: id=$id на ${java.util.Date(whenMs)}, $kind (SDK ${Build.VERSION.SDK_INT})")
  }

  // Натискання на значок будильника в рядку стану відкриває застосунок
  private fun openAppIntent(ctx: Context): PendingIntent =
    PendingIntent.getActivity(
      ctx,
      0,
      Intent(ctx, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /**
   * Новий план із JS замінює попередній. Відкладені нагадування, яких у новому
   * плані немає (їхній початковий час уже минув), лишаються, якщо їхня задача
   * ще чекає нагадувань: є в openTaskIds (невиконані з увімкненим нагадуванням,
   * дні від fromDate) або датована раніше за fromDate. Задача виконана чи
   * видалена — відкладене більше не прийде. openTaskIds == null — без перевірки.
   */
  @Synchronized
  fun replacePlan(ctx: Context, plan: List<Reminder>, openTaskIds: Set<String>?, fromDate: String) {
    val now = System.currentTimeMillis()
    val old = load(ctx)
    val stillWanted = { r: Reminder ->
      openTaskIds == null || r.taskId.isBlank() || r.taskId in openTaskIds || r.date < fromDate
    }
    val keep = old.filter { r -> r.snoozed && r.whenMs > now && plan.none { it.id == r.id } && stillWanted(r) }
    cancel(ctx, old)
    val merged = plan + keep
    save(ctx, merged)
    setAll(ctx, merged)
    Log.d(TAG, "replacePlan: нових ${plan.size}, збережено відкладених ${keep.size}")
  }

  /** Одне нагадування до збереженого плану (тестове), решта плану не змінюється. */
  @Synchronized
  fun add(ctx: Context, r: Reminder) {
    val list = load(ctx).filter { it.id != r.id } + r
    save(ctx, list)
    set(ctx, r.id, r.whenMs)
    Log.d(TAG, "add: id=${r.id}, у плані ${list.size}")
  }

  /** Скасовує будильники збереженого плану й очищає його. */
  @Synchronized
  fun cancelAll(ctx: Context) {
    val old = load(ctx)
    cancel(ctx, old)
    save(ctx, emptyList())
    Log.d(TAG, "cancelAll: скасовано ${old.size}")
  }

  /**
   * «Відкласти»: те саме нагадування ще раз через `delayMs`.
   * fallback — копія з кнопки сповіщення: план могли перепланувати після показу,
   * і тоді минулого нагадування в ньому вже немає.
   */
  @Synchronized
  fun snooze(ctx: Context, id: Int, delayMs: Long, fallback: Reminder?) {
    val list = load(ctx)
    val r = list.firstOrNull { it.id == id } ?: fallback ?: run {
      Log.d(TAG, "snooze: id=$id немає ні в плані, ні в кнопці")
      return
    }
    val moved = r.copy(whenMs = System.currentTimeMillis() + delayMs, snoozed = true)
    saveNow(ctx, list.filter { it.id != id } + moved)
    set(ctx, id, moved.whenMs, alarmClock = true)
    Log.d(TAG, "snooze: id=$id до ${java.util.Date(moved.whenMs)}")
  }

  /** «Виконано»: прибрати всі нагадування задачі й запам'ятати її для JS. */
  @Synchronized
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

  /** Задачу позначили виконаною в застосунку: прибрати її нагадування, разом із відкладеними. */
  @Synchronized
  fun cancelTask(ctx: Context, taskId: String) {
    val (task, rest) = load(ctx).partition { it.taskId == taskId }
    if (task.isEmpty()) return
    cancel(ctx, task)
    save(ctx, rest)
    Log.d(TAG, "cancelTask: знято будильників ${task.size}")
  }

  /** Черга задач, позначених кнопкою «Виконано». Не очищається: див. ackDone. */
  fun pendingDone(ctx: Context): List<String> =
    readQueue(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PENDING_DONE, null))

  /** Прибирає з черги задачі, які вже записано в базу (JS або ReminderSync). */
  @Synchronized
  fun ackDone(ctx: Context, taskIds: List<String>) {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val queue = readQueue(prefs.getString(KEY_PENDING_DONE, null))
    queue.removeAll(taskIds.toSet())
    // commit, а не apply: черга має бути на диску до відповіді в JS
    prefs.edit().putString(KEY_PENDING_DONE, JSONArray(queue).toString()).commit()
    Log.d(TAG, "ackDone: ${taskIds.size} підтверджено, у черзі лишилось ${queue.size}")
  }

  /** Вихід з акаунта: черга належала попередньому користувачеві. */
  @Synchronized
  fun clearPendingDone(ctx: Context) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_PENDING_DONE).commit()
    Log.d(TAG, "clearPendingDone")
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
