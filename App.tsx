
import React, { useState, useCallback, useEffect } from 'react';
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
  FileSpreadsheet,
  Link2,
  AlertCircle,
  RefreshCcw
} from 'lucide-react';
import { Region, ScannedFile, OCRResult } from './types';
import DocumentCanvas from './components/DocumentCanvas';
import { extractDataFromImage } from './services/geminiService';
import { appendToGoogleSheet } from './services/googleSheetsService';

const App: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'editor' | 'results'>('editor');
  
  // Google Sheets Integration State
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isSheetEnabled, setIsSheetEnabled] = useState(false);

  const currentFile = files[currentIndex];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    const newFiles: ScannedFile[] = fileList.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
      sheetSyncStatus: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
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

  const processAllFiles = async () => {
    if (regions.length === 0) {
      alert("Please define at least one region to extract.");
      return;
    }
    
    setIsProcessing(true);
    setView('results');

    for (let i = 0; i < files.length; i++) {
      // Skip if already completed and synced (unless re-running is needed)
      if (files[i].status === 'completed' && (!isSheetEnabled || files[i].sheetSyncStatus === 'synced')) continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

      try {
        const file = files[i].file;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 1. OCR Stage
        const result = await extractDataFromImage(base64, regions);
        
        // Update status to completed locally
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'completed', extractedData: result } : f
        ));

        // 2. Google Sheets Stage (if enabled)
        if (isSheetEnabled && spreadsheetId && accessToken) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, sheetSyncStatus: 'syncing' } : f));
          
          const rowData = regions.map(r => result[r.name] || "");
          const success = await appendToGoogleSheet(spreadsheetId, accessToken, rowData);
          
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, sheetSyncStatus: success ? 'synced' : 'failed' } : f
          ));
        }
      } catch (error) {
        console.error("Extraction/Sync error:", error);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', sheetSyncStatus: 'failed' } : f));
      }
    }

    setIsProcessing(false);
  };

  const exportToCSV = () => {
    const headers = regions.map(r => r.name);
    const rows = files
      .filter(f => f.extractedData)
      .map(f => headers.map(h => `"${(f.extractedData?.[h] || '').replace(/"/g, '""')}"`).join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "extracted_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Layers className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">ScanFlow OCR <span className="text-blue-600">Pro</span></h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Cloud Data Pipeline</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('editor')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'editor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileText size={18} />
              <span>Editor</span>
            </button>
            <button 
              onClick={() => setView('results')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'results' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <TableIcon size={18} />
              <span>Results</span>
            </button>
          </div>
          
          <button 
            onClick={processAllFiles}
            disabled={isProcessing || files.length === 0}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            <span>{isProcessing ? 'Running Pipeline...' : 'Run Automation'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {view === 'editor' ? (
          <>
            {/* Left Sidebar: File Queue */}
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                    <FileText size={16} className="text-blue-500" />
                    <span>File Queue</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    {files.length}
                  </span>
                </div>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                  <Upload className="text-slate-400 group-hover:text-blue-500 mb-2" size={20} />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600">Upload Documents</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {files.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                    <FileText className="mx-auto mb-2" size={32} />
                    <p className="text-sm">No files uploaded</p>
                  </div>
                )}
                {files.map((file, idx) => (
                  <div 
                    key={file.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                      currentIndex === idx 
                        ? 'border-blue-200 bg-blue-50 ring-1 ring-blue-100' 
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-16 bg-slate-100 rounded border overflow-hidden flex-shrink-0">
                        <img src={file.preview} alt="Thumb" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{file.file.name}</p>
                        <div className="flex items-center mt-1 space-x-1">
                          {file.status === 'completed' ? (
                            <span className="flex items-center text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                              OCR READY
                            </span>
                          ) : file.status === 'processing' ? (
                            <span className="flex items-center text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              <Loader2 size={8} className="mr-1 animate-spin" /> OCR
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 border border-slate-200 rounded">PENDING</span>
                          )}
                          
                          {file.sheetSyncStatus === 'synced' && (
                            <span className="flex items-center text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                              SYNCED
                            </span>
                          )}
                          {file.sheetSyncStatus === 'failed' && (
                            <span className="flex items-center text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                              SYNC FAIL
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle: Canvas */}
            <div className="flex-1 bg-slate-100/50 p-8 overflow-y-auto flex flex-col items-center">
              {currentFile ? (
                <div className="w-full max-w-3xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Workspace: {currentFile.file.name}</h2>
                    <p className="text-xs font-semibold text-slate-400 italic">Drag boxes over the text areas you want to extract.</p>
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
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                    <Upload size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-600 mb-2">Ready to Start?</h2>
                  <p className="max-w-xs text-center text-sm">Upload your scanned files to the left and start mapping data extraction fields.</p>
                </div>
              )}
            </div>

            {/* Right Sidebar: Field Editor & Sheets Settings */}
            <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {/* Mapping Rules Section */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                    <Settings size={16} className="text-blue-500" />
                    <span>Mapping Rules</span>
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {regions.length === 0 && (
                    <div className="text-center py-6">
                      <Plus className="mx-auto mb-2 text-slate-300" size={24} />
                      <p className="text-xs text-slate-400 px-4">Draw areas on the document to create data fields.</p>
                    </div>
                  )}
                  {regions.map((region) => (
                    <div 
                      key={region.id}
                      className={`p-3 rounded-xl border transition-all ${
                        activeRegionId === region.id 
                          ? 'border-blue-400 bg-blue-50/50 shadow-sm' 
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">FIELD</span>
                        <button onClick={() => deleteRegion(region.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                      <input 
                        type="text" 
                        value={region.name}
                        onChange={(e) => updateRegionName(region.id, e.target.value)}
                        className="w-full text-xs font-bold bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-1"
                        placeholder="Field Name"
                      />
                    </div>
                  ))}
                </div>

                {/* Google Sheets Integration Section */}
                <div className="mt-4 p-4 border-t border-slate-100 bg-slate-50/30">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                      <FileSpreadsheet size={16} className="text-emerald-500" />
                      <span>Google Sheets Sync</span>
                    </h3>
                    <div 
                      onClick={() => setIsSheetEnabled(!isSheetEnabled)}
                      className={`w-10 h-5 rounded-full cursor-pointer transition-colors relative ${isSheetEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isSheetEnabled ? 'left-6' : 'left-1'}`} />
                    </div>
                  </div>
                  
                  {isSheetEnabled && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spreadsheet ID</label>
                        <input 
                          type="text" 
                          value={spreadsheetId}
                          onChange={(e) => setSpreadsheetId(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                          placeholder="Paste ID from URL..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Access Token</label>
                        <div className="relative">
                          <input 
                            type="password" 
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            placeholder="Bearer OAuth Token"
                          />
                          <Link2 size={12} className="absolute right-3 top-2.5 text-slate-300" />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">Requires 'https://www.googleapis.com/auth/spreadsheets' scope.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Mapping active: {regions.length} fields. 
                  Sheets Sync: {isSheetEnabled ? 'Active' : 'Disabled'}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Extraction & Sync Pipeline</h2>
                  <p className="text-slate-500 text-sm">Real-time status of document data extraction and cloud synchronization.</p>
                </div>
                <div className="flex space-x-3">
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center space-x-2 px-6 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    <Download size={18} />
                    <span>Download CSV</span>
                  </button>
                  {isSheetEnabled && (
                    <div className="flex items-center px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-bold">
                      <CheckCircle2 size={16} className="mr-2" />
                      Live Sheets Sync Active
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Document</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">OCR Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Sheets Sync</th>
                      {regions.map(r => (
                        <th key={r.id} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.map(file => (
                      <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                              <FileText size={16} />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 truncate max-w-[150px]">{file.file.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {file.status === 'completed' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                              SUCCESS
                            </span>
                          ) : file.status === 'processing' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              <Loader2 size={12} className="mr-1 animate-spin" /> RUNNING
                            </span>
                          ) : file.status === 'error' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              FAILED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {!isSheetEnabled ? (
                            <span className="text-[10px] font-bold text-slate-300">DISABLED</span>
                          ) : file.sheetSyncStatus === 'synced' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 size={12} className="mr-1" /> SYNCED
                            </span>
                          ) : file.sheetSyncStatus === 'syncing' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              <RefreshCcw size={12} className="mr-1 animate-spin" /> PUSHING...
                            </span>
                          ) : file.sheetSyncStatus === 'failed' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              <AlertCircle size={12} className="mr-1" /> ERROR
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              WAITING
                            </span>
                          )}
                        </td>
                        {regions.map(r => (
                          <td key={r.id} className="px-6 py-4 text-sm text-slate-600 font-medium">
                            {file.extractedData?.[r.name] || (file.status === 'processing' ? '...' : '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {files.length === 0 && !isProcessing && (
                <div className="text-center py-20 bg-slate-50 rounded-3xl mt-4 border border-dashed border-slate-200">
                  <TableIcon className="mx-auto mb-4 text-slate-300" size={48} />
                  <h3 className="text-lg font-bold text-slate-600 mb-2">Workspace Empty</h3>
                  <p className="text-slate-500 text-sm mb-6">Upload some files to see the extraction pipeline in action.</p>
                  <button 
                    onClick={() => setView('editor')}
                    className="inline-flex items-center space-x-2 text-blue-600 font-bold hover:text-blue-700 transition-colors"
                  >
                    <span>Go to Editor</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Persistent Status Bar */}
      <footer className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intelligence: Gemini 3 Flash</span>
          </div>
          <div className="flex items-center space-x-2 border-l border-slate-200 pl-6">
            <div className={`w-2 h-2 rounded-full ${isSheetEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Cloud Sync: {isSheetEnabled ? 'Real-time' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="text-[10px] font-medium text-slate-400">
          ScanFlow v2.0 &bull; Secure OCR &bull; &copy; 2024
        </div>
      </footer>
    </div>
  );
};

export default App;
