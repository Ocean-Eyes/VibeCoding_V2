const KEY='just-judo-baemilgi-records-v1';
export const validNickname=value=>typeof value==='string'&&/^[\p{L}\p{N}_ -]{2,12}$/u.test(value.normalize('NFC').trim());
export function readRecords(storage){
  try{const data=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(r=>r&&validNickname(r.nickname)&&Number.isInteger(r.count)&&r.count>0&&r.count<=3000&&typeof r.id==='string'&&typeof r.date==='string').sort((a,b)=>b.count-a.count||a.date.localeCompare(b.date)).slice(0,20):[];}catch{return [];}
}
export function saveRecord(storage,record){
  const records=readRecords(storage).filter(r=>r.id!==record.id);
  if(!validNickname(record.nickname)||!Number.isInteger(record.count)||record.count<1||record.count>3000)throw new Error('record');
  records.push({...record,nickname:record.nickname.normalize('NFC').trim()});
  records.sort((a,b)=>b.count-a.count||a.date.localeCompare(b.date));storage.setItem(KEY,JSON.stringify(records.slice(0,20)));return records;
}
export async function leaderboardRequest(body,{fresh=false}={}){
  const response=await fetch('/api/baemilgi'+(!body&&fresh?'?fresh=1':''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)}:{signal:AbortSignal.timeout(10000)});
  let result;try{result=await response.json()}catch{throw new Error('unavailable')}
  if(!response.ok)throw new Error(result.error||'unavailable');return result;
}
