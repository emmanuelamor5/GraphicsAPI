// Mini software rasterizer + small puzzle game
// Stage annotations are marked: [APPLICATION], [GEOMETRY], [RASTERIZATION]

const canvas = document.getElementById('screen');
const W = canvas.width = 820;
const H = canvas.height = 480;
const ctx = canvas.getContext('2d');
const image = ctx.getImageData(0,0,W,H);
const buf = image.data;

// Simple math helpers
function v(x,y,z){return [x,y,z]}
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function mul(a,s){return [a[0]*s,a[1]*s,a[2]*s]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]}
function norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}

// Depth buffer
let depth = new Float32Array(W*H);
function clearBuffers(){for(let i=0;i<buf.length;i++) buf[i]=0; for(let i=0;i<depth.length;i++) depth[i]=Infinity}

// [APPLICATION] Define scene, objects, camera, light
const lightDir = norm([0.5,0.8,0.6]);
const camera = {pos: [0,0,3], fov: Math.PI/3};

// Mesh helper: positions and faces (triangles)
function makeCube(){
  const s=0.8;
  const v0=[-s,-s,-s],v1=[s,-s,-s],v2=[s,s,-s],v3=[-s,s,-s];
  const v4=[-s,-s,s],v5=[s,-s,s],v6=[s,s,s],v7=[-s,s,s];
  const verts=[v0,v1,v2,v3,v4,v5,v6,v7];
  const faces=[
    [0,1,2],[0,2,3], [4,6,5],[4,7,6], // back/front
    [0,4,5],[0,5,1], [1,5,6],[1,6,2], // bottom/right
    [2,6,7],[2,7,3], [3,7,4],[3,4,0]  // top/left
  ];
  return {verts,faces,color:[180,120,230]};
}

function makePyramid(){
  const b=0.9;
  const roof=[0,1.0,0];
  const v0=[-b,-b,-b],v1=[b,-b,-b],v2=[b,-b,b],v3=[-b,-b,b];
  const verts=[v0,v1,v2,v3,roof];
  const faces=[ [0,1,4],[1,2,4],[2,3,4],[3,0,4],[0,3,2],[0,2,1] ];
  return {verts,faces,color:[120,220,160]};
}

const scene = [
  {id:'cube', mesh: makeCube(), pos:[-1.0,0,0], rot:[0,0,0], spin:0.9},
  {id:'pyr', mesh: makePyramid(), pos:[1.2,-0.1,0], rot:[0,0,0], spin:-1.1}
];

// [GEOMETRY] Matrices: model, view, projection
function rotateY(p, ang){const c=Math.cos(ang), s=Math.sin(ang); return [p[0]*c + p[2]*s, p[1], -p[0]*s + p[2]*c]}
function rotateX(p, ang){const c=Math.cos(ang), s=Math.sin(ang); return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c]}

function project(v3){
  // simple perspective projection to NDC
  const z = v3[2]-camera.pos[2];
  const f = 1/Math.tan(camera.fov/2);
  const ndcX = (v3[0]-camera.pos[0]) * f / -z;
  const ndcY = (v3[1]-camera.pos[1]) * f / -z;
  const sx = Math.round((ndcX*0.5+0.5)*W);
  const sy = Math.round((1-(ndcY*0.5+0.5))*H);
  return {x:sx,y:sy,z:-z};
}

// Rasterization helpers
function edgeFunction(a,b,c){return (c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x)}

function putPixel(x,y,r,g,b,a=255){
  if(x<0||y<0||x>=W||y>=H) return;
  const i = (y*W + x)|0;
  const di = i*4;
  buf[di]=r; buf[di+1]=g; buf[di+2]=b; buf[di+3]=a;
}

// Render scene to a binary mask (Uint8Array) using the same rasterizer rules.
function renderMask(sceneArr){
  const mask = new Uint8Array(W*H);
  const depthTemp = new Float32Array(W*H);
  for(let i=0;i<depthTemp.length;i++) depthTemp[i]=Infinity;

  for(const obj of sceneArr){
    const mesh = obj.mesh;
    const modelVerts = mesh.verts.map(vp=>{
      let p = rotateY(vp, obj.rot[1]);
      p = rotateX(p, obj.rot[0]);
      return add(p, obj.pos);
    });

    for(const f of mesh.faces){
      const vA = modelVerts[f[0]], vB = modelVerts[f[1]], vC = modelVerts[f[2]];
      const normal = norm(cross(sub(vB,vA), sub(vC,vA)));
      const viewVec = norm(sub(vA, camera.pos));
      if(dot(normal, viewVec) > 0) continue; // backface cull

      const p0 = project(vA), p1 = project(vB), p2 = project(vC);
      const minX = Math.max(0, Math.min(p0.x,p1.x,p2.x)|0);
      const maxX = Math.min(W-1, Math.max(p0.x,p1.x,p2.x)|0);
      const minY = Math.max(0, Math.min(p0.y,p1.y,p2.y)|0);
      const maxY = Math.min(H-1, Math.max(p0.y,p1.y,p2.y)|0);
      const area = edgeFunction(p0,p1,p2);
      if(Math.abs(area) < 0.5) continue;
      for(let y=minY;y<=maxY;y++){
        for(let x=minX;x<=maxX;x++){
          const p={x,y};
          const w0 = edgeFunction(p1,p2,p);
          const w1 = edgeFunction(p2,p0,p);
          const w2 = edgeFunction(p0,p1,p);
          if(w0>=0 && w1>=0 && w2>=0){
            const alpha = w0/area, beta = w1/area, gamma = w2/area;
            const z = alpha*p0.z + beta*p1.z + gamma*p2.z;
            const idx = y*W + x;
            if(z < depthTemp[idx]){ depthTemp[idx]=z; mask[idx]=1; }
          }
        }
      }
    }
  }
  return mask;
}

// [RASTERIZATION] Draw triangle to image buffer with depth test and flat shading
function rasterizeTri(p0,p1,p2,color,depthVal){
  const minX = Math.max(0, Math.min(p0.x,p1.x,p2.x)|0);
  const maxX = Math.min(W-1, Math.max(p0.x,p1.x,p2.x)|0);
  const minY = Math.max(0, Math.min(p0.y,p1.y,p2.y)|0);
  const maxY = Math.min(H-1, Math.max(p0.y,p1.y,p2.y)|0);
  const area = edgeFunction(p0,p1,p2);
  if(Math.abs(area) < 0.5) return;
  for(let y=minY;y<=maxY;y++){
    for(let x=minX;x<=maxX;x++){
      const p={x,y};
      const w0 = edgeFunction(p1,p2,p);
      const w1 = edgeFunction(p2,p0,p);
      const w2 = edgeFunction(p0,p1,p);
      if(w0>=0 && w1>=0 && w2>=0){
        // interpolate depth by barycentric
        const alpha = w0/area, beta = w1/area, gamma = w2/area;
        const z = alpha*p0.z + beta*p1.z + gamma*p2.z;
        const idx = y*W + x;
        if(z < depth[idx]){ depth[idx]=z; putPixel(x,y,color[0],color[1],color[2]); }
      }
    }
  }
}

// Draw loop
let t=0;

// --- Game setup ---
const selButtons = {cube: document.getElementById('sel-cube'), pyr: document.getElementById('sel-pyr')};
const rotX = document.getElementById('rotX'), rotY = document.getElementById('rotY');
const laz = document.getElementById('laz'), lel = document.getElementById('lel');
const resetBtn = document.getElementById('reset');
const progressEl = document.getElementById('progress');
const targetPreview = document.getElementById('targetPreview');

let selected = 'cube';
function findObj(id){return scene.find(s=>s.id===id)}

selButtons.cube.onclick = ()=>{ selected='cube'; syncUI() }
selButtons.pyr.onclick = ()=>{ selected='pyr'; syncUI() }

function syncUI(){
  const obj = findObj(selected);
  rotX.value = obj.rot[0]; rotY.value = obj.rot[1];
}

rotX.addEventListener('input', ()=>{ findObj(selected).rot[0]=parseFloat(rotX.value) });
rotY.addEventListener('input', ()=>{ findObj(selected).rot[1]=parseFloat(rotY.value) });

// light control
function updateLightFromUI(){
  const az = parseFloat(laz.value||0), el = parseFloat(lel.value||0);
  lightDir[0] = Math.cos(el)*Math.cos(az);
  lightDir[1] = Math.sin(el);
  lightDir[2] = Math.cos(el)*Math.sin(az);
  const n = Math.hypot(lightDir[0],lightDir[1],lightDir[2])||1;
  lightDir[0]/=n; lightDir[1]/=n; lightDir[2]/=n;
}
laz.addEventListener('input', updateLightFromUI);
lel.addEventListener('input', updateLightFromUI);

function randomizeScene(){
  for(const o of scene){ o.rot[0]=(Math.random()-0.5)*3; o.rot[1]=(Math.random()-0.5)*6 }
}
resetBtn.onclick = ()=>{ randomizeScene(); syncUI(); }

// Keyboard controls: select objects, rotate, change light, reset
window.addEventListener('keydown', (ev) => {
  const key = ev.key;
  if(key === '1' || key === '2'){
    selected = (key === '1') ? 'cube' : 'pyr';
    syncUI();
    return;
  }
  // prevent arrow keys causing page scroll
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)) ev.preventDefault();

  const obj = findObj(selected);
  if(!obj) return;
  const step = 0.12;
  switch(key){
    case 'ArrowLeft': case 'a': obj.rot[1] -= step; break;
    case 'ArrowRight': case 'd': obj.rot[1] += step; break;
    case 'ArrowUp': case 'w': obj.rot[0] -= step; break;
    case 'ArrowDown': case 's': obj.rot[0] += step; break;
    case 'q': laz.value = (parseFloat(laz.value||0) - 0.12).toString(); updateLightFromUI(); break;
    case 'e': laz.value = (parseFloat(laz.value||0) + 0.12).toString(); updateLightFromUI(); break;
    case 'r': randomizeScene(); break;
    default: return;
  }
  syncUI();
});

// compute target mask (fixed goal)
const targetScene = [
  {id:'cube', mesh: scene[0].mesh, pos: scene[0].pos, rot: [0.2, 1.2,0]},
  {id:'pyr', mesh: scene[1].mesh, pos: scene[1].pos, rot: [0.1, -0.6,0]}
];
const targetMask = renderMask(targetScene);

// draw targetPreview small canvas
const pv = document.createElement('canvas'); pv.width=160; pv.height=120; targetPreview.appendChild(pv);
const pvCtx = pv.getContext('2d');
function drawPreviewFromMask(mask){
  const img = pvCtx.createImageData(pv.width,pv.height);
  // scale down by nearest neighbor
  const sx = Math.floor(W/pv.width), sy=Math.floor(H/pv.height);
  for(let y=0;y<pv.height;y++) for(let x=0;x<pv.width;x++){
    const sx0 = x*sx, sy0 = y*sy; let v=0;
    for(let yy=0;yy<sy;yy++) for(let xx=0;xx<sx;xx++){ v |= mask[(sy0+yy)*W + (sx0+xx)]; }
    const i=(y*pv.width+x)*4; img.data[i]=200; img.data[i+1]=60; img.data[i+2]=60; img.data[i+3]= v?255:30;
  }
  pvCtx.putImageData(img,0,0);
}
drawPreviewFromMask(targetMask);

// main frame loop: render scene to screen and update game progress
function frame(){
  clearBuffers();

  // [APPLICATION] (no automatic spin in game mode)

  // render color image using rasterizer
  for(const obj of scene){
    const mesh = obj.mesh;
    const modelVerts = mesh.verts.map(vp=>{
      let p = rotateY(vp, obj.rot[1]);
      p = rotateX(p, obj.rot[0]);
      return add(p, obj.pos);
    });
    for(const f of mesh.faces){
      const vA = modelVerts[f[0]], vB = modelVerts[f[1]], vC = modelVerts[f[2]];
      const normal = norm(cross(sub(vB,vA), sub(vC,vA)));
      const viewVec = norm(sub(vA, camera.pos));
      if(dot(normal, viewVec) > 0) continue; // backface cull
      const intensity = Math.max(0, -dot(normal, lightDir));
      const col = mesh.color.map(c=>Math.min(255, (c*intensity + 30)));
      const p0 = project(vA), p1 = project(vB), p2 = project(vC);
      rasterizeTri(p0,p1,p2,col, (p0.z+p1.z+p2.z)/3 );
    }
  }
  ctx.putImageData(image,0,0);

  // game: compute mask similarity
  const curMask = renderMask(scene);
  // compute intersection over target area
  let inter=0, targSum=0;
  for(let i=0;i<targetMask.length;i++){ if(targetMask[i]){ targSum++; if(curMask[i]) inter++; } }
  const ratio = targSum? (inter / targSum) : 0;
  const pct = Math.round(ratio*100);
  progressEl.textContent = `Match: ${pct}%`;
  if(pct>=97) progressEl.textContent = `Match: ${pct}% — You Win!`;

  t+=1; requestAnimationFrame(frame);
}

// initialize UI values
randomizeScene(); syncUI(); laz.value=0.5; lel.value=0.2; updateLightFromUI();
console.log('Starting game: match the target silhouette by rotating objects and light.');
frame();
