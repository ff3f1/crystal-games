package ru.crystalgames.arsenal;

import android.app.*;
import android.content.*;
import android.os.Build;
import android.media.AudioAttributes;
import android.media.RingtoneManager;

public final class FeederAlarm extends BroadcastReceiver {
 private static final String CHANNEL="feeder_timer_v1", PREF="feeder_alarm";
 private static final int ID=771;
 private static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
 private static AlarmManager alarms(Context c){return c.getSystemService(AlarmManager.class);}
 private static NotificationManager notifications(Context c){return c.getSystemService(NotificationManager.class);}
 static boolean exact(Context c){return Build.VERSION.SDK_INT<31||alarms(c).canScheduleExactAlarms();}
 static void channel(Context c){
  NotificationChannel ch=new NotificationChannel(CHANNEL,"Фидер — перезаброс",NotificationManager.IMPORTANCE_HIGH);
  ch.setDescription("Сигнал окончания интервала перезаброса");
  ch.enableVibration(true);ch.setVibrationPattern(new long[]{0,250,120,250});
  ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
  notifications(c).createNotificationChannel(ch);
 }
 static boolean allowed(Context c){channel(c);NotificationChannel ch=notifications(c).getNotificationChannel(CHANNEL);return notifications(c).areNotificationsEnabled()&&ch!=null&&ch.getImportance()!=NotificationManager.IMPORTANCE_NONE;}
 private static PendingIntent pending(Context c,long end){
  return PendingIntent.getBroadcast(c,ID,new Intent(c,FeederAlarm.class).putExtra("end",end),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
 }
 static synchronized void set(Context c,long end){
  long now=System.currentTimeMillis();
  if(end<=0||end>now+121*60000L){alarms(c).cancel(pending(c,0));prefs(c).edit().remove("end").commit();notifications(c).cancel(ID);return;}
  if(prefs(c).getLong("fired",0)==end)return;
  if(prefs(c).getLong("end",0)!=end)notifications(c).cancel(ID);
  if(!prefs(c).edit().putLong("end",end).commit())return;
  if(end<=now){if(now-end<=120000)fire(c,end);else prefs(c).edit().remove("end").commit();return;}
  PendingIntent p=pending(c,end);
  try{if(exact(c))alarms(c).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,end,p);else alarms(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,end,p);}
  catch(SecurityException e){alarms(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,end,p);}
 }
 static void resume(Context c){long end=prefs(c).getLong("end",0);if(end>0)set(c,end);}
 static synchronized void fire(Context c,long end){
  long now=System.currentTimeMillis();
  if(end<=0||prefs(c).getLong("end",0)!=end||prefs(c).getLong("fired",0)==end||now<end)return;
  if(now-end>120000){prefs(c).edit().remove("end").commit();return;}
  if(!allowed(c))return;
  if(!prefs(c).edit().putLong("fired",end).remove("end").commit())return;
  alarms(c).cancel(pending(c,end));
  PendingIntent open=PendingIntent.getActivity(c,ID,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification n=new Notification.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Пора перезабрасывать!").setContentText("Интервал фидерного таймера закончился.").setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build();
  try{notifications(c).notify(ID,n);}catch(SecurityException ignored){}
 }
 @Override public void onReceive(Context c,Intent i){fire(c,i.getLongExtra("end",0));}
}
