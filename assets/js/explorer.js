
const colors=["#2f6fed","#00a878","#f59e0b","#ef4444","#8b5cf6","#0891b2","#db2777","#65a30d"];
Promise.all([fetch("assets/data/trip.json").then(r=>r.json()),fetch("assets/data/photos.json").then(r=>r.json())]).then(([trip,photos])=>{
 const map=L.map("map",{zoomControl:true});
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
 const stageLayers=[];
 trip.stages.forEach((stage,i)=>{
   stage.segments.forEach(seg=>{
     const coords=seg.map(idx=>[trip.points[idx].lat,trip.points[idx].lon]);
     stageLayers.push(L.polyline(coords,{color:colors[i],weight:5,opacity:.9}).addTo(map).bindTooltip(`Day ${stage.day}: ${stage.distance_mi.toFixed(1)} mi`));
   });
 });
 const bounds=L.latLngBounds(trip.points.map(p=>[p.lat,p.lon]));map.fitBounds(bounds,{padding:[18,18]});
 const marker=L.circleMarker([trip.points[0].lat,trip.points[0].lon],{radius:8,color:"#fff",weight:3,fillColor:"#111",fillOpacity:1}).addTo(map);
 const photoMarkers=[];
 photos.forEach(ph=>{if(ph.lat!=null){const m=L.circleMarker([ph.lat,ph.lon],{radius:5,color:"#fff",weight:2,fillColor:"#d63d6c",fillOpacity:1}).addTo(map);m.on("click",()=>setByIndex(ph.route_index));photoMarkers.push(m)}});
 const slider=document.getElementById("tripSlider"), play=document.getElementById("play"), distance=document.getElementById("distance"), progress=document.getElementById("progress");
 slider.max=trip.points.length-1;
 let timer=null;
 function nearestPhotos(point,limit=8){
   return photos.filter(p=>p.route_index!=null).map(p=>({...p,gap:Math.abs(p.route_index-point.index)})).sort((a,b)=>a.gap-b.gap).slice(0,limit);
 }
 function renderPhoto(p){
   const panel=document.getElementById("photoPanel");
   if(!p){panel.innerHTML='<div class="photo-empty">No photo near this point yet.</div>';return}
   panel.innerHTML=`<img src="${p.large}" alt="Trip photo"><div class="photo-meta"><strong>${p.filename}</strong>${p.taken_at?new Date(p.taken_at).toLocaleString():""} · mile ${p.distance_mi.toFixed(1)}</div>`;
 }
 function setByIndex(idx,pan=true){
   idx=Math.max(0,Math.min(trip.points.length-1,Math.round(idx)));slider.value=idx;
   const p=trip.points[idx], stage=trip.stages[p.day-1];
   marker.setLatLng([p.lat,p.lon]);if(pan)map.panTo([p.lat,p.lon],{animate:false});
   document.getElementById("dayBadge").textContent=`Day ${p.day}`;
   document.getElementById("location").textContent=`Mile ${p.distance_mi.toFixed(1)}`;
   document.getElementById("coords").textContent=`${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
   document.getElementById("speed").textContent=`${stage.avg_speed_mph.toFixed(1)} mph`;
   document.getElementById("hr").textContent=`${stage.avg_hr} bpm`;
   document.getElementById("power").textContent=`${stage.avg_power} W`;
   document.getElementById("gain").textContent=`${stage.gain_ft.toLocaleString()} ft`;
   distance.textContent=`${p.distance_mi.toFixed(1)} of ${trip.total_distance_mi.toFixed(1)} mi`;
   progress.textContent=`${Math.round(100*p.distance_mi/trip.total_distance_mi)}% complete`;
   const near=nearestPhotos(p);const veryNear=near.find(x=>Math.abs(x.distance_mi-p.distance_mi)<2.0) || near[0];
   renderPhoto(veryNear);
   const strip=document.getElementById("photoStrip");strip.innerHTML="";
   near.forEach(ph=>{const b=document.createElement("button");b.className="photo-thumb"+(veryNear&&ph.id===veryNear.id?" active":"");b.innerHTML=`<img src="${ph.thumb}" alt="${ph.filename}">`;b.addEventListener("click",()=>{setByIndex(ph.route_index);renderPhoto(ph)});strip.appendChild(b)});
 }
 slider.addEventListener("input",()=>setByIndex(+slider.value));
 map.on("click",e=>{let best=0,bd=Infinity;trip.points.forEach((p,i)=>{const d=map.distance(e.latlng,[p.lat,p.lon]);if(d<bd){bd=d;best=i}});setByIndex(best)});
 play.addEventListener("click",()=>{
   if(timer){clearInterval(timer);timer=null;play.textContent="▶ Play";return}
   play.textContent="❚❚ Pause";timer=setInterval(()=>{let n=+slider.value+Math.max(1,Math.floor(trip.points.length/700));if(n>=trip.points.length-1){clearInterval(timer);timer=null;play.textContent="▶ Play";n=trip.points.length-1}setByIndex(n)},70)
 });
 document.getElementById("reset").addEventListener("click",()=>{setByIndex(0);map.fitBounds(bounds,{padding:[18,18]})});
 setByIndex(0,false);
});
