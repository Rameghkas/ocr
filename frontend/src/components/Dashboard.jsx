import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut, Upload, Camera, FileText, CheckCircle2,
  AlertCircle, Loader2, Copy, Check, RefreshCw, Trash2, FileCheck
} from 'lucide-react';

export default function Dashboard({ token, onLogout }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Ref for native input triggers
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Load and refresh documents list from FastAPI backend
  const fetchDocuments = async (showLoader = true) => {
    if (showLoader) setLoadingDocs(true);
    try {
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
        
        // If a document is currently selected, refresh its details from the updated list
        if (selectedDoc) {
          const updatedSelected = data.find(d => d.id === selectedDoc.id);
          if (updatedSelected) {
            setSelectedDoc(updatedSelected);
          }
        }
      } else if (response.status === 401) {
        // Token expired or invalid
        onLogout();
      } else {
        console.error("Failed to fetch documents from server");
      }
    } catch (err) {
      console.error("Network error fetching documents:", err);
    } finally {
      if (showLoader) setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Setup polling every 3s for documents currently processing or queued
    const interval = setInterval(() => {
      setDocuments(prev => {
        const hasActive = prev.some(d => d.status === 'queued' || d.status === 'processing');
        if (hasActive) {
          fetchDocuments(false);
        }
        return prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedDoc?.id]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(detail.detail || 'Upload failed');
      }

      const data = await response.json();
      // Add newly queued document to top of list and select it
      setDocuments(prev => [data, ...prev]);
      setSelectedDoc(data);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id));
        if (selectedDoc && selectedDoc.id === id) {
          setSelectedDoc(null);
        }
      } else {
        alert('Failed to delete document');
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
            <RefreshCw className="h-3 w-3 animate-spin-reverse" /> Queued
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header Banner */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold text-sm">
            L
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Lumina Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onLogout}
            className="flex items-center justify-center p-2 rounded-xl bg-slate-800/50 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/20 transition-all duration-200"
            title="Log Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-4 overflow-hidden">
        
        {/* Left Section: Upload and Queue List */}
        <section className="flex-1 flex flex-col gap-4 min-w-0 md:max-w-md">
          {/* Upload Box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm/50">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-3 ml-0.5">
              Upload Document Snapshot
            </h2>

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                dragActive
                  ? 'border-purple-500 bg-purple-500/5 shadow-inner'
                  : 'border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-900/20'
              }`}
            >
              {uploading ? (
                <div className="py-2 flex flex-col items-center gap-2">
                  <Loader2 className="h-10 w-10 text-purple-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Uploading to FastAPI backend...</p>
                </div>
              ) : (
                <div className="text-center flex flex-col items-center">
                  <div className="p-3 mb-2 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">Drag & drop or Click to choose a file</p>
                  <p className="text-[10px] text-slate-500 mt-1">PDF, PNG, JPG, JPEG up to 10MB</p>
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInput}
                accept="image/*,application/pdf"
                className="hidden"
              />
            </div>

            {/* Mobile Native Camera Input */}
            <div className="grid grid-cols-1 mt-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 font-semibold text-xs text-slate-300 transition-all duration-200"
              >
                <Camera className="h-4 w-4 text-purple-400" />
                Snapshot Mobile Camera Capture
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                onChange={handleFileInput}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </div>

            {uploadError && (
              <div className="mt-3 p-2 text-xs rounded-lg border border-red-500/20 bg-red-500/5 text-red-400">
                {uploadError}
              </div>
            )}
          </div>

          {/* Processing Queue */}
          <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-4 min-h-[250px] shadow-sm/50 overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400 ml-0.5">
                Processing Queue
              </h2>
              <button
                onClick={() => fetchDocuments(true)}
                disabled={loadingDocs}
                className="p-1.5 rounded-lg border border-slate-850 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                title="Refresh queue"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Queue Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {documents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <FileText className="h-10 w-10 mb-2 stroke-[1.5]" />
                  <p className="text-xs">No documents uploaded yet</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Upload a photo to execute OCR</p>
                </div>
              ) : (
                documents.map((doc) => {
                  const isCur = selectedDoc && selectedDoc.id === doc.id;
                  const dateStr = new Date(doc.upload_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`flex flex-col p-3 rounded-xl border cursor-pointer select-none relative transition-all duration-200 ${
                        isCur
                          ? 'border-purple-500/50 bg-purple-500/10'
                          : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-800 hover:bg-slate-950/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`p-2 rounded-lg mt-0.5 ${isCur ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-900 text-slate-400'}`}>
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate pr-4">{doc.filename}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{dateStr}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          className="text-slate-600 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-2 items-center justify-between mt-2.5 pt-2 border-t border-slate-900/50">
                        {getStatusBadge(doc.status)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Section: OCR Detailed Results */}
        <section className="flex-2 flex flex-col min-w-0 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm/50">
          {selectedDoc ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate text-slate-200">{selectedDoc.filename}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(selectedDoc.status)}
                    <span className="text-[10px] text-slate-500">
                      Uploaded {new Date(selectedDoc.upload_date).toLocaleString()}
                    </span>
                  </div>
                </div>

                {selectedDoc.status === 'completed' && selectedDoc.raw_text && (
                  <button
                    onClick={() => copyToClipboard(selectedDoc.raw_text)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-300 transition-all select-none active:scale-[0.98]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Text Output Pane */}
              <div className="flex-1 overflow-y-auto pr-0.5 rounded-xl bg-slate-950/80 border border-slate-900/80 p-4">
                {selectedDoc.status === 'completed' ? (
                  selectedDoc.raw_text ? (
                    <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text selection:bg-purple-500/35">
                      {selectedDoc.raw_text}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-600">
                      <FileCheck className="h-10 w-10 mb-2 stroke-[1.5] text-slate-700" />
                      <p className="text-xs">Document processed, but no text characters were detected.</p>
                      <p className="text-[10px] text-slate-700 mt-0.5">Ensure image is clear and contains readable text.</p>
                    </div>
                  )
                ) : selectedDoc.status === 'processing' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/20 rounded-xl">
                    <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-3" />
                    <h3 className="text-sm font-semibold text-slate-200">Processing OCR on Server...</h3>
                    <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
                      Preprocessing image and extracting characters using CPU Tesseract OCR engine.
                    </p>
                  </div>
                ) : selectedDoc.status === 'failed' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/20 rounded-xl max-w-md mx-auto">
                    <div className="p-3 rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/20 mb-3">
                      <AlertCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-sm font-semibold text-rose-400">OCR Extraction Failed</h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed bg-rose-500/[0.03] border border-rose-500/10 p-3 rounded-lg w-full">
                      {selectedDoc.error_message || 'An error occurred during OCR text extraction.'}
                    </p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-600">
                    <RefreshCw className="h-8 w-8 mb-2 animate-spin-reverse text-slate-700" />
                    <p className="text-xs">Document is queued in server pipeline...</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 select-none">
              <div className="p-4 mb-3 rounded-full bg-slate-900/60 border border-slate-800 text-slate-400">
                <FileText className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">No Document Selected</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
                Select a document from the queue list to inspect extracted text or check processing status.
              </p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
