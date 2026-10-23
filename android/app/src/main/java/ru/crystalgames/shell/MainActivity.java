package ru.crystalgames.shell;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

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

import java.io.File;
import java.io.FileOutputStream;

/**
 * Оболочка HTML5-игры: WebView + реклама Яндекса.
 * Игра вызывает window.AndroidAds.showInterstitial(id) / showRewarded(id),
 * результат возвращается в window.__adResult(id, ok).
 */
public class MainActivity extends AppCompatActivity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private InterstitialAdLoader interLoader;
    private RewardedAdLoader rewardLoader;
    private InterstitialAd interAd;
    private RewardedAd rewardAd;
    private long lastBack = 0;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                openExternal(u.toString());
                return true;
            }
        });
        web.addJavascriptInterface(new AdsBridge(), "AndroidAds");
        web.addJavascriptInterface(new ShareBridge(), "AndroidShare");
        web.loadUrl(START_URL);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                long now = System.currentTimeMillis();
                if (now - lastBack < 2000) {
                    finish();
                } else {
                    lastBack = now;
                    Toast.makeText(MainActivity.this, "Нажмите ещё раз для выхода", Toast.LENGTH_SHORT).show();
                }
            }
        });

        MobileAds.initialize(this, () -> {
            interLoader = new InterstitialAdLoader(this);
            interLoader.setAdLoadListener(new InterstitialAdLoadListener() {
                @Override public void onAdLoaded(InterstitialAd ad) { interAd = ad; }
                @Override public void onAdFailedToLoad(AdRequestError error) {
                    interAd = null; ui.postDelayed(MainActivity.this::loadInter, 30000);
                }
            });
            rewardLoader = new RewardedAdLoader(this);
            rewardLoader.setAdLoadListener(new RewardedAdLoadListener() {
                @Override public void onAdLoaded(RewardedAd ad) { rewardAd = ad; }
                @Override public void onAdFailedToLoad(AdRequestError error) {
                    rewardAd = null; ui.postDelayed(MainActivity.this::loadReward, 30000);
                }
            });
            loadInter();
            loadReward();
        });
    }

    private void loadInter() {
        if (interLoader != null)
            interLoader.loadAd(new AdRequestConfiguration.Builder(BuildConfig.AD_INTER).build());
    }

    private void loadReward() {
        if (rewardLoader != null)
            rewardLoader.loadAd(new AdRequestConfiguration.Builder(BuildConfig.AD_REWARD).build());
    }

    private void result(int id, boolean ok) {
        ui.post(() -> web.evaluateJavascript("window.__adResult&&window.__adResult(" + id + "," + ok + ")", null));
    }

    private void showInter(int id) {
        final InterstitialAd ad = interAd;
        if (ad == null) { result(id, false); loadInter(); return; }
        interAd = null;
        ad.setAdEventListener(new InterstitialAdEventListener() {
            @Override public void onAdShown() {}
            @Override public void onAdFailedToShow(AdError adError) { result(id, false); loadInter(); }
            @Override public void onAdDismissed() { result(id, true); loadInter(); hideSystemBars(); }
            @Override public void onAdClicked() {}
            @Override public void onAdImpression(ImpressionData impressionData) {}
        });
        ad.show(this);
    }

    private void showReward(int id) {
        final RewardedAd ad = rewardAd;
        if (ad == null) { result(id, false); loadReward(); return; }
        rewardAd = null;
        final boolean[] rewarded = {false};
        ad.setAdEventListener(new RewardedAdEventListener() {
            @Override public void onAdShown() {}
            @Override public void onAdFailedToShow(AdError adError) { result(id, false); loadReward(); }
            @Override public void onAdDismissed() { result(id, rewarded[0]); loadReward(); hideSystemBars(); }
            @Override public void onAdClicked() {}
            @Override public void onAdImpression(ImpressionData impressionData) {}
            @Override public void onRewarded(Reward reward) { rewarded[0] = true; }
        });
        ad.show(this);
    }

    private class AdsBridge {
        @JavascriptInterface public void showInterstitial(int id) { ui.post(() -> showInter(id)); }
        @JavascriptInterface public void showRewarded(int id) { ui.post(() -> showReward(id)); }
    }

    private void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Не удалось открыть ссылку", Toast.LENGTH_SHORT).show();
        }
    }

    /** Шаринг картинки, внешние ссылки, оценка в RuStore, вибрация. */
    private class ShareBridge {
        @JavascriptInterface public void shareImage(String b64, String text) {
            ui.post(() -> {
                try {
                    File dir = new File(getCacheDir(), "share");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, "ulov.jpg");
                    FileOutputStream out = new FileOutputStream(f);
                    out.write(Base64.decode(b64, Base64.DEFAULT));
                    out.close();
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f);
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("image/jpeg");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "Поделиться"));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Не удалось поделиться", Toast.LENGTH_SHORT).show();
                }
            });
        }
        @JavascriptInterface public void openUrl(String url) { ui.post(() -> openExternal(url)); }
        @JavascriptInterface public void rate() {
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("rustore://apps.rustore.ru/app/" + getPackageName()));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (ActivityNotFoundException e) {
                    openExternal("https://www.rustore.ru/catalog/app/" + getPackageName());
                }
            });
        }
        @JavascriptInterface public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(ms);
            } catch (Exception ignored) { }
        }
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override protected void onPause() {
        super.onPause();
        if (web != null) { web.evaluateJavascript("window.__appPause&&window.__appPause()", null); web.onPause(); }
    }

    @Override protected void onResume() {
        super.onResume();
        hideSystemBars();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.__appResume&&window.__appResume()", null); }
    }

    @Override protected void onDestroy() {
        if (interLoader != null) interLoader.setAdLoadListener(null);
        if (rewardLoader != null) rewardLoader.setAdLoadListener(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
