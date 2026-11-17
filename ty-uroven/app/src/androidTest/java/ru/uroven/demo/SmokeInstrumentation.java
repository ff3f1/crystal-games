package ru.uroven.demo;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.graphics.Bitmap;
import android.os.*;
import android.view.KeyEvent;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Dependency-free on-device instrumentation: real packaged WebView, offline flows and screenshots. */
public class SmokeInstrumentation extends Instrumentation {
    private MainActivity activity;
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    @Override public void onStart(){Bundle status=new Bundle();status.putString("id","TY Instrumentation");status.putInt("numtests",1);status.putInt("current",1);status.putString("class",getClass().getName());status.putString("test","testOfflineProduct");sendStatus(1,status);
        try{runProduct();status.putString("stream","\nOffline WebView flows, persistence, chooser and main screens passed.\n");sendStatus(0,status);Bundle done=new Bundle();done.putString("stream","\nOK (1 test)\n");finish(Activity.RESULT_OK,done);}
        catch(Throwable e){status.putString("stack",android.util.Log.getStackTraceString(e));status.putString("stream","\nFAIL: "+e+"\n");sendStatus(-2,status);Bundle done=new Bundle();done.putString("stream","\nFAILURES!!!\n"+e);finish(Activity.RESULT_CANCELED,done);}
    }
    private String js(String code)throws Exception {CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();runOnMainSync(()->activity.webForTesting().evaluateJavascript(code,v->{result.set(v);latch.countDown();}));if(!latch.await(10,TimeUnit.SECONDS))throw new AssertionError("JavaScript timeout");return result.get();}
    private void waitFor(String expression)throws Exception{long end=System.currentTimeMillis()+20000;while(System.currentTimeMillis()<end){if("true".equals(js("Boolean("+expression+")")))return;Thread.sleep(150);}throw new AssertionError("Timed out: "+expression+"; body="+js("document.body.innerText"));}
    private void click(String selector)throws Exception{String result=js("(()=>{const e=document.querySelector("+org.json.JSONObject.quote(selector)+");if(!e)return false;e.click();return true})()");if(!"true".equals(result))throw new AssertionError("Element absent: "+selector);}
    private void tap(String selector)throws Exception {
        org.json.JSONObject r=new org.json.JSONObject(js("(()=>{const r=document.querySelector("+org.json.JSONObject.quote(selector)+").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,viewport:innerWidth}})()"));
        int[] location=new int[2];runOnMainSync(()->activity.webForTesting().getLocationOnScreen(location));
        float scale=activity.webForTesting().getWidth()/(float)r.getDouble("viewport"),x=location[0]+(float)r.getDouble("x")*scale,y=location[1]+(float)r.getDouble("y")*scale;
        long now=android.os.SystemClock.uptimeMillis();
        android.view.MotionEvent down=android.view.MotionEvent.obtain(now,now,android.view.MotionEvent.ACTION_DOWN,x,y,0),up=android.view.MotionEvent.obtain(now,now+80,android.view.MotionEvent.ACTION_UP,x,y,0);
        down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);sendPointerSync(down);sendPointerSync(up);down.recycle();up.recycle();
    }
    private void awaitPicker()throws Exception {long end=System.currentTimeMillis()+10000;while(System.currentTimeMillis()<end){android.view.accessibility.AccessibilityNodeInfo root=getUiAutomation().getRootInActiveWindow();if(root!=null&&root.getPackageName()!=null&&!root.getPackageName().toString().equals(getTargetContext().getPackageName()))return;Thread.sleep(200);}throw new AssertionError("System file picker did not open");}
    private void screenshot(String name)throws Exception{Thread.sleep(300);runOnMainSync(()->activity.webForTesting().evaluateJavascript("document.getElementById('toast').classList.remove('show')",null));Thread.sleep(100);Bitmap bitmap=getUiAutomation().takeScreenshot();File dir=new File(activity.getExternalFilesDir(null),"screenshots");dir.mkdirs();try(FileOutputStream out=new FileOutputStream(new File(dir,name+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}bitmap.recycle();}
    private void go(String page)throws Exception{if(!"true".equals(js("!!document.querySelector('[data-action=go][data-page=\""+page+"\"]')")))click("[data-action=go][data-page=more]");click("[data-action=go][data-page="+page+"]");waitFor("document.querySelector('.content h1')");}
    private void runProduct()throws Exception{
        Intent intent=new Intent(getTargetContext(),MainActivity.class);intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);activity=(MainActivity)startActivitySync(intent);
        waitFor("document.querySelector('[data-action=onboardingNext]')");screenshot("01-onboarding");
        for(int i=0;i<3;i++)click("[data-action=onboardingNext]");waitFor("document.querySelector('#profile')");screenshot("02-editor");
        js("document.querySelector('#profile [name=name]').value='Путешественник';document.querySelector('#profile').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");waitFor("document.getElementById('modal').hidden");screenshot("03-home");
        go("quests");click("[data-action=habit][data-id=move]");js("document.querySelector('#habitComplete [name=value]').value='25';document.querySelector('#habitComplete [name=note]').value='Проверочная прогулка';document.querySelector('#habitComplete').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");waitFor("document.getElementById('modal').hidden");screenshot("04-quests");
        click("[data-action=habit][data-id=move]");waitFor("document.getElementById('sheet').innerText.includes('Сегодня уже получилось')");click("[data-action=close]");
        go("money");waitFor("document.querySelector('.balance').innerText.includes('0')");screenshot("05-finances");
        go("hero");screenshot("06-hero");go("more");screenshot("07-more");go("calendar");screenshot("08-calendar");go("health");screenshot("09-health");go("photos");screenshot("10-photos");
        // Real Android file chooser opens and cancellation returns safely.
        tap("[data-action=photoAdd]");awaitPicker();screenshot("10a-system-photo-picker");sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);Thread.sleep(500);waitFor("document.querySelector('.content')");
        go("analytics");screenshot("11-analytics");go("achievements");screenshot("12-achievements");go("world");screenshot("13-world");go("settings");screenshot("14-settings");js("document.querySelector('[data-action=export]').scrollIntoView({block:'center'})");tap("[data-action=export]");awaitPicker();screenshot("14a-backup-destination");sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);Thread.sleep(500);
        js("(()=>{const e=document.querySelector('[data-setting=theme]');e.value='light';e.dispatchEvent(new Event('change',{bubbles:true}))})()");waitFor("document.body.classList.contains('light')");screenshot("15-light-theme");
        // Force an actual packaged-origin reload and verify durable profile and habit.
        runOnMainSync(()->activity.webForTesting().reload());waitFor("document.querySelector('.content')&&document.body.classList.contains('light')");
        if(!"true".equals(js("(async()=>{const s=await LevelStore.read();return s.onboard&&s.entries.length===1&&s.rewards.length===1})()"))){
            // evaluateJavascript serializes a Promise as {}; assert via DOM after navigating instead.
            go("quests");waitFor("document.querySelector('[data-action=habit][data-id=move]').classList.contains('done')");
        }
        if(!"true".equals(js("document.documentElement.scrollWidth<=innerWidth")))throw new AssertionError("Horizontal overflow");
        PackageInfo info=getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),PackageManager.GET_PERMISSIONS);
        if(info.requestedPermissions!=null)for(String permission:info.requestedPermissions)if(permission.equals("android.permission.INTERNET"))throw new AssertionError("Unexpected network permission");
        go("home");activity.finish();
    }
}
