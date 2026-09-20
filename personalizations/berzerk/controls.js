// Keep old bookmarked/cached entry paths on the public root URL.
const publicRoot=new URL('../../',import.meta.url);
if(location.pathname===new URL('./',import.meta.url).pathname){
  const base=document.createElement('base');base.href=location.href;
  document.head.prepend(base);
  history.replaceState(null,'',publicRoot.pathname+location.search+location.hash);
}
const frame=document.querySelector('#emulator');
const api=()=>frame.contentWindow.berzerk;
let ready=false,direction=255,firing=false,touchEnabled=true;
const send=()=>{if(ready)api().contacts(direction & (firing?0x6f:255));};
const release=()=>{direction=255;firing=false;document.querySelector('#knob').style.transform='';if(ready)api().release();};
const config=await (await fetch(new URL('./cartridge-controls.json',import.meta.url))).json();
for(const action of config.actions){
  const button=document.createElement('button');button.textContent=action.label;button.id=action.id;button.disabled=true;
  button.addEventListener('click',()=>api()?.press(action.code));
  document.getElementById(action.placement).append(button);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data.type==='berzerk-ready'){ready=true;document.querySelectorAll('button').forEach(b=>b.disabled=false);document.querySelector('#status').textContent='';}
  if(event.data.type==='berzerk-error')document.querySelector('#status').textContent=event.data.message;
});
const pad=document.querySelector('#pad'),fire=document.querySelector('#fire');
let padId=null,fireId=null;
function move(event){const r=pad.getBoundingClientRect(),x=(event.clientX-r.left-r.width/2)/(r.width/2),y=(event.clientY-r.top-r.height/2)/(r.height/2);direction=Math.hypot(x,y)<(config.touchPad?.deadZone ?? .45)?255:[0xf7,0xf5,0xfd,0xf9,0xfb,0xfa,0xfe,0xf6][(Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8];const length=Math.max(1,Math.hypot(x,y));document.querySelector('#knob').style.transform=`translate(${x/length*r.width*.24}px,${y/length*r.height*.24}px)`;send();}
pad.addEventListener('pointerdown',e=>{if(!ready||!touchEnabled||padId!==null)return;e.preventDefault();padId=e.pointerId;pad.setPointerCapture(padId);move(e);});
pad.addEventListener('pointermove',e=>{if(e.pointerId===padId)move(e);});
fire.addEventListener('pointerdown',e=>{if(!ready||!touchEnabled||fireId!==null)return;e.preventDefault();fireId=e.pointerId;fire.setPointerCapture(fireId);firing=true;send();});
for(const name of ['pointerup','pointercancel','lostpointercapture']){
 pad.addEventListener(name,e=>{if(e.pointerId===padId){padId=null;direction=255;document.querySelector('#knob').style.transform='';send();}});
 fire.addEventListener(name,e=>{if(e.pointerId===fireId){fireId=null;firing=false;send();}});
}
for(const name of ['blur','pagehide'])window.addEventListener(name,release);
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
window.addEventListener('resize',release);
document.addEventListener('fullscreenchange',release);
document.querySelector('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('main').requestFullscreen();}catch{document.querySelector('#status').textContent='Fullscreen is unavailable in this browser.';}});

window.addEventListener('keydown',e=>{if(ready)api().key(e,true);});
window.addEventListener('keyup',e=>{if(ready)api().key(e,false);});

// Cartridge-owned touch switch; keyboard and physical gamepads remain active.
const touchToggle=document.createElement('button');
touchToggle.id='touch-toggle';touchToggle.textContent='D-pad: On';
touchToggle.title='Show or hide the on-screen D-pad and Fire button';
touchToggle.setAttribute('aria-label','On-screen touch controls');
touchToggle.setAttribute('aria-pressed','true');
document.querySelector('#fullscreen').after(touchToggle);
touchToggle.addEventListener('click',()=>{
  touchEnabled=!touchEnabled;
  // Drop touch contacts only; do not interrupt held physical keyboard keys.
  direction=255;firing=false;
  document.querySelector('#knob').style.transform='';
  const oldPad=padId,oldFire=fireId;padId=null;fireId=null;
  if(oldPad!==null&&pad.hasPointerCapture(oldPad))pad.releasePointerCapture(oldPad);
  if(oldFire!==null&&fire.hasPointerCapture(oldFire))fire.releasePointerCapture(oldFire);
  if(ready)api().contacts(255);
  document.querySelector('main').classList.toggle('touch-off',!touchEnabled);
  touchToggle.textContent=touchEnabled?'D-pad: On':'D-pad: Off';
  touchToggle.setAttribute('aria-pressed',String(touchEnabled));
});

const crtToggle=document.createElement('button');
crtToggle.id='crt-toggle';crtToggle.textContent='CRT: On';crtToggle.disabled=!ready;
crtToggle.title='Enable or disable CRT scanlines';
crtToggle.setAttribute('aria-pressed','true');
document.querySelector('header').append(crtToggle);
let crtEnabled=true;
crtToggle.addEventListener('click',()=>{
  crtEnabled=!crtEnabled;api().setCrt(crtEnabled);
  crtToggle.textContent=crtEnabled?'CRT: On':'CRT: Off';
  crtToggle.setAttribute('aria-pressed',String(crtEnabled));
});
