"""Arsenal PRO payment service. Python 3.11+, standard library only."""
import hashlib, hmac, json, os, re, sqlite3, time
from contextlib import closing
from urllib.parse import urlencode, parse_qs
from wsgiref.simple_server import make_server

PRICE = "399.00"
MERCHANT = "arsenal-rybaka"
CODE = re.compile(r"[A-Za-z0-9_-]{43}")
def sha(s): return hashlib.sha256(s.encode()).hexdigest()
def cents(s):
    if not re.fullmatch(r"[0-9]{1,8}(?:\.[0-9]{1,6})?", s): return None
    whole, _, fraction = s.partition(".")
    if any(c != "0" for c in fraction[2:]): return None
    return int(whole)*100 + int((fraction+"00")[:2])
def signature_ok(expected, supplied):
    return isinstance(supplied,str) and bool(re.fullmatch(r"[a-fA-F0-9]{64}",supplied)) and hmac.compare_digest(expected,supplied.lower())
def make_app(dbpath, test1, test2, live1="", live2="", live_enabled=False):
    if not test1 or not test2 or test1 == test2: raise ValueError("Separate test secrets required")
    if live_enabled and (not live1 or not live2 or len({test1,test2,live1,live2}) != 4): raise ValueError("Separate live secrets required")
    def db():
        c=sqlite3.connect(dbpath,timeout=10)
        c.row_factory=sqlite3.Row
        return c
    with closing(db()) as c:
        c.executescript("""PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS orders(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyhash TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('test','live')),
          amount INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending'
          CHECK(state IN ('pending','paid','refunded')), created INTEGER NOT NULL,
          paid INTEGER, UNIQUE(keyhash,mode));
        """)
    def passwords(mode):
        if mode=="test": return test1,test2
        if mode=="live" and live_enabled: return live1,live2
        return None
    def checkout(row, p1):
        mode=row["mode"]
        q=dict(MerchantLogin=MERCHANT,OutSum=PRICE,InvId=str(row["id"]),
               Description="Арсенал рыбака PRO — лицензия",
               Shp_mode=mode,SignatureValue=sha(f"{MERCHANT}:{PRICE}:{row['id']}:{p1}:Shp_mode={mode}"))
        if mode=="test": q["IsTest"]="1"
        return "https://auth.robokassa.ru/Merchant/Index.aspx?"+urlencode(q)
    def dispatch(env):
        method,path=env["REQUEST_METHOD"],env["PATH_INFO"]
        if method=="GET" and path=="/health":
            return 200,{"ok":True,"live_enabled":live_enabled}
        if method=="GET" and path in ("/success","/fail"):
            return 200,("Вернитесь в Арсенал рыбака и нажмите «Проверить оплату». Подтверждение поступает отдельно." if path=="/success" else "Оплата не завершена. Вернитесь в приложение.")
        if method!="POST": return 405,{"error":"method"}
        try:
            n=int(env.get("CONTENT_LENGTH") or "0")
            if not 0<n<=8192: return 400,{"error":"size"}
            raw=env["wsgi.input"].read(n).decode("utf-8")
        except (ValueError,UnicodeError): return 400,{"error":"body"}
        if path=="/result":
            try:
                pairs=parse_qs(raw,keep_blank_values=True,max_num_fields=32)
                if any(len(v)!=1 for v in pairs.values()): return 400,"duplicate"
                p={k:v[0] for k,v in pairs.items()}
                if set(k for k in p if k.lower().startswith("shp_"))!={"Shp_mode"}: return 400,"params"
                mode=p["Shp_mode"]; pw=passwords(mode)
                if not pw: return 403,"disabled"
                inv,amount=p["InvId"],p["OutSum"]
                if not re.fullmatch(r"[1-9][0-9]{0,15}",inv) or cents(amount)!=39900: return 400,"amount"
                if not signature_ok(sha(f"{amount}:{inv}:{pw[1]}:Shp_mode={mode}"),p["SignatureValue"]): return 403,"signature"
                with closing(db()) as c, c:
                    c.execute("BEGIN IMMEDIATE")
                    row=c.execute("SELECT * FROM orders WHERE id=?",(int(inv),)).fetchone()
                    if not row or row["mode"]!=mode or row["amount"]!=39900: return 404,"order"
                    if row["state"]=="pending":
                        c.execute("UPDATE orders SET state='paid',paid=? WHERE id=?",(int(time.time()),int(inv)))
                return 200,"OK"+inv
            except (KeyError,ValueError): return 400,"params"
        if path not in ("/order","/status"): return 404,{"error":"path"}
        try:
            p=json.loads(raw)
            code,mode=p["code"],p["mode"]
            if not isinstance(code,str) or not CODE.fullmatch(code): return 400,{"error":"code"}
            if not isinstance(mode,str): return 400,{"error":"mode"}
        except (ValueError,KeyError,TypeError): return 400,{"error":"json"}
        pw=passwords(mode)
        if not pw: return 403,{"error":"mode_disabled"}
        key=sha(code)
        with closing(db()) as c, c:
            if path=="/order":
                c.execute("BEGIN IMMEDIATE")
                existing=c.execute("SELECT * FROM orders WHERE keyhash=? AND mode=?",(key,mode)).fetchone()
                if not existing:
                    # Limit storage growth from unauthenticated order requests; adjust after launch.
                    count=c.execute("SELECT count(*) FROM orders WHERE state='pending' AND created>?",(int(time.time())-86400,)).fetchone()[0]
                    if count>=1000: return 429,{"error":"limit"}
                    c.execute("INSERT INTO orders(keyhash,mode,amount,created) VALUES(?,?,?,?)",(key,mode,39900,int(time.time())))
            row=c.execute("SELECT * FROM orders WHERE keyhash=? AND mode=?",(key,mode)).fetchone()
            if not row: return 200,{"state":"unknown","mode":mode}
            data={"state":row["state"],"mode":mode,"invoice":row["id"]}
            if path=="/order" and row["state"]=="pending": data["checkout"]=checkout(row,pw[0])
            return 200,data
    def app(env,start):
        try: status,data=dispatch(env)
        except (sqlite3.Error,TypeError): status,data=503,{"error":"unavailable"}
        body=(json.dumps(data,ensure_ascii=False) if isinstance(data,dict) else data).encode()
        start(f"{status} { {200:'OK',400:'Bad Request',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',429:'Too Many Requests',503:'Service Unavailable'}[status]}",[("Content-Type","application/json; charset=utf-8" if isinstance(data,dict) else "text/plain; charset=utf-8"),("Cache-Control","no-store"),("Content-Length",str(len(body)))])
        return [body]
    return app

def from_env():
    return make_app(os.environ.get("ARSENAL_DB","/var/lib/arsenal/orders.sqlite3"),os.environ["ROBO_TEST_1"],os.environ["ROBO_TEST_2"],os.environ.get("ROBO_LIVE_1",""),os.environ.get("ROBO_LIVE_2",""),os.environ.get("LIVE_ENABLED")=="yes")
if __name__=="__main__":
    with make_server("127.0.0.1",8765,from_env()) as http: http.serve_forever()
