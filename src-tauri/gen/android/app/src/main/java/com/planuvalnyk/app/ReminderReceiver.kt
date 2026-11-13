package com.planuvalnyk.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

// Спрацьовує будильник нагадування: показуємо сповіщення з власним макетом
// (res/layout/notification_reminder_small.xml і notification_reminder_big.xml).
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getIntExtra(ReminderAlarms.EXTRA_ID, -1)
    val reminder = ReminderAlarms.find(context, id)
    if (reminder == null) {
      Log.d(ReminderAlarms.TAG, "receiver: id=$id немає в збереженому плані — пропускаю")
      return
    }
    val lateSec = (System.currentTimeMillis() - reminder.whenMs) / 1000
    Log.d(ReminderAlarms.TAG, "receiver: id=$id «${ReminderAlarms.hidden(reminder.title)}», запізнення ${lateSec} с")
    show(context, reminder)
  }

  companion object {
    const val EXTRA_DATE = "date"

    fun show(ctx: Context, r: Reminder) {
      val manager = NotificationManagerCompat.from(ctx)
      // Без дозволу (Android 13+) або з вимкненими сповіщеннями показати не вийде
      if (!manager.areNotificationsEnabled()) {
        Log.d(ReminderAlarms.TAG, "show: сповіщення вимкнені або немає дозволу")
        return
      }

      val color = parseColor(ctx, r.color)

      val notification = NotificationCompat.Builder(ctx, r.channelId)
        .setSmallIcon(R.drawable.ic_notification)
        .setColor(color)
        // Текст для екрана блокування, годинника й інших місць без нашого макета
        .setContentTitle(r.title)
        .setContentText(r.body)
        .setStyle(NotificationCompat.DecoratedCustomViewStyle())
        .setCustomContentView(views(ctx, r, color, R.layout.notification_reminder_small))
        .setCustomBigContentView(views(ctx, r, color, R.layout.notification_reminder_big))
        .setContentIntent(openApp(ctx, r))
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setSilent(r.silent)
        .setAutoCancel(true)
        .build()

      try {
        manager.notify(r.id, notification)
        Log.d(ReminderAlarms.TAG, "show: id=${r.id} показано, канал ${r.channelId}")
      } catch (e: SecurityException) {
        // дозвіл забрали між перевіркою й показом
        Log.d(ReminderAlarms.TAG, "show: немає дозволу — ${e.message}")
      }
    }

    private fun views(ctx: Context, r: Reminder, color: Int, layout: Int): RemoteViews {
      val v = RemoteViews(ctx.packageName, layout)
      v.setInt(R.id.reminder_circle, "setColorFilter", color)
      v.setTextViewText(R.id.reminder_emoji, r.emoji)
      v.setTextViewText(R.id.reminder_title, r.title)
      v.setTextViewText(R.id.reminder_subtitle, r.body)
      v.setViewVisibility(R.id.reminder_subtitle, if (r.body.isBlank()) View.GONE else View.VISIBLE)
      if (layout == R.layout.notification_reminder_big) {
        v.setTextViewText(R.id.reminder_details, r.details)
        v.setViewVisibility(R.id.reminder_details, if (r.details.isBlank()) View.GONE else View.VISIBLE)
        v.setOnClickPendingIntent(
          R.id.reminder_btn_snooze,
          ReminderActionReceiver.pendingIntent(ctx, ReminderActionReceiver.ACTION_SNOOZE, r),
        )
        // У підсумків дня, перекусу й тестового сповіщення немає задачі — «Виконано» ховаємо
        if (r.taskId.isBlank()) {
          v.setViewVisibility(R.id.reminder_btn_done, View.GONE)
        } else {
          v.setOnClickPendingIntent(
            R.id.reminder_btn_done,
            ReminderActionReceiver.pendingIntent(ctx, ReminderActionReceiver.ACTION_DONE, r),
          )
        }
      }
      return v
    }

    // Натискання на сповіщення відкриває застосунок; день передаємо в extra date
    private fun openApp(ctx: Context, r: Reminder): PendingIntent {
      val intent = Intent(ctx, MainActivity::class.java)
        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .putExtra(EXTRA_DATE, r.date)
      return PendingIntent.getActivity(
        ctx,
        r.id,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    // Якщо колір категорії не розпізнано — accent застосунку
    private fun parseColor(ctx: Context, hex: String): Int =
      try {
        Color.parseColor(hex)
      } catch (e: IllegalArgumentException) {
        ContextCompat.getColor(ctx, R.color.reminder_accent)
      }
  }
}
