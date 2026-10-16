package ru.babushkinpogreb.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequestConfiguration;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.MobileAds;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

public class MainActivity extends Activity {
    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private RewardedAdLoader rewardedLoader;
    private InterstitialAdLoader interLoader;
    private RewardedAd rewarded;
    private InterstitialAd inter;
    private boolean rewardEarned;
    private boolean adShowing;
    private int rewardedRetries, interRetries;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#140E0B"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
        });
        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/index.html");

        MobileAds.initialize(this, () -> ui.post(() -> { loadRewarded(); loadInter(); }));
    }

    /* ---------- реклама ---------- */
    private void loadRewarded() {
        if (rewardedLoader == null) {
            rewardedLoader = new RewardedAdLoader(this);
            rewardedLoader.setAdLoadListener(new RewardedAdLoadListener() {
                @Override public void onAdLoaded(RewardedAd ad) { rewarded = ad; rewardedRetries = 0; }
                @Override public void onAdFailedToLoad(AdRequestError e) {
                    rewarded = null;
                    long delay = Math.min(60000L, 5000L * (1L << Math.min(rewardedRetries++, 4)));
                    ui.postDelayed(MainActivity.this::loadRewarded, delay);
                }
            });
        }
        rewardedLoader.loadAd(new AdRequestConfiguration.Builder(BuildConfig.REWARDED_ID).build());
    }

    private void loadInter() {
        if (interLoader == null) {
            interLoader = new InterstitialAdLoader(this);
            interLoader.setAdLoadListener(new InterstitialAdLoadListener() {
                @Override public void onAdLoaded(InterstitialAd ad) { inter = ad; interRetries = 0; }
                @Override public void onAdFailedToLoad(AdRequestError e) {
                    inter = null;
                    long delay = Math.min(60000L, 5000L * (1L << Math.min(interRetries++, 4)));
                    ui.postDelayed(MainActivity.this::loadInter, delay);
                }
            });
        }
        interLoader.loadAd(new AdRequestConfiguration.Builder(BuildConfig.INTERSTITIAL_ID).build());
    }

    private void result(String kind, String status) {
        adShowing = false;
        js("window.onAdResult&&window.onAdResult('" + kind + "','" + status + "')");
    }

    private void showAd(String kind) {
        if (adShowing) return;
        if ("reward".equals(kind)) {
            RewardedAd ad = rewarded;
            if (ad == null) { result(kind, "unavailable"); loadRewarded(); return; }
            rewarded = null;
            rewardEarned = false;
            adShowing = true;
            ad.setAdEventListener(new RewardedAdEventListener() {
                @Override public void onAdShown() {}
                @Override public void onAdFailedToShow(AdError e) { ad.setAdEventListener(null); result(kind, "unavailable"); loadRewarded(); }
                @Override public void onAdDismissed() { ad.setAdEventListener(null); result(kind, rewardEarned ? "ok" : "skipped"); loadRewarded(); }
                @Override public void onAdClicked() {}
                @Override public void onAdImpression(ImpressionData d) {}
                @Override public void onRewarded(Reward r) { rewardEarned = true; }
            });
            ad.show(this);
        } else {
            InterstitialAd ad = inter;
            if (ad == null) { result(kind, "unavailable"); loadInter(); return; }
            inter = null;
            adShowing = true;
            ad.setAdEventListener(new InterstitialAdEventListener() {
                @Override public void onAdShown() {}
                @Override public void onAdFailedToShow(AdError e) { ad.setAdEventListener(null); result(kind, "unavailable"); loadInter(); }
                @Override public void onAdDismissed() { ad.setAdEventListener(null); result(kind, "ok"); loadInter(); }
                @Override public void onAdClicked() {}
                @Override public void onAdImpression(ImpressionData d) {}
            });
            ad.show(this);
        }
    }

    /* ---------- мост для игры ---------- */
    public class Bridge {
        @JavascriptInterface public void showAd(String kind) { ui.post(() -> MainActivity.this.showAd(kind)); }
        @JavascriptInterface public void share(String text) {
            ui.post(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                try { startActivity(Intent.createChooser(i, "Поделиться")); } catch (Exception ignored) {}
            });
        }
        @JavascriptInterface public void exit() { ui.post(MainActivity.this::finish); }
    }

    private void js(String code) { ui.post(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("window.onAndroidBack?window.onAndroidBack():'exit'", v -> {
            if (v != null && v.contains("exit")) finish();
        });
    }

    @Override protected void onPause() { super.onPause(); js("window.onAppPause&&window.onAppPause()"); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); js("window.onAppResume&&window.onAppResume()"); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); if (web != null) web.saveState(out); }

    @Override
    protected void onDestroy() {
        if (rewardedLoader != null) rewardedLoader.setAdLoadListener(null);
        if (interLoader != null) interLoader.setAdLoadListener(null);
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

}
