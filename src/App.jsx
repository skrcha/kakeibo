import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const EXPENSE_CATS = ["家賃","食費","コンビニ","交通費","日用品","光熱費","外食","デート","NISA","雑費","その他"];
const INCOME_CATS  = ["給与","副業","その他収入"];
const ALL_CATS     = [...INCOME_CATS, ...EXPENSE_CATS];
const CAT_EMOJI = { 家賃:"🏠",食費:"🍱",コンビニ:"🏪",交通費:"🚃",日用品:"🛒",光熱費:"💡",外食:"🍜",デート:"💕",NISA:"📈",雑費:"📦",その他:"🗂️",給与:"💰",副業:"💼",その他収入:"💵" };
const CAT_COLOR = { 家賃:"#c4b5fd",食費:"#67e8f9",コンビニ:"#fda4af",交通費:"#6ee7b7",日用品:"#93c5fd",光熱費:"#c4b5fd",外食:"#f9a8d4",デート:"#fda4af",NISA:"#6ee7b7",雑費:"#94a3b8",その他:"#cbd5e1",給与:"rgba(100,255,180,0.9)",副業:"#a3e635",その他収入:"#86efac" };

const SK_RECORDS  = "kakeibo-v5-records";
const SK_FIXED    = "kakeibo-v5-fixed";
const SK_GOALS    = "kakeibo-v5-goals";
const SK_LASTINIT = "kakeibo-v5-lastinit";
const SK_INITBAL  = "kakeibo-v5-initbal";

const fmt   = (n) => Number(n).toLocaleString("ja-JP") + "円";
const fmtM  = (n) => (Number(n)/10000).toFixed(1) + "万";
const nowDate   = () => new Date().toISOString().slice(0,10);
const currentYM = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const ymLabel   = (ym) => { const [y,m]=ym.split("-"); return `${y}年${parseInt(m)}月`; };

const defaultFixed = [
  { id:1, type:"income",  category:"給与", amount:300000, label:"給与" },
  { id:2, type:"expense", category:"NISA", amount:30000,  label:"NISA積立" },
  { id:3, type:"expense", category:"家賃", amount:90000,  label:"家賃" },
];

// 目標のbasisType:
//   "balance"  → 総残高ベース（生活防衛資金など）
//   "category" → 特定カテゴリの累計ベース（NISA累計など）
const defaultGoals = [
  { id:1, label:"生活防衛資金", target:900000,  color:"#6ee7b7", basisType:"balance",  category:null },
  { id:2, label:"NISA累計",    target:1000000, color:"#c4b5fd", basisType:"category", category:"NISA" },
];

function load(key, def) { try { const v=localStorage.getItem(key); return v?JSON.parse(v):def; } catch{ return def; } }
function save(key, val) { try { localStorage.setItem(key,JSON.stringify(val)); } catch{} }

const Glass = ({ children, style={} }) => (
  <div style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 100%)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:24, padding:16, marginBottom:12, ...style }}>
    {children}
  </div>
);

function ConfirmDialog({ message, onOk, onCancel }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ background:"#111118",border:"1px solid rgba(255,255,255,0.12)",borderRadius:24,padding:28,width:"100%",maxWidth:320 }}>
        <div style={{ fontSize:15,color:"#e8e8f0",marginBottom:24,lineHeight:1.6,textAlign:"center" }}>{message}</div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,padding:"12px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,color:"#888",fontSize:14,fontWeight:600,cursor:"pointer" }}>キャンセル</button>
          <button onClick={onOk}     style={{ flex:1,padding:"12px 0",background:"rgba(255,80,80,0.2)",border:"1px solid rgba(255,80,80,0.4)",borderRadius:14,color:"#fda4af",fontSize:14,fontWeight:700,cursor:"pointer" }}>削除する</button>
        </div>
      </div>
    </div>
  );
}

function GlowBar({ pct, color }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position:"relative",height:6,background:"rgba(255,255,255,0.05)",borderRadius:99 }}>
      <div style={{ position:"absolute",top:0,left:0,height:"100%",width:`${p}%`,borderRadius:99,background:`linear-gradient(90deg,${color}55,${color})`,boxShadow:`0 0 10px ${color}66`,transition:"width .5s cubic-bezier(.4,0,.2,1)" }} />
      {p>0&&p<100&&<div style={{ position:"absolute",top:"50%",left:`${p}%`,transform:"translate(-50%,-50%)",width:10,height:10,borderRadius:"50%",background:color,boxShadow:`0 0 8px ${color}`,border:"2px solid #060609" }} />}
    </div>
  );
}

export default function App() {
  const [records,  setRecords]  = useState(() => load(SK_RECORDS, []));
  const [fixed,    setFixed]    = useState(() => load(SK_FIXED, defaultFixed));
  const [goals,    setGoals]    = useState(() => load(SK_GOALS, defaultGoals));
  const [initBal,  setInitBal]  = useState(() => load(SK_INITBAL, 150000));
  const [tab,      setTab]      = useState("home");
  const [selYM,    setSelYM]    = useState(currentYM());
  const [toast,    setToast]    = useState("");
  const [confirm,  setConfirm]  = useState(null);

  const [fType,   setFType]   = useState("expense");
  const [fCat,    setFCat]    = useState("食費");
  const [fAmount, setFAmount] = useState("");
  const [fMemo,   setFMemo]   = useState("");
  const [fDate,   setFDate]   = useState(nowDate());

  const [editFixed,   setEditFixed]   = useState(false);
  const [newFixed,    setNewFixed]    = useState({ type:"expense", category:"家賃", amount:"", label:"" });
  const [editGoal,    setEditGoal]    = useState(null);
  const [editInitBal, setEditInitBal] = useState(false);
  const [tmpInitBal,  setTmpInitBal]  = useState("");

  useEffect(() => { save(SK_RECORDS, records); }, [records]);
  useEffect(() => { save(SK_FIXED,   fixed);   }, [fixed]);
  useEffect(() => { save(SK_GOALS,   goals);   }, [goals]);
  useEffect(() => { save(SK_INITBAL, initBal); }, [initBal]);

  useEffect(() => {
    const ym = currentYM();
    if (load(SK_LASTINIT,"") === ym) return;
    const toAdd = fixed.map(f => ({ id:Date.now()+Math.random(), type:f.type, category:f.category, amount:f.amount, memo:f.label, date:ym+"-01" }));
    setRecords(prev => [...toAdd, ...prev]);
    save(SK_LASTINIT, ym);
    showToast(`固定費・収入を${toAdd.length}件自動登録`);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),3000); }
  function askDelete(msg, onOk) { setConfirm({ message:msg, onOk }); }
  function moveMonth(dir) {
    const [y,m] = selYM.split("-").map(Number);
    const d = new Date(y,m-1+dir,1);
    setSelYM(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }

  // 総残高（初期残高 + 全記録の累計）
  const totalBalance = initBal + records.reduce((s,r) => r.type==="income" ? s+r.amount : s-r.amount, 0);

  // カテゴリ累計（全期間）
  function catTotal(cat) {
    return records.filter(r=>r.category===cat).reduce((s,r)=>s+r.amount,0);
  }

  // 目標の現在値を算出
  function goalCurrent(g) {
    if (g.basisType==="balance") return totalBalance;
    if (g.basisType==="category" && g.category) return catTotal(g.category);
    return 0;
  }

  // 選択月
  const monthRecs    = records.filter(r=>r.date.startsWith(selYM));
  const totalIncome  = monthRecs.filter(r=>r.type==="income").reduce((s,r)=>s+r.amount,0);
  const totalExpense = monthRecs.filter(r=>r.type==="expense").reduce((s,r)=>s+r.amount,0);
  const balance      = totalIncome - totalExpense;

  const expByCat = EXPENSE_CATS
    .map(c=>({ name:c, value:monthRecs.filter(r=>r.type==="expense"&&r.category===c).reduce((s,r)=>s+r.amount,0) }))
    .filter(d=>d.value>0).sort((a,b)=>b.value-a.value);

  const last6 = Array.from({length:6},(_,i)=>{
    const d=new Date(new Date().getFullYear(),new Date().getMonth()-5+i,1);
    const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return { label:`${d.getMonth()+1}月`, income:records.filter(r=>r.date.startsWith(ym)&&r.type==="income").reduce((s,r)=>s+r.amount,0), expense:records.filter(r=>r.date.startsWith(ym)&&r.type==="expense").reduce((s,r)=>s+r.amount,0) };
  });
  const avgSurplus = last6.reduce((s,m)=>s+(m.income-m.expense),0)/6||1;

  function addRecord() {
    const amt = Number(fAmount);
    if(!amt||amt<=0) return;
    setRecords(prev=>[{ id:Date.now(), type:fType, category:fCat, amount:amt, memo:fMemo, date:fDate },...prev]);
    setFAmount(""); setFMemo("");
    showToast("追加しました ✓");
  }

  const inp  = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"13px 16px", color:"#e8e8f0", fontSize:16, boxSizing:"border-box", outline:"none" };
  const pill = (on, c="rgba(255,255,255,0.9)") => ({ padding:"7px 14px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:on?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)", color:on?c:"#555", boxShadow:on?`0 0 0 1px ${c}33`:"none" });

  // 目標編集フォームの初期値
  const blankGoal = { label:"", target:"", color:"#6ee7b7", basisType:"balance", category:"NISA" };

  return (
    <div style={{ minHeight:"100vh", background:"#060609", color:"#e8e8f0", fontFamily:"'Hiragino Sans','Meiryo',sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>
      {confirm && <ConfirmDialog message={confirm.message} onOk={()=>{ confirm.onOk(); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      {toast && (
        <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:"rgba(110,231,183,0.15)",backdropFilter:"blur(12px)",border:"1px solid rgba(110,231,183,0.3)",color:"#6ee7b7",borderRadius:20,padding:"8px 20px",fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}

      {/* 総残高バナー（常時表示） */}
      <div style={{ background:"linear-gradient(135deg,rgba(196,181,253,0.1),rgba(110,231,183,0.06))", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"18px 20px 14px" }}>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:4, marginBottom:6 }}>TOTAL BALANCE</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <div style={{ fontSize:38, fontWeight:800, letterSpacing:-1, color:totalBalance>=0?"#fff":"#fda4af", lineHeight:1 }}>
              ¥{Number(totalBalance).toLocaleString("ja-JP")}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:5 }}>初期残高 {fmt(initBal)} ＋ 収支累計</div>
          </div>
          <button onClick={()=>{ setTmpInitBal(String(initBal)); setEditInitBal(true); }}
            style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.35)", borderRadius:10, padding:"6px 12px", fontSize:11, cursor:"pointer", flexShrink:0 }}>
            初期残高を変更
          </button>
        </div>
      </div>

      {/* 初期残高モーダル */}
      {editInitBal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
          <div style={{ background:"#111118",border:"1px solid rgba(255,255,255,0.12)",borderRadius:24,padding:28,width:"100%",maxWidth:320 }}>
            <div style={{ fontSize:14,color:"rgba(255,255,255,0.6)",marginBottom:4 }}>記録開始時点の残高</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.25)",marginBottom:16,lineHeight:1.7 }}>ゆうちょ・SBIなど全口座の合計を入力してください</div>
            <input type="number" inputMode="numeric" value={tmpInitBal} onChange={e=>setTmpInitBal(e.target.value)}
              placeholder="例: 150000" style={{ ...inp, fontSize:24, fontWeight:800, marginBottom:16 }} />
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setEditInitBal(false)} style={{ flex:1,padding:"12px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,color:"#888",fontSize:14,cursor:"pointer" }}>キャンセル</button>
              <button onClick={()=>{ setInitBal(Number(tmpInitBal)); setEditInitBal(false); showToast("初期残高を更新しました"); }}
                style={{ flex:1,padding:"12px 0",background:"rgba(255,255,255,0.9)",border:"none",borderRadius:14,color:"#060609",fontSize:14,fontWeight:700,cursor:"pointer" }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 月選択ヘッダー */}
      <div style={{ padding:"14px 20px 10px", borderBottom:"1px solid rgba(255,255,255,0.04)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:16, fontWeight:700 }}>{ymLabel(selYM)}</div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={()=>moveMonth(-1)} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.5)", borderRadius:10, padding:"6px 14px", cursor:"pointer", fontSize:16 }}>‹</button>
          <button onClick={()=>moveMonth(1)}  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.5)", borderRadius:10, padding:"6px 14px", cursor:"pointer", fontSize:16 }}>›</button>
        </div>
      </div>

      <div style={{ padding:"14px 16px 0" }}>

        {/* ===== ホーム ===== */}
        {tab==="home" && <>
          <Glass style={{ padding:"20px" }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:3, marginBottom:8 }}>THIS MONTH</div>
            <div style={{ fontSize:40, fontWeight:800, letterSpacing:-2, color:balance>=0?"#fff":"#fda4af", marginBottom:4 }}>
              {balance>=0?"+":""}{fmtM(balance)}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              {[["収入",totalIncome,"rgba(100,255,180,0.9)"],["支出",totalExpense,"rgba(255,100,130,0.9)"]].map(([l,v,c])=>(
                <div key={l} style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:6 }}>{l}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:c }}>{fmtM(v)}</div>
                </div>
              ))}
            </div>
          </Glass>

          {expByCat.length>0 && (
            <Glass>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:3, marginBottom:16 }}>SPENDING</div>
              {expByCat.map((c,i)=>{
                const pct=(c.value/totalExpense)*100;
                const color=CAT_COLOR[c.name]||"#fff";
                return (
                  <div key={c.name} style={{ marginBottom:i===expByCat.length-1?0:18 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:15 }}>{CAT_EMOJI[c.name]}</span>
                        <span style={{ fontSize:13, color:"rgba(255,255,255,0.7)" }}>{c.name}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>{pct.toFixed(0)}%</span>
                        <span style={{ fontSize:14, fontWeight:700, color }}>{fmt(c.value)}</span>
                      </div>
                    </div>
                    <GlowBar pct={pct} color={color} />
                  </div>
                );
              })}
            </Glass>
          )}

          <Glass style={{ padding:0, overflow:"hidden" }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:3, padding:"16px 16px 12px" }}>HISTORY</div>
            {monthRecs.length===0 && <div style={{ color:"rgba(255,255,255,0.2)", fontSize:12, textAlign:"center", padding:"24px 0" }}>この月の記録はありません</div>}
            {monthRecs.slice(0,30).map((r,i)=>(
              <div key={r.id} style={{ display:"flex", alignItems:"center", padding:"12px 16px", borderTop:i===0?"none":"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width:38,height:38,borderRadius:14,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,marginRight:12,flexShrink:0 }}>
                  {CAT_EMOJI[r.category]||"💳"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.85)" }}>{r.category}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:2 }}>{r.date.slice(5)}{r.memo?" · "+r.memo:""}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:r.type==="income"?"rgba(100,255,180,0.9)":"rgba(255,100,130,0.9)" }}>
                    {r.type==="income"?"+":"-"}{fmt(r.amount)}
                  </div>
                  <button onClick={()=>askDelete(`「${r.category} ${fmt(r.amount)}」を削除しますか？`,()=>setRecords(prev=>prev.filter(x=>x.id!==r.id)))}
                    style={{ background:"none",border:"none",color:"rgba(255,255,255,0.15)",cursor:"pointer",fontSize:18,padding:"2px 4px",flexShrink:0 }}>×</button>
                </div>
              </div>
            ))}
          </Glass>
        </>}

        {/* ===== 記録 ===== */}
        {tab==="add" && (
          <Glass>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:3, marginBottom:18 }}>NEW RECORD</div>
            <div style={{ display:"flex", gap:8, marginBottom:18 }}>
              {["expense","income"].map(t=>(
                <button key={t} onClick={()=>{ setFType(t); setFCat(t==="income"?"給与":"食費"); }}
                  style={{ flex:1,padding:"12px 0",borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,
                    background:fType===t?(t==="income"?"rgba(100,255,180,0.12)":"rgba(255,100,130,0.12)"):"rgba(255,255,255,0.04)",
                    color:fType===t?(t==="income"?"rgba(100,255,180,0.9)":"rgba(255,100,130,0.9)"):"rgba(255,255,255,0.25)",
                    boxShadow:fType===t?`0 0 0 1px ${t==="income"?"rgba(100,255,180,0.3)":"rgba(255,100,130,0.3)"}`:"none" }}>
                  {t==="income"?"収入":"支出"}
                </button>
              ))}
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:2, marginBottom:8 }}>カテゴリ</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(fType==="income"?INCOME_CATS:EXPENSE_CATS).map(c=>(
                  <button key={c} onClick={()=>setFCat(c)} style={pill(fCat===c, CAT_COLOR[c])}>
                    {CAT_EMOJI[c]} {c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:2, marginBottom:8 }}>金額（円）</div>
              <input type="number" inputMode="numeric" value={fAmount} onChange={e=>setFAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRecord()}
                placeholder="0" style={{ ...inp, fontSize:28, fontWeight:800, letterSpacing:-1 }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:2, marginBottom:8 }}>日付</div>
              <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={inp} />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:2, marginBottom:8 }}>メモ（任意）</div>
              <input type="text" value={fMemo} onChange={e=>setFMemo(e.target.value)} placeholder="例: セブン、彼女とランチ" style={inp} />
            </div>
            <button onClick={addRecord} style={{ width:"100%",padding:"16px 0",background:"rgba(255,255,255,0.92)",border:"none",borderRadius:16,color:"#060609",fontSize:16,fontWeight:800,cursor:"pointer" }}>追加する</button>
          </Glass>
        )}

        {/* ===== グラフ ===== */}
        {tab==="chart" && (
          <>
            <Glass>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:3, marginBottom:12 }}>MONTHLY TREND</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last6} barSize={14}>
                  <XAxis dataKey="label" tick={{fill:"rgba(255,255,255,0.3)",fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/10000).toFixed(0)}万`} />
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"#111118",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,color:"#e8e8f0" }} />
                  <Legend wrapperStyle={{fontSize:11,color:"rgba(255,255,255,0.4)"}} />
                  <Bar dataKey="income"  name="収入" fill="rgba(100,255,180,0.7)" radius={[6,6,0,0]} />
                  <Bar dataKey="expense" name="支出" fill="rgba(255,100,130,0.7)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Glass>
            {expByCat.length>0 && (
              <Glass>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:3, marginBottom:16 }}>BREAKDOWN</div>
                {expByCat.map((c,i)=>{
                  const pct=(c.value/totalExpense)*100;
                  const color=CAT_COLOR[c.name]||"#fff";
                  return (
                    <div key={c.name} style={{ marginBottom:i===expByCat.length-1?0:16 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:15 }}>{CAT_EMOJI[c.name]}</span>
                          <span style={{ fontSize:13,color:"rgba(255,255,255,0.7)" }}>{c.name}</span>
                        </div>
                        <div style={{ display:"flex",alignItems:"baseline",gap:8 }}>
                          <span style={{ fontSize:11,color:"rgba(255,255,255,0.25)" }}>{pct.toFixed(0)}%</span>
                          <span style={{ fontSize:14,fontWeight:700,color }}>{fmt(c.value)}</span>
                        </div>
                      </div>
                      <GlowBar pct={pct} color={color} />
                    </div>
                  );
                })}
              </Glass>
            )}
          </>
        )}

        {/* ===== 設定 ===== */}
        {tab==="settings" && (
          <>
            {/* 固定費 */}
            <Glass>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:3 }}>FIXED</div>
                <button onClick={()=>setEditFixed(v=>!v)} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",borderRadius:8,padding:"4px 12px",fontSize:12,cursor:"pointer" }}>
                  {editFixed?"完了":"編集"}
                </button>
              </div>
              {fixed.map(f=>(
                <div key={f.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:18 }}>{CAT_EMOJI[f.category]||"💳"}</span>
                    <div>
                      <div style={{ fontSize:13,color:"rgba(255,255,255,0.8)" }}>{f.label}</div>
                      <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:2 }}>{f.type==="income"?"収入":"支出"} · {f.category}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:13,fontWeight:700,color:f.type==="income"?"rgba(100,255,180,0.9)":"rgba(255,100,130,0.9)" }}>
                      {f.type==="income"?"+":"-"}{fmt(f.amount)}
                    </span>
                    {editFixed && (
                      <button onClick={()=>askDelete(`「${f.label}」を削除しますか？`,()=>setFixed(prev=>prev.filter(x=>x.id!==f.id)))}
                        style={{ background:"none",border:"none",color:"rgba(255,100,130,0.5)",cursor:"pointer",fontSize:18,padding:"2px 4px" }}>×</button>
                    )}
                  </div>
                </div>
              ))}
              {editFixed && (
                <div style={{ marginTop:14,padding:14,background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display:"flex",gap:6,marginBottom:10 }}>
                    {["expense","income"].map(t=>(
                      <button key={t} onClick={()=>setNewFixed(f=>({...f,type:t,category:t==="income"?"給与":"家賃"}))}
                        style={{ flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
                          background:newFixed.type===t?(t==="income"?"rgba(100,255,180,0.12)":"rgba(255,100,130,0.12)"):"rgba(255,255,255,0.04)",
                          color:newFixed.type===t?(t==="income"?"rgba(100,255,180,0.9)":"rgba(255,100,130,0.9)"):"rgba(255,255,255,0.25)" }}>
                        {t==="income"?"収入":"支出"}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:10 }}>
                    {(newFixed.type==="income"?INCOME_CATS:EXPENSE_CATS).map(c=>(
                      <button key={c} onClick={()=>setNewFixed(f=>({...f,category:c}))} style={pill(newFixed.category===c,CAT_COLOR[c])}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <input placeholder="ラベル（例:家賃）" value={newFixed.label} onChange={e=>setNewFixed(f=>({...f,label:e.target.value}))}
                    style={{ ...inp,marginBottom:8,fontSize:14 }} />
                  <input placeholder="金額" type="number" inputMode="numeric" value={newFixed.amount} onChange={e=>setNewFixed(f=>({...f,amount:e.target.value}))}
                    style={{ ...inp,marginBottom:10,fontSize:14 }} />
                  <button onClick={()=>{
                    if(!newFixed.label||!newFixed.amount) return;
                    setFixed(prev=>[...prev,{...newFixed,id:Date.now(),amount:Number(newFixed.amount)}]);
                    setNewFixed({type:"expense",category:"家賃",amount:"",label:""});
                  }} style={{ width:"100%",padding:"12px 0",background:"rgba(255,255,255,0.9)",border:"none",borderRadius:12,color:"#060609",fontSize:14,fontWeight:700,cursor:"pointer" }}>追加</button>
                </div>
              )}
            </Glass>

            {/* 目標 */}
            <Glass>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:3,marginBottom:16 }}>GOALS</div>
              {goals.map(g=>{
                const current = goalCurrent(g);
                const pct     = Math.min(100,(current/g.target)*100);
                const remain  = g.target - current;
                const monthsLeft = remain>0 ? Math.ceil(remain/Math.max(avgSurplus,1)) : 0;
                const basisLabel = g.basisType==="balance" ? "総残高ベース" : `「${g.category}」累計ベース`;
                return (
                  <div key={g.id} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                      <span style={{ fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.85)" }}>{g.label}</span>
                      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                        <span style={{ fontSize:13,fontWeight:700,color:g.color }}>{pct.toFixed(0)}%</span>
                        <button onClick={()=>setEditGoal({...g,target:String(g.target)})} style={{ background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.4)",borderRadius:8,padding:"3px 10px",fontSize:11,cursor:"pointer" }}>編集</button>
                        <button onClick={()=>askDelete(`「${g.label}」を削除しますか？`,()=>setGoals(prev=>prev.filter(x=>x.id!==g.id)))}
                          style={{ background:"none",border:"none",color:"rgba(255,100,130,0.4)",cursor:"pointer",fontSize:16,padding:"2px 4px" }}>×</button>
                      </div>
                    </div>
                    {/* 算出根拠バッジ */}
                    <div style={{ fontSize:10,color:"rgba(255,255,255,0.2)",marginBottom:8,display:"flex",alignItems:"center",gap:4 }}>
                      <span style={{ background:"rgba(255,255,255,0.06)",borderRadius:6,padding:"2px 8px" }}>{basisLabel}</span>
                      <span>{fmt(current)} / {fmt(g.target)}</span>
                    </div>
                    <GlowBar pct={pct} color={g.color} />
                    <div style={{ display:"flex",justifyContent:"flex-end",marginTop:6 }}>
                      <span style={{ fontSize:11,color:"rgba(255,255,255,0.25)" }}>
                        {remain<=0 ? "🎉 達成!" : `あと ${fmt(remain)}（約${monthsLeft}ヶ月）`}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* 目標編集モーダル */}
              {editGoal && (
                <div style={{ padding:16,background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)",marginBottom:12 }}>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:10 }}>目標を編集</div>
                  <input placeholder="目標名" value={editGoal.label} onChange={e=>setEditGoal(g=>({...g,label:e.target.value}))}
                    style={{ ...inp,marginBottom:10,fontSize:14 }} />
                  <input placeholder="目標額（円）" type="number" inputMode="numeric" value={editGoal.target} onChange={e=>setEditGoal(g=>({...g,target:e.target.value}))}
                    style={{ ...inp,marginBottom:12,fontSize:14 }} />

                  {/* 算出方法 */}
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:8 }}>進捗の算出方法</div>
                  <div style={{ display:"flex",gap:8,marginBottom:12 }}>
                    {[["balance","総残高ベース"],["category","カテゴリ累計"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setEditGoal(g=>({...g,basisType:v}))}
                        style={{ flex:1,padding:"10px 0",borderRadius:12,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
                          background:editGoal.basisType===v?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",
                          color:editGoal.basisType===v?"#fff":"rgba(255,255,255,0.3)",
                          boxShadow:editGoal.basisType===v?"0 0 0 1px rgba(255,255,255,0.2)":"none" }}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* カテゴリ選択（カテゴリベースのみ） */}
                  {editGoal.basisType==="category" && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:8 }}>対象カテゴリ</div>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                        {ALL_CATS.map(c=>(
                          <button key={c} onClick={()=>setEditGoal(g=>({...g,category:c}))} style={pill(editGoal.category===c, CAT_COLOR[c]||"#fff")}>
                            {CAT_EMOJI[c]} {c}
                          </button>
                        ))}
                      </div>
                      {editGoal.category && (
                        <div style={{ marginTop:8,fontSize:11,color:"rgba(255,255,255,0.25)" }}>
                          現在の累計：{fmt(catTotal(editGoal.category))}
                        </div>
                      )}
                    </div>
                  )}

                  {editGoal.basisType==="balance" && (
                    <div style={{ marginBottom:12,fontSize:11,color:"rgba(255,255,255,0.25)" }}>
                      現在の総残高：{fmt(totalBalance)}
                    </div>
                  )}

                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>{ setGoals(prev=>prev.map(g=>g.id===editGoal.id?{...editGoal,target:Number(editGoal.target)}:g)); setEditGoal(null); showToast("目標を更新しました"); }}
                      style={{ flex:1,padding:"12px 0",background:"rgba(255,255,255,0.9)",border:"none",borderRadius:12,color:"#060609",fontSize:14,fontWeight:700,cursor:"pointer" }}>保存</button>
                    <button onClick={()=>setEditGoal(null)}
                      style={{ flex:1,padding:"12px 0",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,color:"rgba(255,255,255,0.4)",fontSize:14,cursor:"pointer" }}>キャンセル</button>
                  </div>
                </div>
              )}

              <button onClick={()=>setGoals(prev=>[...prev,{...blankGoal,id:Date.now(),label:"新しい目標",target:500000}])}
                style={{ width:"100%",padding:"12px 0",background:"rgba(255,255,255,0.03)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:14,color:"rgba(255,255,255,0.3)",fontSize:13,cursor:"pointer" }}>
                ＋ 目標を追加
              </button>
            </Glass>
          </>
        )}
      </div>

      {/* タブバー */}
      <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(6,6,9,0.9)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",zIndex:100,padding:"10px 0 env(safe-area-inset-bottom,10px)" }}>
        {[["home","🏠","ホーム"],["add","＋","記録"],["chart","📊","グラフ"],["settings","⚙️","設定"]].map(([key,icon,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0",border:"none",background:"none",cursor:"pointer",color:tab===key?"#fff":"rgba(255,255,255,0.2)",fontSize:10,fontWeight:tab===key?700:400 }}>
            <span style={{ fontSize:key==="add"?24:18,lineHeight:1 }}>{icon}</span>
            <span style={{ letterSpacing:0.5 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
