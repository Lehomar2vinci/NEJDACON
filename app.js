'use strict';
(function(){
  const APP_VERSION = '4.0.0';
  const stateKey = 'beaux-sucres-tier-state-v4';
  const themeKey = 'beaux-sucres-theme';

  const boardEl = document.getElementById('board');
  const poolEl = document.getElementById('pool');
  const nameInput = document.getElementById('nameInput');
  const emojiInput = document.getElementById('emojiInput');
  const imgInput = document.getElementById('imgInput');
  const addBtn = document.getElementById('addBtn');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const shareBtn = document.getElementById('shareBtn');
  const shareField = document.getElementById('shareField');
  const demoBtn = document.getElementById('demoBtn');
  const filterInput = document.getElementById('filterInput');
  const statsEl = document.getElementById('stats');
  const alphaSortBtn = document.getElementById('alphaSortBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const themeToggle = document.getElementById('themeToggle');
  const zeventToggle = document.getElementById('zeventToggle');
  const stageToggle = document.getElementById('stageToggle');
  const streamToggle = document.getElementById('streamToggle');
  const exportPngBtn = document.getElementById('exportPngBtn');
  const logoMark = document.getElementById('logoMark');
  const chipTpl = document.getElementById('chipTemplate');
  const dropzones = Array.from(document.querySelectorAll('.dropzone'));
  const toastEl = document.getElementById('toast');

  const undo = { past: [], future: [] };
  const S = { _v: APP_VERSION, tiers: { S:[], A:[], B:[], C:[], D:[] }, pool:[] };

  function pushHistory(){ undo.past.push(JSON.stringify(S)); undo.future.length=0; }
  function undoAction(){ if(!undo.past.length) return; undo.future.push(JSON.stringify(S)); Object.assign(S, JSON.parse(undo.past.pop())); render(); save(false); }
  function redoAction(){ if(!undo.future.length) return; undo.past.push(JSON.stringify(S)); Object.assign(S, JSON.parse(undo.future.pop())); render(); save(false); }

  function uid(){ return (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)); }

  function demoData(){
    return { _v: APP_VERSION, tiers:{S:[],A:[],B:[],C:[],D:[]}, pool:[
      {id:uid(), name:'Nejda', emoji:'🪄'},
      {id:uid(), name:'Beau Sucre', emoji:'🍬'},
      {id:uid(), name:'Croissant', emoji:'🥐'},
      {id:uid(), name:'Café', emoji:'☕'},
      {id:uid(), name:'Chat', emoji:'🐈'},
      {id:uid(), name:'Crème brûlée', emoji:'🍮'},
      {id:uid(), name:'Team', emoji:'🤝'},
      {id:uid(), name:'Z Event', emoji:'💚'}
    ]};
  }

  function load(){
    try{
      const hash = new URL(location.href).hash;
      if(hash.startsWith('#s=')){
        const json = decodeURIComponent(atob(hash.slice(3)));
        Object.assign(S, JSON.parse(json));
        window.history.replaceState(null, '', location.pathname + location.search);
        return;
      }
    }catch(e){ console.warn('Hash import failed', e); }
    try{
      const raw = localStorage.getItem(stateKey);
      if(raw){ Object.assign(S, JSON.parse(raw)); }
      else { Object.assign(S, demoData()); }
    }catch(e){ console.warn('State load error, using demo', e); Object.assign(S, demoData()); }
  }

  function save(push=true){ if(push) pushHistory(); try{ localStorage.setItem(stateKey, JSON.stringify(S)); }catch{} updateStatsAndBadges(); toast('Sauvegardé'); }

  function clearEl(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function createChip(item){
    const el = chipTpl.content.firstElementChild.cloneNode(true);
    el.dataset.id = item.id;
    const label = el.querySelector('.label');
    const avatar = el.querySelector('.avatar');
    label.textContent = item.name;
    if(item.img){
      avatar.textContent=''; const img=document.createElement('img'); img.src=item.img; img.alt=item.emoji||'🍬'; img.width=20; img.height=20; img.style.borderRadius='50%'; img.style.display='block'; avatar.appendChild(img);
    } else { avatar.textContent = item.emoji || '🍬'; }

    el.addEventListener('dblclick', ()=>{ const s = prompt('Nouveau nom ?', item.name); if(s){ item.name=s.trim(); render(); save(); }});
    el.querySelector('.edit').addEventListener('click', (ev)=>{ ev.stopPropagation(); const e = prompt('Nouvel emoji (ou URL d\'image) ?', item.emoji||''); if(!e) return; if(/^https?:\/\//.test(e)){ item.img=e; item.emoji=''; } else { item.emoji=e; item.img=''; } render(); save(); });
    el.querySelector('.del').addEventListener('click', (ev)=>{ ev.stopPropagation(); if(confirm('Supprimer ce sucre ?')) removeItem(item.id); });

    el.draggable = true;
    el.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', item.id); requestAnimationFrame(()=> el.classList.add('dragging')); });
    el.addEventListener('dragend', ()=> el.classList.remove('dragging'));

    el.addEventListener('keydown', (e)=>{
      const map = { '1':'S','2':'A','3':'B','4':'C','5':'D' };
      if(map[e.key]) moveTo(item.id, map[e.key]);
      if(e.key==='Delete') removeItem(item.id);
      if(['ArrowLeft','ArrowRight'].includes(e.key)){
        const order = ['pool','S','A','B','C','D'];
        const loc = locate(item.id); const idx = order.indexOf(loc.zone);
        const next = order[(idx + (e.key==='ArrowRight'?1:-1) + order.length)%order.length];
        moveTo(item.id, next);
      }
    });
    return el;
  }

  function locate(id){
    for(const zone of ['pool','S','A','B','C','D']){
      const list = zone==='pool'? S.pool : S.tiers[zone];
      const i = list.findIndex(x=>x.id===id); if(i>=0) return { zone, list, index:i, item:list[i] };
    } return null;
  }

  function removeItem(id){ const f = locate(id); if(!f) return; f.list.splice(f.index,1); render(); save(); }

  function moveTo(id, zone, index){
    const f = locate(id); if(!f) return;
    const item = f.item; f.list.splice(f.index,1);
    const target = zone==='pool' ? S.pool : S.tiers[zone];
    if(typeof index==='number' && index>=0) target.splice(index,0,item); else target.push(item);
    render(); save(); if(zone==='S') confetti();
  }

  function render(){
    for(const z of dropzones) clearEl(z);
    const q = (filterInput.value||'').toLowerCase();
    for(const it of S.pool){ if(!q || it.name.toLowerCase().includes(q)) poolEl.appendChild(createChip(it)); }
    for(const k of ['S','A','B','C','D']){
      const zone = document.querySelector(`.dropzone[data-zone="${k}"]`);
      for(const it of S.tiers[k]) zone.appendChild(createChip(it));
    }
    updateStatsAndBadges();
  }

  // drop with insertion position preview
  const placeholder = (()=>{ let _ph=null; return {
    get(){ if(!_ph){ _ph=document.createElement('div'); _ph.className='chip'; _ph.style.opacity=.35; _ph.style.width='80px'; _ph.style.height='36px'; } return _ph; },
    remove(){ if(_ph&&_ph.parentNode) _ph.parentNode.removeChild(_ph); },
    index(zone){ return Array.from(zone.children).indexOf(_ph); }
  }})();

  for(const zone of dropzones){
    zone.addEventListener('dragover', (e)=>{ e.preventDefault(); const dragging=document.querySelector('.chip.dragging'); if(!dragging) return; const afterEl = nearestChip(zone, e.clientX, e.clientY); if(afterEl==null) zone.appendChild(placeholder.get()); else zone.insertBefore(placeholder.get(), afterEl); });
    zone.addEventListener('dragleave', ()=> placeholder.remove());
    zone.addEventListener('drop', (e)=>{ e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const target = zone.dataset.zone; const idx = placeholder.index(zone); moveTo(id, target, idx); placeholder.remove(); });
  }

  function nearestChip(zone, x, y){
    const chips = [...zone.querySelectorAll('.chip:not(.dragging)')];
    let nearest=null, nearestDist=Infinity;
    for(const c of chips){ const r=c.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; const d=(cx-x)**2+(cy-y)**2; if(d<nearestDist){ nearestDist=d; nearest=c; } }
    return nearest;
  }

  // Stats + badges (compteur et score)
  function updateStatsAndBadges(){
    const weights = { S:5, A:4, B:3, C:2, D:1 };
    let total=0, score=0;
    for(const k of ['S','A','B','C','D']){
      const n = S.tiers[k].length; total += n; score += n * weights[k];
      const badge = document.querySelector(`.badge[data-badge="${k}"]`);
      if(badge) badge.textContent = `${k} (${n})`;
    }
    const avg = total? (score/total).toFixed(2) : '0.00';
    statsEl.textContent = `Total=${total} • Score=${score} • Moyenne=${avg}`;
  }

  // UI actions
  addBtn.addEventListener('click', ()=>{
    const name = nameInput.value.trim();
    const emoji = emojiInput.value.trim();
    const img = imgInput.value.trim();
    if(!name) return alert('Donne un petit nom à ton sucre ✨');
    if(S.pool.concat(...Object.values(S.tiers)).some(x=>x.name.toLowerCase()===name.toLowerCase())){
      if(!confirm('Un sucre porte déjà ce nom. Ajouter quand même ?')) return;
    }
    const item = { id:uid(), name, emoji: emoji || '🍬', img: /^https?:\/\//.test(img) ? img : '' };
    S.pool.push(item); render(); save();
    nameInput.value=''; emojiInput.value=''; imgInput.value=''; nameInput.focus();
  });

  saveBtn.addEventListener('click', ()=> save());
  resetBtn.addEventListener('click', ()=>{ if(confirm('Réinitialiser la grille et la réserve ?')){ Object.assign(S, demoData()); render(); save(); }});
  exportBtn.addEventListener('click', ()=>{ const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='beaux-sucres-tier.json'; a.click(); URL.revokeObjectURL(a.href); toast('Export JSON prêt'); });
  importBtn.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', async (e)=>{ const file=e.target.files[0]; if(!file) return; const text=await file.text(); try{ const obj=JSON.parse(text); Object.assign(S, obj); render(); save(); toast('Import réussi'); } catch(err){ alert('Fichier invalide : '+err.message); } finally{ importFile.value=''; } });
  shareBtn.addEventListener('click', async ()=>{ try{ const json=JSON.stringify(S); const hash='#s='+btoa(encodeURIComponent(json)); const url=location.origin+location.pathname+hash; shareField.value=url; if(navigator.clipboard) await navigator.clipboard.writeText(url); toast('Lien copié'); }catch(e){ shareField.select(); document.execCommand('copy'); toast('Lien prêt'); } });
  alphaSortBtn.addEventListener('click', ()=>{ for(const k of ['S','A','B','C','D']){ S.tiers[k].sort((a,b)=>a.name.localeCompare(b.name)); } render(); save(); });
  undoBtn.addEventListener('click', undoAction); redoBtn.addEventListener('click', redoAction);
  filterInput.addEventListener('input', render);

  document.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redoAction():undoAction(); }});

  // Thèmes + scène
  themeToggle.addEventListener('click', ()=>{
    const cur=document.documentElement.dataset.theme||'dark';
    const next = cur==='light' ? 'dark' : 'light';
    applyTheme(next); localStorage.setItem(themeKey, next);
  });
  zeventToggle.addEventListener('click', ()=>{ applyTheme('zevent'); localStorage.setItem(themeKey, 'zevent'); });
  stageToggle.addEventListener('click', ()=>{ document.documentElement.classList.toggle('stage'); });
  streamToggle.addEventListener('click', ()=> document.documentElement.classList.toggle('streamer'));

  function applyTheme(mode){
    document.documentElement.dataset.theme=mode;
    if(mode==='light'){
      document.body.style.background='linear-gradient(180deg,#fafafa,#efeff4)'; document.body.style.color='#0b0c10'; logoMark.innerHTML = '🍬';
    } else if(mode==='zevent'){
      document.body.style.background=''; document.body.style.color=''; logoMark.innerHTML = ZLogoSVG();
    } else { document.body.style.background=''; document.body.style.color=''; logoMark.innerHTML = '🍬'; }
  }
  function ZLogoSVG(){
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#22c55e"/></linearGradient></defs>
      <path d="M10 16h38l-26 28h32v8H14l26-28H10z" fill="url(#g)"/>
      <circle cx="18" cy="14" r="4" fill="#16a34a"/>
    </svg>`;
  }

  // Export PNG (sans lib externe) via SVG foreignObject
  exportPngBtn.addEventListener('click', async ()=>{
    try{
      const target = document.querySelector('.tierboard');
      const rect = target.getBoundingClientRect();
      const scale = Math.min(2, 1400/rect.width);

      const clone = target.cloneNode(true);
      for(const img of clone.querySelectorAll('img')){
        try{ const url = new URL(img.src, location.href); if(url.origin !== location.origin){ const span = document.createElement('span'); span.textContent='🍬'; span.style.fontSize='18px'; img.replaceWith(span); } }
        catch{ /* ignore */ }
      }

      let cssText = '';
      for(const link of document.querySelectorAll('link[rel="stylesheet"]')){
        try{ if(link.href.startsWith(location.origin)){ const res = await fetch(link.href); cssText += "
" + await res.text(); } }
        catch{ /* ignore */ }
      }
      cssText += "
body{background:#000;color:#fff;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial;}";

      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
      svg.setAttribute('width', Math.ceil(rect.width*scale));
      svg.setAttribute('height', Math.ceil(rect.height*scale));
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

      const fo = document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
      fo.setAttribute('x','0'); fo.setAttribute('y','0'); fo.setAttribute('width', String(rect.width)); fo.setAttribute('height', String(rect.height));

      const wrapper = document.createElement('div');
      wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
      const style = document.createElement('style'); style.textContent = cssText;
      wrapper.appendChild(style);
      wrapper.appendChild(clone);
      fo.appendChild(wrapper);
      svg.appendChild(fo);

      const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(rect.width*scale);
        canvas.height = Math.ceil(rect.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob)=>{
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'beaux-sucres-tier.png';
          a.click();
          setTimeout(()=> URL.revokeObjectURL(a.href), 5000);
          toast('PNG exporté');
        });
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); alert('Export PNG non supporté par ce navigateur.'); };
      img.src = url;
    }catch(err){ alert('Export PNG : ' + (err?.message||err)); }
  });

  // Confetti minimal
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let confs = [];
  function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
  window.addEventListener('resize', resize); resize();
  function confetti(){ const N=90; for(let i=0;i<N;i++){ confs.push({ x: Math.random()*canvas.width, y:-20, vy:2+Math.random()*3, vx:-2+Math.random()*4, s:4+Math.random()*4, r:Math.random()*Math.PI, vr:(-.2+Math.random()*.4) }); } }
  function tick(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.globalAlpha=.9; for(const c of confs){ c.x+=c.vx; c.y+=c.vy; c.r+=c.vr; c.vy+=0.03; ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.r); ctx.fillRect(-c.s/2,-c.s/2,c.s,c.s); ctx.restore(); } confs = confs.filter(c=> c.y < canvas.height+40); requestAnimationFrame(tick); }
  tick();

  // Init
  load();
  render();
  applyTheme(localStorage.getItem(themeKey)||'dark');

  // Toast helper
  let toastTimer=null; function toast(msg){ if(!toastEl) return; toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=> toastEl.classList.remove('show'), 1600); }
})();


===================== sw.js =====================
const CACHE_NAME = 'beaux-sucres-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res=> res || fetch(req).then(net=>{
      if(req.method==='GET' && new URL(req.url).origin===location.origin){
        const copy = net.clone(); caches.open(CACHE_NAME).then(c=>c.put(req, copy));
      }
      return net;
    }).catch(()=> caches.match('./index.html')))
  );
});
