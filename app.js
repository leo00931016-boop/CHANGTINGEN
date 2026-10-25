function exportCSV(items){
  if(!items.length){
    message('目前沒有可匯出的紀錄。');
    return;
  }

  const rows=[[
    '時間 ISO',
    '課堂代號',
    '類型',
    '活動',
    '身高 cm',
    '體重 kg',
    '年齡',
    '時間秒',
    '距離 m',
    '平均速度 km/h',
    '總熱量 kcal',
    '軌跡點數'
  ]];

  for (const r of items){
    const seconds = Number(r.seconds) || 0;
    const meters = Number(r.meters) || 0;

    let avgSpeed = 0;
    if (seconds > 0) {
      avgSpeed = (meters / 1000) / (seconds / 3600);
    }

    const kcal = Number.isFinite(r.kcal)
      ? Number(r.kcal)
      : (r.met && r.weight && seconds
        ? MoveCore.calories(r.met, r.weight, seconds)
        : 0);

    rows.push([
      r.date || '',
      r.alias || '',
      r.demo ? '示範' : 'GPS',
      r.mode || '',
      r.height ?? '',
      r.weight ?? '',
      r.age ?? '',
      seconds,
      meters,
      avgSpeed.toFixed(1),
      Number(kcal).toFixed(1),
      Array.isArray(r.points) ? r.points.length : 0
    ]);
  }

  download(
    'campus-move.csv',
    rows.map(r => r.map(cell).join(',')).join('\r\n'),
    'text/csv;charset=utf-8'
  );
}
