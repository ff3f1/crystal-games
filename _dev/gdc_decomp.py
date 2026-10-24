import struct, sys, os, zstandard, math
NAMES = ["","@","ID","LIT","<","<=",">",">=","==","!=","and","or","not","&&","||","!","&","|","~","^","<<",">>","+","-","*","**","/","%","=","+=","-=","*=","**=","/=","%=","<<=",">>=","&=","|=","^=","if","elif","else","for","while","break","continue","pass","return","match","when","as","assert","await","breakpoint","class","class_name","const","enum","extends","func","in","is","namespace","preload","self","signal","static","super","trait","var","void","yield","[","]","{","}","(",")",",",";",".","..","...",":","$","->","_","NL","INDENT","DEDENT","PI","TAU","INF","NAN","VCS","`","?","ERR","EOF"]
def u32(b,o): return struct.unpack_from('<I',b,o)[0]
def dec_str(b,o):
    l=u32(b,o); s=b[o+4:o+4+l].decode('utf-8'); pad=(4-l%4)%4; return s,4+l+pad
def dec_var(b,o):
    h=u32(b,o); t=h&0xff; f64=h&(1<<16); p=o+4
    if t==0: return None,4
    if t==1: return bool(u32(b,p)),8
    if t==2:
        if f64: return struct.unpack_from('<q',b,p)[0],12
        return struct.unpack_from('<i',b,p)[0],8
    if t==3:
        if f64: return struct.unpack_from('<d',b,p)[0],12
        return struct.unpack_from('<f',b,p)[0],8
    if t in (4,21):
        s,l=dec_str(b,p); return (('SN',s) if t==21 else s),4+l
    if t==22:
        nc=u32(b,p)&0x7fffffff; sc=u32(b,p+4); fl=u32(b,p+8); q=p+12; parts=[]
        for i in range(nc+sc):
            s,l=dec_str(b,q); q+=l; parts.append(s)
        path=('/' if fl&1 else '')+'/'.join(parts[:nc])+ ((':'+':'.join(parts[nc:])) if sc else '')
        return ('NP',path), q-o
    raise Exception('variant type %d'%t)
def lit(v):
    if v is None: return 'null'
    if isinstance(v,bool): return 'true' if v else 'false'
    if isinstance(v,int): return str(v)
    if isinstance(v,float):
        if math.isinf(v): return 'INF' if v>0 else '-INF'
        r=repr(v)
        if 'e' in r and '.' not in r.split('e')[0]: r=r.replace('e','.0e')
        return r
    if isinstance(v,tuple):
        pre='&' if v[0]=='SN' else '^'; return pre+qs(v[1])
    return qs(v)
def qs(s):
    return '"'+s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\t','\\t').replace('\r','\\r')+'"'
def decomp(data):
    assert data[:4]==b'GDSC'
    ds=u32(data,8)
    c=zstandard.ZstdDecompressor().decompress(data[12:],max_output_size=ds) if ds else data[12:]
    idc,cc,lc,tc=struct.unpack_from('<4I',c,0); o=16; ids=[]
    for i in range(idc):
        l=u32(c,o); o+=4
        raw=bytes(x^0xb6 for x in c[o:o+l*4]); o+=l*4
        ids.append(raw.decode('utf-32-le'))
    consts=[]
    for i in range(cc):
        v,l=dec_var(c,o); o+=l; consts.append(v)
    lines={};cols={}
    for i in range(lc):
        lines[u32(c,o)]=u32(c,o+4); o+=8
    for i in range(lc):
        cols[u32(c,o)]=u32(c,o+4); o+=8
    toks=[]
    for i in range(tc):
        if c[o]&0x80:
            tt=u32(c,o); ln=u32(c,o+4); o+=8
        else:
            tt=c[o]; ln=u32(c,o+1); o+=5
        typ=tt&0x7f; idx=tt>>8
        if typ in (1,2): s=('@' if typ==1 else '')+ids[idx]
        elif typ in (3,97): s=lit(consts[idx])
        elif typ==92: s='NAN'
        else: s=NAMES[typ]
        toks.append((typ,s,ln))
    # rebuild lines
    out=[]; stack=[]; cur=[]; curline=None
    def flush():
        if cur: out.append(cur_ind[0]+join(cur))
    cur_ind=['']
    for i,(typ,s,ln) in enumerate(toks):
        if i in lines or i==0:
            if cur: out.append(cur_ind[0]+join(cur))
            # blank line preservation
            L=lines.get(i,1); 
            if out and curline is not None and L-curline>1: out.append('')
            curline=L
            col=cols.get(i,1)-1
            while stack and col<stack[-1]: stack.pop()
            if col>0 and (not stack or col>stack[-1]): stack.append(col)
            cur_ind[0]='\t'*len(stack); cur=[]
        cur.append((typ,s))
    if cur: out.append(cur_ind[0]+join(cur))
    return '\n'.join(out)+'\n'
NOSPACE_AFTER={'(','[','{','.','$','!','~'}
NOSPACE_BEFORE={')',']','}',',','.',':',';'}
def join(ts):
    r=''; prev=None
    for j,(typ,s) in enumerate(ts):
        if prev is None: r=s
        else:
            pt,ps=prev
            sp=True
            if ps in NOSPACE_AFTER or s in NOSPACE_BEFORE: sp=False
            if s in ('(','[') and (pt in (2,) or ps in (')',']','"') or pt==3 and ps.startswith(('"',"&","^"))): sp=False
            if s=='(' and ps in ('func','preload','super','assert','await','self','print','not','return','in','and','or','if','elif','while','=', ',','+','-','*','/'): sp = ps in ('not','return','in','and','or','if','elif','while','=',',','+','-','*','/','await','assert')
            if pt==1 and s=='(': sp=False
            if s=='{' : sp=True
            if ps=='{' and s=='}': sp=False
            if ps=='-' and j>=2 and ts[j-2][1] in ('(','[',',','=','return','+','-','*','/','<','>','<=','>=','==','!=','and','or','not',':','+=','-=','*=','/=','if','elif','in','{'): sp=False
            if ps=='-' and j==1: sp=False
            if ps==':' and False: sp=False
            r+=(' ' if sp else '')+s
        prev=(typ,s)
    return r
if __name__=='__main__':
    src,dst=sys.argv[1],sys.argv[2]
    open(dst,'w').write(decomp(open(src,'rb').read()))
