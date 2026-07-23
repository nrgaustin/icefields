
const COLORS=["#2f6fed","#00a878","#f59e0b","#ef4444","#8b5cf6","#0891b2","#db2777","#65a30d"];
const METRICS={
 e:{label:"Elevation",unit:"ft",color:"#5a6f87",default:true},
 g:{label:"Grade",unit:"%",color:"#a35c21",default:true},
 s:{label:"Speed",unit:"mph",color:"#167a8b",default:true},
 h:{label:"Heart rate",unit:"bpm",color:"#b63b4b",default:true},
 p:{label:"Power",unit:"W",color:"#6e4aad",default:true},
 c:{label:"Cadence",unit:"rpm",color:"#32734a",default:false},
 q:{label:"Temperature",unit:"°C",color:"#b56a25",default:false}
};
const state={trip:null,photos:[],notes:[],i:0,context:"instant",follow:"local",visible:new Set(Object.keys(METRICS).filter(k=>METRICS[k].default)),timer:null,prefix:{}};
const $=id=>document.getElementById(id), finite=Number.isFinite;
let map,marker,completedLine,photoLayer,eventLayer,bounds;

function col(k){return state.trip.columns[k]}
function binaryDistance(mi){const a=col("d");let lo=0,hi=a.length-1;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<mi)lo=m+1;else hi=m}return lo}
function buildPrefixes(){
 for(const k of Object.keys(METRICS)){const values=col(k),sum=new Float64Array(values.length+1),count=new Uint32Array(values.length+1);for(let i=0;i<values.length;i++){const v=values[i];sum[i+1]=sum[i]+(finite(v)?v:0);count[i+1]=count[i]+(finite(v)?1:0)}state.prefix[k]={sum,count}}
}
function mean(k,l,r){const p=state.prefix[k],n=p.count[r+1]-p.count[l];return n?(p.sum[r+1]-p.sum[l])/n:null}
function boundsForContext(i,mode){
 const C=state.trip.columns,rday=C.a[i],n=C.d.length;
 if(mode==="instant")return[i,i];
 if(mode==="mile"){const lo=binaryDistance(C.d[i]-.5),hi=Math.min(n-1,binaryDistance(C.d[i]+.5));return[lo,hi]}
 if(mode==="hour"){const t=C.t[i],loT=t-1800000,hiT=t+1800000;let lo=i,hi=i;while(lo>0&&C.a[lo-1]===rday&&C.t[lo-1]>=loT)lo--;while(hi<n-1&&C.a[hi+1]===rday&&C.t[hi+1]<=hiT)hi++;return[lo,hi]}
 if(mode==="stage"){const s=state.trip.stages.find(s=>i>=s.start_index&&i<=s.end_index);return[s.start_index,s.end_index]}
 return[0,n-1]
}
function nearestMapIndex(latlng){
 const C=state.trip.columns;let best=0,bd=Infinity;const step=Math.max(1,Math.floor(C.d.length/25000));
 for(let i=0;i<C.d.length;i+=step){if(!finite(C.y[i]))continue;const d=map.distance(latlng,[C.y[i],C.x[i]]);if(d<bd){bd=d;best=i}}
 const start=Math.max(0,best-step*2),end=Math.min(C.d.length-1,best+step*2);
 for(let i=start;i<=end;i++){if(!finite(C.y[i]))continue;const d=map.distance(latlng,[C.y[i],C.x[i]]);if(d<bd){bd=d;best=i}}
 return best
}
function matchPhotos(){
 state.photos.forEach(p=>{if(p.route_index==null&&finite(p.distance_mi))p.route_index=binaryDistance(p.distance_mi)})
}
function initMap(){
 const C=state.trip.columns;
 map=L.map("map",{zoomControl:true});
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
 const all=[];
 state.trip.stages.forEach((s,j)=>{const coords=[];const step=Math.max(1,Math.ceil((s.end_index-s.start_index)/2400));for(let i=s.start_index;i<=s.end_index;i+=step){if(finite(C.y[i]))coords.push([C.y[i],C.x[i]])}if(finite(C.y[s.end_index]))coords.push([C.y[s.end_index],C.x[s.end_index]]);all.push(...coords);L.polyline(coords,{color:COLORS[j],weight:5,opacity:.75}).addTo(map).bindTooltip(`Day ${s.day}: ${s.distance_mi.toFixed(1)} mi`)});
 bounds=L.latLngBounds(all);map.fitBounds(bounds,{padding:[18,18]});
 marker=L.circleMarker([C.y[0],C.x[0]],{radius:8,color:"#fff",weight:3,fillColor:"#111",fillOpacity:1}).addTo(map);
 completedLine=L.polyline([],{color:"#111",weight:6,opacity:.82}).addTo(map);
 photoLayer=L.layerGroup().addTo(map);eventLayer=L.layerGroup().addTo(map);
 const clusters=[];
 state.photos.filter(p=>p.route_index!=null).sort((a,b)=>a.route_index-b.route_index).forEach(p=>{const mi=C.d[p.route_index],last=clusters.at(-1);if(last&&mi-last.center<.5){last.photos.push(p);last.center=last.photos.reduce((s,x)=>s+C.d[x.route_index],0)/last.photos.length}else clusters.push({center:mi,photos:[p]})});
 clusters.forEach(cluster=>{const i=binaryDistance(cluster.center),icon=L.divIcon({className:"",html:`<div style="background:#d93d70;color:#fff;border:2px solid #fff;border-radius:14px;padding:3px 7px;font:700 11px system-ui;box-shadow:0 2px 7px #0004">📷 ${cluster.photos.length}</div>`,iconAnchor:[18,14]});L.marker([C.y[i],C.x[i]],{icon}).addTo(photoLayer).on("click",()=>setIndex(i,true,cluster.photos[0]))});
 state.notes.forEach(n=>{const i=n.route_index??binaryDistance(n.distance_mi);n.route_index=i;L.circleMarker([C.y[i],C.x[i]],{radius:6,color:"#fff",weight:2,fillColor:"#111",fillOpacity:1}).addTo(eventLayer).bindTooltip(n.title).on("click",()=>setIndex(i))});
 map.on("click",e=>setIndex(nearestMapIndex(e.latlng)));
 document.querySelectorAll("[data-follow]").forEach(b=>b.addEventListener("click",()=>{state.follow=b.dataset.follow;document.querySelectorAll("[data-follow]").forEach(x=>x.classList.toggle("active",x===b));if(state.follow==="trip")map.fitBounds(bounds,{padding:[18,18]})}))
}
function setupRibbons(){
 const total=state.trip.total_distance_mi,stage=$("stageRibbon");stage.innerHTML="";
 state.trip.stages.forEach((s,j)=>{const el=document.createElement("span");el.style.width=`${(s.end_mi-s.start_mi)/total*100}%`;el.style.background=COLORS[j];stage.appendChild(el)});
 const events=$("eventRibbon");events.innerHTML="";
 state.photos.filter(p=>p.route_index!=null).forEach(p=>{const b=document.createElement("button");b.className="photo-mark";b.title=p.filename;b.style.left=`${col("d")[p.route_index]/total*100}%`;b.addEventListener("click",()=>setIndex(p.route_index,true,p));events.appendChild(b)});
 state.notes.forEach(n=>{const b=document.createElement("button");b.className="event-mark";b.title=n.title;b.style.left=`${col("d")[n.route_index]/total*100}%`;b.addEventListener("click",()=>setIndex(n.route_index));events.appendChild(b)})
}
function setupChartControls(){
 const host=$("chartControls");host.innerHTML="";
 Object.entries(METRICS).forEach(([k,m])=>{const b=document.createElement("button");b.className="chart-toggle"+(state.visible.has(k)?" active":"");b.textContent=m.label;b.addEventListener("click",()=>{state.visible.has(k)?state.visible.delete(k):state.visible.add(k);b.classList.toggle("active");renderCharts()});host.appendChild(b)})
}
function chartPointer(e){const rect=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));setIndex(Math.round(x/rect.width*(col("d").length-1)))}
function renderCharts(){
 const host=$("charts");host.innerHTML="";
 for(const k of state.visible){const m=METRICS[k],row=document.createElement("div");row.className="chart-row";row.innerHTML=`<div class="chart-name">${m.label}<span>${m.unit}</span></div><canvas class="chart-canvas" data-key="${k}"></canvas><div class="chart-value" id="chart-${k}">—</div>`;host.appendChild(row);const canvas=row.querySelector("canvas");canvas.addEventListener("pointerdown",chartPointer);canvas.addEventListener("pointermove",e=>{if(e.buttons)chartPointer(e)})}
 requestAnimationFrame(drawCharts)
}
function drawCharts(){
 document.querySelectorAll(".chart-canvas").forEach(canvas=>{const k=canvas.dataset.key,m=METRICS[k],values=col(k),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,W=rect.width,H=rect.height;canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
 const valid=values.filter(finite),lo=Math.min(...valid),hi=Math.max(...valid),range=hi-lo||1;ctx.clearRect(0,0,W,H);
 state.trip.stages.forEach((s,j)=>{ctx.fillStyle=COLORS[j]+"12";ctx.fillRect(s.start_index/(values.length-1)*W,0,(s.end_index-s.start_index)/(values.length-1)*W,H)});
 ctx.strokeStyle=m.color;ctx.lineWidth=1.3;ctx.beginPath();let started=false;const step=Math.max(1,Math.ceil(values.length/Math.max(300,W)));
 for(let i=0;i<values.length;i+=step){const v=values[i];if(!finite(v)){started=false;continue}const x=i/(values.length-1)*W,y=H-4-(v-lo)/range*(H-8);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)}ctx.stroke();
 const x=state.i/(values.length-1)*W,v=values[state.i];ctx.strokeStyle="#111";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();if(finite(v)){const y=H-4-(v-lo)/range*(H-8);ctx.fillStyle="#111";ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill()}})
}
function fmt(v,d=0){return finite(v)?v.toFixed(d):"—"}
function nearbyPhotos(i){const d=col("d")[i];return state.photos.filter(p=>p.route_index!=null).map(p=>({...p,gap:Math.abs(col("d")[p.route_index]-d)})).sort((a,b)=>a.gap-b.gap).slice(0,12)}
function renderPhoto(photo){
 const panel=$("photoPanel");if(!photo){panel.innerHTML='<div class="photo-empty">No photograph within two miles. Pink timeline ticks and map clusters jump directly to photo moments.</div>';return}
 panel.innerHTML=`<img src="${photo.large}" alt="Trip photograph"><div class="photo-meta"><strong>${photo.caption||photo.filename}</strong>${photo.taken_at?new Date(photo.taken_at).toLocaleString():""} · mile ${col("d")[photo.route_index].toFixed(1)}</div>`
}
function renderEvent(i){const near=state.notes.map(n=>({...n,gap:Math.abs(col("d")[n.route_index]-col("d")[i])})).sort((a,b)=>a.gap-b.gap)[0],card=$("eventCard");if(near&&near.gap<3){card.hidden=false;card.innerHTML=`<strong>${near.title}</strong><p>${near.description||""}</p>`}else card.hidden=true}
function setIndex(i,pan=true,forcedPhoto=null){
 const C=state.trip.columns,n=C.d.length;i=Math.max(0,Math.min(n-1,Math.round(i)));state.i=i;$("tripSlider").value=i;
 const stage=state.trip.stages.find(s=>i>=s.start_index&&i<=s.end_index)||state.trip.stages[0];
 marker.setLatLng([C.y[i],C.x[i]]);
 const start=Math.max(stage.start_index,i-3000),step=Math.max(1,Math.ceil((i-start)/1200)),coords=[];for(let j=start;j<=i;j+=step)if(finite(C.y[j]))coords.push([C.y[j],C.x[j]]);if(finite(C.y[i]))coords.push([C.y[i],C.x[i]]);completedLine.setLatLngs(coords);
 if(pan&&state.follow==="local")map.panTo([C.y[i],C.x[i]],{animate:false});else if(pan&&state.follow==="stage"){const pts=[];const st=Math.max(1,Math.ceil((stage.end_index-stage.start_index)/1200));for(let j=stage.start_index;j<=stage.end_index;j+=st)pts.push([C.y[j],C.x[j]]);map.fitBounds(pts,{padding:[24,24]})}
 $("dayBadge").textContent=`Day ${C.a[i]}`;$("location").textContent=`Mile ${C.d[i].toFixed(1)}`;$("clock").textContent=new Date(C.t[i]).toLocaleString();$("coords").textContent=`${C.y[i].toFixed(4)}, ${C.x[i].toFixed(4)}`;
 const [l,r]=boundsForContext(i,state.context),vals={};for(const k of Object.keys(METRICS))vals[k]=mean(k,l,r);
 $("elevation").textContent=`${fmt(vals.e)} ft`;$("grade").textContent=`${fmt(vals.g,1)}%`;$("speed").textContent=`${fmt(vals.s,1)} mph`;$("hr").textContent=`${fmt(vals.h)} bpm`;$("power").textContent=`${fmt(vals.p)} W`;$("cadence").textContent=`${fmt(vals.c)} rpm`;
 $("distance").textContent=`${C.d[i].toFixed(1)} of ${state.trip.total_distance_mi.toFixed(1)} mi`;$("progress").textContent=`${Math.round(C.d[i]/state.trip.total_distance_mi*100)}% complete`;
 Object.keys(METRICS).forEach(k=>{const el=$(`chart-${k}`);if(el)el.textContent=`${fmt(vals[k],k==="s"||k==="g"?1:0)} ${METRICS[k].unit}`});
 const near=nearbyPhotos(i),within=near.filter(p=>p.gap<=2),chosen=forcedPhoto||within[0]||null;renderPhoto(chosen);const strip=$("photoStrip");strip.innerHTML="";near.forEach(p=>{const b=document.createElement("button");b.className="photo-thumb"+(chosen&&p.id===chosen.id?" active":"");b.innerHTML=`<img src="${p.thumb}" alt="${p.filename}">`;b.title=`${p.gap.toFixed(1)} miles away`;b.addEventListener("click",()=>setIndex(p.route_index,true,p));strip.appendChild(b)});
 renderEvent(i);drawCharts()
}
function setupInteractions(){
 $("tripSlider").max=col("d").length-1;$("tripSlider").addEventListener("input",e=>setIndex(+e.target.value));
 $("play").addEventListener("click",()=>{if(state.timer){clearInterval(state.timer);state.timer=null;$("play").textContent="▶ Play";return}const speed=Number($("playSpeed").value);$("play").textContent="❚❚ Pause";state.timer=setInterval(()=>{let next=state.i+Math.max(1,Math.floor(col("d").length/(1000/speed)));if(next>=col("d").length-1){clearInterval(state.timer);state.timer=null;$("play").textContent="▶ Play";next=col("d").length-1}setIndex(next)},65)});
 $("reset").addEventListener("click",()=>{setIndex(0);map.fitBounds(bounds,{padding:[18,18]})});
 document.querySelectorAll(".context-btn").forEach(b=>b.addEventListener("click",()=>{state.context=b.dataset.context;document.querySelectorAll(".context-btn").forEach(x=>x.classList.toggle("active",x===b));setIndex(state.i,false)}));
 addEventListener("resize",()=>requestAnimationFrame(drawCharts))
}
async function start(){
 try{
  $("loadText").textContent="Loading the preprocessed trip database…";
  const [trip,photos,notes]=await Promise.all([fetch("assets/data/trip.json").then(r=>r.json()),fetch("assets/data/photos.json").then(r=>r.json()),fetch("assets/data/notes.json").then(r=>r.json())]);
  state.trip=trip;state.photos=photos;state.notes=notes;matchPhotos();buildPrefixes();$("loading").remove();$("explorer").hidden=false;initMap();setupRibbons();setupChartControls();renderCharts();setupInteractions();setIndex(0,false)
 }catch(err){console.error(err);$("loadText").innerHTML=`Unable to initialize the explorer.<br><small>${err.message}</small>`;$("loading").querySelector(".spinner").style.display="none"}
}
start();
