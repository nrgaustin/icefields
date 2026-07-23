
import { Decoder, Stream } from "https://cdn.jsdelivr.net/npm/@garmin/fitsdk@21.208.0/+esm";

const COLORS=["#2f6fed","#00a878","#f59e0b","#ef4444","#8b5cf6","#0891b2","#db2777","#65a30d"];
const METRICS={
  altitude:{label:"Elevation",unit:"ft",color:"#5a6f87",default:true},
  grade:{label:"Grade",unit:"%",color:"#a35c21",default:true},
  speed:{label:"Speed",unit:"mph",color:"#167a8b",default:true},
  heartRate:{label:"Heart rate",unit:"bpm",color:"#b63b4b",default:true},
  power:{label:"Power",unit:"W",color:"#6e4aad",default:true},
  cadence:{label:"Cadence",unit:"rpm",color:"#32734a",default:false}
};
const state={records:[],stages:[],photos:[],notes:[],index:0,playing:false,timer:null,context:"instant",follow:"local",visible:new Set(Object.keys(METRICS).filter(k=>METRICS[k].default))};

const $=id=>document.getElementById(id);
const finite=v=>Number.isFinite(v);
const semiToDeg=v=>Math.abs(v)>180?v*(180/2147483648):v;
const mph=v=>finite(v)?v*2.236936:null;
const ft=v=>finite(v)?v*3.28084:null;

function getRecordMessages(messages){
  return messages.recordMesgs || messages.record_mesgs || messages.records || messages.record || [];
}
function field(o,...keys){for(const k of keys){if(o && o[k]!==undefined && o[k]!==null)return o[k]}return null}
async function decodeFile(item){
  const buffer=await fetch(item.file).then(r=>{if(!r.ok)throw new Error(`Could not load ${item.file}`);return r.arrayBuffer()});
  const decoder=new Decoder(Stream.fromArrayBuffer(buffer));
  const {messages,errors}=decoder.read({mergeHeartRates:true});
  if(errors?.length) console.warn(item.file,errors);
  const raw=getRecordMessages(messages);
  return raw.map((r,i)=>{
    let ts=field(r,"timestamp","timeStamp");
    if(ts && !(ts instanceof Date)) ts=new Date(ts);
    let lat=field(r,"positionLat","position_lat"),lon=field(r,"positionLong","position_long");
    if(finite(lat))lat=semiToDeg(lat);if(finite(lon))lon=semiToDeg(lon);
    const altitude=field(r,"enhancedAltitude","altitude","enhanced_altitude");
    const speed=field(r,"enhancedSpeed","speed","enhanced_speed");
    return {
      day:item.day,file:item.label,sourceIndex:i,
      timestamp:ts instanceof Date && !isNaN(ts)?ts:null,
      lat:finite(lat)?lat:null,lon:finite(lon)?lon:null,
      altitude:ft(Number(altitude)),
      speed:mph(Number(speed)),
      heartRate:Number(field(r,"heartRate","heart_rate")),
      power:Number(field(r,"power")),
      cadence:Number(field(r,"cadence")),
      temperature:Number(field(r,"temperature")),
      fileDistanceM:Number(field(r,"distance"))
    };
  }).filter(r=>r.timestamp||finite(r.lat)||finite(r.fileDistanceM));
}
function median(arr){const a=arr.filter(finite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function hav(lat1,lon1,lat2,lon2){const R=6371000,p1=lat1*Math.PI/180,p2=lat2*Math.PI/180,dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180;const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function processRecords(fileSets,summary){
  const out=[];let tripOffsetM=0,lastDay=null,stageStart=0;
  fileSets.forEach((records,fileIdx)=>{
    if(!records.length)return;
    const day=records[0].day;
    let firstD=records.find(r=>finite(r.fileDistanceM))?.fileDistanceM||0;
    let prior=null,geoDistance=0;
    records.forEach((r,j)=>{
      let localM=finite(r.fileDistanceM)?Math.max(0,r.fileDistanceM-firstD):null;
      if(localM===null && prior&&finite(r.lat)&&finite(prior.lat))geoDistance+=hav(prior.lat,prior.lon,r.lat,r.lon);
      r.distanceMi=(tripOffsetM+(localM??geoDistance))/1609.344;
      r.index=out.length;
      out.push(r);prior=r;
    });
    const last=records[records.length-1],fileM=((finite(last.fileDistanceM)?last.fileDistanceM-firstD:geoDistance)||0);
    tripOffsetM+=Math.max(0,fileM);
  });
  // Scale to Garmin's known total, preserving actual within-file variation.
  const totalKnown=summary.filter(x=>x.Day!=="Total").reduce((s,x)=>s+Number(x["Distance (mi)"]),0);
  const rawTotal=out.at(-1)?.distanceMi||totalKnown;
  const scale=rawTotal?totalKnown/rawTotal:1;
  out.forEach(r=>r.distanceMi*=scale);
  // Moving time and grade.
  let movingS=0;
  out.forEach((r,i)=>{
    if(i>0){
      const p=out[i-1],dt=(r.timestamp&&p.timestamp)?(r.timestamp-p.timestamp)/1000:0;
      if(dt>0&&dt<30&&r.day===p.day){r.deltaS=dt;if((r.speed||0)>0.5)movingS+=dt}else r.deltaS=0;
    }else r.deltaS=0;
    r.tripMovingS=movingS;
  });
  // Grade over roughly +/- 75 m.
  let left=0,right=0;
  out.forEach((r,i)=>{
    while(left<i && (r.distanceMi-out[left].distanceMi)*1609.344>75)left++;
    if(right<i)right=i;
    while(right+1<out.length && (out[right+1].distanceMi-r.distanceMi)*1609.344<75 && out[right+1].day===r.day)right++;
    const a=out[left],b=out[right],run=(b.distanceMi-a.distanceMi)*1609.344;
    r.grade=run>25&&finite(a.altitude)&&finite(b.altitude)?((b.altitude-a.altitude)/3.28084)/run*100:null;
  });
  // Stage boundaries.
  const stages=[];
  for(let day=1;day<=8;day++){
    const inds=out.map((r,i)=>r.day===day?i:-1).filter(i=>i>=0);
    const row=summary.find(x=>String(x.Day)===String(day));
    if(inds.length)stages.push({day,start:inds[0],end:inds.at(-1),startMi:out[inds[0]].distanceMi,endMi:out[inds.at(-1)].distanceMi,summary:row});
  }
  return {records:out,stages,totalKnown};
}
function avg(records,key){const a=records.map(r=>r[key]).filter(finite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
function windowRecords(i,mode){
  const r=state.records[i];
  if(mode==="instant")return [r];
  if(mode==="mile")return state.records.filter(x=>x.day===r.day&&Math.abs(x.distanceMi-r.distanceMi)<=.5);
  if(mode==="hour"&&r.timestamp)return state.records.filter(x=>x.day===r.day&&x.timestamp&&Math.abs(x.timestamp-r.timestamp)<=1800000);
  if(mode==="stage")return state.records.filter(x=>x.day===r.day);
  return state.records;
}
function nearestIndexByLatLng(latlng){
  let best=0,bd=Infinity;
  state.records.forEach((r,i)=>{if(finite(r.lat)){const d=map.distance(latlng,[r.lat,r.lon]);if(d<bd){bd=d;best=i}}});
  return best;
}
function nearestIndexByDistance(mi){
  let lo=0,hi=state.records.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(state.records[mid].distanceMi<mi)lo=mid+1;else hi=mid}
  return lo;
}
function nearestPhotos(i,limit=12){
  const r=state.records[i];
  return state.photos.filter(p=>p.matchedIndex!=null).map(p=>({...p,gapMi:Math.abs(state.records[p.matchedIndex].distanceMi-r.distanceMi)})).sort((a,b)=>a.gapMi-b.gapMi).slice(0,limit);
}
function matchPhotos(){
  state.photos.forEach(p=>{
    if(!finite(p.lat)||!finite(p.lon)){p.matchedIndex=null;return}
    let best=null,bd=Infinity;
    state.records.forEach((r,i)=>{if(finite(r.lat)&&r.day===(p.day||r.day)){const d=hav(p.lat,p.lon,r.lat,r.lon);if(d<bd){bd=d;best=i}}});
    p.matchedIndex=best;p.routeOffsetM=bd;
  });
}
function matchNotes(){
  state.notes.forEach(n=>{n.matchedIndex=finite(Number(n.distance_mi))?nearestIndexByDistance(Number(n.distance_mi)):0});
}
let map,marker,completedLine,remainingLine,photoLayer,eventLayer,routeBounds;
function initMap(){
  map=L.map("map",{zoomControl:true});
  const topo=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
  routeBounds=L.latLngBounds(state.records.filter(r=>finite(r.lat)).map(r=>[r.lat,r.lon]));
  state.stages.forEach((s,i)=>{
    const coords=state.records.slice(s.start,s.end+1).filter(r=>finite(r.lat)).map(r=>[r.lat,r.lon]);
    L.polyline(coords,{color:COLORS[i],weight:5,opacity:.7}).addTo(map).bindTooltip(`Day ${s.day}`);
  });
  marker=L.circleMarker([state.records[0].lat,state.records[0].lon],{radius:8,color:"#fff",weight:3,fillColor:"#111",fillOpacity:1}).addTo(map);
  completedLine=L.polyline([],{color:"#111",weight:6,opacity:.85}).addTo(map);
  photoLayer=L.layerGroup().addTo(map);eventLayer=L.layerGroup().addTo(map);
  // Cluster photos into 0.5-mile groups to keep the route visible.
  const clusters=[];
  state.photos.filter(p=>p.matchedIndex!=null).sort((a,b)=>a.matchedIndex-b.matchedIndex).forEach(p=>{
    const mi=state.records[p.matchedIndex].distanceMi,last=clusters.at(-1);
    if(last&&mi-last.centerMi<.5){last.photos.push(p);last.centerMi=(last.centerMi*(last.photos.length-1)+mi)/last.photos.length}
    else clusters.push({centerMi:mi,photos:[p]});
  });
  clusters.forEach(c=>{
    const idx=nearestIndexByDistance(c.centerMi),r=state.records[idx];
    if(!finite(r.lat))return;
    const icon=L.divIcon({className:"",html:`<div style="background:#d93d70;color:white;border:2px solid white;border-radius:14px;padding:3px 7px;font:700 11px system-ui;box-shadow:0 2px 7px #0004">📷 ${c.photos.length}</div>`,iconAnchor:[18,14]});
    L.marker([r.lat,r.lon],{icon}).addTo(photoLayer).on("click",()=>setIndex(idx,true,c.photos[0]));
  });
  state.notes.forEach(n=>{const r=state.records[n.matchedIndex];if(finite(r.lat))L.circleMarker([r.lat,r.lon],{radius:6,color:"#fff",weight:2,fillColor:"#111",fillOpacity:1}).addTo(eventLayer).bindTooltip(n.title).on("click",()=>setIndex(n.matchedIndex))});
  map.fitBounds(routeBounds,{padding:[18,18]});
  map.on("click",e=>setIndex(nearestIndexByLatLng(e.latlng)));
  document.querySelectorAll("[data-follow]").forEach(b=>b.addEventListener("click",()=>{state.follow=b.dataset.follow;document.querySelectorAll("[data-follow]").forEach(x=>x.classList.toggle("active",x===b));if(state.follow==="trip")map.fitBounds(routeBounds,{padding:[18,18]})}));
}
function setupRibbons(){
  const total=state.records.at(-1).distanceMi;
  const stage=$("stageRibbon");stage.innerHTML="";
  state.stages.forEach((s,i)=>{const el=document.createElement("span");el.style.width=`${(s.endMi-s.startMi)/total*100}%`;el.style.background=COLORS[i];stage.appendChild(el)});
  const events=$("eventRibbon");events.innerHTML="";
  state.photos.filter(p=>p.matchedIndex!=null).forEach(p=>{const b=document.createElement("button");b.className="photo-mark";b.title=p.filename;b.style.left=`${state.records[p.matchedIndex].distanceMi/total*100}%`;b.addEventListener("click",()=>setIndex(p.matchedIndex,true,p));events.appendChild(b)});
  state.notes.forEach(n=>{const b=document.createElement("button");b.className="event-mark";b.title=n.title;b.style.left=`${state.records[n.matchedIndex].distanceMi/total*100}%`;b.addEventListener("click",()=>setIndex(n.matchedIndex));events.appendChild(b)});
}
function setupChartControls(){
  const c=$("chartControls");c.innerHTML="";
  Object.entries(METRICS).forEach(([key,m])=>{const b=document.createElement("button");b.className="chart-toggle"+(state.visible.has(key)?" active":"");b.textContent=m.label;b.addEventListener("click",()=>{state.visible.has(key)?state.visible.delete(key):state.visible.add(key);b.classList.toggle("active");renderCharts()});c.appendChild(b)});
}
function renderCharts(){
  const host=$("charts");host.innerHTML="";
  for(const key of state.visible){
    const m=METRICS[key],row=document.createElement("div");row.className="chart-row";
    row.innerHTML=`<div class="chart-name">${m.label}<span>${m.unit}</span></div><canvas class="chart-canvas" data-key="${key}"></canvas><div class="chart-value" id="chart-${key}">—</div>`;
    host.appendChild(row);
    const canvas=row.querySelector("canvas");canvas.addEventListener("pointerdown",chartPointer);canvas.addEventListener("pointermove",e=>{if(e.buttons)chartPointer(e)});
  }
  requestAnimationFrame(drawCharts);
}
function chartPointer(e){const rect=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));setIndex(Math.round(x/rect.width*(state.records.length-1)))}
function drawCharts(){
  document.querySelectorAll(".chart-canvas").forEach(canvas=>{
    const key=canvas.dataset.key,m=METRICS[key],rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
    canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));
    const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);const W=rect.width,H=rect.height;
    const vals=state.records.map(r=>r[key]).filter(finite),lo=Math.min(...vals),hi=Math.max(...vals),range=(hi-lo)||1;
    ctx.clearRect(0,0,W,H);ctx.strokeStyle="#dce3e7";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H-1);ctx.lineTo(W,H-1);ctx.stroke();
    // stage background bands
    state.stages.forEach((s,i)=>{ctx.fillStyle=COLORS[i]+"12";ctx.fillRect(s.start/(state.records.length-1)*W,0,(s.end-s.start)/(state.records.length-1)*W,H)});
    ctx.strokeStyle=m.color;ctx.lineWidth=1.4;ctx.beginPath();let started=false;
    const step=Math.max(1,Math.ceil(state.records.length/W));
    for(let i=0;i<state.records.length;i+=step){const v=state.records[i][key];if(!finite(v)){started=false;continue}const x=i/(state.records.length-1)*W,y=H-4-(v-lo)/range*(H-8);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)}
    ctx.stroke();
    const i=state.index,v=state.records[i][key],x=i/(state.records.length-1)*W;
    ctx.strokeStyle="#111";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
    if(finite(v)){const y=H-4-(v-lo)/range*(H-8);ctx.fillStyle="#111";ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill()}
  });
}
function fmt(v,d=0){return finite(v)?v.toFixed(d):"—"}
function renderPhoto(photo){
  const panel=$("photoPanel");
  if(!photo){panel.innerHTML='<div class="photo-empty">No photograph within two miles of this point. Use the pink timeline marks or map clusters to jump to photo moments.</div>';return}
  panel.innerHTML=`<img src="${photo.large}" alt="Trip photograph"><div class="photo-meta"><strong>${photo.caption||photo.filename}</strong>${photo.taken_at?new Date(photo.taken_at).toLocaleString():""} · mile ${state.records[photo.matchedIndex].distanceMi.toFixed(1)}</div>`;
}
function renderEvent(i){
  const nearby=state.notes.map(n=>({...n,gap:Math.abs(n.matchedIndex-i)})).sort((a,b)=>a.gap-b.gap)[0],card=$("eventCard");
  if(nearby&&Math.abs(state.records[nearby.matchedIndex].distanceMi-state.records[i].distanceMi)<3){card.hidden=false;card.innerHTML=`<strong>${nearby.title}</strong><p>${nearby.description||""}</p>`}else card.hidden=true;
}
function setIndex(i,pan=true,forcedPhoto=null){
  i=Math.max(0,Math.min(state.records.length-1,Math.round(i)));state.index=i;$("tripSlider").value=i;
  const r=state.records[i],stage=state.stages.find(s=>i>=s.start&&i<=s.end)||state.stages[0];
  marker.setLatLng([r.lat,r.lon]);
  const completed=state.records.slice(Math.max(0,i-2500),i+1).filter(x=>finite(x.lat)).map(x=>[x.lat,x.lon]);completedLine.setLatLngs(completed);
  if(pan&&state.follow==="local")map.panTo([r.lat,r.lon],{animate:false});else if(pan&&state.follow==="stage"){const coords=state.records.slice(stage.start,stage.end+1).filter(x=>finite(x.lat)).map(x=>[x.lat,x.lon]);map.fitBounds(coords,{padding:[24,24]})}
  $("dayBadge").textContent=`Day ${r.day}`;$("location").textContent=`Mile ${r.distanceMi.toFixed(1)}`;
  $("clock").textContent=r.timestamp?r.timestamp.toLocaleString():"Recorded position";$("coords").textContent=`${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`;
  const wr=windowRecords(i,state.context);
  const metricData={altitude:avg(wr,"altitude"),grade:avg(wr,"grade"),speed:avg(wr,"speed"),heartRate:avg(wr,"heartRate"),power:avg(wr,"power"),cadence:avg(wr,"cadence")};
  $("elevation").textContent=`${fmt(metricData.altitude)} ft`;$("grade").textContent=`${fmt(metricData.grade,1)}%`;$("speed").textContent=`${fmt(metricData.speed,1)} mph`;$("hr").textContent=`${fmt(metricData.heartRate)} bpm`;$("power").textContent=`${fmt(metricData.power)} W`;$("cadence").textContent=`${fmt(metricData.cadence)} rpm`;
  $("distance").textContent=`${r.distanceMi.toFixed(1)} of ${state.records.at(-1).distanceMi.toFixed(1)} mi`;$("progress").textContent=`${Math.round(i/(state.records.length-1)*100)}% of recorded points`;
  Object.keys(METRICS).forEach(k=>{const el=$(`chart-${k}`);if(el)el.textContent=`${fmt(metricData[k],k==="speed"||k==="grade"?1:0)} ${METRICS[k].unit}`});
  const near=nearestPhotos(i),within=near.filter(p=>p.gapMi<=2),chosen=forcedPhoto||within[0]||null;renderPhoto(chosen);
  const strip=$("photoStrip");strip.innerHTML="";near.forEach(p=>{const b=document.createElement("button");b.className="photo-thumb"+(chosen&&p.id===chosen.id?" active":"");b.innerHTML=`<img src="${p.thumb}" alt="${p.filename}">`;b.title=`${p.gapMi.toFixed(1)} miles away`;b.addEventListener("click",()=>setIndex(p.matchedIndex,true,p));strip.appendChild(b)});
  renderEvent(i);drawCharts();
}
function setupInteractions(){
  $("tripSlider").max=state.records.length-1;$("tripSlider").addEventListener("input",e=>setIndex(+e.target.value));
  $("play").addEventListener("click",()=>{if(state.timer){clearInterval(state.timer);state.timer=null;$("play").textContent="▶ Play";return}const speed=Number($("playSpeed").value);$("play").textContent="❚❚ Pause";state.timer=setInterval(()=>{let n=state.index+Math.max(1,Math.floor(state.records.length/(900/speed)));if(n>=state.records.length-1){clearInterval(state.timer);state.timer=null;$("play").textContent="▶ Play";n=state.records.length-1}setIndex(n)},65)});
  $("reset").addEventListener("click",()=>{setIndex(0);map.fitBounds(routeBounds,{padding:[18,18]})});
  document.querySelectorAll(".context-btn").forEach(b=>b.addEventListener("click",()=>{state.context=b.dataset.context;document.querySelectorAll(".context-btn").forEach(x=>x.classList.toggle("active",x===b));setIndex(state.index,false)}));
  addEventListener("resize",()=>requestAnimationFrame(drawCharts));
}
async function start(){
  try{
    const [manifest,summary,photos,notes]=await Promise.all([
      fetch("assets/data/fit_manifest.json").then(r=>r.json()),
      fetch("assets/data/daily_summary.json").then(r=>r.json()),
      fetch("assets/data/photos.json").then(r=>r.json()),
      fetch("assets/data/notes.json").then(r=>r.json())
    ]);
    $("loadText").textContent="Decoding nine Garmin FIT files…";
    const fileSets=[];for(let i=0;i<manifest.length;i++){$("loadText").textContent=`Decoding Garmin file ${i+1} of ${manifest.length}…`;fileSets.push(await decodeFile(manifest[i]))}
    const processed=processRecords(fileSets,summary);state.records=processed.records;state.stages=processed.stages;state.photos=photos;state.notes=notes;
    matchPhotos();matchNotes();$("loading").remove();$("explorer").hidden=false;
    initMap();setupRibbons();setupChartControls();renderCharts();setupInteractions();setIndex(0,false);
  }catch(err){console.error(err);$("loadText").innerHTML=`Unable to initialize the FIT-data explorer.<br><small>${err.message}</small>`;$("loading").querySelector(".spinner").style.display="none"}
}
start();
