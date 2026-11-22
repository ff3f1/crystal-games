import requests, re, json
from bs4 import BeautifulSoup
u='https://www.fws.gov/NCTC-underwater-b-rolls'
h=requests.get(u,timeout=30)
print('MAIN',h.status_code,h.url,len(h.content))
s=BeautifulSoup(h.text,'html.parser')
for a in s.find_all('a',href=True):
 t=' '.join(a.stripped_strings)
 if any(x in t for x in ('Underwater Grayling', 'Brook Trout', 'Underwater Florida 7','Underwater Florida 3')):
  print('LINK',repr(t),a['href'], 'parent',repr(str(a.parent)[:300]))
  url=requests.compat.urljoin(u,a['href'])
  try:
   r=requests.get(url,timeout=25)
   print('PAGE',r.status_code,r.url,len(r.content),r.text[:250].replace('\n',' '))
  except Exception as e:print('ERR',e)
# search for Vbrick GUID near text
for term in ('Underwater Grayling & Pike','Brook Trout','Underwater Florida 7'):
 n=h.text.find(term);print('NEAR',term,n,h.text[n-600:n+500] if n>=0 else '')
