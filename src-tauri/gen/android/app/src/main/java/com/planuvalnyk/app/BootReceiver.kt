package com.planuvalnyk.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

// Після перезавантаження телефона Android забуває всі будильники.
// Читаємо збережений план і ставимо заново ті, час яких ще не минув.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != ACTION_QUICKBOOT) return

    val list = ReminderAlarms.load(context)
    ReminderAlarms.setAll(context, list)
    val future = list.count { it.whenMs > System.currentTimeMillis() }
    Log.d(ReminderAlarms.TAG, "boot: $action, у плані ${list.size}, поставлено $future")
  }

  companion object {
    // Швидке ввімкнення на деяких телефонах (зокрема Xiaomi/HTC)
    private const val ACTION_QUICKBOOT = "android.intent.action.QUICKBOOT_POWERON"
  }
}
