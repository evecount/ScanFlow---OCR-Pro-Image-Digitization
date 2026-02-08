
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Download, 
  Table as TableIcon, 
  FileText, 
  Settings, 
  ChevronRight,
  Upload,
  Layers,
  CheckCircle2,
  Loader2,
  X,
  FileJson,
  FileCode,
  ClipboardList,
  Sparkles,
  Wand2,
  Info,
  AlertCircle,
  Zap,
  MessageSquareQuote,
  RefreshCw
} from 'lucide-react';
import { Region, ScannedFile } from './types';
import DocumentCanvas from './components/DocumentCanvas';
import { extractDataFromImage, detectRegionsFromImage } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [view, setView] = useState<'editor' | 'results'>('editor');
  const [aiHints, setAiHints] = useState('');

  const currentFile = files[currentIndex];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    if (fileList.length === 0) return;

    const newFiles: ScannedFile[] = fileList.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);

    if (regions.length === 0 && newFiles.length > 0) {
      triggerAutoDetectForFile(newFiles[0]);
    }
  };

  const triggerAutoDetectForFile = async (scannedFile: ScannedFile) => {
    setIsDetecting(true);
    try {
      const base64 = await fileToBase64(scannedFile.file);
      const detectedRegions = await detectRegionsFromImage(base64, aiHints);
      
      if (detectedRegions && detectedRegions.length > 0) {
        setRegions(detectedRegions);
        setActiveRegionId(detectedRegions[0].id);
      }
    } catch (error) {
      console.error("Auto-detection error:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleManualAutoDetect = async () => {
    if (!currentFile) return;
    await triggerAutoDetectForFile(currentFile);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processAllFiles = async () => {
    if (regions.length === 0) {
      alert("Please define at least one region to extract.");
      return;
    }
    
    setIsProcessing(true);
    setView('results');

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'completed') continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

      try {
        const base64 = await fileToBase64(files[i].file);
        const result = await extractDataFromImage(base64, regions, aiHints);
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'completed', extractedData: result } : f
        ));
      } catch (error) {
        console.error("Extraction error:", error);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error' } : f));
      }
    }

    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (currentIndex >= filtered.length && filtered.length > 0) {
        setCurrentIndex(filtered.length - 1);
      }
      return filtered;
    });
  };

  const deleteRegion = (id: string) => {
    setRegions(prev => prev.filter(r => r.id !== id));
    if (activeRegionId === id) setActiveRegionId(null);
  };

  const updateRegionName = (id: string, name: string) => {
    setRegions(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    const headers = regions.map(r => r.name);
    const rows = files
      .filter(f => f.extractedData)
      .map(f => headers.map(h => `"${(f.extractedData?.[h] || '').replace(/"/g, '""')}"`).join(','));
    const content = [headers.join(','), ...rows].join('\n');
    downloadFile(content, 'scanflow_results.csv', 'text/csv;charset=utf-8;');
  };

  const exportAsJSON = () => {
    const data = files
      .filter(f => f.extractedData)
      .map(f => ({
        fileName: f.file.name,
        data: f.extractedData
      }));
    downloadFile(JSON.stringify(data, null, 2), 'scanflow_results.json', 'application/json');
  };

  const exportAsMarkdown = () => {
    const headers = regions.map(r => r.name);
    let md = `# OCR Extraction Report\n\n`;
    md += `| File Name | ${headers.join(' | ')} |\n`;
    md += `| :--- | ${headers.map(() => ' :--- ').join('|')} |\n`;
    
    files.filter(f => f.extractedData).forEach(f => {
      const row = headers.map(h => f.extractedData?.[h] || '-').join(' | ');
      md += `| ${f.file.name} | ${row} |\n`;
    });
    
    downloadFile(md, 'scanflow_report.md', 'text/markdown');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Layers className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">ScanFlow <span className="text-indigo-600">Lite</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Universal OCR Export</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('editor')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'editor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileText size={18} />
              <span>Editor</span>
            </button>
            <button 
              onClick={() => setView('results')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'results' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <TableIcon size={18} />
              <span>Results</span>
            </button>
          </div>
          
          <button 
            onClick={processAllFiles}
            disabled={isProcessing || files.length === 0 || regions.length === 0}
            className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            <span>{isProcessing ? 'Processing Batch...' : 'Run Automation'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {view === 'editor' ? (
          <>
            {/* LEFT SIDEBAR: FILE QUEUE */}
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                    <FileText size={16} className="text-indigo-500" />
                    <span>File Queue</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    {files.length}
                  </span>
                </div>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                  <Upload className="text-slate-400 group-hover:text-indigo-500 mb-2" size={20} />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Drop Files Here</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {files.map((file, idx) => (
                  <div 
                    key={file.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                      currentIndex === idx 
                        ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-100' 
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-16 bg-slate-100 rounded border overflow-hidden flex-shrink-0">
                        <img src={file.preview} alt="Thumb" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{file.file.name}</p>
                        <div className="flex items-center mt-1">
                          {file.status === 'completed' ? (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">READY</span>
                          ) : file.status === 'processing' ? (
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded animate-pulse">OCR...</span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded">IDLE</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CENTER: CANVAS & AI CONTROLS */}
            <div className="flex-1 bg-slate-100/50 p-8 overflow-y-auto flex flex-col items-center relative">
              {currentFile ? (
                <div className="w-full max-w-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Mapping Area</h2>
                      <div className="h-4 w-px bg-slate-200"></div>
                      <button 
                        onClick={handleManualAutoDetect}
                        disabled={isDetecting}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {isDetecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        <span>{isDetecting ? 'Re-syncing...' : 'Magic Auto-Detect'}</span>
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-slate-400">
                      {currentFile.file.name}
                    </div>
                  </div>
                  
                  <DocumentCanvas 
                    imageSrc={currentFile.preview}
                    regions={regions}
                    onRegionsChange={setRegions}
                    activeRegionId={activeRegionId}
                    onSelectRegion={setActiveRegionId}
                  />

                  {isDetecting && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-2xl">
                       <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 border border-indigo-50 ring-4 ring-indigo-500/5">
                         <div className="relative">
                           <Wand2 className="w-12 h-12 text-indigo-600 animate-pulse" />
                           <Sparkles className="w-6 h-6 text-amber-400 absolute -top-3 -right-3 animate-bounce" />
                         </div>
                         <div className="text-center">
                           <h4 className="font-bold text-slate-800 text-lg">AI Extraction Hint</h4>
                           <p className="text-sm text-slate-500 max-w-[200px]">Gemini is refining the extraction map based on your NLP instructions...</p>
                         </div>
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-indigo-500/5">
                    <Zap size={40} className="text-indigo-600 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Automate Your Scans</h2>
                  <p className="max-w-xs text-center text-slate-500 text-sm mb-8">Upload documents to start. Use the AI Guide to tell Gemini exactly what you're looking for.</p>
                  <label className="flex items-center space-x-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-95">
                    <Upload size={18} />
                    <span>Upload & Auto-Map</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR: MAPPING & AI GUIDE */}
            <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                  <MessageSquareQuote size={16} className="text-indigo-500" />
                  <span>AI Guide (NLP)</span>
                </h3>
              </div>
              
              <div className="p-4 border-b border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Custom Extraction Hints</label>
                <textarea 
                  value={aiHints}
                  onChange={(e) => setAiHints(e.target.value)}
                  placeholder="e.g. 'Look for a Tax ID in the bottom left' or 'Only extract names that are handwritten'."
                  className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none placeholder:text-slate-300"
                />
                <div className="mt-2 flex items-start space-x-2 text-[10px] text-indigo-500 font-medium leading-relaxed">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <p>Type what Gemini might miss. Click 'Magic Auto-Detect' to apply these hints.</p>
                </div>
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                  <Settings size={16} className="text-indigo-500" />
                  <span>Mapping Rules</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {files.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start space-x-3">
                    <div className="mt-0.5">
                      <Zap size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-amber-800 uppercase tracking-tight">Batch Consistency</h4>
                      <p className="text-[10px] leading-relaxed text-amber-700 mt-1">
                        Ensure all documents in this batch follow the same visual format.
                      </p>
                    </div>
                  </div>
                )}

                {regions.map((region) => (
                  <div 
                    key={region.id}
                    className={`p-3 rounded-xl border transition-all ${
                      activeRegionId === region.id 
                        ? 'border-indigo-400 bg-indigo-50/50 shadow-sm' 
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Field Def</span>
                      <button onClick={() => deleteRegion(region.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                    <input 
                      type="text" 
                      value={region.name}
                      onChange={(e) => updateRegionName(region.id, e.target.value)}
                      className="w-full text-xs font-bold bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none pb-1"
                      placeholder="e.g. Invoice Number"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-8 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Batch Results</h2>
                  <p className="text-slate-500 text-sm">Extracted data from {files.length} documents using AI Guidance.</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={exportAsCSV} className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all"><Download size={14} /><span>CSV</span></button>
                  <button onClick={exportAsJSON} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all"><FileJson size={14} /><span>JSON</span></button>
                  <button onClick={exportAsMarkdown} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all"><FileCode size={14} /><span>Markdown</span></button>
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source</th>
                      {regions.map(r => (
                        <th key={r.id} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.map(file => (
                      <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">{file.file.name}</td>
                        {regions.map(r => (
                          <td key={r.id} className="px-6 py-4 text-xs text-slate-600">
                            {file.status === 'completed' ? (file.extractedData?.[r.name] || '-') : <span className="text-slate-300 italic">{file.status === 'processing' ? 'Processing...' : 'Pending'}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Core: Gemini 3 Flash</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-slate-400">
          ScanFlow AI &bull; Smart Batch OCR
        </div>
      </footer>
    </div>
  );
};

export default App;
