
import React, { useState } from 'react';
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
  ClipboardList
} from 'lucide-react';
import { Region, ScannedFile } from './types';
import DocumentCanvas from './components/DocumentCanvas';
import { extractDataFromImage } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'editor' | 'results'>('editor');

  const currentFile = files[currentIndex];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    const newFiles: ScannedFile[] = fileList.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
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
      if (files[i].status === 'completed') continue;

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

      try {
        const file = files[i].file;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const result = await extractDataFromImage(base64, regions);
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
            disabled={isProcessing || files.length === 0}
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

            <div className="flex-1 bg-slate-100/50 p-8 overflow-y-auto flex flex-col items-center">
              {currentFile ? (
                <div className="w-full max-w-3xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Mapping Area</h2>
                    <p className="text-xs font-semibold text-slate-400">Targeting: {currentFile.file.name}</p>
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
                    <FileText size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-600 mb-2">No Document Selected</h2>
                  <p className="max-w-xs text-center text-sm">Upload images to begin mapping the extraction fields.</p>
                </div>
              )}
            </div>

            <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center space-x-2">
                  <Settings size={16} className="text-indigo-500" />
                  <span>Mapping Rules</span>
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Field Definition</span>
                      <button onClick={() => deleteRegion(region.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
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
                {regions.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Plus className="text-slate-300" size={20} />
                    </div>
                    <p className="text-xs text-slate-400 font-medium px-6 leading-relaxed">Draw a rectangle on the document to define an extraction field.</p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-indigo-50 border-t border-indigo-100">
                <div className="flex items-center space-x-2 mb-2">
                  <ClipboardList size={14} className="text-indigo-600" />
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">Batch Stats</span>
                </div>
                <div className="space-y-1 text-[10px] font-semibold text-indigo-600/70">
                  <div className="flex justify-between"><span>Files in queue:</span> <span>{files.length}</span></div>
                  <div className="flex justify-between"><span>Active fields:</span> <span>{regions.length}</span></div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Export Hub</h2>
                  <p className="text-slate-500 text-sm">Your extracted data is ready. Choose your preferred format below.</p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={exportAsCSV}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all"
                  >
                    <Download size={14} />
                    <span>CSV</span>
                  </button>
                  <button 
                    onClick={exportAsJSON}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all"
                  >
                    <FileJson size={14} />
                    <span>JSON</span>
                  </button>
                  <button 
                    onClick={exportAsMarkdown}
                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all"
                  >
                    <FileCode size={14} />
                    <span>Markdown</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source Document</th>
                      {regions.map(r => (
                        <th key={r.id} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.filter(f => f.status === 'completed').map(file => (
                      <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                              <CheckCircle2 size={16} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{file.file.name}</span>
                          </div>
                        </td>
                        {regions.map(r => (
                          <td key={r.id} className="px-6 py-4 text-xs text-slate-600 font-medium">
                            {file.extractedData?.[r.name] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {files.filter(f => f.status === 'completed').length === 0 && !isProcessing && (
                <div className="text-center py-20 bg-slate-50 rounded-3xl mt-4 border border-dashed border-slate-200">
                  <TableIcon className="mx-auto mb-4 text-slate-300" size={48} />
                  <h3 className="text-lg font-bold text-slate-600 mb-2">No Processed Data</h3>
                  <p className="text-slate-500 text-sm mb-6">Return to the editor and run automation to see results here.</p>
                  <button 
                    onClick={() => setView('editor')}
                    className="inline-flex items-center space-x-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                  >
                    <span>Back to Workspace</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="block w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Model: Gemini 3 Flash</span>
          </div>
          <div className="flex items-center space-x-2 border-l border-slate-200 pl-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Privacy: Local-Only Export</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-slate-400">
          ScanFlow v2.5 &bull; Build 2024.12
        </div>
      </footer>
    </div>
  );
};

export default App;
