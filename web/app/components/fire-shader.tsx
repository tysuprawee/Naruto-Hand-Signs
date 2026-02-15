"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════ */
/* Fragment shader – simplex-noise fire with sparks                       */
/* ═══════════════════════════════════════════════════════════════════════ */
const FRAG_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 resolution;
uniform float time;
uniform vec4 mouse;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}

float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float PI=3.14159265358979;

float prng(in vec2 seed){
  seed=fract(seed*vec2(5.3983,5.4427));
  seed+=dot(seed.yx,seed.xy+vec2(21.5351,14.3137));
  return fract(seed.x*seed.y);
}

float noiseStack(vec3 pos,int octaves,float falloff){
  float noise=snoise(pos);
  float off=1.0;
  if(octaves>1){pos*=2.0;off*=falloff;noise=(1.0-off)*noise+off*snoise(pos);}
  if(octaves>2){pos*=2.0;off*=falloff;noise=(1.0-off)*noise+off*snoise(pos);}
  if(octaves>3){pos*=2.0;off*=falloff;noise=(1.0-off)*noise+off*snoise(pos);}
  return(1.0+noise)/2.0;
}

vec2 noiseStackUV(vec3 pos,int octaves,float falloff,float diff){
  float dA=noiseStack(pos,octaves,falloff);
  float dB=noiseStack(pos+vec3(3984.293,423.21,5235.19),octaves,falloff);
  return vec2(dA,dB);
}

void main(){
  float t=time;
  vec2 res=resolution.xy;
  vec2 drag=mouse.xy+sin(t);
  vec2 offset=mouse.xy+cos(t);

  vec2 fragCoord=gl_FragCoord.xy;
  float xpart=fragCoord.x/res.x;
  float ypart=fragCoord.y/res.y;

  float clip=210.0;
  float ypartClip=fragCoord.y/clip;
  float ypartClippedFalloff=clamp(2.0-ypartClip,0.0,1.0);
  float ypartClipped=min(ypartClip,1.0);
  float ypartClippedn=1.0-ypartClipped;

  float xfuel=1.0-abs(2.0*xpart-1.0);

  float realTime=0.5*t;

  vec2 coordScaled=0.01*fragCoord-0.02*vec2(offset.x,0.0);
  vec3 position=vec3(coordScaled,0.0)+vec3(1223.0,6434.0,8425.0);
  vec3 flow=vec3(4.1*(0.5-xpart)*pow(ypartClippedn,4.0),-2.0*xfuel*pow(ypartClippedn,64.0),0.0);
  vec3 timing=realTime*vec3(0.0,-1.7,1.1)+flow;

  vec3 displacePos=vec3(1.0,0.5,1.0)*2.4*position+realTime*vec3(0.01,-0.7,1.3);
  vec3 displace3=vec3(noiseStackUV(displacePos,2,0.4,0.1),0.0);

  vec3 noiseCoord=(vec3(2.0,1.0,1.0)*position+timing+0.4*displace3)/1.0;
  float noise=noiseStack(noiseCoord,3,0.4);

  float flames=pow(ypartClipped,0.3*xfuel)*pow(noise,0.3*xfuel);

  float f=ypartClippedFalloff*pow(1.0-flames*flames*flames,8.0);
  float fff=f*f*f;
  vec3 fireCore=vec3(f*0.01, fff*0.004, fff*fff*0.02);
  vec3 fireRim=vec3(0.10,0.03,0.16)*pow(f,6.0);
  vec3 fire=fireCore+fireRim;

  float smokeNoise=0.5+snoise(0.4*position+timing*vec3(1.0,1.0,0.2))/2.0;
  vec3 smoke=vec3(0.02*pow(xfuel,3.0)*pow(ypart,2.0)*(smokeNoise+0.4*(1.0-noise)));

  float sparkGridSize=30.0;
  vec2 sparkCoord=fragCoord-vec2(2.0*offset.x,190.0*realTime);
  sparkCoord-=30.0*noiseStackUV(0.01*vec3(sparkCoord,30.0*t),1,0.4,0.1);
  sparkCoord+=100.0*flow.xy;
  if(mod(sparkCoord.y/sparkGridSize,2.0)<1.0) sparkCoord.x+=0.5*sparkGridSize;
  vec2 sparkGridIndex=vec2(floor(sparkCoord/sparkGridSize));
  float sparkRandom=prng(sparkGridIndex);
  float sparkLife=min(10.0*(1.0-min((sparkGridIndex.y+(190.0*realTime/sparkGridSize))/(24.0-20.0*sparkRandom),1.0)),1.0);
  vec3 sparks=vec3(0.0);
  if(sparkLife>0.0){
    float sparkSize=xfuel*xfuel*sparkRandom*0.08;
    float sparkRadians=999.0*sparkRandom*2.0*PI+2.0*t;
    vec2 sparkCircular=vec2(sin(sparkRadians),cos(sparkRadians));
    vec2 sparkOffset=(0.5-sparkSize)*sparkGridSize*sparkCircular;
    vec2 sparkModulus=mod(sparkCoord+sparkOffset,sparkGridSize)-0.5*vec2(sparkGridSize);
    float sparkLength=length(sparkModulus);
    float sparksGray=max(0.0,1.0-sparkLength/(sparkSize*sparkGridSize));
    sparks=sparkLife*sparksGray*vec3(0.06,0.02,0.10);
  }

  vec3 color=max(fire,sparks)+smoke*0.28;
  float flameAlpha=clamp(f*5.2+fff*1.4,0.0,1.0);
  float plumeMask=smoothstep(0.07,0.45,f);
  float smokeAlpha=clamp(smoke.r*6.0*plumeMask,0.0,0.12);
  float sparkAlpha=clamp(length(sparks)*12.0,0.0,0.35);
  float rawAlpha=clamp(flameAlpha+smokeAlpha+sparkAlpha,0.0,1.0);
  float alpha=smoothstep(0.12,0.38,rawAlpha);

  gl_FragColor=vec4(color,alpha);
}
`;

const VERT_SOURCE = `
attribute vec2 position;
void main(){
  gl_Position=vec4(position,0.0,1.0);
}
`;

/* ═══════════════════════════════════════════════════════════════════════ */
/* AudioWorklet processor source (fire sound)                            */
/* ═══════════════════════════════════════════════════════════════════════ */
const AUDIO_WORKLET_SRC = `
const TWO_PI=6.28318530717958647693;
const map=(v,a,b,c,d)=>(v-a)*(d-c)/(b-a)+c;
let currentNoise=0;
const generateNewNoise=()=>currentNoise=Math.random()*2-1;

class Biquad{
  constructor(type="lowpass"){
    this.type=type;this.a0=1;this.a1=0;this.a2=0;this.b1=0;this.b2=0;
    this.Fc=0.5;this.Q=0.707;this.peakGain=0;this.z1=0;this.z2=0;this.calcBiquad();
  }
  setFreq(f){this.Fc=f;this.calcBiquad();}
  setBiquad(type,freq,Q,pg){this.type=type;this.Fc=freq;this.Q=Q;this.peakGain=pg;this.calcBiquad();}
  calcBiquad(){
    let norm;const V=Math.pow(10,Math.abs(this.peakGain)/20);const K=Math.tan(Math.PI*this.Fc);
    switch(this.type){
      case"lowpass":norm=1/(1+K/this.Q+K*K);this.a0=K*K*norm;this.a1=2*this.a0;this.a2=this.a0;this.b1=2*(K*K-1)*norm;this.b2=(1-K/this.Q+K*K)*norm;break;
      case"highpass":norm=1/(1+K/this.Q+K*K);this.a0=1*norm;this.a1=-2*this.a0;this.a2=this.a0;this.b1=2*(K*K-1)*norm;this.b2=(1-K/this.Q+K*K)*norm;break;
      case"bandpass":norm=1/(1+K/this.Q+K*K);this.a0=K/this.Q*norm;this.a1=0;this.a2=-this.a0;this.b1=2*(K*K-1)*norm;this.b2=(1-K/this.Q+K*K)*norm;break;
      case"highshelf":if(this.peakGain>=0){norm=1/(1+Math.sqrt(2)*K+K*K);this.a0=(V+Math.sqrt(2*V)*K+K*K)*norm;this.a1=2*(K*K-V)*norm;this.a2=(V-Math.sqrt(2*V)*K+K*K)*norm;this.b1=2*(K*K-1)*norm;this.b2=(1-Math.sqrt(2)*K+K*K)*norm;}else{norm=1/(V+Math.sqrt(2*V)*K+K*K);this.a0=(1+Math.sqrt(2)*K+K*K)*norm;this.a1=2*(K*K-1)*norm;this.a2=(1-Math.sqrt(2)*K+K*K)*norm;this.b1=2*(K*K-V)*norm;this.b2=(V-Math.sqrt(2*V)*K+K*K)*norm;}break;
    }
  }
  process(v){const o=v*this.a0+this.z1;this.z1=v*this.a1+this.z2-this.b1*o;this.z2=v*this.a2-this.b2*o;return o;}
}

class Glide{constructor(){this.a=0;this.b=0;this.z=0;}init(s,t,sr){this.z=s;this.a=Math.exp(-TWO_PI/(t*0.001*sr));this.b=1-this.a;}process(t){this.z=(t*this.b)+(this.z*this.a);return this.z;}}

class Roaring{
  constructor(){this.gain=1;this.noiseSeed=1;this.bandPass=new Biquad();this.lop=new Biquad();this.lop2=new Biquad();this.hip=new Biquad();this.bandPass.setBiquad("bandpass",30/sampleRate,1.5,2);this.lop.setBiquad("lowpass",800/sampleRate,0.707,2);this.lop2.setBiquad("lowpass",2875/sampleRate,0.707,2);this.hip.setBiquad("highpass",30/sampleRate,0.707,2);}
  generate(sz){const boom=map(sz,0,1,100,30);this.hip.setFreq(boom/sampleRate);this.bandPass.setFreq(boom/sampleRate);this.lop.setFreq(map(Math.pow(sz,2.5),0,1,10,800)/sampleRate);const ns=map(sz,0,1,0.02,1);const n1=(Math.random()>=0.5)*2-1;let n2=currentNoise*ns;n2=this.lop.process(n2);let c=(n1*0.5)*(n2*0.5);c=this.bandPass.process(c)*40;c=this.lop2.process(c);return this.hip.process(c)*this.gain;}
}

class Hissing{
  constructor(){this.gain=1;this.lop=new Biquad();this.shelf=new Biquad();this.lop.setBiquad("lowpass",100/sampleRate,2,2);this.shelf.setBiquad("highshelf",2000/sampleRate,0,15);}
  generate(sz){this.lop.setFreq(map(sz,0,1,10,100)/sampleRate);const ns=map(sz,0,1,0.02,1);const n1=currentNoise;let n2=(Math.random()>=0.5)*2-1;n2=this.lop.process(n2*ns);return(this.shelf.process(n1*n2)*0.04)*this.gain;}
}

class Crackling{
  constructor(){this.gain=1;this.env=new Glide();this.bandPass=new Biquad();this.lop=new Biquad();this.bandPass.setBiquad("bandpass",1650/sampleRate,1.5,2);this.lop.setBiquad("lowpass",8200/sampleRate,0.707,0);}
  generate(sz){const ca=map(Math.pow(sz,1.5),0,1,1,0.99975);let n=currentNoise;if(n>ca){this.bandPass.setFreq(map(Math.random(),0,1,1500,16500)/sampleRate);this.env.init(1,(Math.random()*30)+60,sampleRate);}n=this.bandPass.process(n);n*=this.env.process(0);n=this.lop.process(n);return n*0.1*this.gain;}
}

class FireNoiseGenerator extends AudioWorkletProcessor{
  constructor(){super();this.roaring=new Roaring();this.hissing=new Hissing();this.crackling=new Crackling();}
  static get parameterDescriptors(){return[{name:'size',defaultValue:1}];}
  process(inputs,outputs,parameters){
    const sz=parameters.size;
    for(let f=0;f<outputs[0][0].length;++f){
      generateNewNoise();
      const data=this.roaring.generate(sz[0])+this.crackling.generate(sz[0]);
      for(let ch=0;ch<outputs[0].length;++ch) outputs[0][ch][f]=data;
    }
    return true;
  }
}
registerProcessor('fire-noise-generator',FireNoiseGenerator);
`;

/* ═══════════════════════════════════════════════════════════════════════ */
/* Props                                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */
interface FireShaderProps {
  /** CSS class applied to the wrapper div */
  className?: string;
  /** Height in CSS – defaults to 220px */
  height?: string;
  /** Whether to enable fire audio on click */
  enableAudio?: boolean;
  /** Master opacity 0-1 */
  opacity?: number;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Component                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */
export default function FireShader({
  className = "",
  height = "220px",
  enableAudio = true,
  opacity = 1,
}: FireShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const audioStartedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /* ── WebGL setup ──────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;
    glRef.current = gl;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Shader error:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SOURCE);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SOURCE);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    programRef.current = prog;
    gl.useProgram(prog);

    /* Fullscreen quad */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "resolution");
    const uTime = gl.getUniformLocation(prog, "time");
    const uMouse = gl.getUniformLocation(prog, "mouse");

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    startRef.current = performance.now();

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      const t = (now - startRef.current) * 0.001;
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t);
      if (uMouse) gl.uniform4f(uMouse, canvas.width * 0.5, canvas.height * 0.5, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => { });
      }
    };
  }, []);

  /* ── Fire audio on click ──────────────────────────────────────────── */
  const startAudio = useCallback(async () => {
    if (!enableAudio || audioStartedRef.current) return;
    audioStartedRef.current = true;

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const blob = new Blob([AUDIO_WORKLET_SRC], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const node = new AudioWorkletNode(ctx, "fire-noise-generator");

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 20;
      compressor.attack.value = 0.1;
      compressor.release.value = 0.25;

      /* Simple convolver for reverb tail */
      const convolver = ctx.createConvolver();
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.05);
      const impulse = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
        }
      }
      convolver.buffer = impulse;

      const gain = ctx.createGain();
      gain.gain.value = 0.25;

      node.connect(gain).connect(compressor).connect(ctx.destination);
      node.connect(convolver).connect(compressor);
      ctx.resume();
    } catch (e) {
      console.warn("Fire audio failed:", e);
    }
  }, [enableAudio]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height, overflow: "hidden", opacity }}
      onClick={startAudio}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
