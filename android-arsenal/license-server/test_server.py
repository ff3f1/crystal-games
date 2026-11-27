import io,json,tempfile,unittest,sqlite3
from urllib.parse import urlencode,urlparse,parse_qs
from server import make_app,sha
class Payments(unittest.TestCase):
 def setUp(self):
    self.tmp=tempfile.TemporaryDirectory()
    self.path=self.tmp.name+"/test.sqlite"
    self.app=make_app(self.path,"test-one","test-two","live-one","live-two",True)
    self.key="a"*43
 def tearDown(self): self.tmp.cleanup()
 def req(self,path,data=None):
    raw=(urlencode(data) if path=="/result" else json.dumps(data)).encode()
    status=[]
    env={"REQUEST_METHOD":"POST","PATH_INFO":path,"CONTENT_LENGTH":str(len(raw)),"wsgi.input":io.BytesIO(raw)}
    body=b"".join(self.app(env,lambda s,h:status.append(int(s.split()[0])))).decode()
    return status[0],body
 def order(self,mode="test"):
    return json.loads(self.req("/order",{"code":self.key,"mode":mode})[1])
 def result(self,i,mode="test",amount="399.000000",secret="test-two"):
    return self.req("/result",{"InvId":str(i),"OutSum":amount,"Shp_mode":mode,"SignatureValue":sha(f"{amount}:{i}:{secret}:Shp_mode={mode}")})
 def test_order_signature_and_restore(self):
    a=self.order();i=a["invoice"];q=parse_qs(urlparse(a["checkout"]).query)
    self.assertEqual(q["IsTest"],["1"])
    self.assertEqual(q["SignatureValue"],[sha(f"arsenal-rybaka:399.00:{i}:test-one:Shp_mode=test")])
    self.assertEqual(self.order()["invoice"],i)
    self.assertEqual(self.result(i),(200,"OK"+str(i)))
    self.assertEqual(self.result(i),(200,"OK"+str(i)))
    self.assertEqual(self.order()["state"],"paid")
    self.assertEqual(json.loads(self.req("/status",{"code":"b"*43,"mode":"test"})[1])["state"],"unknown")
    self.assertEqual(self.order("live")["state"],"pending")
 def test_invalid_and_refund(self):
    i=self.order()["invoice"]
    self.assertEqual(self.result(i,secret="wrong")[0],403)
    self.assertEqual(self.result(i,amount="1.00")[0],400)
    self.assertEqual(self.result(i,mode="live",secret="live-two")[0],404)
    self.assertEqual(self.order()["state"],"pending")
    self.result(i)
    with sqlite3.connect(self.path) as c:c.execute("UPDATE orders SET state='refunded' WHERE id=?",(i,))
    self.result(i)
    self.assertEqual(self.order()["state"],"refunded")
 def test_promotion_cap_and_signatures(self):
    self.app=make_app(self.path,"test-one","test-two","live-one","live-two",True,promo_live=True,promo_test=True,promo_limit=2)
    status=json.loads(self.req("/status",{"code":self.key,"mode":"test"})[1]);self.assertEqual(status["price_cents"],19900);self.assertEqual(status["promo_remaining"],2)
    a=self.order();self.assertEqual(a["price_cents"],19900);self.assertEqual(a["promo_remaining"],1)
    q=parse_qs(urlparse(a["checkout"]).query);self.assertEqual(q["OutSum"],["199.00"])
    self.assertEqual(q["SignatureValue"],[sha(f"arsenal-rybaka:199.00:{a['invoice']}:test-one:Shp_mode=test")])
    self.assertEqual(self.order()["invoice"],a["invoice"])
    self.assertNotEqual(self.result(a["invoice"])[0],200)
    self.assertEqual(self.result(a["invoice"],amount="199.000000"),(200,"OK"+str(a["invoice"])))
    self.key="b"*43;b=self.order();self.assertEqual(b["price_cents"],19900)
    self.key="c"*43;c=self.order();self.assertEqual(c["price_cents"],39900)
    self.assertEqual(c["promo_remaining"],0)
    self.assertEqual(self.order("live")["price_cents"],19900)
    self.app=make_app(self.path,"test-one","test-two","live-one","live-two",True)
    self.key="b"*43;self.assertEqual(self.order()["price_cents"],19900)
    self.assertEqual(self.result(b["invoice"],amount="199.00"),(200,"OK"+str(b["invoice"])))
 def test_live_disabled(self):
    self.app=make_app(self.path,"test-one","test-two")
    self.assertEqual(self.req("/order",{"code":self.key,"mode":"live"})[0],403)
if __name__=="__main__": unittest.main()
