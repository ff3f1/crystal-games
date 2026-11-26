package ru.crystalgames.arsenal;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.util.AtomicFile;
import android.util.Base64;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> pending;
 private static final int PICK=42, EXPORT=43;
 private byte[] exportBytes;
 private final int LIMIT=64*1024*1024;
 private AtomicFile stateFile;
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  getWindow().setStatusBarColor(0xff121716);
  getWindow().setNavigationBarColor(0xff121716);
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
  setContentView(web);
  web.loadUrl("file:///android_asset/index.html");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK&&pending!=null){pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));pending=null;}
  if(request==EXPORT){byte[] bytes=exportBytes;exportBytes=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){if(out==null)throw new IOException();out.write(bytes);Toast.makeText(this,"Файл сохранён",Toast.LENGTH_SHORT).show();}catch(Exception e){Toast.makeText(this,"Не удалось сохранить файл",Toast.LENGTH_LONG).show();}}}
 }
 @Override public void onBackPressed(){
  if(web!=null) web.evaluateJavascript("(function(){var d=document.querySelector('#modal');if(d&&d.open){d.close();return true;}if(typeof tab!=='undefined'&&tab!=='home'){page('home');return true;}return false;})()", value->{if("false".equals(value))super.onBackPressed();});
  else super.onBackPressed();
 }
 private void startExport(byte[] bytes,String mime,String filename){
  if(exportBytes!=null){Toast.makeText(this,"Сначала завершите сохранение",Toast.LENGTH_SHORT).show();return;}
  exportBytes=bytes;
  try{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(mime);i.putExtra(Intent.EXTRA_TITLE,filename);startActivityForResult(i,EXPORT);}
  catch(Exception e){exportBytes=null;Toast.makeText(this,"Нет приложения для сохранения файла",Toast.LENGTH_LONG).show();}
 }
 private final class NativeBridge {
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
  @JavascriptInterface public boolean exportImage(String raw,String filename){
   if(raw==null||raw.length()>4*1024*1024)return false;
   try{byte[] b=Base64.decode(raw,Base64.DEFAULT);if(b.length<4||(b[0]&255)!=255||(b[1]&255)!=216)return false;runOnUiThread(()->startExport(b,"image/jpeg",filename!=null&&filename.matches("trophy-[0-9-]+\\.jpg")?filename:"trophy.jpg"));return true;}catch(Exception e){return false;}
  }
 }
 @Override protected void onDestroy(){
  if(pending!=null){pending.onReceiveValue(null);pending=null;}
  if(web!=null){web.removeJavascriptInterface("ArsenalNative");web.destroy();web=null;}
  super.onDestroy();
 }
}
