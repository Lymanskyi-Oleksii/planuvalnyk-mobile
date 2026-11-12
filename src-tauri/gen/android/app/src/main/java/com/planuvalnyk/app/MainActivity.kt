package com.planuvalnyk.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    rememberOpenDate(intent)
  }

  // Застосунок уже запущено (launchMode singleTask) — натискання на сповіщення
  // приходить сюди, а не в onCreate
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    rememberOpenDate(intent)
  }

  // День зі сповіщення-нагадування; JS забирає його командою take_open_date
  private fun rememberOpenDate(intent: Intent?) {
    val date = intent?.getStringExtra(ReminderReceiver.EXTRA_DATE)
    if (!date.isNullOrBlank()) {
      pendingOpenDate = date
      intent.removeExtra(ReminderReceiver.EXTRA_DATE) // не відкривати той самий день повторно
    }
  }

  companion object {
    @Volatile
    var pendingOpenDate: String? = null
  }
}
