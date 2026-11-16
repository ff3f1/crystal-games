/* Water is shaded every frame on the GPU; tackle is lit, volumetric geometry.
 * Existing world projection and gameplay IDs stay stable for save compatibility. */
(function(FZ){
  'use strict';
  const T=window.THREE,R=FZ.Scene,U=FZ.U;
  if(!T)return;
  const previous={init:R.init,resize:R.resize,setQuality:R.setQuality,render:R.render,drawAim:R.drawAim};
  let renderer,scene,camera,W=390,H=844,quality='hi',enabled=false,canvas,legacy;
  let plane,rod,float,line,aimMesh,fishModel,fishId='',net,weather,weatherStreaks;
  let key='',texture=null,oldTexture=null,asset=null,requested='',contextLost=false,ringCursor=0;
  const rippleData=Array.from({length:12},()=>new T.Vector4(-10,-10,-100,0));
  const uniforms={photo:{value:null},hasPhoto:{value:0},resolution:{value:new T.Vector2(W,H)},photoSize:{value:new T.Vector2(1,1)},shore:{value:.39},waterline:{value:.5},clock:{value:0},wind:{value:1},dark:{value:0},warm:{value:0},rain:{value:0},cloudCover:{value:0},ice:{value:0},winter:{value:0},hole:{value:new T.Vector2(.47,.64)},holeRadius:{value:new T.Vector2(.25,.04)},holeOn:{value:0},drillProgress:{value:0},colorNear:{value:new T.Color('#193b37')},colorFar:{value:new T.Color('#6d918b')},ripples:{value:rippleData},sun:{value:new T.Vector2(.7,.2)}};
  const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const fragment=`precision highp float;
    uniform sampler2D photo;uniform float hasPhoto,shore,waterline,clock,wind,dark,warm,rain,ice,winter,holeOn,cloudCover,drillProgress;
    uniform vec2 resolution,photoSize,hole,holeRadius,sun;uniform vec3 colorNear,colorFar;uniform vec4 ripples[12];varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
    float wave(vec2 p){float w=sin(p.x*1.7+p.y*.8+clock*1.1)*.44;w+=sin(p.x*3.2-p.y*1.3-clock*1.4)*.20;w+=sin(p.y*7.+clock*1.6+p.x*.4)*.10;return w;}
    vec3 samplePhoto(vec2 uv){
      float sc=max(resolution.x/photoSize.x,resolution.y*shore/(photoSize.y*waterline));
      vec2 xy=vec2((uv.x-.5)*resolution.x/sc+photoSize.x*.5,photoSize.y*waterline-(shore-uv.y)*resolution.y/sc);
      vec3 sceneColor=texture2D(photo,vec2(clamp(xy.x/photoSize.x,.002,.998),1.-clamp(xy.y/photoSize.y,.002,.998))).rgb;
      vec3 upperSky=mix(vec3(.31,.52,.73),vec3(.68,.77,.83),clamp(uv.y/shore,0.,1.));
      return sceneColor;
    }
    void main(){
      vec2 uv=vec2(vUv.x,1.-vUv.y);float depth=clamp((uv.y-shore)/(1.-shore),0.,1.);
      vec3 sky=mix(vec3(.40,.61,.73),vec3(.84,.86,.78),uv.y/shore);
      vec3 landscape=hasPhoto>.5?samplePhoto(uv):sky;
      vec3 c=landscape;
      if(winter>.5 && uv.y<=shore){
        float bank=smoothstep(shore*.47,shore,uv.y);
        float lum=dot(c,vec3(.2126,.7152,.0722));
        c=mix(c,vec3(lum*.94,lum,lum*1.08),.20+bank*.16);
        float frost=smoothstep(.54,.82,noise(uv*vec2(160.,94.))*.22+lum*.78);
        c=mix(c,vec3(.81,.87,.91),bank*frost*.16);
      }
      if(uv.y>shore){
        float perspective=.12+depth*depth*1.8;vec2 p=vec2(uv.x*28./perspective,9./(.11+depth));
        p.x+=clock*.05*wind;float strength=.25+wind*.16;
        vec2 normal=vec2(wave(p+vec2(.02,0.))-wave(p-vec2(.02,0.)),wave(p+vec2(0.,.02))-wave(p-vec2(0.,.02)))*strength;
        float ringLight=0.;
        for(int i=0;i<12;i++){
          float age=clock-ripples[i].z;
          if(age>0.&&age<3.4){vec2 d=(uv-ripples[i].xy)*vec2(resolution.x/resolution.y,2.8);float radius=length(d);float front=age*.052;float fade=exp(-age*1.0)*ripples[i].w;
            float crest=sin((radius-front)*540.)*exp(-pow((radius-front)*145.,2.))*fade;
            normal+=normalize(d+vec2(.0001))*crest*.055;ringLight+=crest*.075;
          }
        }
        // Wind ripples distort reflected shore and sky continuously in two axes.
        // Distorted low-strength shore reflection: no mirror-copy water.
        float chop=sin(p.x*1.9+clock*.65)*.007+sin(p.y*2.4-clock*.4)*.004;
        vec2 refl=vec2(uv.x+normal.x*(.027+depth*.08)+chop,shore-min(depth*shore*.48,shore*.48)+normal.y*(.032+depth*.02));
        vec3 reflection=hasPhoto>.5?samplePhoto(refl):sky;
        float mirror=(.08+.24*exp(-depth*3.6))*(1.-clamp(length(normal)*.35,0.,.23));
        vec3 water=mix(colorFar,colorNear,pow(depth,.65));
        c=mix(water,reflection,mirror);
        float spec=pow(max(0.,1.-length(normal-vec2(.045,-.015))*5.),48.);
        float lightPath=exp(-pow((uv.x-sun.x+normal.x*.2)/(.035+depth*.18),2.));
        c+=vec3(.92,.84,.63)*spec*lightPath*(1.-dark)*(.07+warm*.3)*(1.-cloudCover);
        float fine=noise(p*4.+clock*.15);c+=vec3(.16,.20,.19)*(fine-.5)*(.025+depth*.12)*strength;
        c+=ringLight;
        c=mix(c,vec3(.70,.75,.72),exp(-depth*34.)*.18);
        if(rain>.01){vec2 cell=floor(uv*vec2(55.,80.));float tt=fract(clock*1.6+hash(cell));float rr=length((fract(uv*vec2(55.,80.))-.5)*vec2(1.,2.8));c+=smoothstep(.025,0.,abs(rr-tt*.5))*(1.-tt)*rain*.07;}
        if(ice>.5){
          // Grain, clear-ice patches, cracks and near-shore snowbanks.
          float coarse=noise(uv*vec2(17.,29.));
          float grain=noise(uv*vec2(175.,295.))*.07+noise(uv*vec2(33.,52.))*.065;
          float frost=noise(uv*vec2(65.,92.));
          float cracks=pow(1.-abs(sin((uv.x+noise(uv*7.)*.16)*55.+uv.y*10.)),54.);
          float bluePatch=smoothstep(.54,.77,coarse)*.21;
          c=mix(vec3(.44,.60,.68),vec3(.77,.84,.87),clamp(depth*.54+grain+.14,0.,1.));
          c=mix(c,vec3(.34,.53,.63),bluePatch*1.55*(1.-depth*.35));
          // Wind-polished blue ice alternates with powdery snow, not flat plastic.
          float snowDrift=smoothstep(.51,.77,coarse+frost*.18)*(.12+depth*.21);
          c=mix(c,vec3(.88,.91,.93),snowDrift);
          c+=vec3(.8,.85,.88)*(frost-.5)*.05;
          c-=cracks*(.055+.045*coarse);
          float bank=1.-smoothstep(.005,.075,depth+sin(uv.x*32.)*.002);
          c=mix(c,vec3(.89,.92,.94),bank*.66);
          if(drillProgress>.0 && holeOn<.5){
            // Shaved ice and cracks spread as the drill progresses.
            float dr=length((uv-hole)/holeRadius);
            float drillEdge=.24+drillProgress*.76;
            float shaving=(1.-smoothstep(drillEdge*.67,drillEdge,dr))*(.4+.6*noise(uv*vec2(180.,220.)));
            float ring=exp(-pow((dr-drillEdge)*11.,2.));
            c=mix(c,vec3(.92,.95,.97),shaving*.48*drillProgress);
            c+=ring*vec3(.13,.16,.16)*drillProgress;
          }
          if(holeOn>.5){
            float hr=length((uv-hole)/holeRadius);
            float aperture=1.-smoothstep(.90,1.01,hr);
            float waterTexture=noise(uv*vec2(90.,70.)+clock*.08)*.075;
            vec3 inside=mix(vec3(.025,.08,.105),vec3(.085,.18,.22),clamp(hr*.56+waterTexture,0.,1.));
            c=mix(c,inside,aperture);
            // Broken frost, slush and an ice lip frame the actual water opening.
            float broken=exp(-pow((hr-1.12)*14.,2.));
            float flakes=.55+.45*noise(uv*vec2(160.,190.));
            c=mix(c,vec3(.86,.91,.94),broken*flakes*.38);
            c+=vec3(.38,.47,.50)*exp(-pow((hr-1.015)*11.,2.))*.24;
          }
        }
      }
      float night=clamp(dark/.60,0.,1.);
      // Moonlit visibility: the previous near-black multiplier hid line,
      // ice and fish on mobile screens even with maximum brightness.
      // The sky remains darker than moonlit water: the photographic
      // backdrop is daylight, so brightening the entire scene washes out night.
      float waterMoon=smoothstep(shore*.80,shore*1.15,uv.y);
      vec3 moonTint=mix(vec3(.070,.095,.14),vec3(.12,.17,.23),waterMoon);
      c*=mix(vec3(1.),moonTint,night);
      c=mix(c,vec3(dot(c,vec3(.2126,.7152,.0722)))*.63,cloudCover*.55);
      if(uv.y<shore*.66){
        float star=step(.9992,hash(floor(uv*resolution*.55)))*night*(1.-cloudCover);
        c+=vec3(.55,.64,.8)*star;
      }c=mix(c,c*vec3(1.12,.92,.74),warm*.40);
      c=mix(c,vec3(dot(c,vec3(.2126,.7152,.0722)))*.75,rain*.25);
      float vignette=1.-.23*pow(length((uv-.5)*vec2(.7,1.1)),1.7);c*=vignette;
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const V=(x,y,z=0)=>new T.Vector3(x-W/2,H/2-y,z);
  function material(color,roughness=.4,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness});}
  function cylinder(group,r1,r2,length,mat,x,y,z,rx=0,rz=0){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,length,18),mat);m.position.set(x,y,z);m.rotation.set(rx,0,rz);group.add(m);return m;}
  function sphere(group,x,y,z,sx,sy,sz,mat){const m=new T.Mesh(new T.SphereGeometry(1,18,12),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;}
  function torus(group,r,t,mat,x,y,z){const m=new T.Mesh(new T.TorusGeometry(r,t,6,36),mat);m.position.set(x,y,z);group.add(m);return m;}
  function connect(mesh,a,b){mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.scale.y=a.distanceTo(b);}
  let reelCanvas,reelTexture,reelPlane,netBag,netDrops,landingMetrics=null,reelCrank,rodSprites={},root,hemisphere,keyLight,rimLight,tackleMetrics=null;
  function buildTackle(){
    root=new T.Group();scene.add(root);
    const chrome=material('#c5c4b5',.24,.85);
    // A single textured flexible plane per mode replaces 28 blank segments,
    // disconnected grip / reel sprites, separate 3D hand and ferrule.
    const loader=new T.TextureLoader();
    for(const mode of FZ.RodArt.modes){
      const geometry=new T.PlaneGeometry(1,1,32,2);
      const ys=Array.from(geometry.attributes.position.array).filter((_,i)=>i%3===1);
      const mat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,alphaTest:.035,
        side:T.DoubleSide,depthTest:false,depthWrite:false});
      const sprite=new T.Mesh(geometry,mat);sprite.renderOrder=20;sprite.visible=false;
      sprite.userData={ys,ready:false};scene.add(sprite);rodSprites[mode]=sprite;
      loader.load("assets/equipment/complete/"+mode+".svg",tx=>{
        tx.colorSpace=T.SRGBColorSpace;tx.generateMipmaps=false;tx.minFilter=T.LinearFilter;
        mat.map=tx;mat.needsUpdate=true;sprite.userData.ready=true;
      },undefined,()=>{sprite.userData.ready=false;});
    }
    reelCanvas=document.createElement("canvas");reelCanvas.width=210;reelCanvas.height=170;
    reelTexture=new T.CanvasTexture(reelCanvas);reelTexture.colorSpace=T.SRGBColorSpace;
    reelTexture.generateMipmaps=false;reelTexture.minFilter=T.LinearFilter;
    reelCrank=new T.Group();scene.add(reelCrank);reelCrank.visible=false;
    reelPlane=new T.Mesh(new T.PlaneGeometry(210,170),new T.MeshBasicMaterial({
      map:reelTexture,transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide}));
    reelPlane.renderOrder=22;reelCrank.add(reelPlane);
    float=new T.Group();scene.add(float);
    const white=material('#eee9d6',.25),red=material('#ee4f25',.24),black=material('#252c23',.4),lime=material('#e3d95c',.32);
    sphere(float,0,0,0,.63,1.15,.63,white);sphere(float,0,.62,0,.60,.62,.60,red);
    cylinder(float,.07,.10,4.7,black,0,2.5,0);cylinder(float,.10,.10,1.35,red,0,4.1,0);cylinder(float,.11,.11,.25,lime,0,3.25,0);cylinder(float,.055,.055,2.8,black,0,-2,0);
    const lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(new Float32Array(65*3),3));line=new T.Line(lg,new T.LineBasicMaterial({color:'#d8e0bd',transparent:true,opacity:.65}));scene.add(line);
    aimMesh=new T.Mesh(new T.RingGeometry(14,15,48),new T.MeshBasicMaterial({color:'#e4c286',side:T.DoubleSide,transparent:true,opacity:.8}));aimMesh.scale.y=.35;scene.add(aimMesh);aimMesh.visible=false;
    net=new T.Group();scene.add(net);
    const rimPoints=[];
    for(let i=0;i<=64;i++){const q=i/64*Math.PI*2;rimPoints.push(new T.Vector3(53*Math.cos(q),35*Math.sin(q),0));}
    const rim=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints),80,2.1,8,false),chrome);net.add(rim);
    const handle=cylinder(net,2.7,3.4,1,material("#263940",.48),0,0,0);
    connect(handle,new T.Vector3(51,0,0),new T.Vector3(190,-125,12));
    const grip=cylinder(net,4.2,4.2,1,material("#132024",.9),0,0,0);
    connect(grip,new T.Vector3(155,-94,9),new T.Vector3(193,-128,12));
    sphere(net,52,0,0,7,5,4,chrome);
    netBag=new T.Group();net.add(netBag);
    const meshPoints=[];
    const bowl=(q,d)=>new T.Vector3(53*Math.cos(q)*(1-d*.78),35*Math.sin(q)*(1-d*.78)-d*4,-42*Math.sin(d*Math.PI*.5));
    for(let j=0;j<24;j++)for(let i=0;i<10;i++){
      const q=j/24*Math.PI*2,d=i/10;
      meshPoints.push(bowl(q,d),bowl(q+.09,d+.1));
    }
    for(let i=1;i<=10;i++)for(let j=0;j<48;j++)
      meshPoints.push(bowl(j/48*Math.PI*2,i/10),bowl((j+1)/48*Math.PI*2,i/10));
    netBag.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(meshPoints),
      new T.LineBasicMaterial({color:"#718c80",transparent:true,opacity:.78})));
    const drops=new Float32Array(28*3);
    netDrops=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:"#deeff5",size:2,transparent:true,opacity:.8}));
    netDrops.geometry.setAttribute("position",new T.BufferAttribute(drops,3));scene.add(netDrops);netDrops.visible=false;
    net.visible=false;
    const wp=new Float32Array(150*3),wr=U.rng('weather');for(let i=0;i<150;i++){wp[i*3]=(wr()-.5)*W;wp[i*3+1]=(wr()-.5)*H;wp[i*3+2]=30;}
    const wg=new T.BufferGeometry();wg.setAttribute('position',new T.BufferAttribute(wp,3));weather=new T.Points(wg,new T.PointsMaterial({color:'#dce9e7',size:1.7,transparent:true,opacity:.4}));scene.add(weather);weather.visible=false;
    const streaks=new T.BufferGeometry();streaks.setAttribute('position',new T.BufferAttribute(new Float32Array(150*6),3));
    weatherStreaks=new T.LineSegments(streaks,new T.LineBasicMaterial({color:'#a6bdc8',transparent:true,opacity:.27}));scene.add(weatherStreaks);weatherStreaks.visible=false;
  }
  R.init=function(cv){
    canvas=cv;legacy=document.createElement('canvas');previous.init.call(R,legacy);
    try{
      renderer=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:false,powerPreference:'high-performance'});
      renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
      scene=new T.Scene();camera=new T.OrthographicCamera(-W/2,W/2,H/2,-H/2,.1,4000);camera.position.z=1000;
      const pm=new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,depthWrite:false});plane=new T.Mesh(new T.PlaneGeometry(1,1),pm);plane.position.z=-100;scene.add(plane);
      hemisphere=new T.HemisphereLight(0xdae8ee,0x343d29,2);scene.add(hemisphere);
      keyLight=new T.DirectionalLight(0xffe8c8,2.9);keyLight.position.set(-200,300,500);scene.add(keyLight);
      rimLight=new T.DirectionalLight(0x9ac4d5,1.4);rimLight.position.set(180,-50,-50);scene.add(rimLight);
      buildTackle();enabled=true;R.renderer='webgl';R.resize();
      cv.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;FZ.Sound.suspend();if(FZ.UI)FZ.UI.toast('Графика приостановлена. Восстанавливаем сцену…','',5000);});
      cv.addEventListener('webglcontextrestored',()=>{contextLost=false;key='';asset=null;FZ.Sound.resume();});
    }catch(e){R.renderer='canvas';R.rendererError=e.message;R.initFallback(cv);}
  };
  R.initFallback=function(cv){
    // A browser cannot switch an acquired WebGL canvas to 2D.
    const fallback=document.createElement('canvas');fallback.id='cv';cv.replaceWith(fallback);canvas=fallback;enabled=false;previous.init.call(R,fallback);
    // Preserve input listeners on the original element through event forwarding.
    ['pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>fallback.addEventListener(type,e=>{
      // Capture on the visible replacement canvas, not the detached original.
      if(type==='pointerdown')try{fallback.setPointerCapture(e.pointerId);}catch(_){ }
      cv.dispatchEvent(new PointerEvent(type,e));
    }));
    document.body.dataset.renderer='canvas';
  };
  R.resize=function(){previous.resize.call(R);if(!enabled)return;W=innerWidth;H=innerHeight;const ratio=Math.min(devicePixelRatio||1,{hi:2,mid:1.5,lo:1}[quality]||1.25);renderer.setPixelRatio(ratio);renderer.setSize(W,H);camera.left=-W/2;camera.right=W/2;camera.top=H/2;camera.bottom=-H/2;camera.updateProjectionMatrix();plane.scale.set(W,H,1);uniforms.resolution.value.set(W,H);uniforms.shore.value=R.size().shoreY/H;const h=R.holeGeom();uniforms.hole.value.set(h.x/W,h.y/H);uniforms.holeRadius.value.set(h.rx/W,h.ry/H);};
  R.setQuality=function(q){quality=q;previous.setQuality.call(R,q);R.resize();};
  const colors={pond:['#203c2b','#7b9581'],river:['#233f3d','#809795'],platnik:['#193b30','#7c9280'],reservoir:['#1d3c4a','#70939e'],lake:['#183847','#6d9299'],delta:['#324332','#8e9d7f'],baikal:['#153e4d','#7fb5be'],taiga:['#233f36','#7b9286'],coast:['#173b50','#6e9cae']};
  function loadBackdrop(v){
    const k='bg/'+v.loc.id+'_'+v.season;
    const im=FZ.Assets.bg(v.loc.id,v.season);
    if(k!==requested){requested=k;asset=null;uniforms.hasPhoto.value=0;}
    if(im && asset!==im){
      asset=im;oldTexture=texture;texture=new T.Texture(im);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;scene.environment=null;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
      uniforms.photo.value=texture;uniforms.photoSize.value.set(im.width,im.height);uniforms.waterline.value=FZ.Assets.waterline(v.loc.id,v.season);uniforms.hasPhoto.value=1;if(oldTexture)oldTexture.dispose();
    }
  }
  function tackle(v,dt){
    const t=v.t,f=v.fish,bend=U.clamp(v.rod.bend||0,0,1.5),tilt=v.rod.tilt||0,isIce=!!v.ice;
    const menu=document.getElementById("ovMenu").classList.contains("on");
    const showingLine=!menu&&v.tackle.state!=="none";
    root.visible=false;line.visible=showingLine;
    float.visible=showingLine&&!f&&!isIce&&v.mode==="float";
    const idleSway=Math.sin(t*.71)*2.2,mode=isIce?"ice":v.mode;
    const anchors={
      float:[.70,.79,.34,.29],feeder:[.73,.80,.30,.37],
      spin:[.74,.82,.40,.36],ice:[.74,.79,.58,.61]
    };
    const a=anchors[mode]||anchors.float;
    const base=V(W*a[0],H*a[1]+idleSway,40);
    const tip=V(W*(a[2]+tilt*(isIce?.055:.12)),H*a[3]+idleSway-(v.rod.lift||0)*H*.05,30);
    if(v.tackle.state==="fly")tip.y+=Math.sin(v.tackle.flyT*Math.PI*2)*H*.14;
    const c=FZ.RodArt.info(mode),len=base.distanceTo(tip);
    const angle=Math.atan2(base.y-tip.y,base.x-tip.x),zAxis=new T.Vector3(0,0,1);
    const factor=len/(c.baseX-c.tipX),width=1440*factor,height=300*factor;
    const flexPx=Math.min(isIce?9:34,len*(isIce?.045:.085))*bend;
    let active=null,top=tip.clone();
    for(const k of Object.keys(rodSprites)){
      const m=rodSprites[k];m.visible=false;
      if(k!==mode||!m.userData.ready)continue;
      active=m;m.visible=!menu;
      const baseOffset=new T.Vector3((c.baseX-720)*factor,(150-c.axisY)*factor,0).applyAxisAngle(zAxis,angle);
      m.position.copy(base).sub(baseOffset);m.position.z=80;
      m.rotation.z=angle;m.scale.set(width,height,1);
      const attr=m.geometry.attributes.position;
      for(let i=0;i<attr.count;i++){
        const x=attr.getX(i);
        const along=U.clamp((c.baseX-(x+.5)*1440)/(c.baseX-c.tipX),0,1);
        attr.setY(i,m.userData.ys[i]-flexPx*along*along/height);
      }
      attr.needsUpdate=true;
    }
    top.add(new T.Vector3(0,-flexPx,0).applyAxisAngle(zAxis,angle));
    reelCrank.visible=!!active&&!menu;
    if(reelCrank.visible){
      const reelOffset=new T.Vector3((c.reelX-c.baseX)*factor,(c.axisY-c.reelY)*factor,0).applyAxisAngle(zAxis,angle);
      reelCrank.position.copy(base).add(reelOffset);reelCrank.position.z=108;
      reelCrank.scale.setScalar(factor);reelCrank.rotation.z=angle;
      const reelAlong=U.clamp((c.baseX-c.reelX)/(c.baseX-c.tipX),0,1);
      reelCrank.position.add(new T.Vector3(0,-flexPx*reelAlong*reelAlong,0).applyAxisAngle(zAxis,angle));
      const rc=reelCanvas.getContext("2d");rc.clearRect(0,0,210,170);rc.save();rc.translate(105,85);
      FZ.RodArt.mechanism(rc,mode,v.rod.reelAngle||0,v.rod.slipAngle||0);rc.restore();reelTexture.needsUpdate=true;
    }
    const lineX=f&&f.hooked?f.X:(v.tackle.X||0),lineZ=f&&f.hooked?f.Z:(v.tackle.Z||20);
    let p=R.proj(lineX,Math.max(3.6,lineZ));
    if(isIce){const h=R.holeGeom();p={x:h.x,y:h.y+h.ry*.2,s:20};}
    const pos=V(p.x+(v.tackle.dx||0),p.y+(v.tackle.sink||0)*9,8);
    if(v.tackle.state==='fly')pos.y+=Math.sin(U.clamp(v.tackle.flyT,0,1)*Math.PI)*H*.22;
    float.position.copy(pos);float.rotation.z=-(v.tackle.tilt||0)*.65+Math.sin(t*1.8)*.045;
    const floatScale=U.clamp(p.s*.15,2.4,8);float.scale.setScalar(floatScale);if(v.mode!=='float'&&!isIce)float.scale.setScalar(floatScale*.25);
    const linePos=line.geometry.attributes.position;
    const target=pos.clone().add(new T.Vector3(0,isIce?0:floatScale*4,0));
    const sag=isIce?H*.004:(f?H*(.004+.038*(1-U.clamp(f.tension||0,0,1))):H*.075);
    for(let i=0;i<65;i++){const u=i/64,point=top.clone().lerp(target,u);point.y-=Math.sin(u*Math.PI)*sag;linePos.setXYZ(i,point.x,point.y,point.z);}
    linePos.needsUpdate=true;
    tackleMetrics={winter:isIce,rodLength:len,blankLength:len*(isIce?.65:.78),
      assetMode:mode,assetReady:!!(active&&active.userData.ready),
      tipScreenY:H/2-top.y,holeScreenY:R.holeGeom().y,
      reelVisible:reelCrank.visible&&!isIce,iceDrumVisible:reelCrank.visible&&isIce,
      reelRate:v.rod.reelRate||0};
    const landing=v.landing&&f&&!isIce?FZ.RodArt.landingPose(v,W,H,R.proj):null;
    net.visible=!!landing&&f.w>=.35&&!menu;netDrops.visible=net.visible&&landing.lift>0;
    landingMetrics=landing?{...landing,visible:net.visible}:null;
    if(net.visible){
      net.position.copy(V(landing.x,landing.y,80));net.rotation.set(-.9,0,-.12);
      net.scale.setScalar(landing.radius/53);netBag.scale.z=landing.sag;
      const dp=netDrops.geometry.attributes.position;
      for(let i=0;i<dp.count;i++){
        const fall=(v.t*1.6+i*.137)%1,spread=Math.sin(i*2.4)*landing.radius*.7;
        const p=V(landing.x+spread,landing.y+landing.radius*.35+fall*fall*70,95);
        dp.setXYZ(i,p.x,p.y,p.z);
      }dp.needsUpdate=true;
      if(v.landing.k>.3&&v.landing.k<.58&&t-lastFloatRing>.14){lastFloatRing=t;addRipple(landing.fishX/W,landing.fishY/H,t,.65);}
    }
    if(f&&!isIce&&(f.surface>.15||f.jump||v.landing)){
      if(fishId!==f.s.id){if(fishModel){scene.remove(fishModel);FZ.Fish3D.dispose(fishModel);}fishModel=FZ.Fish3D.create(f.s);if(fishModel){scene.add(fishModel);fishId=f.s.id;}}
      if(!fishModel)return;fishModel.visible=true;const fp=R.proj(f.X,Math.max(3.6,f.Z));const jump=f.jump?Math.sin(Math.PI*U.clamp(f.jump.k,0,1))*Math.min(120,fp.s*2):0;
      fishModel.position.copy(V(fp.x,fp.y-jump,20));fishModel.scale.setScalar(Math.min(85,Math.max(7,fp.s*(f.lenM||.4)/3.5)));fishModel.rotation.set(.4,f.vx>0?Math.PI:0,f.jump?Math.sin(f.jump.k*6)*.35:0);FZ.Fish3D.animate(fishModel,t*7,.08);
      if(landing){
        fishModel.position.copy(V(landing.fishX,landing.fishY,86));
        fishModel.scale.setScalar(landing.length/4);
        fishModel.rotation.set(.4,0,Math.sin(t*5)*.035*(1-landing.lift));
      }
    }else if(fishModel)fishModel.visible=false;
    // Float disturbance is physically anchored to the projected contact point.
    if(!menu&&v.tackle.state==='water'&&t-lastFloatRing>.65){lastFloatRing=t;addRipple(p.x/W,p.y/H,t,(v.tackle.sink||0)>.3?.8:.3);}
  }
  let lastFloatRing=-100;
  function addRipple(x,y,time,power){rippleData[ringCursor++%12].set(x,y,time,U.clamp(power,.15,2));}
  const oldRing=R.ring;
  R.ring=function(X,Z,r,life){if(!enabled)return oldRing.apply(R,arguments);const p=R.proj(X,Math.max(3.6,Z));addRipple(p.x/W,p.y/H,uniforms.clock.value,Math.max(.4,r||1));};
  const oldSplash=R.splash;
  R.splash=function(X,Z,k){if(!enabled)return oldSplash.apply(R,arguments);const p=R.proj(X,Math.max(3.6,Z));for(let i=0;i<3;i++)addRipple(p.x/W+(i-1)*.007,p.y/H,uniforms.clock.value+i*.09,(k||1)*(1-i*.2));R.shakeA=Math.max(R.shakeA,(k||1)*2);};
  R.render=function(v,dt){
    if(!enabled)return previous.render.call(R,v,dt);if(contextLost)return;
    R.fx.length=0;R.parts.length=0;R.jumps.length=0;R.rings.length=0;
    if(R.size().shoreY/H!==uniforms.shore.value)R.resize();if(v.loc.zfar!==R._glFar){R.setFar(v.loc.zfar);R._glFar=v.loc.zfar;}
    const L=R.light(v.hour,v.season);R.lastLight=L;loadBackdrop(v);
    const c=colors[v.loc.style]||colors.lake;uniforms.colorNear.value.set(c[0]);uniforms.colorFar.value.set(c[1]);
    uniforms.clock.value=v.t;uniforms.wind.value=v.wx.wind||0;uniforms.dark.value=L.dark;uniforms.warm.value=L.warm;uniforms.sun.value.set(L.sunX/W,L.sunY/H);
    uniforms.cloudCover.value=U.damp(uniforms.cloudCover.value,({clear:0,cloudy:.3,overcast:.8,rain:.85,storm:1,snow:.8}[v.wx.sky]||0),1.2,dt);uniforms.rain.value=v.ice?0:(v.wx.sky==='storm'?1:v.wx.sky==='rain'?.65:0);uniforms.ice.value=v.ice?1:0;uniforms.winter.value=v.season==='winter'?1:0;uniforms.holeOn.value=v.ice&&!v.ice.noHole&&v.ice.drill==null?1:0;uniforms.drillProgress.value=v.ice&&v.ice.drill!=null?U.clamp(v.ice.drill,0,1):0;
    const lightLevel=Math.max(.18,1-U.clamp(L.dark/.6,0,1)*.96);hemisphere.intensity=1.3*lightLevel;keyLight.intensity=1.9*lightLevel;rimLight.intensity=.8*lightLevel;
    const precipitation=v.ice&&(v.wx.sky==='rain'||v.wx.sky==='storm')?'snow':v.wx.sky;
    weather.visible=['rain','storm','snow'].includes(precipitation);weatherStreaks.visible=weather.visible&&precipitation!=='snow';weather.material.size=precipitation==='snow'?3:1.4;
    if(weather.visible){const p=weather.geometry.attributes.position;const speed=precipitation==='snow'?30:370;for(let i=0;i<p.count;i++){let y=p.getY(i)-dt*speed;if(y<-H/2)y=H/2;p.setY(i,y);}p.needsUpdate=true;
      if(weatherStreaks.visible){const q=weatherStreaks.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);q.setXYZ(i*2,x,y,30);q.setXYZ(i*2+1,x-v.wx.wind*.8,y+14,30);}q.needsUpdate=true;}weather.material.opacity=precipitation==='snow'?.45:0;
    }
    tackle(v,dt);aimMesh.visible=false;
    if(R.shakeA>.05){camera.position.x=Math.sin(v.t*57)*R.shakeA;camera.position.y=Math.cos(v.t*49)*R.shakeA*.5;R.shakeA*=Math.pow(.015,dt);}else{camera.position.x=0;camera.position.y=0;}
    renderer.render(scene,camera);R.metrics={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,pixelRatio:renderer.getPixelRatio()};
  };
  R.drawAim=function(v,a){if(!enabled)return previous.drawAim.call(R,v,a);const p=R.proj(a.X,a.Z);aimMesh.visible=true;aimMesh.position.copy(V(p.x,p.y,20));renderer.render(scene,camera);};
  const oldClear=R.clearFx;
  R.clearFx=function(){oldClear();rippleData.forEach(r=>r.set(-10,-10,-100,0));lastFloatRing=-100;};
  const oldSnapshot=R.snapshot;
  R.snapshot=function(){if(!enabled)return oldSnapshot();renderer.render(scene,camera);const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d').drawImage(canvas,0,0);return c;};
  R.graphicsInfo=()=>({renderer:enabled?'webgl':'canvas',contextLost,metrics:R.metrics,error:R.rendererError||null,
    hole:enabled?{x:uniforms.hole.value.x,y:uniforms.hole.value.y,rx:uniforms.holeRadius.value.x,ry:uniforms.holeRadius.value.y,open:uniforms.holeOn.value,drilling:uniforms.drillProgress.value}:null,
    reelCrankAngle:enabled&&reelCrank?(FZ.Game.rig().rod.reelAngle||0):null,landing:landingMetrics,tackle:tackleMetrics});
})(window.FZ);
