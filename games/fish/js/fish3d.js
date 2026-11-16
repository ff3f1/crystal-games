/* Original high-resolution species art on a continuously deformed relief mesh.
 * Two GPU contexts maximum: world and shared portrait. Thumbnails are prebuilt.
 * No atlases, recolored aliases, strip deformation, or silent drawn substitutes. */
(function(FZ){
  'use strict';
  const T=window.THREE,M={revision:2,profiles:{},error:null};
  const rows = {
    bleak:[.19,.065,.21,.15,.48,.13,'silver'], roach:[.30,.10,.22,.20,.43,.18,'cyprinid'],
    rudd:[.34,.11,.21,.22,.49,.16,'cyprinid'], perch:[.31,.12,.25,.20,.28,.44,'percid'],
    ruffe:[.28,.12,.29,.16,.26,.49,'percid'], rotan:[.28,.15,.34,.15,.33,.45,'goby'],
    crucian:[.42,.14,.24,.22,.30,.40,'cyprinid'], gcrucian:[.47,.15,.22,.23,.28,.41,'cyprinid'],
    bream:[.46,.09,.23,.24,.42,.15,'bream'], sbream:[.39,.09,.25,.21,.43,.16,'bream'],
    tench:[.32,.15,.25,.18,.44,.19,'round'], carp:[.37,.17,.27,.24,.30,.44,'carp'],
    wildcarp:[.31,.15,.25,.24,.31,.42,'carp'], grasscarp:[.24,.12,.24,.24,.43,.15,'cyprinid'],
    pike:[.17,.09,.34,.18,.68,.15,'pike'], zander:[.23,.11,.29,.20,.29,.40,'percid'],
    asp:[.23,.11,.26,.24,.46,.16,'silver'], chub:[.27,.14,.29,.21,.45,.16,'cyprinid'],
    ide:[.29,.13,.25,.22,.43,.16,'cyprinid'], dace:[.23,.09,.25,.21,.44,.15,'silver'],
    vobla:[.32,.11,.23,.21,.43,.16,'cyprinid'], catfish:[.21,.16,.34,.12,.29,.09,'catfish'],
    burbot:[.20,.13,.30,.14,.43,.42,'burbot'], smelt:[.15,.06,.25,.15,.48,.13,'salmon'],
    whitefish:[.26,.11,.24,.21,.41,.17,'salmon'], omul:[.22,.09,.25,.20,.43,.17,'salmon'],
    grayling:[.24,.10,.24,.22,.29,.35,'grayling'], lenok:[.24,.11,.25,.20,.44,.17,'salmon'],
    taimen:[.21,.12,.30,.22,.46,.16,'salmon'], trout:[.26,.13,.24,.20,.43,.18,'salmon'],
    sturgeon:[.16,.11,.35,.25,.67,.13,'sturgeon'], palia:[.27,.12,.24,.20,.45,.16,'salmon'],
    brooktrout:[.26,.12,.24,.20,.44,.16,'salmon'], nase:[.23,.10,.26,.21,.43,.16,'silver'],
    sterlet:[.14,.08,.38,.25,.66,.13,'sturgeon'], chekhon:[.20,.07,.22,.24,.64,.12,'sabre'],
    rybets:[.26,.10,.28,.22,.44,.15,'silver'], nelma:[.22,.11,.28,.24,.44,.15,'salmon'],
    muksun:[.26,.12,.23,.22,.40,.18,'salmon'], chir:[.30,.14,.24,.22,.40,.18,'salmon'],
    chinook:[.24,.14,.29,.23,.43,.16,'salmon'], coho:[.25,.13,.27,.22,.43,.16,'salmon'],
    sockeye:[.29,.13,.27,.22,.42,.17,'salmon'], halibut:[.57,.055,.25,.22,.19,.62,'flat'],
    terpug:[.33,.12,.25,.17,.25,.53,'percid'], gudgeon:[.22,.10,.29,.20,.44,.18,'barbel'],
    minnow:[.20,.08,.25,.18,.49,.15,'minnow'], eel:[.09,.065,.17,.07,.35,.62,'eel'],
    silvercarp:[.34,.17,.31,.26,.46,.15,'silvercarp'], vendace:[.20,.08,.22,.19,.44,.16,'salmon'],
    peled:[.30,.13,.23,.22,.40,.19,'salmon'], pinksalmon:[.32,.13,.28,.23,.40,.18,'salmon'],
    chumsalmon:[.24,.14,.29,.24,.44,.17,'salmon'], flounder:[.65,.045,.24,.21,.16,.67,'flat'],
    cod:[.27,.15,.29,.18,.28,.49,'cod'], navaga:[.24,.11,.26,.17,.30,.47,'cod'],
    sculpin:[.24,.19,.38,.14,.34,.42,'goby'], marinka:[.23,.12,.26,.23,.44,.17,'barbel'],
    osman:[.22,.11,.25,.21,.45,.17,'barbel'], amurpike:[.18,.10,.34,.19,.67,.16,'pike'],
    redmullet:[.28,.12,.30,.22,.32,.31,'mullet'], blackseagoby:[.28,.17,.35,.15,.32,.45,'goby']
  };

  Object.keys(rows).forEach(id=>{const p=rows[id];M.profiles[id]={id,height:p[0],thickness:p[1],head:p[2],tail:p[3],shape:p[6]};});
  function image(s){const k='fishhd/'+s.id,im=FZ.Assets.get(k);if(!im)FZ.Assets.ensure(k);return im;}
  M.ready=s=>FZ.Assets.ensure('fishhd/'+s.id);
  M.create=function(s){
    const im=image(s);if(!im||!T)return null;
    const group=new T.Group(),aspect=im.height/im.width;
    const texture=new T.Texture(im);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;texture.anisotropy=4;
    const geo=new T.PlaneGeometry(4,4*aspect,96,24),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.13*Math.sin(Math.PI*(x+2)/4)*Math.max(0,1-Math.pow(y/(aspect*2),2)));}
    geo.computeVertexNormals();
    const uni={swimTime:{value:0},swimAmp:{value:.025}};
    const mat=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.02,side:T.DoubleSide,depthWrite:true});
    mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,uni);sh.vertexShader='uniform float swimTime;uniform float swimAmp;\n'+sh.vertexShader;
      sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float tailWeight=smoothstep(-.8,1.7,position.x);
        transformed.z += sin(swimTime-position.x*2.5)*swimAmp*tailWeight*tailWeight;
        transformed.y += sin(swimTime*.85-position.x*2.)*swimAmp*.22*tailWeight*tailWeight;
      `);};
    mat.customProgramCacheKey=()=> 'fish-relief-v2';group.add(new T.Mesh(geo,mat));
    group.userData={species:s.id,uniforms:uni,textureWidth:im.width,textureHeight:im.height,vertices:pos.count,aspect};return group;
  };
  M.animate=function(model,t,amp){if(!model)return;model.userData.uniforms.swimTime.value=t;model.userData.uniforms.swimAmp.value=amp==null?.035:amp;};
  M.dispose=function(model){model.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});};
  let renderer,scene,camera,active,activeId='',lastW=0,lastH=0;
  function init(){
    if(renderer)return true;if(M.error||!T)return false;
    try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
      scene=new T.Scene();camera=new T.OrthographicCamera(-2.12,2.12,1.23,-1.23,.1,30);camera.position.z=8;return true;
    }catch(e){M.error=e.message;return false;}
  }
  M.supported=init;
  M.draw=function(ctx,s,x,y,len,o){
    o=o||{};const im=image(s);if(!im)return false;
    const aspect=im.height/im.width,h=len*aspect;
    if(!init()){ctx.save();ctx.translate(x,y);if(o.dir===-1)ctx.scale(-1,1);if(o.silhouette)ctx.filter='brightness(0)';ctx.drawImage(im,-len/2,-h/2,len,h);ctx.restore();return true;}
    const w=Math.max(64,Math.min(1800,Math.ceil(len*(o.dpr||devicePixelRatio||1)))),rh=Math.ceil(w*aspect);
    if(w!==lastW||rh!==lastH){renderer.setSize(w,rh,false);camera.top=2.12*aspect;camera.bottom=-2.12*aspect;camera.updateProjectionMatrix();lastW=w;lastH=rh;}
    if(activeId!==s.id){const next=M.create(s);if(!next)return false;scene.add(next);renderer.compile(scene,camera);if(active){scene.remove(active);M.dispose(active);}active=next;activeId=s.id;}
    M.animate(active,o.phase||0,(o.amp||0)*.45);active.rotation.set(0,Math.sin((o.phase||0)*.14)*.045,o.roll||0);active.scale.x=o.dir===-1?-1:1;
    renderer.render(scene,camera);ctx.save();ctx.globalAlpha*=o.alpha==null?1:o.alpha;if(o.silhouette)ctx.filter='brightness(0)';ctx.drawImage(renderer.domElement,x-len/2,y-h/2,len,h);ctx.restore();return true;
  };
  M.thumbnail=(s,w,sil)=>'assets/fish-thumb/'+s.id+(sil?'_sil':'')+'.webp';
  M.info=()=>({error:M.error,activeSpecies:activeId,contexts:renderer?1:0});
  FZ.Fish3D=M;
})(window.FZ);
