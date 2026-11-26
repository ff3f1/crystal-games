package ru.crystalgames.arsenal;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.view.View;
import android.widget.LinearLayout;
import android.os.SystemClock;
import android.os.Handler;
import android.os.Looper;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import android.util.AtomicFile;
import android.graphics.Bitmap;
import android.graphics.ImageDecoder;
import android.graphics.BitmapFactory;
import android.content.ClipData;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.util.Base64;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
 private WebView web;
 private LinearLayout root;
 private BannerAdView banner;
 private InterstitialAdLoader interLoader;
 private InterstitialAd inter;
 private final Handler adHandler=new Handler(Looper.getMainLooper());
 private String adScreen="",bannerSlot="";
 private boolean resumed=false,adShowing=false,interLoading=false;
 private int actions=0;
 private long lastInter=SystemClock.elapsedRealtime(), lastBannerRequest=0;
 private static final long INTER_INTERVAL=300000;
 private ProController pro;
 private boolean adsAllowed(){return pro==null||!pro.isActive();}
 private boolean eligible(){return adsAllowed()&&resumed&&!adShowing&&!galleryOpen&&!isFinishing()&&("main".equals(adScreen)||"catalog".equals(adScreen));}
 private void destroyBanner(){if(banner!=null){banner.setBannerAdEventListener(null);if(root!=null)root.removeView(banner);banner.destroy();banner=null;}bannerSlot="";}
 private void refreshBanner(){
  if(!eligible()){destroyBanner();return;}
  if(banner!=null&&bannerSlot.equals(adScreen))return;
  destroyBanner();
  final String slot=adScreen; final BannerAdView b=new BannerAdView(this);
  banner=b;bannerSlot=slot;b.setVisibility(View.GONE);
  root.addView(b,new LinearLayout.LayoutParams(-1,-2));
  int width=Math.max(1,Math.round(getResources().getDisplayMetrics().widthPixels/getResources().getDisplayMetrics().density));
  b.setAdSize(BannerAdSize.sticky(this,width));
  b.setBannerAdEventListener(new BannerAdEventListener(){
   @Override public void onAdLoaded(){if(banner==b&&eligible()&&slot.equals(adScreen))b.setVisibility(View.VISIBLE);}
   @Override public void onAdFailedToLoad(AdRequestError error){if(banner==b){destroyBanner();adHandler.postDelayed(()->{if(eligible()&&slot.equals(adScreen)&&banner==null)refreshBanner();},60000);}}
   @Override public void onAdClicked(){}
   @Override public void onImpression(ImpressionData data){}
  });
  // Debounce transitions and avoid excess requests when browsing.
  long delay=Math.max(0,1500-(SystemClock.elapsedRealtime()-lastBannerRequest));
  adHandler.postDelayed(()->{if(banner==b&&eligible()){lastBannerRequest=SystemClock.elapsedRealtime();b.loadAd(new AdRequest.Builder("main".equals(slot)?BuildConfig.MAIN_AD:BuildConfig.CATALOG_AD).build());}},delay);
 }
 private void loadInter(){
  if(!adsAllowed()||isFinishing()||interLoading||inter!=null||adShowing)return;
  if(interLoader==null)interLoader=new InterstitialAdLoader(this);
  interLoading=true;
  interLoader.loadAd(new AdRequest.Builder(BuildConfig.INTER_AD).build(),new InterstitialAdLoadListener(){
   @Override public void onAdLoaded(InterstitialAd ad){interLoading=false;if(!isFinishing()&&!isDestroyed()&&adsAllowed())inter=ad;}
   @Override public void onAdFailedToLoad(AdRequestError e){interLoading=false;if(!isFinishing()&&!isDestroyed())adHandler.postDelayed(()->{if(resumed)loadInter();},60000);}
  });
 }
 private void maybeInter(){
  if(!eligible()||actions<3||SystemClock.elapsedRealtime()-lastInter<INTER_INTERVAL)return;
  if(inter==null){loadInter();return;}
  final InterstitialAd a=inter;inter=null;adShowing=true;destroyBanner();
  a.setAdEventListener(new InterstitialAdEventListener(){
   @Override public void onAdShown(){lastInter=SystemClock.elapsedRealtime();actions=0;}
   @Override public void onAdFailedToShow(AdError e){lastInter=SystemClock.elapsedRealtime();finishInter(a);}
   @Override public void onAdDismissed(){finishInter(a);}
   @Override public void onAdClicked(){}
   @Override public void onAdImpression(ImpressionData data){}
  });
  try{a.show(this);}catch(Exception e){lastInter=SystemClock.elapsedRealtime();finishInter(a);}
 }
 private void finishInter(InterstitialAd a){a.setAdEventListener(null);adShowing=false;if(!isFinishing()&&!isDestroyed()){refreshBanner();loadInter();}}
 @Override protected void onResume(){super.onResume();resumed=true;refreshBanner();loadInter();if(pro!=null)pro.refresh();}
 @Override protected void onPause(){resumed=false;destroyBanner();super.onPause();}

 private ValueCallback<Uri[]> pending;
 private static final int PICK=42, EXPORT=43, GALLERY=44;
 private final ExecutorService photoWorker=Executors.newSingleThreadExecutor();
 private volatile boolean galleryOpen=false;
 private int photoToken, photoLimit;
 private byte[] exportBytes;
 private final int LIMIT=64*1024*1024;
 private AtomicFile stateFile;
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  getWindow().setStatusBarColor(0xff121716);
  getWindow().setNavigationBarColor(0xff121716);
  pro=new ProController(this,()->{if(web!=null){refreshBanner();if(adsAllowed())loadInter();else if(inter!=null){inter.setAdEventListener(null);inter=null;}web.evaluateJavascript("render();if(document.querySelector(\'#galleryGrid\'))refreshGallery()",null);}});
  stateFile=new AtomicFile(new File(getFilesDir(),"arsenal-state.json"));
  web = new WebView(this);
  web.setBackgroundColor(0xff121716);
  WebSettings s=web.getSettings();
  s.setJavaScriptEnabled(true);
  s.setDomStorageEnabled(true);
  s.setAllowFileAccess(false);
  s.setAllowContentAccess(true);
  s.setAllowFileAccessFromFileURLs(false);
  s.setAllowUniversalAccessFromFileURLs(false);
  s.setJavaScriptCanOpenWindowsAutomatically(false);
  s.setSupportMultipleWindows(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebChromeClient(new WebChromeClient() {
   @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
    if(pending!=null) pending.onReceiveValue(null);
    pending=callback;
    try {startActivityForResult(params.createIntent(),PICK);}
    catch(ActivityNotFoundException e){pending=null;callback.onReceiveValue(null);}
    return true;
   }
  });
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return handle(url);}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return handle(request.getUrl().toString());}
   private boolean handle(String url) {
    if(url.startsWith("arsenal://share?")){
     String text=Uri.parse(url).getQueryParameter("text");
     if(text!=null && text.length()<=100000){
      Intent i=new Intent(Intent.ACTION_SEND);
      i.setType("text/plain");i.putExtra(Intent.EXTRA_TEXT,text);
      startActivity(Intent.createChooser(i,"Арсенал рыбака"));
     }
    }
    return true;
   }
  });
  web.addJavascriptInterface(new NativeBridge(),"ArsenalNative");
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  root.addView(web,new LinearLayout.LayoutParams(-1,0,1f));
  setContentView(root);
  web.loadUrl("file:///android_asset/index.html");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK&&pending!=null){Uri[] selected=null;if(result==RESULT_OK&&data!=null){LinkedHashSet<Uri> uris=collectUris(data,20);selected=uris.toArray(new Uri[0]);}ValueCallback<Uri[]> callback=pending;pending=null;callback.onReceiveValue(selected);}
  if(request==GALLERY){final int token=photoToken;final int limit=photoLimit;if(result!=RESULT_OK||data==null){galleryOpen=false;sendPhotos(token,new JSONArray(),0,true);}else{final LinkedHashSet<Uri> uris=collectUris(data,limit);photoWorker.execute(()->{JSONArray out=new JSONArray();int bad=0;for(Uri u:uris){try{out.put(readPhoto(u));}catch(Exception|OutOfMemoryError e){bad++;}}galleryOpen=false;sendPhotos(token,out,bad+(uris.isEmpty()?1:0),false);});}}
  if(request==EXPORT){byte[] bytes=exportBytes;exportBytes=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){if(out==null)throw new IOException();out.write(bytes);Toast.makeText(this,"Файл сохранён",Toast.LENGTH_SHORT).show();}catch(Exception e){Toast.makeText(this,"Не удалось сохранить файл",Toast.LENGTH_LONG).show();}}}
 }
 @Override public void onBackPressed(){
  if(web!=null) web.evaluateJavascript("(function(){var v=document.querySelector('#photoViewer');if(v&&v.open){closePhotoViewer();return true;}var d=document.querySelector('#modal');if(d&&d.open){closeModal();return true;}if(typeof tab!=='undefined'&&tab!=='home'){page('home');return true;}return false;})()", value->{if("false".equals(value))super.onBackPressed();});
  else super.onBackPressed();
 }
 private void startExport(byte[] bytes,String mime,String filename){
  if(exportBytes!=null){Toast.makeText(this,"Сначала завершите сохранение",Toast.LENGTH_SHORT).show();return;}
  exportBytes=bytes;
  try{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(mime);i.putExtra(Intent.EXTRA_TITLE,filename);startActivityForResult(i,EXPORT);}
  catch(Exception e){exportBytes=null;Toast.makeText(this,"Нет приложения для сохранения файла",Toast.LENGTH_LONG).show();}
 }
 private LinkedHashSet<Uri> collectUris(Intent data,int max){
  LinkedHashSet<Uri> list=new LinkedHashSet<>();ClipData clip=data.getClipData();if(clip!=null)for(int i=0;i<clip.getItemCount()&&list.size()<max;i++){Uri u=clip.getItemAt(i).getUri();if(u!=null)list.add(u);}
  if(data.getData()!=null&&list.size()<max)list.add(data.getData());return list;
 }
 private String readPhoto(Uri u) throws IOException {
  Bitmap b;
  if(android.os.Build.VERSION.SDK_INT>=28){
   b=ImageDecoder.decodeBitmap(ImageDecoder.createSource(getContentResolver(),u),(decoder,info,src)->{
    int w=info.getSize().getWidth(),h=info.getSize().getHeight();double scale=Math.min(1.0,1400.0/Math.max(w,h));decoder.setTargetSize(Math.max(1,(int)Math.round(w*scale)),Math.max(1,(int)Math.round(h*scale)));decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
   });
  }else{
   BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;
   try(InputStream in=getContentResolver().openInputStream(u)){BitmapFactory.decodeStream(in,null,o);}
   if(o.outWidth<=0||o.outHeight<=0)throw new IOException("Invalid image");
   int sample=1;while(Math.max(o.outWidth,o.outHeight)/sample>1800)sample*=2;o.inSampleSize=sample;o.inJustDecodeBounds=false;
   try(InputStream in=getContentResolver().openInputStream(u)){b=BitmapFactory.decodeStream(in,null,o);}
  }
  if(b==null)throw new IOException("Decode failed");
  try{
   for(int q=85;q>=40;q-=15){ByteArrayOutputStream out=new ByteArrayOutputStream();if(!b.compress(Bitmap.CompressFormat.JPEG,q,out))throw new IOException("Encode failed");byte[] bytes=out.toByteArray();if(bytes.length<=240000)return "data:image/jpeg;base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP);}
   double factor=Math.min(1.0,560.0/Math.max(b.getWidth(),b.getHeight()));Bitmap small=Bitmap.createScaledBitmap(b,Math.max(1,(int)(b.getWidth()*factor)),Math.max(1,(int)(b.getHeight()*factor)),true);
   try{ByteArrayOutputStream out=new ByteArrayOutputStream();small.compress(Bitmap.CompressFormat.JPEG,65,out);byte[] bytes=out.toByteArray();if(bytes.length==0||bytes.length>240000)throw new IOException("Too large");return "data:image/jpeg;base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP);}finally{if(small!=b)small.recycle();}
  }finally{b.recycle();}
 }
 private void sendPhotos(int token,JSONArray photos,int failures,boolean cancelled){
  runOnUiThread(()->{if(web!=null&&!isFinishing())web.evaluateJavascript("receiveNativePhotos("+token+","+photos.toString()+","+failures+","+cancelled+")",null);});
 }
 private final class NativeBridge {
  @JavascriptInterface public boolean isPro(){return pro!=null&&pro.isActive();}
  @JavascriptInterface public boolean proConfigured(){return pro!=null&&pro.configured();}
  @JavascriptInterface public void openPro(){runOnUiThread(()->{if(pro!=null)pro.open();});}

  @JavascriptInterface public void adScreen(String screen){runOnUiThread(()->{String next=("main".equals(screen)||"catalog".equals(screen))?screen:"";adScreen=next;refreshBanner();});}
  @JavascriptInterface public void completedAction(){runOnUiThread(()->{actions=Math.min(100,actions+1);});}
  @JavascriptInterface public void adBreak(){runOnUiThread(()->maybeInter());}

  @JavascriptInterface public synchronized boolean pickPhotos(int token,int limit){
   if(galleryOpen||limit<1||limit>(pro!=null&&pro.isActive()?5:1))return false;galleryOpen=true;photoToken=token;photoLimit=limit;
   runOnUiThread(()->{try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("image/*");i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,limit>1);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivityForResult(i,GALLERY);}catch(Exception e){galleryOpen=false;sendPhotos(token,new JSONArray(),1,false);}});return true;
  }
  @JavascriptInterface public void rateApp(){runOnUiThread(()->{
   Uri u=Uri.parse("https://www.rustore.ru/catalog/app/ru.crystalgames.arsenal");
   try{startActivity(new Intent(Intent.ACTION_VIEW,u).setPackage("ru.vk.store"));}catch(Exception e){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){Toast.makeText(MainActivity.this,"Карточка приложения появится после публикации в RuStore",Toast.LENGTH_LONG).show();}}
  });}
  @JavascriptInterface public synchronized String loadState(){try{byte[] b=stateFile.readFully();return b.length<=LIMIT?new String(b,StandardCharsets.UTF_8):"";}catch(IOException e){return "";}}
  @JavascriptInterface public synchronized boolean saveState(String raw){
   if(raw==null||raw.length()>LIMIT)return false;
   byte[] bytes=raw.getBytes(StandardCharsets.UTF_8);if(bytes.length>LIMIT)return false;
   FileOutputStream out=null;try{out=stateFile.startWrite();out.write(bytes);stateFile.finishWrite(out);return true;}catch(Exception e){if(out!=null)stateFile.failWrite(out);return false;}
  }
  @JavascriptInterface public boolean openProduct(String raw){
   if(raw==null||raw.length()>2048)return false;
   Uri u=Uri.parse(raw);String scheme=u.getScheme();if((!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme))||u.getHost()==null||u.getUserInfo()!=null)return false;
   runOnUiThread(()->{try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_VIEW,u),"Открыть товар"));}catch(Exception e){Toast.makeText(MainActivity.this,"Не удалось открыть ссылку",Toast.LENGTH_SHORT).show();}});return true;
  }
  @JavascriptInterface public boolean exportBackup(String raw,String filename){
   if(raw==null||raw.length()>LIMIT)return false;byte[] b=raw.getBytes(StandardCharsets.UTF_8);if(b.length>LIMIT)return false;
   runOnUiThread(()->startExport(b,"application/json",filename!=null&&filename.matches("arsenal-[0-9-]+\\.json")?filename:"arsenal-backup.json"));return true;
  }
  @JavascriptInterface public boolean shareImage(String raw,String text){
   if(raw==null||raw.length()>4*1024*1024||text==null||text.length()>2000)return false;
   try{byte[] b=Base64.decode(raw,Base64.DEFAULT);if(b.length<4||(b[0]&255)!=255||(b[1]&255)!=216)return false;
    photoWorker.execute(()->{try{File dir=new File(getCacheDir(),"share");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException();File[] old=dir.listFiles();if(old!=null)for(File f:old)if(f.lastModified()<System.currentTimeMillis()-86400000L)f.delete();File file=File.createTempFile("arsenal-",".jpg",dir);try(FileOutputStream out=new FileOutputStream(file)){out.write(b);}Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".share",file);runOnUiThread(()->{if(isFinishing()||isDestroyed())return;try{Intent i=new Intent(Intent.ACTION_SEND);i.setType("image/jpeg");i.putExtra(Intent.EXTRA_STREAM,uri);i.putExtra(Intent.EXTRA_TEXT,text);i.setClipData(ClipData.newRawUri("Арсенал рыбака",uri));i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(i,"Поделиться карточкой"));}catch(Exception e){Toast.makeText(MainActivity.this,"Не удалось поделиться",Toast.LENGTH_LONG).show();}});}catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"Не удалось подготовить карточку",Toast.LENGTH_LONG).show());}});return true;
   }catch(Exception e){return false;}
  }
  @JavascriptInterface public boolean exportImage(String raw,String filename){
   if(raw==null||raw.length()>4*1024*1024)return false;
   try{byte[] b=Base64.decode(raw,Base64.DEFAULT);if(b.length<4||(b[0]&255)!=255||(b[1]&255)!=216)return false;runOnUiThread(()->startExport(b,"image/jpeg",filename!=null&&filename.matches("(trophy|gear)-[0-9-]+\\.jpg")?filename:"trophy.jpg"));return true;}catch(Exception e){return false;}
  }
 }
 @Override protected void onDestroy(){
  adHandler.removeCallbacksAndMessages(null);destroyBanner();if(inter!=null){inter.setAdEventListener(null);inter=null;}if(pro!=null)pro.destroy();photoWorker.shutdownNow();
  if(pending!=null){pending.onReceiveValue(null);pending=null;}
  if(web!=null){web.removeJavascriptInterface("ArsenalNative");web.destroy();web=null;}
  super.onDestroy();
 }
}
