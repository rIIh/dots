import React, {useEffect, useRef, useState} from 'react';
import '../styles/App.css';
import {Shaders, Node, GLSL} from "gl-react";
import {Surface} from "gl-react-dom";
import {useTimer} from "use-timer"; // for React DOM
import useComponentSize from '@rehooks/component-size'
import {useDrag, useGesture} from "react-use-gesture";
import useAnime from "../lib/useAnime";
if(typeof console === "undefined"){
  // @ts-ignore
  console = {};
}
const shaders = Shaders.create({
  dots: {
    frag: GLSL`
#ifdef GL_ES
precision mediump float;
#endif

uniform float time;
uniform float u_intensity;
uniform vec2 mouse;
uniform vec2 resolution;
uniform vec3 ripples[32];

#define iter 12.
#define scaleSpeed 2.0
#define satSpeed 6.2
#define mouseScale 0.65
#define maxDotSize 0.3
#define zoom 1.0
#define zoomInTime 2.0
#define distortion 0.4

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

float expoInOut(float t) {
  return t == 0.0 || t == 1.0
    ? t
    : t < 0.5
      ? +0.5 * pow(2.0, (20.0 * t) - 10.0)
      : -0.5 * pow(2.0, 10.0 - (t * 20.0)) + 1.0;
}

vec3 white = vec3(1.0, 1.0, 1.0);
vec3 black = vec3(0.0, 0.0, 0.0);

void main( ) {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;
  float scaling = 1.;// resolution.x / 500.;
  uv*=iter * scaling;
        
  float frequency = 1.0;
  float aZoom = expoInOut(min(time,zoomInTime)/zoomInTime);
  vec2 st2 = mat2(0.707, -0.707, 0.707, 0.707) * uv/(aZoom*0.9+0.1)*zoom;
  vec2 nearest = 2.0*fract(frequency * st2) - 1.0;

  //#ifdef mouse
  //vec2 mt2 = vec2((mouse.x*2.)-1., mouse.y-0.5);
  vec2 mt2 = (mouse - 0.5 * resolution.xy) / resolution.y;
  vec2 mPos = mt2-(uv/iter/scaling);
  float mDist = max(1.-length(mPos)/mouseScale, 0.);
  //#endif
  
  float dist = length(nearest);
  float nValue = noise(vec3(vec2(st2-fract(frequency * st2)+vec2(10., 10.))/1.+time/2., time*2.));
  float radius = (nValue*0.1+0.01)*2.*aZoom;
  //#ifdef mouse
  radius += mDist*maxDotSize*aZoom;
  //#endif
  radius = min(radius, maxDotSize);

  vec3 st3 = vec3(st2, time*4.);
  float intensity = max(radius/maxDotSize, 0.75);
  float calcDistortion = distortion;
  //#ifdef mouse
  calcDistortion = (1. - distortion) * (mDist + distortion);
  //#endif
  vec3 dots = vec3(
       max(intensity-step(radius, length(nearest+vec2(noise((st3+10.)/10.)  * calcDistortion, noise((st3-10.)/10.) *calcDistortion))), 0.) + 0.038, 
       max(intensity-step(radius, length(nearest+vec2(noise((st3+14.)/10.)  * calcDistortion, noise((st3-14.)/10.) *calcDistortion))), 0.) + 0.038, 
       max(intensity-step(radius, length(nearest+vec2(noise((st3+18.)/10.)  * calcDistortion, noise((st3-18.)/10.) *calcDistortion))), 0.) + 0.038);
  vec3 noise = vec3(1.,1.,1.)*nValue;
  gl_FragColor = vec4(dots*(u_intensity), 1.0);
  //gl_FragColor = vec4(mDist,mDist,mDist, 1.0);
  //gl_FragColor = vec4(gl_FragCoord.xy/resolution.xy, 0., 1.);
}
`
  },
  gradient: {
    frag: GLSL`
#ifdef GL_ES
precision mediump float;
#endif

#extension GL_OES_standard_derivatives : enable

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

void main( void ) {
  vec2 position = ( gl_FragCoord.xy / resolution.xy );

  vec3 aColor = vec3(0.149, 0.172, 0.207);
  vec3 bColor = vec3(0.105, 0.121, 0.149);
  vec3 result = mix(aColor, bColor, length(vec2(position.x, 1. - position.y)));

  gl_FragColor = vec4(result, 1.0 );
}
  `
  }
});

const Background = ({wrapper, mouse}: { wrapper: React.RefObject<any>, mouse?: [number, number] }) => {
  const size = useComponentSize(wrapper);
  const scaling = 1;
  const resolution = [Math.floor(size.width * scaling), Math.floor(size.height * scaling)];
  const time = useTimer({
    initialTime: 0,
    interval: 20,
  })
  useEffect(() => time.start(), []);

  return <div style={{position: 'absolute', width: '100%', height: '100%', cursor: 'hand' }}>
    <Surface style={{position: 'absolute'}} webglContextAttributes={{powerPreference: "high-performance"}}
             pixelRatio={2}
             width={resolution[0]} height={resolution[1]}>
      <Node shader={shaders.dots}
            clear={{ color: [0.039, 0.039, 0.039, 1.] }}
            ignoreUnusedUniforms
              uniforms={{
              time: time.time / 100,
              mouse: mouse?.map(i => i * 2),
              resolution,
              u_intensity: 1,
            }}/>
    </Surface>
  </div>;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(val, max));
}

function App() {
  const time = useTimer({
    initialTime: 0,
    interval: 10,
  })
  const delay = 300;
  const [mouse, animateMouse, setMouse] = useAnime({x: window.innerWidth / 2, y: 0.5});
  const [mouseDownTime, setTime] = useState(0);
  const bind = useGesture({
    onDrag: ({ delta: [dx, dy],  down, first, last,  event, scrolling, cancel }) => {
      // @ts-ignore
      if (scrolling) { cancel?.(); }
      if (first && (event?.target as HTMLElement).tagName.toLowerCase() !== 'canvas') {
        cancel?.();
      }
      event?.preventDefault?.();
      if (down && !scrolling) {
        setMouse(last => ({x: clamp(last.x + dx /*/ size.width*/, 0, size.width), y: clamp(last.y + dy/* / size.height*/, 0, size.height)}));
      }
    },
    onMouseDown: event => {
      setTime(event.timeStamp);
    },
    onMouseUp: event => {
      if (event.timeStamp - mouseDownTime < delay && (event?.target as HTMLElement).tagName.toLowerCase() === 'canvas') {
        animateMouse(({x: clamp(event.clientX /*/ size.width*/, 0, size.width), y: clamp(event.pageY/* / size.height*/, 0, size.height)}));
      }
    }
  }, {
    eventOptions: {
      passive: false
    },
    drag: {
      delay,
    }
  })
  let view = useRef<HTMLElement>(null)
  const size = useComponentSize(view);
  useEffect(() => time.start(), []);
  const name = 'Vadim';
  return (
    <main>
      <section ref={view} className="hero is-dark is-dots is-fullheight is-relative" {...bind()}>
        <Background wrapper={view} mouse={[mouse.x, size.height - mouse.y]}/>
        <div className="hero-head animate__animated animate__slideInDown animate__faster animate__delay-1s">
          <nav className="navbar">
            <div className="container">
              <div className="navbar-brand">
                <a className="navbar-item">
                  MELV.space
                  {/*<img src="https://bulma.io/images/bulma-type-white.png" alt="Logo"/>*/}
                </a>
                <span className="navbar-burger burger" data-target="navbarMenuHeroA">
          </span>
              </div>
              <div id="navbarMenuHeroA" className="navbar-menu">
                <div className="navbar-end">
                  <a className="navbar-item is-active">
                    Home
                  </a>
                  <a className="navbar-item">
                    Examples
                  </a>
                  <a className="navbar-item">
                    Documentation
                  </a>
                  <span className="navbar-item">
            </span>
                </div>
              </div>
            </div>
          </nav>
        </div>
        <div className="hero-body is-larger ignore-events animate__animated animate__fadeInLeft animate__faster animate__delay-1s">
          <div className="container ignore-events">
            <h1 className="title is-size-1 is-size-3-mobile has-background-black is-width-fit px-4 py-1">
              Hi! I'm <span className="is-relative">
              <span className="is-transparent">{name}</span>
              <span className="is-outlined-green  is-unselectable is-transparent is-shadowless is-overlay" style={{ transform: 'translate(2px, -2px)' }}>{name}</span>
              <span className="is-outlined-blue   is-unselectable is-transparent is-shadowless is-overlay" style={{ transform: 'translate(0px)' }}>{name}</span>
              <span className="is-outlined-red    is-unselectable is-transparent is-shadowless is-overlay" style={{ transform: 'translate(-2px, 2px)' }}>{name}</span>
            </span>
            </h1>
            <h2
              className="subtitle is-size-6-tablet is-size-3-desktop  has-background-black has-text-weight-bold is-outlined-white is-width-fit px-4 py-1">
              Web Programming / SPA / SSR
            </h2>
          </div>
        </div>
      </section>
      <section className="hero is-warning is-fullheight">
        <div className="hero-body">
          <div className="container">
            <h1 className="title">
              Fullheight title
            </h1>
            <h2 className="subtitle">
              Fullheight subtitle
            </h2>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
