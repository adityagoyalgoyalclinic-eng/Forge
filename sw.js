// FORGE service worker — offline-first caching
const CACHE='forge-v1';
const CORE=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(CORE.filter(u=>u))).catch(()=>{})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:') return;
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
  // Cache-first (stale-while-revalidate) for fonts / static
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
