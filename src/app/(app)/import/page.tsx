"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type IngestType = "youtube" | "pdf" | "url" | "text";

const SOURCE_TYPES: { id: IngestType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { 
    id: "youtube", 
    label: "YouTube Video", 
    desc: "Import lectures, tutorials, or podcasts", 
    color: "#ef4444",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
  },
  { 
    id: "pdf",     
    label: "PDF Document", 
    desc: "Upload books, papers, or slides", 
    color: "#3b82f6",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
  },
  { 
    id: "url",     
    label: "Web Article", 
    desc: "Scrape blogs, wikis, or news", 
    color: "#10b981",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
  },
  { 
    id: "text",    
    label: "Raw Text", 
    desc: "Paste notes or markdown directly", 
    color: "#f59e0b",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  },
];

export default function ImportPage() {
  const router = useRouter();
  const [ingestType, setIngestType] = useState<IngestType>("youtube");
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [youtubeUrl, setYoutubeUrl]   = useState("");
  const [pdfFile, setPdfFile]         = useState<File | null>(null);
  const [webUrl, setWebUrl]           = useState("");
  const [textContent, setTextContent] = useState("");
  const [textTitle, setTextTitle]     = useState("");

  const executeImport = async (targetWorkspaceId: string) => {
    let response: Response;
    if (ingestType === "youtube") {
      response = await fetch("/api/ingest/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: youtubeUrl, workspaceId: targetWorkspaceId }),
      });
    } else if (ingestType === "pdf") {
      const fd = new FormData();
      fd.append("file", pdfFile!);
      fd.append("workspaceId", targetWorkspaceId);
      response = await fetch("/api/ingest/pdf", { method: "POST", body: fd });
    } else if (ingestType === "url") {
      response = await fetch("/api/ingest/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webUrl, workspaceId: targetWorkspaceId }),
      });
    } else {
      response = await fetch("/api/ingest/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: textTitle, text: textContent, workspaceId: targetWorkspaceId }),
      });
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Import failed');
    }
    return data;
  };

  const submitToExistingWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId.trim()) { setError("Please enter a workspace ID, or click 'Create new workspace' instead."); return; }
    
    setLoading(true); setError(null);
    try {
      const data = await executeImport(workspaceId);
      setSuccess(true);
      setTimeout(() => {
        router.push(data.sourceId ? `/learn/${workspaceId}/${data.sourceId}` : `/workspace/${workspaceId}`);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndImport = async () => {
    // Pre-validation
    if (ingestType === 'youtube' && !youtubeUrl) { setError("Please provide a YouTube URL first"); return; }
    if (ingestType === 'pdf' && !pdfFile) { setError("Please select a PDF first"); return; }
    if (ingestType === 'url' && !webUrl) { setError("Please provide an Article URL first"); return; }
    if (ingestType === 'text' && (!textTitle || !textContent)) { setError("Please provide title and content first"); return; }

    setLoading(true); setError(null);
    try {
      // 1. Create a new workspace dynamically
      let wsTitle = "New Workspace";
      if (ingestType === 'youtube') wsTitle = "YouTube Import";
      if (ingestType === 'pdf') wsTitle = pdfFile?.name || "PDF Import";
      if (ingestType === 'url') wsTitle = "Web Article Import";
      if (ingestType === 'text') wsTitle = textTitle;

      const wsRes = await fetch("/api/workspaces/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: wsTitle, description: "Auto-generated workspace from import" }),
      });
      const wsData = await wsRes.json();
      if (!wsRes.ok) throw new Error(wsData.error || "Failed to create workspace");
      
      const newWorkspaceId = wsData.$id;
      setWorkspaceId(newWorkspaceId);

      // 2. Import into the new workspace
      const data = await executeImport(newWorkspaceId);
      
      setSuccess(true);
      setTimeout(() => {
        router.push(data.sourceId ? `/learn/${newWorkspaceId}/${data.sourceId}` : `/workspace/${newWorkspaceId}`);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const activeSource = SOURCE_TYPES.find(s => s.id === ingestType)!;

  return (
    <div className="flex-1 overflow-y-auto relative" style={{ background: '#f8f8fc', minHeight: '100%' }}>
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-b from-[#6c63ff]/10 to-transparent pointer-events-none" />
      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-[#6c63ff]/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] rounded-full bg-[#3b82f6]/10 blur-[80px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20 relative z-10 font-sans">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight" style={{ color: '#1a1a2e' }}>Add Content</h1>
          <p className="text-[16px] font-medium max-w-2xl" style={{ color: '#6b7280' }}>
            Import your learning material to a workspace. We'll instantly process it into flashcards, study plans, and an interactive AI tutor.
          </p>
        </motion.div>

        {/* Success & Error Banners */}
        <div className="mb-8">
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl p-4 flex items-center gap-3 shadow-sm mb-4"
                style={{ background: '#10b98115', border: '1px solid #10b98130' }}
              >
                <span className="w-8 h-8 rounded-full bg-[#10b981] text-white flex items-center justify-center text-md font-bold">✓</span>
                <span className="font-bold text-[15px]" style={{ color: '#047857' }}>Import started! Redirecting to your workspace…</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl p-4 flex items-center gap-3 shadow-sm mb-4"
                style={{ background: '#ef444415', border: '1px solid #ef444430' }}
              >
                <span className="w-8 h-8 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-md font-bold">!</span>
                <span className="font-bold text-[15px]" style={{ color: '#b91c1c' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Split Layout Container */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          
          {/* Left Column: Source Selection */}
          <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-3">
            <h3 className="text-[13px] font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: '#9ca3af' }}>Select Source</h3>
            {SOURCE_TYPES.map(st => {
              const active = ingestType === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => { setIngestType(st.id); setError(null); }}
                  className="group relative flex items-center gap-4 p-4 rounded-[20px] transition-all outline-none text-left w-full"
                  style={{
                    background: active ? '#fff' : 'transparent',
                    border: active ? `1px solid ${st.color}40` : '1px solid transparent',
                    boxShadow: active ? `0 12px 32px ${st.color}15` : 'none',
                  }}
                >
                  {active && (
                    <motion.div layoutId="importActiveBg" className="absolute inset-0 rounded-[20px] pointer-events-none border-2" style={{ borderColor: st.color }} />
                  )}
                  
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm border border-black/5"
                    style={{ background: active ? st.color : '#fff', color: active ? '#fff' : st.color }}
                  >
                    {st.icon}
                  </div>
                  
                  <div>
                    <div className="font-extrabold text-[15px] mb-0.5 transition-colors" style={{ color: active ? '#1a1a2e' : '#4b5563' }}>
                      {st.label}
                    </div>
                    <div className="text-[13px] font-medium transition-colors" style={{ color: active ? '#6b7280' : '#9ca3af' }}>
                      {st.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Configuration Form */}
          <div className="flex-1 w-full min-w-0">
            <h3 className="text-[13px] font-bold uppercase tracking-wider mb-5 ml-1 hidden md:block" style={{ color: '#9ca3af' }}>Configuration</h3>
            <AnimatePresence mode="wait">
              <motion.div
                key={ingestType}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-[#eeeef6] overflow-hidden"
              >
                {/* Form Header */}
                <div className="px-8 py-6 border-b border-[#eeeef6] bg-[#fafafa] flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${activeSource.color}20`, color: activeSource.color }}
                  >
                    {activeSource.icon}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-[18px]" style={{ color: '#1a1a2e' }}>
                      {activeSource.label} Configuration
                    </h2>
                    <p className="text-[13px] font-medium mt-0.5" style={{ color: '#6b7280' }}>
                      Provide the details below to start processing.
                    </p>
                  </div>
                </div>

                <form onSubmit={submitToExistingWorkspace} className="p-8 flex flex-col gap-8">
                  
                  {/* Dynamic Fields */}
                  <div>
                    {ingestType === "youtube" && (
                      <div>
                        <label className="block text-[14px] font-bold mb-3" style={{ color: '#1a1a2e' }}>
                          Video URL
                        </label>
                        <input 
                          type="url" 
                          placeholder="https://youtube.com/watch?v=..." 
                          value={youtubeUrl} 
                          onChange={e => setYoutubeUrl(e.target.value)}
                          className="w-full bg-[#f8f8fc] border border-[#e5e7eb] rounded-xl px-5 py-4 text-[15px] font-semibold outline-none focus:bg-white transition-all placeholder:font-medium shadow-inner"
                          style={{ color: '#1a1a2e' }}
                        />
                        <p className="text-[12px] font-medium mt-2" style={{ color: '#9ca3af' }}>Works best with videos that have closed captions available.</p>
                      </div>
                    )}

                    {ingestType === "pdf" && (
                      <div>
                        <label className="block text-[14px] font-bold mb-3" style={{ color: '#1a1a2e' }}>
                          Select Document
                        </label>
                        <div className="relative border-2 border-dashed border-[#e5e7eb] rounded-xl p-10 text-center bg-[#f8f8fc] hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-colors group">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={e => setPdfFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 text-[#3b82f6] group-hover:scale-110 transition-transform">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                          </div>
                          <p className="text-[16px] font-bold" style={{ color: pdfFile ? '#3b82f6' : '#1a1a2e' }}>
                            {pdfFile ? pdfFile.name : "Click to select or drag and drop"}
                          </p>
                          <p className="text-[13px] font-medium mt-2" style={{ color: '#9ca3af' }}>PDFs up to 50MB</p>
                        </div>
                      </div>
                    )}

                    {ingestType === "url" && (
                      <div>
                        <label className="block text-[14px] font-bold mb-3" style={{ color: '#1a1a2e' }}>
                          Article URL
                        </label>
                        <input 
                          type="url" 
                          placeholder="https://example.com/article" 
                          value={webUrl} 
                          onChange={e => setWebUrl(e.target.value)}
                          className="w-full bg-[#f8f8fc] border border-[#e5e7eb] rounded-xl px-5 py-4 text-[15px] font-semibold outline-none focus:bg-white transition-all placeholder:font-medium shadow-inner"
                          style={{ color: '#1a1a2e' }}
                        />
                      </div>
                    )}

                    {ingestType === "text" && (
                      <div className="flex flex-col gap-6">
                        <div>
                          <label className="block text-[14px] font-bold mb-3" style={{ color: '#1a1a2e' }}>Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Biology Notes Chapter 4" 
                            value={textTitle} 
                            onChange={e => setTextTitle(e.target.value)}
                            className="w-full bg-[#f8f8fc] border border-[#e5e7eb] rounded-xl px-5 py-4 text-[15px] font-semibold outline-none focus:bg-white transition-all placeholder:font-medium shadow-inner"
                            style={{ color: '#1a1a2e' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[14px] font-bold mb-3" style={{ color: '#1a1a2e' }}>Content</label>
                          <textarea
                            placeholder="Paste your raw text, transcript, or markdown here..."
                            value={textContent}
                            onChange={e => setTextContent(e.target.value)}
                            rows={8}
                            className="w-full bg-[#f8f8fc] border border-[#e5e7eb] rounded-xl px-5 py-4 text-[15px] font-semibold outline-none focus:bg-white transition-all placeholder:font-medium resize-y shadow-inner"
                            style={{ color: '#1a1a2e' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-px w-full bg-[#e5e7eb]" />

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-4">
                    {/* Primary Flow: Create & Import */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[14px] font-bold" style={{ color: '#1a1a2e' }}>
                          Create & Import (Recommended)
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateAndImport}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-extrabold text-[15px] transition-all w-full group relative overflow-hidden shadow-md"
                        style={{ 
                          background: loading ? '#d1d5db' : '#6c63ff',
                          color: loading ? '#6b7280' : '#ffffff',
                          border: 'none'
                        }}
                      >
                        {loading ? (
                          <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            ✨ Auto-Create Workspace & Import <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-4 my-2">
                      <div className="h-px flex-1 bg-[#e5e7eb]" />
                      <span className="text-[12px] font-bold uppercase tracking-wider text-[#9ca3af]">OR</span>
                      <div className="h-px flex-1 bg-[#e5e7eb]" />
                    </div>

                    {/* Secondary Flow: Add to Existing Workspace */}
                    <div>
                      <label className="block text-[14px] font-bold mb-3" style={{ color: '#1a1a2e' }}>
                        Add to Existing Workspace
                      </label>
                      <div className="flex items-stretch gap-3">
                        <input
                          type="text"
                          placeholder="Paste Workspace ID"
                          value={workspaceId}
                          onChange={e => setWorkspaceId(e.target.value)}
                          className="flex-1 bg-[#f8f8fc] border border-[#e5e7eb] rounded-xl px-5 py-3 text-[14px] font-semibold outline-none focus:bg-white transition-all placeholder:font-medium shadow-inner"
                          style={{ color: '#1a1a2e' }}
                        />
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 rounded-xl font-bold text-[14px] transition-all border shadow-sm"
                          style={{
                            background: loading ? '#f3f4f6' : '#ffffff',
                            borderColor: '#e5e7eb',
                            color: loading ? '#9ca3af' : '#4b5563',
                          }}
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  </div>

                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
