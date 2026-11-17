package ru.crystalgames.shell;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import java.io.ByteArrayInputStream;
import java.util.Locale;

/** Local, offline game shell. Same HTTPS origin preserves existing fishing2 saves. */
public class MainActivity extends Activity {
    private WebView web;
    private boolean legacyRenderer;
    private final String host = "appassets.androidplatform.net";
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        immersive();
        web = new WebView(this);
        web.setBackgroundColor(0xff102e32);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportZoom(false);
        // Very old bundled WebViews have GPU font serialization crashes. Updated
        // engines retain acceleration; the compatibility path uses software tiles.
        java.util.regex.Matcher engine = java.util.regex.Pattern.compile("Chrome/(\\d+)").matcher(web.getSettings().getUserAgentString());
        legacyRenderer = engine.find() && Integer.parseInt(engine.group(1)) < 90;
        if (legacyRenderer) web.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !host.equals(req.getUrl().getHost());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                String path = req.getUrl().getPath();
                if (!host.equals(req.getUrl().getHost()) || path == null || !path.startsWith("/assets/") || path.contains("..")) return empty();
                String name = path.substring(8);
                String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
                String mime;
                switch (ext) {
                    case "html": mime="text/html"; break;
                    case "js": mime="application/javascript"; break;
                    case "css": mime="text/css"; break;
                    case "mp3": mime="audio/mpeg"; break;
                    case "webp": mime="image/webp"; break;
                    case "png": mime="image/png"; break;
                    case "woff2": mime="font/woff2"; break;
                    default: mime="application/octet-stream";
                }
                try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(name)); }
                catch (Exception e) { return empty(); }
            }
            private WebResourceResponse empty() {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, new ByteArrayInputStream(new byte[0]));
            }
        });
        web.addJavascriptInterface(new GameBridge(), "AndroidGame");
        setContentView(web);
        web.loadUrl("https://" + host + "/assets/index.html");
    }
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    public class GameBridge {
        @JavascriptInterface public boolean legacyRenderer() { return legacyRenderer; }
        @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
        @JavascriptInterface public void vibrate(int ms) {
            if (ms <= 0) return;
            Vibrator v = (Vibrator)getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (android.os.Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.min(ms, 250), VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(Math.min(ms, 250));
            }
        }
    }
    @Override public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.gameBack&&window.gameBack()", null);
    }
    @Override protected void onPause() {
        if (web != null) web.evaluateJavascript("window.__appPause&&window.__appPause()", result -> { if (web != null) web.onPause(); });
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume(); immersive();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.__appResume&&window.__appResume()", null); }
    }
    @Override protected void onDestroy() {
        if (web != null) { web.loadUrl("about:blank"); web.destroy(); web=null; }
        super.onDestroy();
    }
}
