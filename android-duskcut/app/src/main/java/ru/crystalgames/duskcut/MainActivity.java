package ru.crystalgames.duskcut;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

/** Fully offline HTML5 gameplay in a native, immersive Android activity.
 *  The ONLY network dependency is optional real Yandex Mobile Ads (not Yandex Games SDK).
 */
public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String GAME_URL = "https://"+ LOCAL_HOST + "/assets/www/index.html";

    private WebView webView;
    private WebViewAssetLoader loader;
    private RewardedAdLoader rewardedLoader;
    private RewardedAd rewardedAd;
    private InterstitialAdLoader interstitialLoader;
    private InterstitialAd interstitialAd;
    private boolean adShowing = false;
    private String rewardKind = null;
    private boolean rewardGranted = false;
    private boolean initialLoadFinished = false;

    @Override @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON, WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        immersive();
        loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(8,10,16));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        final WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setDefaultTextEncodingName("UTF-8");
        webView.addJavascriptInterface(new GameBridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (LOCAL_HOST.equals(url.getHost()) && "https".equals(url.getScheme())) return false;
                if ("https".equals(url.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,url)); } catch (Exception ignored) {}
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!GAME_URL.equals(url)) return;
                initialLoadFinished=true;
                js("window.androidPlatformReady && window.androidPlatformReady("+(rewardedAd != null)+")");
            }
        });
        setContentView(webView);
        webView.loadUrl(GAME_URL);
        initAds();
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void js(String script) {
        if (webView == null || !initialLoadFinished) return;
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    private void initAds() {
        // SDK 8 initialises automatically, before the first ad request.
        if (!BuildConfig.REWARDED_AD_UNIT.isEmpty()) {
            rewardedLoader = new RewardedAdLoader(this);
            loadRewarded();
        }
        if (!BuildConfig.INTERSTITIAL_AD_UNIT.isEmpty()) {
            interstitialLoader = new InterstitialAdLoader(this);
            loadInterstitial();
        }
    }
    private void loadRewarded() {
        if (rewardedLoader == null || isFinishing()) return;
        rewardedLoader.loadAd(new AdRequest.Builder(BuildConfig.REWARDED_AD_UNIT).build(),new RewardedAdLoadListener() {
            @Override public void onAdLoaded(RewardedAd ad) {
                rewardedAd=ad;
                js("window.androidSetRewardAvailable && window.androidSetRewardAvailable(true)");
            }
            @Override public void onAdFailedToLoad(AdRequestError error) {
                rewardedAd=null;
                js("window.androidSetRewardAvailable && window.androidSetRewardAvailable(false)");
                // Do not endlessly retry on errors; resume loading after normal future activity restart.
            }
        });
    }
    private void loadInterstitial() {
        if (interstitialLoader == null || isFinishing()) return;
        interstitialLoader.loadAd(new AdRequest.Builder(BuildConfig.INTERSTITIAL_AD_UNIT).build(),new InterstitialAdLoadListener() {
            @Override public void onAdLoaded(InterstitialAd ad) { interstitialAd=ad; }
            @Override public void onAdFailedToLoad(AdRequestError error) { interstitialAd=null; }
        });
    }
    private void showRewarded(String kind) {
        if (adShowing || rewardedAd == null || !("revive".equals(kind) || "shards".equals(kind))) {
            js("window.androidRewardClosed && window.androidRewardClosed("+quote(kind)+",false)");
            return;
        }
        adShowing=true;
        rewardGranted=false;
        rewardKind=kind;
        js("window.androidSetRewardAvailable && window.androidSetRewardAvailable(false)");
        final RewardedAd ad=rewardedAd;
        rewardedAd=null;
        ad.setAdEventListener(new RewardedAdEventListener() {
            @Override public void onAdShown() { js("window.androidAdOpened && window.androidAdOpened()"); }
            @Override public void onAdFailedToShow(AdError error) { finishRewarded(ad); }
            @Override public void onAdDismissed() { finishRewarded(ad); }
            @Override public void onAdClicked() {}
            @Override public void onAdImpression(ImpressionData info) {}
            @Override public void onRewarded(Reward reward) { rewardGranted=true; }
        });
        ad.show(this);
    }
    private void finishRewarded(RewardedAd shownAd) {
        if (!adShowing || rewardKind==null) return;
        shownAd.setAdEventListener(null);
        String kind=rewardKind;
        boolean success=rewardGranted;
        adShowing=false;rewardKind=null;rewardGranted=false;
        // Only real Yandex Mobile Ads onRewarded() authorises granting.
        js("window.androidRewardClosed && window.androidRewardClosed("+quote(kind)+","+success+")");
        loadRewarded();
    }
    private void showInterstitial() {
        if(adShowing || interstitialAd==null) {
            js("window.androidInterstitialClosed && window.androidInterstitialClosed()");
            return;
        }
        adShowing=true;
        final InterstitialAd ad=interstitialAd;
        interstitialAd=null;
        ad.setAdEventListener(new InterstitialAdEventListener() {
            @Override public void onAdShown() {js("window.androidAdOpened && window.androidAdOpened()");}
            @Override public void onAdFailedToShow(AdError error) {finishInterstitial(ad);}
            @Override public void onAdDismissed() {finishInterstitial(ad);}
            @Override public void onAdClicked() {}
            @Override public void onAdImpression(ImpressionData info) {}
        });
        ad.show(this);
    }
    private void finishInterstitial(InterstitialAd shownAd) {
        if (!adShowing) return;
        shownAd.setAdEventListener(null);
        adShowing=false;
        js("window.androidInterstitialClosed && window.androidInterstitialClosed()");
        loadInterstitial();
    }
    private String quote(String value) {
        // kind is only one of fixed known literals from our own game UI.
        if ("revive".equals(value)) return "'revive'";
        if ("shards".equals(value)) return "'shards'";
        return "''";
    }
    private boolean trusted() {
        if (webView==null) return false;
        try {return LOCAL_HOST.equals(Uri.parse(webView.getUrl()).getHost());}
        catch(Exception ignored) {return false;}
    }
    private final class GameBridge {
        @JavascriptInterface public void showRewarded(String kind) {
            runOnUiThread(() -> {if (trusted()) MainActivity.this.showRewarded(kind);});
        }
        @JavascriptInterface public void showInterstitial() {
            runOnUiThread(() -> {if (trusted()) MainActivity.this.showInterstitial();});
        }
        @JavascriptInterface public void share(String text) {
            runOnUiThread(() -> {
                if(!trusted())return;
                // After RuStore publication the stable URL becomes valid.
                String copy=text+"\nhttps://www.rustore.ru/catalog/app/ru.crystalgames.duskcut";
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT,copy);
                startActivity(Intent.createChooser(send,"Пригласить друга"));
            });
        }
        @JavascriptInterface public void rate() {
            runOnUiThread(() -> {
                if(!trusted())return;
                try {startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.rustore.ru/catalog/app/ru.crystalgames.duskcut")));}
                catch(Exception e){Toast.makeText(MainActivity.this,"Не удалось открыть RuStore",Toast.LENGTH_SHORT).show();}
            });
        }
        @JavascriptInterface public void vibrate(int millis) {
            runOnUiThread(() -> {
                if(!trusted())return;
                Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
                if(v!=null && v.hasVibrator())v.vibrate(VibrationEffect.createOneShot(Math.min(65,Math.max(10,millis)),VibrationEffect.DEFAULT_AMPLITUDE));
            });
        }
        @JavascriptInterface public void confirmExit() {
            runOnUiThread(() -> {
                if(!trusted())return;
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Выйти из DUSK//CUT?")
                    .setMessage("Прогресс улучшений и хроник сохраняется автоматически.")
                    .setNegativeButton("Остаться",(d,w)->{})
                    .setPositiveButton("Выйти",(d,w)->finish())
                    .show();
            });
        }
    }
    @Override public void onBackPressed() {js("window.androidBack && window.androidBack()");}
    @Override protected void onPause() {
        js("window.androidBackground && window.androidBackground(true)");
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        immersive();
        js("window.androidBackground && window.androidBackground(false)");
    }
    @Override protected void onDestroy() {
        if(rewardedAd!=null)rewardedAd.setAdEventListener(null);
        if(interstitialAd!=null)interstitialAd.setAdEventListener(null);
        rewardedAd=null;interstitialAd=null;rewardedLoader=null;interstitialLoader=null;
        if(webView!=null){ webView.removeJavascriptInterface("AndroidBridge");webView.destroy();webView=null; }
        super.onDestroy();
    }
}
