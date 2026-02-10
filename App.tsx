
import React, { useState, useMemo, useEffect } from 'react';
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
  RefreshCw,
  Cloud,
  CloudCheck,
  CloudOff,
  History,
  Grid3X3,
  File as FileIcon
} from 'lucide-react';
import { Region, ScannedFile, SyncStatus } from './types';
import DocumentCanvas from './components/DocumentCanvas';
import { extractDataFromImage, detectRegionsFromImage } from './services/geminiService';
import { saveExtractionToFirestore } from './services/firestoreService';
import { appendToGoogleSheet } from './services/googleSheetsService';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

const App: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [view, setView] = useState<'editor' | 'results'>('editor');
  const [aiHints, setAiHints] = useState('');
  
  const batchId = useMemo(() => `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, []);
  const currentFile = files[currentIndex];

  const removeFile = (id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.status === 'processing') return;

    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (currentIndex >= filtered.length && filtered.length > 0) {
        setCurrentIndex(filtered.length - 1);
      }
      return filtered;
    });
  };

  const renderPdfToImage = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Canvas context failed");
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    if (fileList.length === 0) return;

    const processedFiles: ScannedFile[] = [];

    for (const file of fileList) {
      let preview = '';
      if (file.type === 'application/pdf') {
        try {
          preview = await renderPdfToImage(file);
        } catch (err) {
          console.error("PDF Render Error:", err);
          preview = ''; // Fallback
        }
      } else {
        preview = await fileToBase64(file);
      }

      processedFiles.push({
        id: Math.random().toString(36).substring(2, 11),
        file,
        preview,
        status: 'pending' as const,
        syncStatus: 'unsynced' as const,
      });
    }

    setFiles(prev => [...prev, ...processedFiles]);

    if (regions.length === 0 && processedFiles.length > 0) {
      triggerAutoDetectForFile(processedFiles[0]);
    }
  };

  const triggerAutoDetectForFile = async (scannedFile: ScannedFile) => {
    if (!scannedFile.preview) return;
    setIsDetecting(true);
    try {
      const detectedRegions = await detectRegionsFromImage(scannedFile.preview, aiHints);
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

  const processAllFiles = async () => {
    if (regions.length === 0) {
      alert("Please define mapping regions first.");
      return;
    }
    
    setIsProcessing(true);
    setView('results');

    for (let i = 0; i < files.length; i++) {
      const targetFile = files[i];
      if (targetFile.status === 'completed') continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

      try {
        const result = await extractDataFromImage(targetFile.preview, regions, aiHints);
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'completed', extractedData: result, syncStatus: 'syncing' } : f
        ));

        const syncSuccess = await saveExtractionToFirestore(batchId, targetFile.file.name, result, regions);
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, syncStatus: syncSuccess ? 'synced' : 'failed' } : f
        ));

      } catch (error) {
        console.error(`Batch Error:`, error);
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: 'Extraction failed' } : f
        ));
      }
    }
    setIsProcessing(false);
  };

  const exportAsCSV = () => {
    if (files.filter(f => f.status === 'completed').length === 0) {
      alert("No completed extractions to export.");
      return;
    }

    const headers = ['File Name', ...regions.map(r => r.name)];
    const csvRows = files
      .filter(f => f.status === 'completed')
      .map(f => [
        f.file.name,
        ...regions.map(r => `"${(f.extractedData?.[r.name] || '').replace(/"/g, '""')}"`)
      ]);

    const csvContent = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `scanflow_export_${batchId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const syncToGoogleSheets = async () => {
    const spreadsheetId = prompt("Enter Google Spreadsheet ID:");
    const token = prompt("Enter Google API Access Token:");
    if (!spreadsheetId || !token) return;

    alert("Syncing batch to Google Sheets...");
    for (const file of files) {
      if (file.status === 'completed' && file.extractedData) {
        const rowData = [file.file.name, ...regions.map(r => file.extractedData?.[r.name] || '')];
        await appendToGoogleSheet(spreadsheetId, token, rowData);
      }
    }
    alert("Batch sync complete!");
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg"><Layers className="text-white w-6 h-6" /></div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">ScanFlow <span className="text-indigo-600">Enterprise</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Supports PDF & Image</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setView('editor')} className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'editor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}><FileText size={18} /><span>Editor</span></button>
            <button onClick={() => setView('results')} className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'results' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}><TableIcon size={18} /><span>Results Hub</span></button>
          </div>
          <button 
            onClick={processAllFiles}
            disabled={isProcessing || files.length === 0 || regions.length === 0}
            className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            <span>{isProcessing ? 'Processing Batch...' : 'Run Automation'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {view === 'editor' ? (
          <>
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700 flex items-center space-x-2"><FileText size={16} className="text-indigo-500" /><span>Queue</span></h3>
                </div>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer group transition-all">
                  <Upload className="text-slate-400 group-hover:text-indigo-500 mb-1" size={20} />
                  <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600">Drop PDF or Images</span>
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {files.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <FileIcon className="text-slate-300" size={24} />
                    </div>
                    <p className="text-xs font-medium text-slate-400">Queue is empty. Upload PDFs or scans to start.</p>
                  </div>
                )}
                {files.map((file, idx) => (
                  <div key={file.id} onClick={() => setCurrentIndex(idx)} className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${currentIndex === idx ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-100' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-14 bg-slate-100 rounded border overflow-hidden flex-shrink-0">
                        {file.preview ? (
                          <img src={file.preview} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50"><FileIcon size={16} className="text-slate-300"/></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate pr-4">{file.file.name}</p>
                        <div className="flex items-center mt-1">
                          {file.status === 'error' ? (
                            <span className="text-[8px] font-bold text-red-500">FAILED</span>
                          ) : (
                            <span className={`text-[8px] font-bold uppercase tracking-wider ${file.status === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`}>
                              {file.status}
                            </span>
                          )}
                        </div>
                      </div>
                      {file.status !== 'processing' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all absolute right-2 top-2"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-slate-100/50 p-8 flex flex-col items-center relative overflow-y-auto">
              {currentFile ? (
                <div className="w-full max-w-3xl space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center space-x-4">
                      <span>Blueprint Canvas</span>
                      <button onClick={() => triggerAutoDetectForFile(currentFile)} className="text-indigo-600 flex items-center space-x-1 hover:text-indigo-700 transition-colors"><RefreshCw size={12}/><span>Recalibrate</span></button>
                    </div>
                    <span>{currentFile.file.name}</span>
                  </div>
                  <DocumentCanvas 
                    imageSrc={currentFile.preview}
                    regions={regions}
                    onRegionsChange={setRegions}
                    activeRegionId={activeRegionId}
                    onSelectRegion={setActiveRegionId}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6"><Zap className="text-indigo-600 animate-pulse" size={32}/></div>
                  <h2 className="text-2xl font-bold text-slate-800">Workspace Ready</h2>
                  <p className="text-slate-500 text-sm max-w-xs mt-2">Upload document scans or PDFs to start mapping your data fields for this batch.</p>
                </div>
              )}
            </div>

            <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center space-x-2"><MessageSquareQuote size={16} className="text-indigo-500" /><span>AI Guidance</span></h3>
              </div>
              <div className="p-4 border-b border-slate-100">
                <textarea 
                  value={aiHints}
                  onChange={(e) => setAiHints(e.target.value)}
                  placeholder="Tell Gemini what to prioritize (e.g., 'Look for handwritten signatures')..."
                  className="w-full h-32 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                />
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center space-x-2"><Settings size={16} className="text-indigo-500" /><span>Mapping Rules</span></h3>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                {regions.length === 0 && (
                  <div className="text-center py-6 px-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No Regions Mapped</p>
                    <p className="text-[9px] text-slate-400 mt-1">Draw areas on the canvas to define extraction fields.</p>
                  </div>
                )}
                {regions.map((region) => (
                  <div key={region.id} className={`group flex items-center justify-between p-2 rounded-xl border text-[11px] font-bold transition-all ${activeRegionId === region.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                    <input 
                      type="text" 
                      value={region.name}
                      onChange={(e) => setRegions(regions.map(r => r.id === region.id ? {...r, name: e.target.value} : r))}
                      className="bg-transparent outline-none flex-1"
                    />
                    <button onClick={() => setRegions(regions.filter(r => r.id !== region.id))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-colors"><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-white overflow-hidden p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Results Hub</h2>
                <p className="text-slate-500 text-sm">Review batch extractions and sync to external systems.</p>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={exportAsCSV}
                  className="flex items-center space-x-2 px-6 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all active:scale-95"
                >
                  <Download size={16} />
                  <span>Download CSV</span>
                </button>
                <button 
                  onClick={syncToGoogleSheets}
                  className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                >
                  <Grid3X3 size={16} />
                  <span>Sync to Sheets</span>
                </button>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <button onClick={() => setView('editor')} className="text-xs font-bold text-indigo-600 hover:underline">Back to Mapping</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Document</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-center">Sync Status</th>
                    {regions.map(r => <th key={r.id} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{r.name}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map(file => (
                    <tr key={file.id} className={`${file.status === 'error' ? 'bg-red-50/50' : 'hover:bg-slate-50/50 transition-colors'}`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{file.file.name}</span>
                          {file.status === 'error' && <span className="text-[9px] text-red-500 font-bold uppercase mt-0.5">Extraction Failed</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {file.syncStatus === 'synced' ? <CloudCheck className="mx-auto text-emerald-500" size={16}/> : 
                         file.syncStatus === 'syncing' ? <Loader2 className="mx-auto text-indigo-400 animate-spin" size={16}/> : 
                         file.syncStatus === 'failed' ? <CloudOff className="mx-auto text-red-400" size={16}/> :
                         <Cloud className="mx-auto text-slate-200" size={16}/>}
                      </td>
                      {regions.map(r => (
                        <td key={r.id} className="px-6 py-4 text-xs text-slate-600 font-medium">
                          {file.status === 'completed' ? (file.extractedData?.[r.name] || '-') : <span className="text-slate-300 italic uppercase text-[10px]">{file.status}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span>System: Active</span>
          </div>
          <div className="flex items-center space-x-2 border-l border-slate-200 pl-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <History size={12} className="text-slate-400"/>
            <span>Batch Persistence: Firestore</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-[10px] font-bold text-slate-400">
          <span>Synced to Cloud: {files.filter(f => f.syncStatus === 'synced').length} / {files.length}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
