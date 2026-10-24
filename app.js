'use strict';
const $=id=>document.getElementById(id), center=[24.1796,120.6495], KEY='campus-move-history-v1';
let records=[];try{records=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(records))records=[];}catch{}
let map, route, halo=null, startMarker=null, positionDot, accuracyCircle, targetMarker, targetLine, target=null, current=null;
let session=null, watch=null, demoTimer=null, wake=null, last=null, lastSignal=0, lines=[], storageOK=true;
function message(s){$('message').textContent=s;}
function pinIcon(kind,label){return L.divIcon({className:'map-pin-wrap map-pin-'+kind,html:'<span class="pin-body"><b>'+label+'</b></span>',iconSize:[30,30],iconAnchor:[15,30]});}
function setTrack(lines){if(route)route.setLatLngs(lines);if(halo)halo.setLatLngs(lines);}
function clearStart(){if(startMarker&&map)map.removeLayer(startMarker);startMarker=null;}
function setStart(p){clearStart();if(map)startMarker=L.marker([p.lat,p.lng],{icon:pinIcon('start','起'),zIndexOffset:500}).addTo(map).bindTooltip('起點');}
try{map=L.map('map',{zoomControl:false}).setView(center,17);L.control.zoom({position:'bottomright'}).addTo(map);addBaseMap(map).on('tileerror',()=>message('底圖載入失敗，請檢查網路；Google Maps 圖資載入失敗。'));halo=L.polyline([], {color:'#fffe',weight:9,opacity:.8,lineCap:'round',lineJoin:'round'}).addTo(map);route=L.polyline([], {color:'#d95432',weight:5,lineCap:'round',lineJoin:'round'}).addTo(map);map.on('click',e=>{target={lat:e.latlng.lat,lng:e.latlng.lng};updateTarget();});}catch(err){message('地圖初始化失敗：'+err.message);}
function updateTarget(){if(!target){$('navigate').hidden=true;$('targetInfo').textContent='點一下地圖，設定老師指定的集合點。';return;}let info='集合點已設定（依老師現場路線）';if(current){const d=Math.round(MoveCore.distance(current,target));info+='：距離 '+d+' m';}$('targetInfo').textContent=info;const ll=[target.lat,target.lng];if(!targetMarker)targetMarker=L.marker(ll,{icon:pinIcon('target','終')}).addTo(map).bindTooltip('集合點');else targetMarker.setLatLng(ll);if(!targetLine){targetLine=L.polyline([[current?current.lat:target.lat,current?current.lng:target.lng],target],{color:'#975325',dashArray:'6 4',weight:2}).addTo(map);}else targetLine.setLatLngs([[current?current.lat:target.lat,current?current.lng:target.lng],target]);$('navigate').hidden=false;$('navigate').href='https://www.google.com/maps/dir/?api=1&destination='+target.lat+','+target.lng+'&travelmode=walking';}
function clearTarget(){target=null;for(const l of [targetMarker,targetLine])if(l&&map)map.removeLayer(l);targetMarker=targetLine=null;updateTarget();}
$('clearTarget').onclick=clearTarget;$('campus').onclick=()=>map&&map.setView(center,17);
function displayPosition(p){current=p;if(map){const ll=[p.lat,p.lng];if(!positionDot){positionDot=L.circleMarker(ll,{radius:7,color:'white',weight:3,fillColor:'#2f88b3',fillOpacity:1}).addTo(map);accuracyCircle=L.circle(ll,{radius:p.accuracy,color:'#2f88b3',weight:1,fillOpacity:.08}).addTo(map);}else{positionDot.setLatLng(ll);accuracyCircle.setLatLng(ll).setRadius(p.accuracy);}$('accuracy').textContent=Math.round(p.accuracy)+'m';updateTarget();}}
const GEO_REASONS={1:'定位權限被拒絕：請到瀏覽器／手機設定允許位置與精確定位後重試。',2:'目前無法取得位置，請移到戶外空曠處。',3:'定位逾時，請稍後重試。',4:'目前無法取得位置，請再試一次。'};
function geoError(err){if(session?.state==='running')pause('定位中斷，已暫停。'+(GEO_REASONS[err.code]||'請重試。'));else message(GEO_REASONS[err.code]||'定位失敗。');$('badge').textContent='● 定位不可用';}
function locateError(err){message(GEO_REASONS[err.code]||'定位失敗。');if(!session||session.state!=='running')$('badge').textContent='● 定位不可用';}
async function available(){
  const host = window.location.hostname;
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(host);

  if (!window.isSecureContext && !isLocalhost) {
    const warning = 'GPS 需要 HTTPS 網址（本機 localhost 例外）。請改用 HTTPS 或 http://localhost:8000 後再開始。';
    alert(warning);
    message(warning);
    return false;
  }

  if (!navigator.geolocation) {
    const warning = '此瀏覽器不支援 GPS 定位，無法開始運動。';
    alert(warning);
    message(warning);
    return false;
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') {
        const warning = '位置權限已被拒絕。請在瀏覽器／手機設定中允許「位置」與「精確定位」，再點開始。';
        alert(warning);
        message(warning);
        return false;
      }
    } catch (err) {
      // 某些瀏覽器在隱私政策下不提供 permissions API，忽略此檢查並繼續。
    }
  }

  return true;
}
$('locate').onclick=async()=>{if(session?.demo){message('示範模式使用模擬位置；結束後可取得真實定位。');return;}if(!(await available()))return;message('正在取得你的定位…');navigator.geolocation.getCurrentPosition(pos=>{const p=normalize(pos);displayPosition(p);setStart(p);message('定位成功，現在可以開始運動。');},locateError,{enableHighAccuracy:true,timeout:10000,maximumAge:0});};
function normalize(pos){return {lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,t:pos.timestamp};}
function seconds(){return session?session.seconds+(session.state==='running'&&session.runStart?(Date.now()-session.runStart)/1000:0):0;}
function fmt(n){const s=Math.floor(n);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function render(){document.body.classList.toggle('is-active',!!session&&session.state!=='finished');$('activityLabel').textContent=session?.demo?'示範運動':session?.mode?.split(' · ')[0]||'運動';const s=seconds(),d=session?.meters||0;$('elapsed').textContent=fmt(s);$('distance').textContent=(d/1000).toFixed(2);$('calories').textContent=Math.round(MoveCore.calories(session?.met||3.5,session?.weight||0,s));$('speed').textContent=s>0?(d/s/3.6).toFixed(1):'0.0';$('points').textContent=session?.points?.length||0;$('badge').textContent=session?session.state==='running'?'● 紀錄中':'● 已暫停':'● 定位不可用';$('finish').disabled=!session||session.state==='finished';$('pause').disabled=!session||session.state==='finished';}
async function holdScreen(){try{if('wakeLock'in navigator)wake=await navigator.wakeLock.request('screen');}catch{} }
function stopWatch(){if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}clearInterval(demoTimer);demoTimer=null;wake?.release().catch(()=>{});wake=null;}
function receive(p){if(!session||session.state!=='running')return;lastSignal=Date.now();displayPosition(p);const result=MoveCore.accept(last,p);if(!result.ok){message(result.reason);return;}if(!session.runStart)session.runStart=Date.now();if(!last){last=p;return;}if(result.break){if(last){lines.push([last.lat,last.lng]);}lines.push([p.lat,p.lng]);last=p;return;}session.meters=(session.meters||0)+result.meters;session.points.push({lat:p.lat,lng:p.lng,t:p.t,accuracy:p.accuracy,segment:lines.length});last=p;setTrack(lines);}
function run(){session.state='running';session.runStart=0;last=null;lastSignal=Date.now();if(session.demo){demoTick();demoTimer=setInterval(demoTick,1000);}else{watch=navigator.geolocation.watchPosition(pos=>{const p=normalize(pos);receive(p);},err=>geoError(err),{enableHighAccuracy:true,timeout:20000,maximumAge:1000});holdScreen();}render();}
async function begin(demo){const fields=demo?['height','weight','age'].map($):[$('profile')];if(!fields.every(el=>el.reportValidity()))return;if(!demo&&!(await available()))return;$('setupDialog').close();stopWatch();session={id:Date.now(),date:new Date().toISOString(),alias:$('alias').value.trim(),demo,demoIndex:0,mode:$('mode').value,met:Number($('met').value)||3.5,height:Number($('height').value)||0,weight:Number($('weight').value)||0,age:Number($('age').value)||0,seconds:0,meters:0,points:[],state:'ready',runStart:0};lines=[];setTrack([]);clearStart();$('badge').textContent='● 等待定位';message(demo?'示範模式已啟動，現在會使用模擬位置。':'開始運動，請允許定位權限後開始紀錄。');run();}
$('profile').onsubmit=e=>{e.preventDefault();begin(false);};$('demo').onclick=()=>begin(true);
function demoTick(){const i=session.demoIndex++,angle=i*.12;session.seconds+=5;receive({lat:center[0]+.00062*Math.sin(angle),lng:center[1]+.00085*Math.cos(angle),accuracy:6,t:session.id+i*6000});}
function pause(reason){if(!session||session.state!=='running')return;session.seconds=seconds();session.runStart=0;session.state='paused';stopWatch();last=null;$('badge').textContent='● 已暫停';if(reason)message(reason);render();}
$('pause').onclick=()=>{if(session.state==='running')pause();else {message('等待新的有效定位後繼續…');run();}};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(records));storageOK=true;}catch{storageOK=false;message('裝置儲存空間不足或儲存被封鎖。紀錄暫留本頁，請先匯出。');}}
function buildSummary(points, seconds) {
  const stats = MoveCore.analyzeTrack(Array.isArray(points) ? points : [], Number(seconds) || 0);
  return {
    avgSpeed: Number.isFinite(stats.avgSpeed) ? Number(stats.avgSpeed) : 0,
    segments: Number.isFinite(stats.segments) ? Number(stats.segments) : 0,
    lineDistance: Number.isFinite(stats.lineDistance) ? Number(stats.lineDistance) : 0,
    maxAdjacentSpeed: Number.isFinite(stats.maxAdjacentSpeed) ? Number(stats.maxAdjacentSpeed) : 0
  };
}
function finalizeRecord(record) {
  const points = Array.isArray(record.points) ? record.points : [];
  const summary = buildSummary(points, record.seconds);
  return {
    ...record,
    summary,
    metadata: {
      ...record.metadata,
      ...summary
    }
  };
}
function exportTrackJSON(record) {
  const payload = finalizeRecord(record);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const safeName = (record.alias || 'campus-move').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campus-move';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-track.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('finish').onclick=()=>{if(!session||session.state==='finished')return;session.seconds=seconds();session.runStart=0;session.state='finished';stopWatch();session.kcal=MoveCore.calories(session.met,session.weight,session.seconds);const summary=buildSummary(session.points,session.seconds);const record={...session,points:session.points.slice(),meters:session.meters||0,seconds:session.seconds,date:new Date().toISOString(),summary,metadata:{...summary}};records.unshift(record);persist();renderHistory();render();message('紀錄已完成，請匯出 CSV / JSON。');};
function download(name,body,type){
  const isCsv = !!(type && type.toLowerCase().includes('csv'));
  const safeBody = isCsv && !body.startsWith('\uFEFF') ? '\uFEFF' + body : body;

  const blob = new Blob([safeBody], {
    type: isCsv ? 'text/csv;charset=utf-8;' : (type || 'text/plain;charset=utf-8;')
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function exportCSV(items){if(!items.length){message('目前沒有可匯出的紀錄。');return;}const headers=['時間 ISO','課堂代號','類型','活動','身高 cm','體重 kg','年齡','秒數','距離 m','熱量 kcal','平均速度 km/h','段數','起點到終點直線距離 m','最快相鄰點速度 m/s'];const rows=items.map(item=>{const points=Array.isArray(item.points)?item.points:[];const summary=buildSummary(points,Number(item.seconds)||0);const row=[item.date||'',item.alias||'',item.demo?'demo':'real',item.mode||'',item.height??'',item.weight??'',item.age??'',item.seconds??'',item.meters??'',item.kcal??'',summary.avgSpeed,summary.segments,summary.lineDistance,summary.maxAdjacentSpeed];return row.map(cell).join(',');});const csvContent='\uFEFF'+headers.map(cell).join(',')+'\n'+rows.join('\n');download('campus-move-summary.csv',csvContent,'text/csv;charset=utf-8;');}
let historyFilter='all';
function routeThumbnail(r){const box=document.createElement('div');box.className='route-thumb';const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 67');const pts=r.points||[];if(pts.length>1){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){minX=Math.min(minX,p.lng);maxX=Math.max(maxX,p.lng);minY=Math.min(minY,p.lat);maxY=Math.max(maxY,p.lat);}const sx=(x)=>((x-minX)/(maxX-minX||1))*90;const sy=(y)=>((maxY-y)/(maxY-minY||1))*35+16;for(const s of new Set(pts.map(p=>p.segment||0))){const seg=pts.filter(p=>(p.segment||0)===s);if(seg.length<2)continue;const path=document.createElementNS(ns,'path');path.setAttribute('d',seg.map((p,i)=>`${i?' ':'M'}${sx(p.lng)} ${sy(p.lat)}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#d95432');path.setAttribute('stroke-width',2.5);path.setAttribute('stroke-linecap','round');svg.appendChild(path);}}else{const t=document.createElementNS(ns,'text');t.setAttribute('x','50');t.setAttribute('y','35');t.setAttribute('text-anchor','middle');t.setAttribute('fill','#999');t.setAttribute('font-size','8');t.textContent='無路線';svg.appendChild(t);}box.appendChild(svg);return box;}
function renderHistory(){const root=$('records');root.replaceChildren();const actual=records.filter(r=>!r.demo);$('historyTotal').textContent=actual.length?`${actual.length} 次運動 · ${(actual.reduce((s,r)=>s+r.meters,0)/1000).toFixed(2)} km`:'0 次運動';const shown=records.filter(r=>historyFilter==='all'||(historyFilter==='real')===!r.demo);if(!shown.length){root.innerHTML='<div class="empty"><div class="empty-art"><svg><use href="#i-route"/></svg></div><div><h3>還沒有紀錄</h3><p>開始運動後，紀錄會出現在這裡。</p></div></div>';return;}for(const r of shown){const row=document.createElement('div');row.className='record';row.appendChild(routeThumbnail(r));const info=document.createElement('div');info.className='record-info';const title=document.createElement('strong');title.textContent=r.alias||r.mode||'運動';const sub=document.createElement('small');sub.textContent=new Date(r.date||Date.now()).toLocaleString('zh-TW');info.appendChild(title,sub);const stats=document.createElement('div');stats.className='record-stats';for(const [label,value] of [['距離',(r.meters||0)/1000+' km'],['時間',Math.round(r.seconds||0)+' s'],['熱量',Math.round(r.kcal||0)+' kcal']]){const item=document.createElement('span');item.textContent=`${label} ${value}`;stats.appendChild(item);}info.appendChild(stats);const actions=document.createElement('div');actions.className='record-actions';const exportBtn=document.createElement('button');exportBtn.textContent='匯出 CSV';exportBtn.onclick=()=>exportCSV([r]);const exportJsonBtn=document.createElement('button');exportJsonBtn.textContent='匯出 JSON';exportJsonBtn.onclick=()=>exportTrackJSON(r);const delBtn=document.createElement('button');delBtn.textContent='刪除';delBtn.onclick=()=>{records=records.filter(x=>x!==r);persist();renderHistory();};actions.appendChild(exportBtn,exportJsonBtn,delBtn);row.appendChild(info,stats,actions);root.appendChild(row);}}
$('openSetup').onclick=()=>$('setupDialog').showModal();$('closeSetup').onclick=()=>$('setupDialog').close();$('energyInfo').onclick=()=>$('energyDialog').showModal();$('closeEnergy').onclick=()=>$('energyDialog').close();$('todayDate').textContent=new Date().toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'});document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{historyFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===button));renderHistory();});$('exportAll').onclick=()=>exportCSV(records);$('deleteAll').onclick=()=>{if(records.length&&confirm('確定要刪除全部紀錄嗎？')){records=[];persist();renderHistory();}};document.addEventListener('visibilitychange',()=>{if(document.hidden&&session?.state==='running')pause('畫面已切換，已暫停 GPS 紀錄。');});window.addEventListener('beforeunload',e=>{if(session&&session.state==='running'){e.preventDefault();e.returnValue='';}});setInterval(()=>{if(session?.state==='running'&&Date.now()-lastSignal>30000)pause('GPS 訊號過久未更新，已暫停。');render();},1000);renderHistory();render();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});document.querySelectorAll('.sidenav a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.sidenav a').forEach(n=>n.classList.toggle('active',n===a));}));
