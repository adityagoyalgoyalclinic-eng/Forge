// FORGE service worker — offline-first caching
const CACHE='forge-v2';
const IMG_CACHE='forge-img-v1';
const CORE=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(CORE.filter(u=>u))).catch(()=>{})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==IMG_CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:') return;

  // Exercise demo images / fonts from CDNs → cache-first in a dedicated, persistent cache
  const isDemoImg = /jsdelivr\.net|githubusercontent\.com/.test(url.hostname) && /\.(jpg|jpeg|png|webp)$/i.test(url.pathname);
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if(isDemoImg||isFont){
    e.respondWith(
      caches.open(IMG_CACHE).then(c=>c.match(req).then(hit=>{
        if(hit) return hit;
        return fetch(req).then(res=>{ if(res&&(res.status===200||res.type==='opaque')) c.put(req,res.clone()); return res; }).catch(()=>hit);
      }))
    );
    return;
  }

  // Network-first for the main HTML so updates are picked up; cache fallback
  if(req.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname==='/'){
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        return res;
      }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // Cache-first (stale-while-revalidate) for everything else
  e.respondWith(
    caches.match(req).then(cached=>{
      const fetchPromise=fetch(req).then(res=>{
        if(res&&res.status===200){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
      return cached||fetchPromise;
    })
  );
});
