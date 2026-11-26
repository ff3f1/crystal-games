package ru.crystalgames.arsenal;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.view.Window;

public final class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> pending;
 private static final int PICK=42;
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  getWindow().setStatusBarColor(0xff121716);
  getWindow().setNavigationBarColor(0xff121716);
  web = new WebView(this);
  web.setBackgroundColor(0xff121716);
  WebSettings s=web.getSettings();
  s.setJavaScriptEnabled(true);
  s.setDomStorageEnabled(true);
  s.setAllowFileAccess(true);
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
  setContentView(web);
  web.loadUrl("file:///android_asset/index.html");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK&&pending!=null){pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));pending=null;}
 }
 @Override public void onBackPressed(){
  if(web!=null) web.evaluateJavascript("(function(){var d=document.querySelector('#modal');if(d&&d.open){d.close();return true;}if(typeof tab!=='undefined'&&tab!=='home'){page('home');return true;}return false;})()", value->{if("false".equals(value))super.onBackPressed();});
  else super.onBackPressed();
 }
 @Override protected void onDestroy(){
  if(pending!=null){pending.onReceiveValue(null);pending=null;}
  if(web!=null){web.destroy();web=null;}
  super.onDestroy();
 }
}
