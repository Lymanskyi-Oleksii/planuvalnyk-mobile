package com.planuvalnyk.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat

// Кнопки сповіщення «Виконано» і «Відкласти на 10 хв». Застосунок не відкривається.
class ReminderActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getIntExtra(ReminderAlarms.EXTRA_ID, -1)
    Log.d(ReminderAlarms.TAG, "action: ${intent.action}, id=$id, task=${intent.getStringExtra(EXTRA_TASK_ID)}")
    if (id == -1) return
    NotificationManagerCompat.from(context).cancel(id)

    when (intent.action) {
      ACTION_SNOOZE -> ReminderAlarms.snooze(context, id, SNOOZE_MS)
      ACTION_DONE -> {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID)
        if (taskId.isNullOrBlank()) return
        // Спершу в чергу (на диск), потім спроба записати в базу одразу.
        // Не вдалося — позначить JS при наступному відкритті (pendingDone / ackDone).
        ReminderAlarms.markDone(context, taskId)
        val pending = goAsync() // мережа — не в головному потоці
        val app = context.applicationContext
        Thread {
          try {
            if (ReminderSync.markDoneRemote(app, taskId)) {
              ReminderAlarms.ackDone(app, listOf(taskId))
            }
          } finally {
            pending.finish()
          }
        }.start()
      }
    }
  }

  companion object {
    const val ACTION_DONE = "com.planuvalnyk.app.REMINDER_DONE"
    const val ACTION_SNOOZE = "com.planuvalnyk.app.REMINDER_SNOOZE"
    private const val EXTRA_TASK_ID = "taskId"
    private const val SNOOZE_MS = 10 * 60 * 1000L

    // Унікальність PendingIntent: requestCode = id сповіщення, а різні кнопки
    // розрізняються action, тож інтенти не перезаписують один одного.
    fun pendingIntent(ctx: Context, action: String, r: Reminder): PendingIntent {
      val intent = Intent(ctx, ReminderActionReceiver::class.java)
        .setAction(action)
        .putExtra(ReminderAlarms.EXTRA_ID, r.id)
        .putExtra(EXTRA_TASK_ID, r.taskId)
      return PendingIntent.getBroadcast(
        ctx,
        r.id,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
