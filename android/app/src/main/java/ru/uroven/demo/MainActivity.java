package ru.uroven.demo;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceResponse;
import android.webkit.WebResourceRequest;
import java.io.InputStream;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.util.Base64;
import android.widget.Toast;
import java.io.OutputStream;

/** Packaged HTTPS-origin WebView with opt-in remote API. */
public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> pickerCallback;
    private static final int PICK_FILE=3182, SAVE_JSON=3183;
    private byte[] pendingJson;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(8,12,20));
        getWindow().setNavigationBarColor(Color.rgb(13,20,30));
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(8,12,20));
        setContentView(web);
        WebSettings w=web.getSettings();
        w.setJavaScriptEnabled(true);
        w.setDomStorageEnabled(true);
        w.setAllowFileAccess(true); // restricted to packaged assets; cross-file access forbidden below
        w.setAllowContentAccess(true); // system-selected images only
        w.setAllowFileAccessFromFileURLs(false);
        w.setAllowUniversalAccessFromFileURLs(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri=req.getUrl();
                return !("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u=req.getUrl();
                if(!"https".equals(u.getScheme()) || !"appassets.androidplatform.net".equals(u.getHost()))return null;
                String path=u.getPath();
                if(path==null || path.equals("/"))path="/index.html";
                if(path.contains("..") || path.contains("\\"))return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new java.util.HashMap<>(),new java.io.ByteArrayInputStream(new byte[0]));
                try {
                    String asset=path.substring(1);
                    InputStream stream=getAssets().open(asset);
                    String mime=asset.endsWith(".html")?"text/html":asset.endsWith(".js")?"application/javascript":asset.endsWith(".css")?"text/css":asset.endsWith(".webp")?"image/webp":asset.endsWith(".wav")?"audio/wav":"application/octet-stream";
                    return new WebResourceResponse(mime,"UTF-8",stream);
                }catch(Exception e){return null;}
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if(pickerCallback!=null)pickerCallback.onReceiveValue(null);
                pickerCallback=callback;
                try { startActivityForResult(params.createIntent(),PICK_FILE);return true; }
                catch(Exception e){pickerCallback=null;Toast.makeText(MainActivity.this,"Выбор файлов недоступен",Toast.LENGTH_SHORT).show();return false;}
            }
        });
        web.addJavascriptInterface(new Object(){
            @JavascriptInterface public void exportJson(String b64){
                try {pendingJson=Base64.decode(b64,Base64.DEFAULT);runOnUiThread(()->{
                    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/json");
                    i.putExtra(Intent.EXTRA_TITLE,"ty-uroven-backup.json");
                    startActivityForResult(i,SAVE_JSON);
                });}catch(Exception e){runOnUiThread(()->Toast.makeText(MainActivity.this,"Ошибка экспорта",Toast.LENGTH_SHORT).show());}
            }
        },"AndroidBridge");
        web.loadUrl("https://appassets.androidplatform.net/index.html");
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_FILE){
            if(pickerCallback!=null){pickerCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));pickerCallback=null;}
        }else if(request==SAVE_JSON){
            if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingJson!=null){
                try(OutputStream s=getContentResolver().openOutputStream(data.getData())){
                    if(s!=null){s.write(pendingJson);Toast.makeText(this,"Копия сохранена",Toast.LENGTH_SHORT).show();}
                }catch(Exception e){Toast.makeText(this,"Не удалось записать файл",Toast.LENGTH_SHORT).show();}
            }
            pendingJson=null;
        }
    }
    @Override public void onBackPressed(){
        if(web.canGoBack())web.goBack();else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(web!=null){web.destroy();web=null;}super.onDestroy();
    }
}
