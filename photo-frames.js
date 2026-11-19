/* Khung ảnh động: thêm, xóa, kéo thả và kéo góc đổi kích thước. */
(() => {
  'use strict';
  const KEY='koi.photo.frames.v4', MAX=16; // Giữ khóa cũ để bảo toàn bố cục đã lưu
  const initial=[{x:5,y:14},{x:79,y:16},{x:5,y:64}];
  const root=document.createElement('div'); root.id='koi-photos';
  const toolbar=document.createElement('div'); toolbar.id='koi-photos-toolbar';
  toolbar.innerHTML='<button type="button" id="koi-edit">✎ Chỉnh sửa khung ảnh</button><button type="button" id="koi-add">＋ Thêm khung ảnh</button><span id="koi-help">Kéo khung để di chuyển · Kéo góc dưới phải để phóng to/thu nhỏ</span>';
  const editButton=toolbar.querySelector('#koi-edit'),addButton=toolbar.querySelector('#koi-add');
  let data={frames:[],editing:false};
  let restoredLayout = false;
  const initialPropertiesSeen = new Set();
  const initialFilePropertiesSeen = new Set();
  try { const stored=JSON.parse(localStorage.getItem(KEY)||'null'); if(stored&&Array.isArray(stored.frames)) { data.frames=stored.frames; restoredLayout=true; } } catch(e) {}
  if(!data.frames.length) { restoredLayout=false; data.frames=initial.map((p,i)=>({id:i+1,...p,w:220,show:true,src:''})); }
  let editing=false;
  const save=()=>{
    try {
      // Chỉ lưu đường dẫn hoặc bản xem trước đã nén; ảnh chất lượng cao nằm trong IndexedDB.
      localStorage.setItem(KEY,JSON.stringify({frames:data.frames}));
      return true;
    } catch(e) {
      console.error('Không thể lưu khung ảnh (bộ nhớ đầy hoặc bị chặn)',e);
      alert('Không thể lưu ảnh và vị trí. Hãy kiểm tra dung lượng lưu trữ của Wallpaper Engine.');
      return false;
    }
  };
  // File ảnh dùng IndexedDB để tránh vượt giới hạn 5MB của localStorage.
  const dbPromise = new Promise(resolve=>{
    if(!window.indexedDB){resolve(null);return;}
    try {const req=indexedDB.open('koi-photo-images',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('images');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
    } catch(e){resolve(null);}
  });
  async function storeImage(id,url){const db=await dbPromise;if(!db)return false;return new Promise(resolve=>{try{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(url,String(id));tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch(e){resolve(false);}});}
  async function restoreImage(id){const db=await dbPromise;if(!db)return null;return new Promise(resolve=>{try{const tx=db.transaction('images','readonly');const req=tx.objectStore('images').get(String(id));req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);}catch(e){resolve(null);}});}
  async function deleteImage(id){const db=await dbPromise;if(!db)return;try{db.transaction('images','readwrite').objectStore('images').delete(String(id));}catch(e){}}

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Tạo bản ảnh nhỏ để vẫn khôi phục được ảnh khi IndexedDB bị xóa hoặc không khả dụng.
  function makePreview(source, maxSize=520) {
    const ratio=Math.min(1,maxSize/Math.max(source.width,source.height));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(source.width*ratio));
    c.height=Math.max(1,Math.round(source.height*ratio));
    c.getContext('2d').drawImage(source,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',0.56);
  }
  const state=id=>data.frames.find(f=>f.id===id);
  const nodes=new Map();
  function place(el,s){
    el.style.width=clamp(Number(s.w)||220,90,Math.max(90,innerWidth))+'px';
    el.style.left=clamp((Number(s.x)||0)*innerWidth/100,0,Math.max(0,innerWidth-el.offsetWidth))+'px';
    el.style.top=clamp((Number(s.y)||0)*innerHeight/100,0,Math.max(0,innerHeight-el.offsetHeight))+'px';
    el.style.display=s.show===false?'none':'';
  }
  function image(el,src){
    const img=el.querySelector('img');
    if(!src){img.removeAttribute('src');el.dataset.empty='true';return;}
    let url=String(src).trim();
    if(/^[a-zA-Z]:[\\/]/.test(url))url='file:///'+url.replace(/\\/g,'/');
    img.onload=()=>el.dataset.empty='false';
    img.onerror=()=>{el.dataset.empty='true';console.warn('Không tải được ảnh:',url);};
    img.src=url;
  }
  function edit(on){
    editing=!!on;document.body.classList.toggle('koi-photos-editing',editing);
    editButton.textContent=editing?'✓ Hoàn tất chỉnh sửa':'✎ Chỉnh sửa khung ảnh';
    root.style.pointerEvents=editing?'auto':'none';
  }
  function makeFrame(s){
    const el=document.createElement('div');el.className='koi-photo';el.dataset.id=s.id;el.dataset.empty='true';
    el.innerHTML='<img alt="Ảnh kỷ niệm"><div class="photo-placeholder">Khung ảnh <small>Nhấn “Chọn ảnh” để tải ảnh lên</small></div><div class="photo-tool"><button type="button" class="choose-photo">Chọn ảnh</button><button type="button" class="clear-photo">Xóa ảnh</button><button type="button" class="delete-frame">Xóa khung</button></div><div class="photo-resize" title="Kéo để phóng to hoặc thu nhỏ"></div>';
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;el.append(input);
    el.querySelector('.choose-photo').onclick=e=>{e.stopPropagation();input.click();};
    el.querySelector('.clear-photo').onclick=e=>{e.stopPropagation();const oldKey=s.imageKey||s.id;s.src='';s.preview='';s.imageKey=null;deleteImage(oldKey);image(el,'');save();};
    el.querySelector('.delete-frame').onclick=e=>{e.stopPropagation();if(data.frames.length===1)return;data.frames=data.frames.filter(f=>f.id!==s.id);nodes.delete(s.id);deleteImage(s.id);el.remove();save();};
    input.onchange=()=>{
      const file=input.files?.[0];if(!file)return;
      if(!file.type.startsWith('image/'))return;
      const reader=new FileReader();reader.onload=()=>{
        const source=new Image();source.onload=()=>{
          const ratio=Math.min(1,1100/Math.max(source.width,source.height));
          const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*ratio));canvas.height=Math.max(1,Math.round(source.height*ratio));
          canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
          const encoded=canvas.toDataURL('image/jpeg',.72);
          const preview=makePreview(source);
          // Lưu bản xem trước TRƯỚC, tránh mất ảnh nếu tắt hình nền khi đang ghi IndexedDB.
          const oldKey=s.imageKey||s.id;
          s.src='';s.preview=preview;s.imageKey=s.id+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
          image(el,encoded);
          save();
          storeImage(s.imageKey,encoded).then(ok=>{
            if(ok && oldKey!==s.imageKey)deleteImage(oldKey);
            if(!ok) console.warn('IndexedDB không lưu được ảnh đầy đủ; dùng ảnh xem trước đã lưu.');
          });
        };source.src=String(reader.result);
      };reader.readAsDataURL(file);input.value='';
    };
    let gesture=null;
    el.addEventListener('pointerdown',e=>{
      if(!editing||e.button!==0||e.target.closest('button,input'))return;
      e.preventDefault();e.stopPropagation();
      const rect=el.getBoundingClientRect();
      gesture={kind:e.target.closest('.photo-resize')?'resize':'move',startX:e.clientX,startY:e.clientY,left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth,ratio:rect.height/rect.width};
      el.setPointerCapture(e.pointerId);el.classList.add('moving');
    });
    el.addEventListener('pointermove',e=>{
      if(!gesture)return;
      if(gesture.kind==='resize'){
        s.w=clamp(gesture.width+e.clientX-gesture.startX,90,Math.min(800,innerWidth-el.offsetLeft));
        el.style.width=s.w+'px';
      }else{
        const x=clamp(gesture.left+e.clientX-gesture.startX,0,Math.max(0,innerWidth-el.offsetWidth));
        const y=clamp(gesture.top+e.clientY-gesture.startY,0,Math.max(0,innerHeight-el.offsetHeight));
        el.style.left=x+'px';el.style.top=y+'px';s.x=x/innerWidth*100;s.y=y/innerHeight*100;
      }
    });
    const stop=()=>{if(gesture){gesture=null;el.classList.remove('moving');save();}};
    el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);el.addEventListener('lostpointercapture',stop);
    root.append(el);nodes.set(s.id,el);place(el,s);image(el,s.src||s.preview||'');
    // Ưu tiên bản ảnh chất lượng cao; nếu không còn thì dùng bản xem trước trong localStorage.
    if(!s.src)restoreImage(s.imageKey||s.id).then(saved=>{
      if(!saved || s.src || nodes.get(s.id)!==el)return;
      image(el,saved);
      // Di chuyển dữ liệu cũ (chỉ có IndexedDB) sang cơ chế có bản dự phòng.
      if(!s.preview){
        const tmp=new Image();tmp.onload=()=>{if(!s.preview && nodes.get(s.id)===el){s.preview=makePreview(tmp);save();}};tmp.src=saved;
      }
    });
  }
  data.frames.forEach(makeFrame);
  editButton.onclick=()=>edit(!editing);
  addButton.onclick=()=>{
    if(data.frames.length>=MAX){alert('Tối đa '+MAX+' khung ảnh');return;}
    const id=Math.max(0,...data.frames.map(f=>f.id))+1;
    const s={id,x:clamp(15+(id*7)%55,0,80),y:clamp(15+(id*9)%50,0,80),w:220,show:true,src:''};
    data.frames.push(s);makeFrame(s);edit(true);save();
  };
  document.body.append(root,toolbar);edit(false);
  window.addEventListener('resize',()=>data.frames.forEach(s=>{const el=nodes.get(s.id);if(el)place(el,s);}));
  function apply(values){
    if(typeof values.photoFramesEdit==='boolean')edit(values.photoFramesEdit);
    let changed=false;
    for(let i=1;i<=3;i++){
      const s=state(i),el=nodes.get(i);if(!s||!el)continue;
      const key='photoFrame'+i;
      if(key+'Show' in values){s.show=!!values[key+'Show'];changed=true;}
      if(key in values && typeof values[key]==='string' && values[key].trim() && values[key]!==s.src){
        const first=!initialFilePropertiesSeen.has(key);
        initialFilePropertiesSeen.add(key);
        // Không để lựa chọn file cũ trong Wallpaper Engine ghi đè ảnh mới đã tải trong khung.
        if(!(restoredLayout && first && s.preview)){
          const oldKey=s.imageKey||s.id;s.src=values[key];s.preview='';s.imageKey=null;deleteImage(oldKey);image(el,s.src);changed=true;
        }
      }
      // Wallpaper Engine replays defaults on startup. Ignore only the FIRST
      // value of each layout property when a saved layout already exists.
      for(const [suffix,field,low,high] of [['X','x',0,100],['Y','y',0,100],['Size','w',90,800]]){
        const prop=key+suffix;
        if(!(prop in values))continue;
        const first=!initialPropertiesSeen.has(prop);
        initialPropertiesSeen.add(prop);
        if(restoredLayout && first)continue;
        const v=Number(values[prop]);
        if(Number.isFinite(v)){s[field]=clamp(v,low,high);changed=true;}
      }
      place(el,s);
    }
    if(changed)save();
  }
  window.addEventListener('koi:photo-properties',e=>apply(e.detail||{}));
  if(window.__koiPhotoProperties)apply(window.__koiPhotoProperties);
})();
