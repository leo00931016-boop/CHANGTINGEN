(function(root){
const rad=n=>n*Math.PI/180;
function distance(a,b){const dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function calories(met,kg,seconds){return met*3.5*kg/200*seconds/60;}
function accept(previous,p){
if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!Number.isFinite(p.t)||!Number.isFinite(p.accuracy)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||p.accuracy<0||p.accuracy>20)return {ok:false,reason:'GPS 精度不符合門檻：'+p.accuracy+'m'};
if(!previous)return {ok:true,meters:0,break:true};
const dt=(p.t-previous.t)/1000;
if(dt<=0)return {ok:false,reason:'時間倒退'};
if(dt>30)return {ok:true,meters:0,break:true};
const d=distance(previous,p);
if(d/dt>8)return {ok:false,reason:'GPS 速度過快：'+d/dt+'m/s'};
if(d<Math.max(4,Math.min(12,(p.accuracy+previous.accuracy)*0.25)))return {ok:false,reason:'GPS 位置移動太短'};
return {ok:true,meters:d,break:false};
}
const api={distance,calories,accept};if(typeof module!=='undefined')module.exports=api;else root.MoveCore=api;
})(typeof window!=='undefined'?window:globalThis);
