import re
from playwright.sync_api import sync_playwright
urls={}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page()
 page.on('request',lambda r:urls.setdefault(r.url,0))
 for k,vid in [('PIKE','1c8ce64d-525d-4f7c-bda6-2a88f5c6e838'),('TROUT','d9413087-4bef-4d2f-952c-11ca4af83bde')]:
  urls.clear()
  page.goto('https://fws.rev.vbrick.com/#/videos/'+vid,wait_until='domcontentloaded',timeout=30000)
  page.wait_for_timeout(13000)
  print('TITLE',k,page.title(),flush=True)
  print('BODY',k,page.locator('body').inner_text()[:700],flush=True)
  print('VIDEO',k,page.locator('video').count(),flush=True)
  print('VIDEO-SRC',k,page.locator('video').evaluate_all('(els)=>els.map(e=>({src:e.src, html:e.outerHTML.slice(0,300)}))'),flush=True)
  for url in urls:
   if any(w in url.lower() for w in ['api','mp4','m3u8','mpd','master','hls','video','playback']):
    print('NETWORK',k,url[:650],flush=True)
 browser.close()
