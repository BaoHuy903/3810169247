/* 3 khung ảnh treo, hỗ trợ kéo thả và lưu vị trí. Không can thiệp hiệu ứng hồ cá. */
(function(){
'use strict';
const KEY='koi.photo.frames.v2';
const root=document.createElement('div');root.id='koi-photos';
const toggle=document.createElement('button');toggle.id='koi-photos-toggle';toggle.textContent='Chỉnh sửa khung ảnh';toggle.title='Bật chế độ kéo thả và chọn ảnh';
const defaults=[{x:.035,y:.14},{x:.79,y:.16},{x:.055,y:.64}];
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
let editing=false;
const frames=[];
function persist(){try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(e){console.warn('Không lưu được vị trí ảnh',e)}}
function renderVisibility(){root.classList.toggle('koi-editing',editing);toggle.textContent=editing?'Hoàn tất chỉnh sửa':'Chỉnh sửa khung ảnh';frames.forEach(f=>{f.style.pointerEvents=editing?'auto':'none'})}
function fit(f){const x=Math.max(0,Math.min(window.innerWidth-f.offsetWidth,(saved[f.dataset.id]?.x??.05)*window.innerWidth));const y=Math.max(0,Math.min(window.innerHeight-f.offsetHeight-42,(saved[f.dataset.id]?.y??.1)*window.innerHeight));f.style.left=x+'px';f.style.top=y+'px'}
function loadImage(f,url){const img=f.querySelector('img');if(!url){img.hidden=true;img.removeAttribute('src');f.dataset.empty='true';return}img.onload=()=>{img.hidden=false;f.dataset.empty='false'};img.onerror=()=>{img.hidden=true;f.dataset.empty='true'};img.src=url}
for(let i=0;i<3;i++){
 const id=String(i+1),state=saved[id]||{...defaults[i]},f=document.createElement('div');f.className='koi-photo';f.dataset.id=id;f.dataset.empty='true';f.style.setProperty('--tilt',[-1.3,1.2,.6][i]+'deg');
 f.innerHTML='<img alt="Ảnh cá nhân '+id+'" hidden><div class="photo-placeholder">Khung ảnh '+id+'<small>Nhấn Chỉnh sửa để thêm ảnh</small></div><div class="photo-tool"><button type="button" class="choose-photo">Chọn ảnh</button><button type="button" class="clear-photo">Xóa ảnh</button></div>';
 const file=document.createElement('input');file.type='file';file.accept='image/*';file.hidden=true;
 file.onchange=()=>{const chosen=file.files&&file.files[0];if(!chosen)return;if(chosen.size>8*1024*1024){alert('Ảnh quá lớn. Hãy chọn ảnh dưới 8 MB.');return}const reader=new FileReader();reader.onload=()=>{saved[id]={...(saved[id]||defaults[i]),src:String(reader.result)};persist();loadImage(f,saved[id].src)};reader.readAsDataURL(chosen)};
 f.querySelector('.choose-photo').onclick=e=>{e.stopPropagation();file.click()};f.querySelector('.clear-photo').onclick=e=>{e.stopPropagation();saved[id]={...(saved[id]||defaults[i]),src:''};persist();loadImage(f,'')};
 f.appendChild(file);root.appendChild(f);frames.push(f);
 let drag=null;
 f.addEventListener('pointerdown',e=>{if(!editing||e.button!==0||e.target.closest('button'))return;e.preventDefault();const rect=f.getBoundingClientRect();drag={dx:e.clientX-rect.left,dy:e.clientY-rect.top};f.setPointerCapture(e.pointerId);f.classList.add('moving')});
 f.addEventListener('pointermove',e=>{if(!drag)return;const x=Math.max(0,Math.min(innerWidth-f.offsetWidth,e.clientX-drag.dx));const y=Math.max(0,Math.min(innerHeight-f.offsetHeight-42,e.clientY-drag.dy));f.style.left=x+'px';f.style.top=y+'px';saved[id]={...(saved[id]||defaults[i]),x:x/innerWidth,y:y/innerHeight}});
 const end=()=>{if(!drag)return;drag=null;f.classList.remove('moving');persist()};f.addEventListener('pointerup',end);f.addEventListener('pointercancel',end);
 loadImage(f,state.src||'');
}
toggle.addEventListener('click',()=>{editing=!editing;renderVisibility()});
document.body.append(root,toggle);renderVisibility();frames.forEach(f=>fit(f));window.addEventListener('resize',()=>frames.forEach(f=>fit(f)));
})();
