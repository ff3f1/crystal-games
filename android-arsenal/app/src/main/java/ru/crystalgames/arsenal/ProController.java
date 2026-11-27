package ru.crystalgames.arsenal;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import android.widget.EditText;
import android.widget.Toast;
import org.json.JSONObject;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import javax.net.ssl.HttpsURLConnection;

final class ProController {
 private final Activity activity;
 private final SharedPreferences prefs;
 private final Runnable changed;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final String mode=BuildConfig.DEBUG?"test":"live";
 private volatile boolean active=false,closed=false;
 private boolean busy=false;
 private volatile int quotedPrice=0, promoRemaining=0;
 String priceLabel(){return quotedPrice==19900?"199 ₽":quotedPrice==39900?"399 ₽":"Цена при оформлении";}
 ProController(Activity a,Runnable onChange){
  activity=a;changed=onChange;
  prefs=a.getSharedPreferences("arsenal_pro_"+mode,Context.MODE_PRIVATE);
  active=prefs.getBoolean("verified_paid",false)&&valid(prefs.getString("code",""));
 }
 boolean isActive(){return active;}
 boolean configured(){return BuildConfig.LICENSE_BASE_URL.startsWith("https://");}
 private boolean valid(String s){return s!=null&&s.matches("[A-Za-z0-9_-]{43}");}
 private String code(){return prefs.getString("code","");}
 private String newCode(){byte[] b=new byte[32];new SecureRandom().nextBytes(b);return Base64.encodeToString(b,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
 private void say(String s){Toast.makeText(activity,s,Toast.LENGTH_LONG).show();}
 private void copy(String key){
  ClipboardManager cm=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);
  ClipData clip=ClipData.newPlainText("Код восстановления PRO",key);
  if(android.os.Build.VERSION.SDK_INT>=33){android.os.PersistableBundle extras=new android.os.PersistableBundle();extras.putBoolean("android.content.extra.IS_SENSITIVE",true);clip.getDescription().setExtras(extras);}
  cm.setPrimaryClip(clip);say("Код скопирован. Сохраните его в надёжном месте.");
 }
 void open(){
  if(!configured()){new AlertDialog.Builder(activity).setTitle("Арсенал PRO").setMessage("Разовая покупка — 399 ₽. Без рекламы. Оплата пока не подключена.").setPositiveButton("Закрыть",null).show();return;}
  new AlertDialog.Builder(activity).setTitle(active?"PRO активирован":"Арсенал PRO — "+priceLabel())
   .setMessage((BuildConfig.DEBUG?"ТЕСТОВЫЙ РЕЖИМ — деньги не списываются.\n\n":"")+ (active?"Реклама отключена. До 5 фото на карточку. Сохраните код восстановления для нового телефона.":"Один платёж, без подписки. Без рекламы и до 5 фото на карточку. Для восстановления используется личный код покупки."))
   .setPositiveButton(active?"Код восстановления":"Купить PRO",(d,w)->{if(active)showCode(code(),false);else purchase();})
   .setNeutralButton("Восстановить",(d,w)->restore())
   .setNegativeButton("Проверить оплату",(d,w)->check(true)).show();
 }
 private void purchase(){
  if(busy){say("Запрос уже выполняется");return;}
  String k=code();
  if(!valid(k)){k=newCode();if(!prefs.edit().putString("code",k).putBoolean("verified_paid",false).commit()){say("Не удалось сохранить код покупки");return;}}
  showCode(k,true);
 }
 private void showCode(String k,boolean purchase){
  if(!valid(k)){say("Код пока отсутствует");return;}
  AlertDialog.Builder d=new AlertDialog.Builder(activity).setTitle("Код восстановления")
   .setMessage(k+"\n\nСохраните код. Он подтверждает право восстановления PRO; не передавайте его другим.");
  d.setNeutralButton("Копировать",(x,y)->{copy(k);if(purchase)showCode(k,true);});
  if(purchase)d.setPositiveButton("К оплате",(x,y)->request("/order",k,false,true));
  d.setNegativeButton("Закрыть",null).show();
 }
 private void restore(){
  EditText input=new EditText(activity);input.setSingleLine(true);input.setHint("Код восстановления");
  new AlertDialog.Builder(activity).setTitle("Восстановить покупку").setView(input)
   .setPositiveButton("Восстановить",(d,w)->{String k=input.getText().toString().trim();if(!valid(k)){say("Некорректный код");return;}request("/status",k,true,true);})
   .setNegativeButton("Отмена",null).show();
 }
 void refresh(){if(configured()&&valid(code())&&!busy)check(false);}
 private void check(boolean notify){
  if(!valid(code())){if(notify)say("Сначала начните покупку или введите код восстановления");return;}
  request("/status",code(),false,notify);
 }
 private void request(String endpoint,String k,boolean restore,boolean notify){
  if(!configured()||closed||busy)return;
  busy=true;
  worker.execute(()->{
   JSONObject result=null;
   HttpsURLConnection c=null;
   try{
    URL url=new URL(BuildConfig.LICENSE_BASE_URL+endpoint+".php");
    c=(HttpsURLConnection)url.openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(10000);c.setReadTimeout(10000);
    c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Cache-Control","no-store");
    byte[] body=new JSONObject().put("code",k).put("mode",mode).toString().getBytes(StandardCharsets.UTF_8);
    try(OutputStream out=c.getOutputStream()){out.write(body);}
    if(c.getResponseCode()!=200)throw new IOException("HTTP");
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    try(InputStream in=c.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){bytes.write(b,0,n);if(bytes.size()>32768)throw new IOException("size");}}
    result=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
    if(!mode.equals(result.optString("mode")))result=null;
   }catch(Exception ignored){}finally{if(c!=null)c.disconnect();}
   final JSONObject data=result;
   activity.runOnUiThread(()->{
    busy=false;if(closed||activity.isFinishing()||activity.isDestroyed())return;
    if(data==null){if(notify)say("Сервис оплаты недоступен. Попробуйте позже.");return;}
    int quote=data.optInt("price_cents",0);quotedPrice=(quote==19900||quote==39900)?quote:0;promoRemaining=Math.max(0,Math.min(1000,data.optInt("promo_remaining",0)));
    String state=data.optString("state");
    if("paid".equals(state)){
     boolean saved=prefs.edit().putString("code",k).putBoolean("verified_paid",true).commit();
     if(!saved){say("Не удалось сохранить лицензию");return;}
     active=true;changed.run();if(notify)say("PRO активирован. Реклама отключена.");return;
    }
    if(restore){say("Оплаченная лицензия по этому коду не найдена");return;}
    if("refunded".equals(state)){prefs.edit().remove("code").putBoolean("verified_paid",false).commit();active=false;changed.run();if(notify)say("Лицензия возвращена. Можно оформить новую покупку.");return;}
    if("/order".equals(endpoint)&&"pending".equals(state)){
     Uri u=Uri.parse(data.optString("checkout"));
     if("https".equals(u.getScheme())&&"auth.robokassa.ru".equals(u.getHost())&&"/Merchant/Index.aspx".equals(u.getPath())&&u.getUserInfo()==null&&("test".equals(mode)?"1".equals(u.getQueryParameter("IsTest")):u.getQueryParameter("IsTest")==null)){
      String rawAmount=u.getQueryParameter("OutSum");int exact=0;try{exact=new java.math.BigDecimal(rawAmount).movePointRight(2).intValueExact();}catch(Exception ignored){}
      if((exact!=19900&&exact!=39900)||(quotedPrice!=0&&exact!=quotedPrice)){say("Не удалось подтвердить стоимость заказа");return;}
      final int price=exact;new AlertDialog.Builder(activity).setTitle("Подтверждение покупки").setMessage("PRO — "+(price/100)+" ₽. Разовый платёж. "+(price==19900?"Акционная цена закреплена за этим счётом.":"Без подписки.")).setPositiveButton("Перейти к оплате",(d,w)->{try{activity.startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){say("Не удалось открыть страницу оплаты");}}).setNegativeButton("Отмена",null).show();
     }else say("Некорректный адрес оплаты");
    }else if(notify)say("Подтверждение оплаты пока не получено.");
   });
  });
 }
 void destroy(){closed=true;worker.shutdownNow();}
}
