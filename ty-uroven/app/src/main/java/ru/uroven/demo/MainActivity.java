package ru.uroven.demo;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.webkit.*;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.widget.Toast;
import java.io.*;
import java.util.Collections;

/** Offline local HTTPS origin. No network permission or remote JavaScript. */
public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> pickerCallback;
    private static final int PICK_FILE=3182, SAVE_JSON=3183;
    private File pendingExport;
    private OutputStream exportStream;
    private long exportBytes;
    private boolean destroyed;
    private final Object exportLock=new Object();
    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(Color.rgb(16,18,34));
        getWindow().setNavigationBarColor(Color.rgb(16,18,34));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(16,18,34));setContentView(web);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings w=web.getSettings();w.setJavaScriptEnabled(true);w.setDomStorageEnabled(true);
        w.setAllowFileAccess(false);w.setAllowContentAccess(true);w.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        w.setMediaPlaybackRequiresUserGesture(true);w.setSupportMultipleWindows(false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){
                Uri u=req.getUrl();String p=u.getPath();
                if(!"https".equals(u.getScheme())||!"appassets.androidplatform.net".equals(u.getHost())||p==null||p.contains("..")||p.contains("\\")||!"GET".equals(req.getMethod()))return missing();
                if(p.equals("/"))p="/index.html";
                try{return new WebResourceResponse(mime(p),"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-cache"),getAssets().open(p.substring(1)));}catch(Exception e){return missing();}
            }
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){view.destroy();web=null;recreate();return true;}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(pickerCallback!=null)pickerCallback.onReceiveValue(null);pickerCallback=callback;
                try{Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_FILE);return true;}
                catch(Exception e){callback.onReceiveValue(null);pickerCallback=null;message("Выбор файла недоступен");return true;}
            }
        });
        web.addJavascriptInterface(new Bridge(),"AndroidBridge");web.loadUrl("https://appassets.androidplatform.net/index.html");
    }
    private static String mime(String p){if(p.endsWith(".html"))return "text/html";if(p.endsWith(".js"))return "application/javascript";if(p.endsWith(".css"))return "text/css";if(p.endsWith(".webp"))return "image/webp";if(p.endsWith(".png"))return "image/png";if(p.endsWith(".svg"))return "image/svg+xml";if(p.endsWith(".wav"))return "audio/wav";if(p.endsWith(".ogg"))return "audio/ogg";if(p.endsWith(".woff2"))return "font/woff2";return "application/octet-stream";}
    private static WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private void message(String msg){runOnUiThread(()->{if(!destroyed){Toast.makeText(this,msg,Toast.LENGTH_SHORT).show();if(web!=null)web.evaluateJavascript("window.LevelNativeStatus&&LevelNativeStatus("+org.json.JSONObject.quote(msg)+")",null);}});}
    public class Bridge {
        @JavascriptInterface public void haptic(){runOnUiThread(()->{if(web!=null)web.performHapticFeedback(android.os.Build.VERSION.SDK_INT>=30?HapticFeedbackConstants.CONFIRM:HapticFeedbackConstants.VIRTUAL_KEY);});}
        @JavascriptInterface public void beginExport(){synchronized(exportLock){cleanupExport();try{pendingExport=new File(getCacheDir(),"ty-export.json");exportStream=new FileOutputStream(pendingExport);exportBytes=0;}catch(Exception e){cleanupExport();throw new IllegalStateException("Не удалось подготовить файл",e);}}}
        @JavascriptInterface public void appendExport(String b64){synchronized(exportLock){try{if(exportStream==null)throw new IOException("Экспорт не начат");byte[] bytes=Base64.decode(b64,Base64.DEFAULT);exportBytes+=bytes.length;if(exportBytes>170L*1024*1024)throw new IOException("Копия слишком велика");exportStream.write(bytes);}catch(Exception e){cleanupExport();throw new IllegalStateException("Ошибка подготовки копии",e);}}}
        @JavascriptInterface public void finishExport(){synchronized(exportLock){try{if(exportStream==null)throw new IOException();exportStream.close();exportStream=null;}catch(Exception e){cleanupExport();message("Не удалось подготовить копию");return;}}runOnUiThread(()->{try{Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,"ty-uroven-backup.json");startActivityForResult(intent,SAVE_JSON);}catch(Exception e){synchronized(exportLock){cleanupExport();}message("Сохранение файла недоступно");}});}
        @JavascriptInterface public void exportJson(String b64){beginExport();appendExport(b64);finishExport();}
    }
    private void cleanupExport(){try{if(exportStream!=null)exportStream.close();}catch(IOException ignored){}exportStream=null;if(pendingExport!=null)pendingExport.delete();pendingExport=null;exportBytes=0;}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==PICK_FILE){if(pickerCallback!=null){pickerCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));pickerCallback=null;}}
        if(request==SAVE_JSON){final Uri uri=result==RESULT_OK&&data!=null?data.getData():null;if(uri==null){synchronized(exportLock){cleanupExport();}message("Сохранение копии отменено");return;}
            new Thread(()->{synchronized(exportLock){try(InputStream input=new FileInputStream(pendingExport);OutputStream output=getContentResolver().openOutputStream(uri,"wt")){if(output==null)throw new IOException();byte[] buf=new byte[32768];int n;while((n=input.read(buf))!=-1)output.write(buf,0,n);message("Резервная копия сохранена");}catch(Exception e){message("Не удалось сохранить копию");}finally{cleanupExport();}}},"backup-writer").start();}
    }
    @Override public void onBackPressed(){if(web==null){super.onBackPressed();return;}web.evaluateJavascript("window.LevelBack?LevelBack():false",result->{if(!"true".equals(result))MainActivity.super.onBackPressed();});}
    @Override protected void onPause(){if(web!=null){web.evaluateJavascript("window.LevelSound&&LevelSound.pause()",null);web.onPause();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("window.LevelSound&&LevelSound.start()",null);}}
    @Override protected void onDestroy(){destroyed=true;if(pickerCallback!=null){pickerCallback.onReceiveValue(null);pickerCallback=null;}synchronized(exportLock){cleanupExport();}if(web!=null){web.removeJavascriptInterface("AndroidBridge");web.destroy();web=null;}super.onDestroy();}
    WebView webForTesting(){return web;}
}
