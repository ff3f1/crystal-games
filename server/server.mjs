import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const DB_PATH = process.env.DB_PATH || resolve('data/level.db');
const WEB_DIR = process.env.WEB_DIR || resolve('../client');
const ALLOWED_ORIGINS = new Set(['https://appassets.androidplatform.net',...(process.env.ALLOWED_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean)]);
mkdirSync(dirname(DB_PATH),{recursive:true});
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, passhash TEXT NOT NULL, salt TEXT NOT NULL, created INTEGER NOT NULL, public INTEGER NOT NULL DEFAULT 0, interests TEXT NOT NULL DEFAULT '', avatar INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(tokenhash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS saves(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL DEFAULT '{}', updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships(a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('pending','accepted')), requested_by TEXT NOT NULL, PRIMARY KEY(a,b));
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires);`);
const q={
 user:db.prepare('SELECT id,username,public,interests,avatar,created FROM users WHERE id=?'),
 auth:db.prepare('SELECT * FROM users WHERE username=?'),
 token:db.prepare('SELECT user_id FROM sessions WHERE tokenhash=? AND expires>?'),
 save:db.prepare('SELECT revision,payload,updated FROM saves WHERE user_id=?'),
 friends:db.prepare(`SELECT u.id,u.username,u.avatar,u.interests,f.status,f.requested_by FROM friendships f JOIN users u ON u.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.a=? OR f.b=? ORDER BY u.username`)
};
const now=()=>Date.now(); const id=()=>randomBytes(16).toString('hex');const hash=s=>createHash('sha256').update(s).digest('hex');
const rate=new Map();function limited(key,limit=45){const t=now(),v=rate.get(key)||{start:t,n:0};if(t-v.start>60000){v.start=t;v.n=0}v.n++;rate.set(key,v);if(rate.size>5000)for(const [k,x] of rate)if(t-x.start>120000)rate.delete(k);return v.n>limit}
function json(res,status,obj,origin){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(body)}
function requestBody(req){return new Promise((ok,fail)=>{let size=0,chunks=[];req.on('data',x=>{size+=x.length;if(size>400000){fail(Object.assign(new Error('Слишком большой запрос'),{code:413}));req.destroy()}else chunks.push(x)});req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch{fail(Object.assign(new Error('Некорректный JSON'),{code:400}))}});req.on('error',fail)})}
function userOf(req){const m=/^Bearer ([a-f0-9]{64})$/i.exec(req.headers.authorization||'');if(!m)return null;const r=q.token.get(hash(m[1]),now());return r?.user_id||null}
function publicUser(u){return {id:u.id,username:u.username,avatar:u.avatar,interests:u.interests}}
function pair(a,b){return a<b?[a,b]:[b,a]}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 const cors=origin==='null'||ALLOWED_ORIGINS.has(origin)?origin:null;
 const url=new URL(req.url||'/', 'http://localhost');
 const path=url.pathname;
 if(req.method==='OPTIONS'){res.writeHead(cors?204:403,{'Access-Control-Allow-Origin':cors||'', 'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Vary':'Origin'});res.end();return}
 if(origin&&!cors){json(res,403,{error:'Origin not allowed'});return}
 if(path.startsWith('/api/')){
   if(limited(req.socket.remoteAddress||'unknown',path==='/api/login'||path==='/api/register'?10:100)){json(res,429,{error:'Слишком много запросов'},cors);return}
   try{
    if(path==='/api/health'&&req.method==='GET'){json(res,200,{ok:true,service:'ty-uroven',version:7},cors);return}
    if(path==='/api/register'&&req.method==='POST'){
      const b=await requestBody(req),username=String(b.username||'').trim().toLowerCase(),password=String(b.password||'');
      if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<10||password.length>128){json(res,400,{error:'Логин: 3–24 латинских символа, пароль: 10–128 символов'},cors);return}
      const salt=randomBytes(16).toString('hex'),passhash=scryptSync(password,salt,64).toString('hex'),uid=id();
      try{db.prepare('INSERT INTO users(id,username,passhash,salt,created) VALUES(?,?,?,?,?)').run(uid,username,passhash,salt,now())}catch{json(res,409,{error:'Логин уже занят'},cors);return}
      db.prepare('INSERT INTO saves(user_id,updated) VALUES(?,?)').run(uid,now());
      const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),uid,now()+30*86400000);
      json(res,201,{token,user:publicUser(q.user.get(uid)),revision:0},cors);return;
    }
    if(path==='/api/login'&&req.method==='POST'){
      const b=await requestBody(req),username=String(b.username||'').trim().toLowerCase(),password=String(b.password||'');const u=q.auth.get(username);
      const test=scryptSync(password.slice(0,128),u?.salt||'00000000000000000000000000000000',64);
      if(!u||!timingSafeEqual(test,Buffer.from(u.passhash,'hex'))){json(res,401,{error:'Неверный логин или пароль'},cors);return}
      const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),u.id,now()+30*86400000);
      json(res,200,{token,user:publicUser(u),revision:q.save.get(u.id)?.revision||0},cors);return;
    }
    const uid=userOf(req);if(!uid){json(res,401,{error:'Нужно войти в аккаунт'},cors);return}
    if(path==='/api/logout'&&req.method==='POST'){const t=req.headers.authorization?.slice(7);if(t)db.prepare('DELETE FROM sessions WHERE tokenhash=?').run(hash(t));json(res,200,{ok:true},cors);return}
    if(path==='/api/me'&&req.method==='GET'){const u=q.user.get(uid),s=q.save.get(uid);json(res,200,{user:publicUser(u),public:!!u.public,revision:s.revision,updated:s.updated},cors);return}
    if(path==='/api/settings'&&req.method==='PUT'){
      const b=await requestBody(req);db.prepare('UPDATE users SET public=?,interests=?,avatar=? WHERE id=?').run(b.public===true?1:0,String(b.interests||'').slice(0,120),Math.max(0,Math.min(7,Number(b.avatar)||0)),uid);json(res,200,{ok:true},cors);return;
    }
    if(path==='/api/sync'&&req.method==='GET'){const s=q.save.get(uid);json(res,200,{revision:s.revision,payload:JSON.parse(s.payload),updated:s.updated},cors);return}
    if(path==='/api/sync'&&req.method==='PUT'){
      const b=await requestBody(req);if(!Number.isSafeInteger(b.revision)||b.revision<0||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload)){json(res,400,{error:'Неверный формат сохранения'},cors);return}
      const data=JSON.stringify(b.payload);if(data.length>300000){json(res,413,{error:'Сохранение слишком большое'},cors);return}
      // CAS prevents two devices from silently overwriting each other.
      const change=db.prepare('UPDATE saves SET revision=revision+1,payload=?,updated=? WHERE user_id=? AND revision=?').run(data,now(),uid,b.revision);
      if(!change.changes){json(res,409,{error:'На сервере есть более новая версия. Сначала загрузите её.',revision:q.save.get(uid).revision},cors);return}
      json(res,200,{revision:b.revision+1,ok:true},cors);return;
    }
    if(path==='/api/people'&&req.method==='GET'){
      const search=(url.searchParams.get('q')||'').trim().toLowerCase();if(search.length<3){json(res,200,{people:[]},cors);return}
      const users=db.prepare('SELECT id,username,avatar,interests FROM users WHERE public=1 AND username LIKE ? AND id<>? LIMIT 20').all('%'+search.replace(/[%_]/g,'')+'%',uid);json(res,200,{people:users},cors);return;
    }
    if(path==='/api/friends'&&req.method==='GET'){json(res,200,{friends:q.friends.all(uid,uid,uid)},cors);return}
    if(path==='/api/friends/request'&&req.method==='POST'){
      const b=await requestBody(req),other=String(b.id||'');if(other===uid||!q.user.get(other)){json(res,400,{error:'Пользователь не найден'},cors);return}
      const [a,c]=pair(uid,other);try{db.prepare('INSERT INTO friendships(a,b,status,requested_by) VALUES(?,?,?,?)').run(a,c,'pending',uid)}catch{json(res,409,{error:'Заявка уже существует'},cors);return}json(res,200,{ok:true},cors);return;
    }
    if(path==='/api/friends/accept'&&req.method==='POST'){
      const b=await requestBody(req),[a,c]=pair(uid,String(b.id||''));const changed=db.prepare("UPDATE friendships SET status='accepted' WHERE a=? AND b=? AND status='pending' AND requested_by<>?").run(a,c,uid);json(res,changed.changes?200:404,{ok:!!changed.changes},cors);return;
    }
    if(path==='/api/leaderboard'&&req.method==='GET'){
      const friends=q.friends.all(uid,uid,uid).filter(x=>x.status==='accepted').map(x=>x.id);friends.push(uid);
      const entries=friends.map(id=>{const u=q.user.get(id),s=q.save.get(id);let xp=0;try{xp=Math.max(0,Math.min(1000000,Number(JSON.parse(s.payload).xp)||0))}catch{}return {username:u.username,avatar:u.avatar,xp}}).sort((a,b)=>b.xp-a.xp);json(res,200,{entries},cors);return;
    }
    json(res,404,{error:'Не найдено'},cors);
   }catch(e){json(res,e.code&&Number.isInteger(e.code)?e.code:500,{error:e.code?e.message:'Ошибка сервера'},cors)}
   return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'},cors);return}
 let file=path==='/'?'index.html':decodeURIComponent(path.slice(1));if(file.includes('..')||file.startsWith('.')||file.includes('\\')){res.writeHead(403);res.end();return}
 const full=join(WEB_DIR,file);if(!existsSync(full)){res.writeHead(404);res.end('Not found');return}
 try{const data=readFileSync(full);res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream','Content-Length':data.length,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self' 'unsafe-inline' data: blob:; connect-src 'self' https: http://localhost:*; img-src 'self' data: blob:;"});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(500);res.end()}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`TY.UROVEN server :${PORT} db=${DB_PATH}`));
