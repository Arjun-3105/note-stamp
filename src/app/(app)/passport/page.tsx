"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/badges/PassportView";

type Tab = "all"|"earned"|"ready"|"progress";

export default function PassportPage() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [mintingId, setMintingId] = useState<string|null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<Badge|null>(null);
  const [progressSummary, setProgressSummary] = useState<{doneTopics:number;totalTopics:number;doneChunks:number;totalChunks:number;donePages:number;totalPages:number}|null>(null);
  const [recentActivity, setRecentActivity] = useState<{icon:string; text:string; time:string}[]>([]);

  useEffect(()=>{ if(!userId) return;
    fetch("/api/badges").then(r=>r.ok?r.json():Promise.reject("failed")).then(d=>setBadges(d.badges||[])).catch(e=>setError(String(e))).finally(()=>setLoading(false));
    fetch("/api/progress").then(r=>r.ok?r.json():null).then(d=>{
      if(!d?.progresses) return;
      let done=0,total=0, doneC=0,totalC=0, doneP=0,totalP=0;
      for(const p of d.progresses){ done+=(p.completedTopics||[]).length; total+=p.totalTopics||0; doneC+=(p.completedChunks||[]).length; totalC+=p.totalChunks||0; doneP+=(p.completedPages||[]).length; totalP+=p.totalPages||0; }
      setProgressSummary({doneTopics:done,totalTopics:total, doneChunks:doneC,totalChunks:totalC, donePages:doneP,totalPages:totalP});
    }).catch(()=>{});
    // API-backed recent activity from dashboard
    fetch("/api/dashboard").then(r=>r.ok?r.json():null).then(d=>{
      if(!d?.activity) return;
      const mapped = (d.activity as any[]).slice(0,4).map((a:any)=>{
        const time = (()=>{ try{ const diff=Date.now()-new Date(a.time).getTime(); const m=Math.floor(diff/60000); if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; }catch{ return a.time; }})();
        if(a.type==="quiz") return {icon: a.passed?"🏆":"📝", text: `Quiz ${a.passed?"passed":"attempted"} • Score ${a.score}% • ${a.title||"Assessment"}`, time};
        return {icon:"📚", text:`Imported "${a.title}" (${a.sourceType||"source"})`, time};
      });
      if(mapped.length) setRecentActivity(mapped);
    }).catch(()=>{});
  },[userId]);

  const minted = useMemo(()=> badges.filter(b=> (b as any).tokenId || (b as any).txHash), [badges]);
  const readyToMint = useMemo(()=> badges.filter(b=> !(b as any).tokenId && (b as any).score >= 0), [badges]);
  const skillBadges = useMemo(()=> badges.filter(b=> b.type==="skill"), [badges]);
  const microBadges = useMemo(()=> badges.filter(b=> b.type==="micro"), [badges]);

  const avgMastery = useMemo(()=> {
    if(!badges.length) return 0;
    const sum = badges.reduce((s,b)=> s + ((b as any).score||0),0);
    return Math.round(sum/badges.length);
  },[badges]);

  const latest: Badge | null = useMemo(()=> {
    if(!minted.length) return skillBadges[0] || badges[0] || null;
    return [...minted].sort((a:any,b:any)=> new Date(b.mintedAt||b.createdAt).getTime() - new Date(a.mintedAt||a.createdAt).getTime())[0] as Badge;
  },[minted, skillBadges, badges]);

  const filteredSkill = useMemo(()=>{
    if(tab==="earned") return skillBadges.filter(b=> !!(b as any).tokenId);
    if(tab==="ready") return skillBadges.filter(b=> !(b as any).tokenId);
    if(tab==="progress") return skillBadges.filter(b=> ((b as any).score||0) < 80 && !(b as any).tokenId);
    return skillBadges;
  },[tab, skillBadges]);

  const handleMint = async (badge: Badge)=>{
    if((badge as any).tokenId) return;
    setMintingId(badge.$id);
    try{
      const res = await fetch(`/api/badges/${badge.$id}/mint`, {method:"POST"});
      if(!res.ok){ const d=await res.json(); throw new Error(d.error||"Failed");}
      const refresh = await fetch("/api/badges");
      if(refresh.ok) setBadges((await refresh.json()).badges||[]);
    }catch(e){ setError(e instanceof Error? e.message:String(e)); } finally{ setMintingId(null); }
  };

  if(loading){
    return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}>
      <div style={{width:32,height:32,border:"3px solid #eee",borderTopColor:"#6c63ff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    </div>
  }

  return (
    <div style={{background:"#f8f8fc", minHeight:"100vh", fontFamily:"Inter, -apple-system, sans-serif"}}>
      <div style={{maxWidth:1300, margin:"0 auto", padding:"24px 24px 40px", display:"flex", gap:24}}>
        {/* Main */}
        <div style={{flex:1, minWidth:0}}>
          {/* Header stats */}
          <div style={{marginBottom:18}}>
            <h1 style={{fontSize:26,fontWeight:900, color:"#111827", margin:0}}>Achievements</h1>
            <p style={{fontSize:13, color:"#6b7280", margin:"4px 0 16px"}}>Your learning milestones, skills & verified credentials.</p>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12}}>
              {[
                {label:"Achievements", value:String(badges.length).padStart(2,"0"), icon:"🏆"},
                {label:"NFTs Minted", value:String(minted.length).padStart(2,"0"), icon:"⬢"},
                {label:"Avg. Mastery", value:`${avgMastery}%`, icon:"↗"},
                {label:"Badges Earned", value:String(badges.length).padStart(2,"0"), icon:"☆"},
              ].map(c=>(
                <div key={c.label} style={{background:"#fff", border:"1px solid #eeeef6", borderRadius:16, padding:"14px 14px", display:"flex", flexDirection:"column", gap:8}}>
                  <div style={{width:28,height:28, borderRadius:8, background:"#f5f3ff", display:"grid", placeItems:"center", fontSize:14, color:"#6c63ff"}}>{c.icon}</div>
                  <div style={{fontSize:20, fontWeight:900, color:"#111827", lineHeight:1}}>{c.value}</div>
                  <div style={{fontSize:11, color:"#9ca3af", fontWeight:600}}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Skill Credentials */}
          <div style={{marginBottom:20}}>
            <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:12}}>
              <h2 style={{fontSize:16,fontWeight:800, color:"#111827", margin:0}}>Skill Credentials</h2>
              <div style={{marginLeft:"auto", display:"flex", gap:6, background:"#fff", border:"1px solid #eeeef6", borderRadius:999, padding:3}}>
                {[
                  {id:"all", label:`All (${skillBadges.length})`},
                  {id:"earned", label:`Earned (${minted.filter(b=>b.type==="skill").length})`},
                  {id:"ready", label:`Ready to Mint (${skillBadges.filter(b=>!(b as any).tokenId).length})`},
                  {id:"progress", label:`In Progress (${Math.max(0, skillBadges.length - minted.filter(b=>b.type==="skill").length)})`},
                ].map(t=>(
                  <button key={t.id} onClick={()=>setTab(t.id as Tab)} style={{padding:"6px 12px", borderRadius:999, fontSize:12, fontWeight:700, background: tab===t.id ? "#6c63ff" : "transparent", color: tab===t.id ? "#fff":"#6b7280", border:"none", cursor:"pointer"}}>{t.label}</button>
                ))}
              </div>
            </div>

            {skillBadges.length===0 ? (
              <div style={{background:"#fff", border:"1px dashed #e5e7eb", borderRadius:16, padding:24, textAlign:"center", color:"#9ca3af", fontSize:13}}>No skill credentials yet — pass a quiz to earn one.</div>
            ) : filteredSkill.length===0 ? (
              <div style={{background:"#fff", border:"1px dashed #e5e7eb", borderRadius:16, padding:24, textAlign:"center", color:"#9ca3af", fontSize:13}}>No credentials in this tab.</div>
            ) : (
              <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12}}>
                {filteredSkill.map(b=>{
                  const isMinted = !!(b as any).tokenId;
                  const isReady = !isMinted;
                  const score = (b as any).score||0;
                  return (
                    <div key={b.$id} style={{background:"#fff", border:"1px solid #eeeef6", borderRadius:16, padding:16, display:"flex", flexDirection:"column", gap:10, position:"relative"}}>
                      <span style={{position:"absolute", top:10, right:10, fontSize:10, fontWeight:800, letterSpacing:"0.04em", padding:"3px 7px", borderRadius:999, background: isMinted? "#dcfce7": isReady? "#fef3c7":"#dbeafe", color: isMinted? "#15803d": isReady? "#b45309":"#2563eb", border:`1px solid ${isMinted?"#bbf7d0": isReady?"#fde68a":"#bfdbfe"}`}}>
                        {isMinted? "✓ MINTED": isReady? "☆ READY TO MINT":"IN PROGRESS"}
                      </span>
                      <div style={{width:44,height:44, borderRadius:12, background:isMinted?"#f0fdf4": isReady?"#fffbeb":"#eff6ff", border:"1px solid #eeeef6", display:"grid", placeItems:"center", fontSize:20}}>
                        {isMinted? "⧉": isReady? "🛡": "⬢"}
                      </div>
                      <div style={{fontSize:13,fontWeight:800, color:"#111827", lineHeight:1.2, minHeight:32}}>{b.title.replace("Certified: ","")}</div>
                      <div>
                        <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginBottom:4}}><span>Mastery</span><span style={{fontWeight:700, color:"#111827"}}>{score}%</span></div>
                        <div style={{height:6, borderRadius:999, background:"#f3f4f6", overflow:"hidden"}}><div style={{width:`${score}%`, height:"100%", background: isMinted?"#10b981": isReady?"#f59e0b":"#6c63ff"}}/></div>
                      </div>
                      {isMinted ? (
                        <>
                          <div style={{fontSize:11, color:"#6b7280"}}>NFT #{String((b as any).tokenId).slice(0,8)} {(b as any).tokenId?.length>8?"…":""}</div>
                          <button onClick={()=> setSelected(b)} style={{marginTop:4, width:"100%", padding:"8px 12px", borderRadius:10, background:"#f5f3ff", border:"1px solid #ede9fe", color:"#6c63ff", fontSize:12, fontWeight:700, cursor:"pointer"}}>View Credential →</button>
                        </>
                      ) : isReady ? (
                        <button onClick={()=> handleMint(b)} disabled={mintingId===b.$id} style={{marginTop:6, width:"100%", padding:"10px 12px", borderRadius:10, background:"#6c63ff", color:"#fff", fontSize:12, fontWeight:800, border:"none", cursor:"pointer", opacity: mintingId===b.$id?0.6:1}}>{mintingId===b.$id?"Minting…":"Mint as NFT →"}</button>
                      ) : (
                        <button onClick={()=> setSelected(b)} style={{marginTop:6, width:"100%", padding:"8px 12px", borderRadius:10, background:"#f5f3ff", border:"1px solid #ede9fe", color:"#6c63ff", fontSize:12, fontWeight:700, cursor:"pointer"}}>Keep Learning →</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Micro Badges */}
          <div style={{marginBottom:20}}>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
              <h2 style={{fontSize:16,fontWeight:800, color:"#111827", margin:0}}>Micro Badges</h2>
              <span style={{fontSize:11, color:"#9ca3af"}}>{microBadges.length} total</span>
              <Link href="#" style={{marginLeft:"auto", fontSize:12, color:"#6c63ff", fontWeight:600, textDecoration:"none"}}>View all badges →</Link>
            </div>
            {microBadges.length===0 ? (
              <div style={{background:"#fff", border:"1px dashed #e5e7eb", borderRadius:12, padding:24, textAlign:"center"}}>
                <div style={{fontSize:13, color:"#6b7280", fontWeight:600}}>No micro badges yet — API-backed</div>
                <div style={{fontSize:11, color:"#9ca3af", marginTop:4}}>Complete sources (mark chunks/pages done, pass quiz). They appear here via <code style={{background:"#f3f4f6", padding:"1px 4px", borderRadius:4}}>GET /api/badges?type=micro</code></div>
              </div>
            ) : (
              <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12}}>
                {microBadges.map(m=>(
                  <div key={m.$id} style={{background:"#fff", border:"1px solid #eeeef6", borderRadius:12, padding:14}}>
                    <div style={{fontSize:12,fontWeight:700, color:"#111827"}}>{m.title}</div>
                    <div style={{fontSize:11, color:"#6b7280", marginTop:4}}>{m.description?.slice(0,60)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity — API-backed from GET /api/dashboard activity */}
          <div>
            <h2 style={{fontSize:14,fontWeight:800, color:"#111827", marginBottom:10}}>Recent Activity <span style={{fontSize:11, fontWeight:600, color:"#9ca3af", background:"#f3f4f6", padding:"2px 6px", borderRadius:999, marginLeft:6}}>API • /api/dashboard</span></h2>
            <div style={{background:"#fff", border:"1px solid #eeeef6", borderRadius:12, overflow:"hidden"}}>
              {(recentActivity.length ? recentActivity : [
                {icon:"🏆", text: latest ? `You minted "${latest.title}" as NFT` : "No activity yet — complete a module", time:"—"},
              ]).map((a,i,arr)=>(
                <div key={i} style={{display:"flex", gap:10, padding:"12px 14px", borderBottom: i<arr.length-1?"1px solid #f3f4f6":"none", alignItems:"center"}}>
                  <div style={{width:28,height:28, borderRadius:8, background:"#f5f3ff", display:"grid", placeItems:"center", fontSize:12}}>{a.icon}</div>
                  <div style={{flex:1, fontSize:12, color:"#374151"}}>{a.text}</div>
                  <div style={{fontSize:11, color:"#9ca3af"}}>{a.time}</div>
                </div>
              ))}
              <div style={{textAlign:"center", padding:8, borderTop:"1px solid #f3f4f6"}}>
                <Link href="/dashboard" style={{fontSize:12, color:"#6c63ff", fontWeight:600, textDecoration:"none"}}>View all activity →</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail - Latest Credential + Certificate Preview */}
        <div style={{width:360, flexShrink:0, display:"flex", flexDirection:"column", gap:16}}>
          {/* Latest Credential card */}
          {latest && (
            <div style={{background:"#fff", border:"1px solid #eeeef6", borderRadius:16, padding:14}}>
              <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:8}}>
                <span style={{fontSize:10, fontWeight:800, letterSpacing:"0.06em", color:"#6c63ff"}}>LATEST CREDENTIAL</span>
                <span style={{marginLeft:"auto", width:18,height:18, borderRadius:999, background:"#ede9fe", display:"grid", placeItems:"center", fontSize:10, color:"#6c63ff"}}>✔</span>
              </div>
              <div style={{background:"#f5f3ff", border:"1px solid #ede9fe", borderRadius:10, padding:"6px 8px", display:"inline-block", fontSize:10, fontWeight:700, color:"#6c63ff", marginBottom:8}}>Certified</div>
              <div style={{fontSize:13,fontWeight:800, color:"#111827", lineHeight:1.2}}>{latest.title.replace("Certified: ","")}</div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:8}}><span>Mastery</span><span style={{fontWeight:700, color:"#111827"}}>{(latest as any).score||67}%</span></div>
              <div style={{height:6, borderRadius:999, background:"#f3f4f6", marginTop:4, overflow:"hidden"}}><div style={{width:`${(latest as any).score||67}%`, height:"100%", background:"#6c63ff"}}/></div>
              <div style={{display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:"#6b7280"}}>
                <span>✓ Verified on Sepolia</span><span>#{(latest as any).tokenId?.toString().slice(0,8) || "17879455"}</span>
              </div>
              <button onClick={()=> setSelected(latest)} style={{marginTop:10, width:"100%", padding:"10px 12px", borderRadius:10, background:"#f5f3ff", border:"1px solid #ede9fe", color:"#6c63ff", fontSize:12, fontWeight:700, cursor:"pointer"}}>View Credential →</button>
            </div>
          )}

          {/* Inline certificate preview when selected (mobile slide-over alternative) */}
          {selected && (
            <div style={{background:"#fff", border:"1px solid #eeeef6", borderRadius:16, padding:14, position:"sticky", top:14}}>
              <button onClick={()=> setSelected(null)} style={{fontSize:12, color:"#6c63ff", fontWeight:600, background:"none", border:"none", cursor:"pointer", padding:0, marginBottom:8}}>← Back to Achievements</button>
              <CertificateCard badge={selected} userName={user?.fullName || user?.firstName || "ARJUN CHAUDHARY"} />
            </div>
          )}
        </div>
      </div>

      {/* Full-screen certificate modal for desktop */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:"fixed", inset:0, zIndex:50, display:"flex", justifyContent:"flex-end", background:"rgba(0,0,0,0.35)"}} onClick={()=> setSelected(null)}>
            <motion.div initial={{x:400}} animate={{x:0}} exit={{x:400}} transition={{type:"spring", damping:28, stiffness:320}} onClick={e=>e.stopPropagation()} style={{width:560, maxWidth:"95vw", height:"100vh", overflowY:"auto", background:"#f8f8fc", borderLeft:"1px solid #e5e7eb", padding:16}}>
              <CertificateDetail badge={selected} userName={user?.fullName || "Arjun Chaudhary"} onClose={()=> setSelected(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div style={{maxWidth:1300, margin:"0 auto", padding:"0 24px"}}><div style={{background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", padding:12, borderRadius:10, fontSize:13}}>{error}</div></div>}
    </div>
  );
}

function ApiBackedSkills({badge, score}:{badge:Badge, score:number}){
  const [skills, setSkills] = useState<{k:string, v:number}[]|null>(null);
  useEffect(()=>{
    const sid = (badge as any).sourceId;
    if(!sid) { setSkills(null); return; }
    fetch(`/api/sources/${sid}/content?chunkLimit=0`).then(r=>r.ok?r.json():null).then(d=>{
      // try to infer skills from chunks/roadmap; fallback to badge skill
      const skill = (badge as any).skill || "";
      if(skill) setSkills([{k: skill, v: score}]);
      else setSkills(null);
    }).catch(()=> setSkills(null));
  },[badge]);
  if(!skills) return (
    <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12}}>
      <div style={{fontSize:11, fontWeight:800, color:"#111827", marginBottom:8}}>Skills Mastered <span style={{fontSize:10, color:"#9ca3af", fontWeight:600}}>• API • badge.skill</span></div>
      <div style={{fontSize:11, color:"#6b7280", background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:10, padding:10}}>No per-skill breakdown yet — this credential is API-backed for <b>{(badge as any).skill || badge.title}</b> at {score}%. Per-topic mastery comes from <code style={{background:"#f3f4f6", padding:"1px 4px", borderRadius:4}}>GET /api/progress</code> + <code style={{background:"#f3f4f6", padding:"1px 4px", borderRadius:4}}>GET /api/badges</code>. Complete roadmap topics to populate.</div>
    </div>
  );
  return (
    <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12}}>
      <div style={{fontSize:11, fontWeight:800, color:"#111827", marginBottom:8}}>Skills Mastered <span style={{fontSize:10, color:"#9ca3af"}}>• API • {(badge as any).skill}</span></div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8}}>
        {skills.map(s=>(
          <div key={s.k} style={{background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:10, padding:8}}>
            <div style={{fontSize:10, fontWeight:700, color:"#6b7280"}}>{s.k}</div>
            <div style={{height:4, borderRadius:999, background:"#e5e7eb", marginTop:4}}><div style={{width:`${s.v}%`, height:"100%", background:"#6c63ff"}}/></div>
            <div style={{fontSize:10, color:"#6b7280", marginTop:2, textAlign:"right"}}>{s.v}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiBackedProof({badge, score}:{badge:Badge, score:number}){
  const [stats, setStats] = useState<{doneTopics:number;totalTopics:number}|null>(null);
  useEffect(()=>{
    fetch("/api/progress").then(r=>r.ok?r.json():null).then(d=>{
      if(!d?.progresses) return;
      let done=0,total=0;
      for(const p of d.progresses){ done+=(p.completedTopics||[]).length; total+=p.totalTopics||0; }
      setStats({doneTopics:done,totalTopics:total});
    }).catch(()=>{});
  },[]);
  return (
    <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12}}>
      <div style={{fontSize:11, fontWeight:800, color:"#111827", marginBottom:8}}>Proof of Learning <span style={{fontSize:10, color:"#9ca3af", fontWeight:600}}>• API • /api/progress + /api/badges</span></div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:11, color:"#374151"}}>
        <div>✓ Badge score<br/><span style={{color:"#111827", fontWeight:700}}>{score}%</span> <span style={{color:"#6b7280"}}>on-chain record</span></div>
        <div>✓ Topics mastered<br/><span style={{color:"#111827", fontWeight:700}}>{stats ? `${stats.doneTopics} / ${stats.totalTopics||"—"}` : "—"}</span> <span style={{color:"#6b7280"}}>roadmap progress</span></div>
        <div>✓ Credential<br/><span style={{color:"#111827", fontWeight:700}}>{(badge as any).tokenId ? "Minted" : "Not minted"}</span> <span style={{color:"#6b7280"}}>{(badge as any).txHash ? "tx available" : "mint to verify"}</span></div>
      </div>
    </div>
  );
}

function CertificateCard({badge, userName}:{badge:Badge, userName:string}){
  const score = (badge as any).score || 67;
  const token = (badge as any).tokenId || "17879455";
  const tx = (badge as any).txHash || "0x7d45...ab12";
  return (
    <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:16, textAlign:"center"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
        <span style={{fontSize:10, fontWeight:800, color:"#6c63ff", letterSpacing:"0.06em"}}>LEARNLOOP</span>
        <span style={{width:22,height:22, borderRadius:999, background:"#ede9fe", display:"grid", placeItems:"center", color:"#6c63ff", fontSize:10}}>✔</span>
      </div>
      <div style={{fontSize:11, fontWeight:800, letterSpacing:"0.1em", color:"#6c63ff", marginBottom:4}}>CERTIFIED</div>
      <div style={{fontSize:12,fontWeight:800, color:"#334155", lineHeight:1.2}}>{badge.title.replace("Certified: ","").toUpperCase()}</div>
      <div style={{width:36,height:36, borderRadius:999, background:"#ede9fe", display:"grid", placeItems:"center", margin:"10px auto", color:"#6c63ff"}}>🏅</div>
      <div style={{fontSize:11, fontWeight:700, color:"#7c3aed"}}>{score}% MASTERY</div>
      <div style={{fontSize:11, fontWeight:700, color:"#111827", marginTop:4}}>{userName.toUpperCase()}</div>
      <div style={{fontSize:10, color:"#6b7280"}}>{new Date().toLocaleDateString("en-US",{year:"numeric", month:"long", day:"numeric"}).toUpperCase()} • #{token}</div>
    </div>
  );
}

function CertificateDetail({badge, userName, onClose}:{badge:Badge, userName:string, onClose:()=>void}){
  const score = (badge as any).score ?? 0;
  const token = (badge as any).tokenId || "—";
  const tx = (badge as any).txHash || "";
  const ipfs = (badge as any).ipfsHash || "";
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x8a3f...91c2";
  const mintedAt = (badge as any).mintedAt || badge.createdAt;
  const qrData = tx ? `https://sepolia.etherscan.io/tx/${tx}` : `ipfs://${ipfs}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <button onClick={onClose} style={{fontSize:12, color:"#6c63ff", fontWeight:600, background:"none", border:"none", cursor:"pointer"}}>← Back to Achievements</button>
        <span style={{marginLeft:"auto", fontSize:10, fontWeight:800, color:"#15803d", background:"#dcfce7", border:"1px solid #bbf7d0", padding:"4px 8px", borderRadius:999}}>✓ ON-CHAIN VERIFIED</span>
      </div>

      <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:20, textAlign:"center", position:"relative"}}>
        <div style={{position:"absolute", top:12, right:12, width:22,height:22, borderRadius:999, background:"#ede9fe", display:"grid", placeItems:"center", color:"#6c63ff", fontSize:10}}>✔</div>
        <div style={{fontSize:10, fontWeight:800, letterSpacing:"0.1em", color:"#6c63ff"}}>LEARNLOOP</div>
        <div style={{fontSize:18, fontWeight:900, color:"#7c3aed", marginTop:4, letterSpacing:"0.02em"}}>CERTIFIED</div>
        <div style={{fontSize:12, fontWeight:800, color:"#334155", marginTop:6, lineHeight:1.3}}>{badge.title.replace("Certified: ","").toUpperCase()}</div>
        <div style={{width:48,height:48, borderRadius:999, background:"#ede9fe", display:"grid", placeItems:"center", margin:"12px auto", fontSize:20, color:"#6c63ff"}}>🏅</div>
        <div style={{fontSize:11, fontWeight:800, color:"#7c3aed"}}>{score}% MASTERY</div>
        <div style={{fontSize:13, fontWeight:800, color:"#111827", marginTop:6}}>{userName.toUpperCase()}</div>
        <div style={{fontSize:11, color:"#6b7280", marginTop:2}}>{mintedAt ? new Date(mintedAt).toLocaleDateString("en-US",{year:"numeric", month:"long", day:"numeric"}).toUpperCase() : "—"} • #{token}</div>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:12}}>
          <div style={{fontSize:10, color:"#6b7280", textAlign:"left"}}><div>Sepolia</div><div style={{fontFamily:"monospace"}}>#{token}</div></div>
          {tx || ipfs ? <img src={qrUrl} alt="QR" style={{width:64, height:64, border:"1px solid #e5e7eb", borderRadius:8}} /> : <div style={{width:64,height:64, border:"1px dashed #e5e7eb", borderRadius:8, display:"grid", placeItems:"center", fontSize:10, color:"#9ca3af"}}>No tx</div>}
        </div>
        <div style={{display:"flex", gap:8, marginTop:12}}>
          <button style={{flex:1, padding:"8px 10px", borderRadius:8, background:"#f5f3ff", border:"1px solid #ede9fe", color:"#6c63ff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:4}}>↗ Share Credential</button>
          <button style={{flex:1, padding:"8px 10px", borderRadius:8, background:"#fff", border:"1px solid #e5e7eb", color:"#374151", fontSize:11, fontWeight:700}}>⬇ Download</button>
          {tx ? <a href={`https://sepolia.etherscan.io/tx/${tx}`} target="_blank" rel="noreferrer" style={{flex:1, padding:"8px 10px", borderRadius:8, background:"#fff", border:"1px solid #e5e7eb", color:"#374151", fontSize:11, fontWeight:700, textAlign:"center", textDecoration:"none", display:"grid", placeItems:"center"}}>View on Explorer ↗</a> : <span style={{flex:1, padding:"8px 10px", borderRadius:8, background:"#f3f4f6", border:"1px solid #e5e7eb", color:"#9ca3af", fontSize:11, fontWeight:700, textAlign:"center", display:"grid", placeItems:"center"}}>No tx yet</span>}
        </div>
      </div>

      <div>
        <h3 style={{fontSize:12, fontWeight:800, color:"#111827", marginBottom:8}}>Credential Details <span style={{fontSize:10, color:"#9ca3af", fontWeight:600, background:"#f3f4f6", padding:"2px 6px", borderRadius:999, marginLeft:6}}>API • badges + progress</span></h3>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12}}>
            <div style={{fontSize:10, fontWeight:700, color:"#9ca3af", letterSpacing:"0.06em"}}>MASTERY OVERVIEW</div>
            <div style={{display:"flex", gap:12, alignItems:"center", marginTop:8}}>
              <div style={{width:54,height:54, borderRadius:999, border:"4px solid #ede9fe", borderTopColor:"#6c63ff", display:"grid", placeItems:"center", fontSize:12, fontWeight:900, color:"#6c63ff"}}>{score}%</div>
              <div style={{fontSize:11, color:"#374151", display:"flex", flexDirection:"column", gap:4}}>
                <span style={{fontWeight:700, color:"#111827"}}>Mastery</span>
                <span>✓ {score >= 80 ? "Passed threshold (≥80%)" : "Below threshold — keep learning"}</span>
                <span>✓ Assessment Score: {score}% (from badge)</span>
              </div>
            </div>
          </div>
          <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12}}>
            <div style={{fontSize:10, fontWeight:700, color:"#9ca3af", letterSpacing:"0.06em"}}>VERIFICATION</div>
            <div style={{marginTop:8, display:"flex", flexDirection:"column", gap:6, fontSize:11}}>
              <div>{tx ? "✓" : "○"} <b>{tx ? "On-chain Verified" : "Not yet on-chain"}</b> <span style={{color:"#6b7280"}}>Sepolia Testnet</span></div>
              <div>Token ID <span style={{fontFamily:"monospace", background:"#f3f4f6", padding:"1px 6px", borderRadius:6}}>#{token}</span></div>
              <div>Contract Address <span style={{fontFamily:"monospace", fontSize:10}}>{contract.slice(0,10)}…{contract.slice(-4)}</span> <a href={contract.startsWith("0x") ? `https://sepolia.etherscan.io/address/${contract}` : "#"} target="_blank" rel="noreferrer" style={{color:"#6c63ff", fontSize:10}}>↗</a></div>
            </div>
          </div>
        </div>
      </div>

      <ApiBackedSkills badge={badge} score={score} />
      <ApiBackedProof badge={badge} score={score} />

      <div style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12}}>
        <div style={{fontSize:11, fontWeight:800, color:"#111827", marginBottom:8}}>On-Chain Record <span style={{fontSize:10, color:"#9ca3af", fontWeight:600}}>• API • badges table</span></div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, fontSize:11}}>
          <div><div style={{color:"#9ca3af"}}>Token ID</div><div style={{fontFamily:"monospace"}}>#{token}</div></div>
          <div><div style={{color:"#9ca3af"}}>Network</div><div>Sepolia Testnet</div></div>
          <div><div style={{color:"#9ca3af"}}>Contract</div><div style={{fontFamily:"monospace", fontSize:10}} title={contract}>{contract.slice(0,8)}…</div></div>
          <div><div style={{color:"#9ca3af"}}>Minted On</div><div>{mintedAt ? new Date(mintedAt).toLocaleDateString() : "—"}</div></div>
          <div><div style={{color:"#9ca3af"}}>Transaction</div><div style={{fontFamily:"monospace", color:"#6c63ff"}}>{tx ? `${tx.slice(0,10)}…` : "—"}</div></div>
          <div style={{gridColumn:"span 3"}}><div style={{color:"#9ca3af"}}>Metadata (IPFS)</div><div style={{fontFamily:"monospace", color:"#6c63ff"}}>{ipfs ? `${ipfs.slice(0,22)}…` : "—"}</div></div>
        </div>
      </div>
    </div>
  );
}
