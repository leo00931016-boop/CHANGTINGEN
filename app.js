'use strict';
const $=id=>document.getElementById(id), center=[24.1796,120.6495], KEY='campus-move-history-v1';
let records=[]; try { records=JSON.parse(localStorage.getItem(KEY)||'[]'); if(!Array.isArray(records)) records=[]; } catch {}
let session=null, last=null, lastSignal=0, historyFilter='all';

function message(s){ const el=$('message'); if(el) el.textContent=s; }
function download(name, body, type){
  const url=URL.createObjectURL(new Blob([body], {type}));
  const a=document.createElement('a');
  a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function cell(v){
  let s=String(v ?? '');
  if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
function buildExportStats(record){
  const validPoints = Array.isArray(record?.points)
    ? record.points.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    : [];
  const durationSec = Number.isFinite(record?.seconds) ? Math.max(0, Number(record.seconds)) : 0;
  const stats = MoveCore.analyzeTrack(validPoints, durationSec);
  return {
    avgSpeed: Number(stats.avgSpeed || 0),
    segments: Number(stats.segments || 0),
    lineDistance: Number(stats.lineDistance || 0),
    maxAdjacentSpeed: Number(stats.maxAdjacentSpeed || 0)
  };
}
function exportCSV(items){
  if(!items.length){ message('目前沒有可匯出的紀錄。'); return; }
  const rows=[[
    '時間 ISO',
    '課堂代號',
    '類型',
    '活動',
    '身高 cm',
    '體重 kg',
    '年齡',
    '時間 (秒)',
    '距離 (m)',
    '卡路里',
    '平均速度 (km/h)',
    '段數 (段)',
    '起點到終點直線距離 (m)',
    '最快相鄰點速度 (m/s)'
  ]];
  for(const r of items){
    const stats=buildExportStats(r);
    rows.push([
      r.date || '',
      r.alias || '',
      r.type || '',
      r.mode || '',
      r.height || '',
      r.weight || '',
      r.age || '',
      Number(r.seconds || 0).toFixed(0),
      Number(r.meters || 0).toFixed(1),
      Number(r.kcal || 0).toFixed(1),
      Number(stats.avgSpeed || 0).toFixed(2),
      Number(stats.segments || 0).toFixed(0),
      Number(stats.lineDistance || 0).toFixed(2),
      Number(stats.maxAdjacentSpeed || 0).toFixed(2)
    ]);
  }
  const csv = rows.map(row => row.map(cell).join(',')).join('\r\n');
  download('campus-move.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
}
function persist(){
  try { localStorage.setItem(KEY, JSON.stringify(records)); }
  catch { message('裝置儲存空間不足或儲存被封鎖。'); }
}
function renderHistory(){
  const root=$('records');
  if(!root) return;
  root.replaceChildren();
  const actual=records.filter(r=>!r.demo);
  $('historyTotal').textContent = actual.length ? `${actual.length} 次運動 · ${(actual.reduce((s,r)=>s + (Number(r.meters)||0),0)/1000).toFixed(2)} km` : '0 筆紀錄';
  const shown = records.filter(r => historyFilter === 'all' || (historyFilter === 'real' ? !r.demo : r.demo));
  if(!shown.length){
    root.innerHTML='<div class="empty"><div class="empty-art"><svg><use href="#i-route"/></svg></div><div><h3>還沒有紀錄</h3><p>完成一次 GPS 運動後，紀錄會出現在這裡。</p></div></div>';
    return;
  }
  for(const r of shown){
    const row=document.createElement('div'); row.className='record';
    const info=document.createElement('div'); info.className='record-info';
    const title=document.createElement('strong'); title.textContent = r.demo ? '示範運動' : (r.alias || '無名稱') + ' · ' + (r.mode || '步行');
    const sub=document.createElement('small'); sub.textContent = new Date(r.date || Date.now()).toLocaleString('zh-TW');
    const stats=document.createElement('div'); stats.className='record-stats';
    const values=[
      [`${((Number(r.meters)||0)/1000).toFixed(2)} km`,'距離'],
      [`${Math.round(Number(r.kcal)||0)} kcal`,'熱量'],
      [`${Math.max(0, Math.round((Number(r.seconds)||0)/60))} 分`,'時間']
    ];
    for(const [value,label] of values){
      const item=document.createElement('span');
      item.textContent=value;
      const unit=document.createElement('small'); unit.textContent=label; item.append(unit);
      stats.append(item);
    }
    const actions=document.createElement('div'); actions.className='record-actions';
    const exportDataBtn=document.createElement('button'); exportDataBtn.textContent='匯出資料';
    exportDataBtn.onclick=()=>{
      const exportRecord={...r, ...buildExportStats(r)};
      download('campus-track.json', JSON.stringify(exportRecord, null, 2), 'application/json');
    };
    const exportCsvBtn=document.createElement('button'); exportCsvBtn.textContent='匯出 CSV'; exportCsvBtn.onclick=()=>exportCSV([r]);
    const deleteBtn=document.createElement('button'); deleteBtn.textContent='刪除';
    deleteBtn.onclick=()=>{ records=records.filter(x=>x!==r); persist(); renderHistory(); };
    actions.append(exportDataBtn, exportCsvBtn, deleteBtn);
    info.append(title, sub, stats);
    row.append(info, actions);
    root.append(row);
  }
}

$('exportAll')?.addEventListener('click', ()=> exportCSV(records));
$('deleteAll')?.addEventListener('click', ()=>{ if(records.length&&confirm('永久刪除此裝置全部運動紀錄？')){ records=[]; persist(); renderHistory(); }});
document.querySelectorAll('[data-filter]').forEach(button => {
  button.onclick = () => {
    historyFilter = button.dataset.filter || 'all';
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b === button));
    renderHistory();
  };
});
renderHistory();
