import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut, Upload, Camera, FileText, CheckCircle2,
  AlertCircle, Loader2, Copy, Check, RefreshCw, Trash2, FileCheck,
  Calendar, MapPin, Scale, Coins, Edit, Save, X, Eye
} from 'lucide-react';

export default function Dashboard({ token, onLogout }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [activeTab, setActiveTab] = useState('structured');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    challan_date: '',
    source_address: '',
    destination_address: '',
    total_kg: '',
    total_cost: ''
  });
  const [savingFields, setSavingFields] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Sync edits state when a document changes or its status completes
  useEffect(() => {
    if (selectedDoc) {
      setEditedData({
        challan_date: selectedDoc.structured_data?.challan_date || '',
        source_address: selectedDoc.structured_data?.source_address || '',
        destination_address: selectedDoc.structured_data?.destination_address || '',
        total_kg: selectedDoc.structured_data?.total_kg !== null && selectedDoc.structured_data?.total_kg !== undefined ? selectedDoc.structured_data.total_kg : '',
        total_cost: selectedDoc.structured_data?.total_cost !== null && selectedDoc.structured_data?.total_cost !== undefined ? selectedDoc.structured_data.total_cost : ''
      });
      setIsEditing(false);
      // Reset to structured tab when a new document is selected
      if (selectedDoc.status !== 'completed') {
        setActiveTab('structured');
      }
    }
  }, [selectedDoc?.id, selectedDoc?.status]);

  const copyField = (fieldKey, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value.toString());
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleSaveStructuredData = async () => {
    setSavingFields(true);
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}/structured`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          challan_date: editedData.challan_date || null,
          source_address: editedData.source_address || null,
          destination_address: editedData.destination_address || null,
          total_kg: editedData.total_kg !== '' ? parseFloat(editedData.total_kg) : null,
          total_cost: editedData.total_cost !== '' ? parseFloat(editedData.total_cost) : null
        })
      });
      if (response.ok) {
        const updatedDoc = await response.json();
        setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
        setSelectedDoc(updatedDoc);
        setIsEditing(false);
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error("Save structured data error:", err);
      alert("Network error saving changes.");
    } finally {
      setSavingFields(false);
    }
  };
  
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

                {selectedDoc.status === 'completed' && activeTab === 'raw' && selectedDoc.raw_text && (
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

              {/* Tab Navigation */}
              {selectedDoc.status === 'completed' && (
                <div className="flex border-b border-slate-800 mb-4 shrink-0">
                  <button
                    onClick={() => setActiveTab('structured')}
                    className={`pb-2.5 px-4 text-xs font-semibold tracking-wide border-b-2 transition-all ${
                      activeTab === 'structured'
                        ? 'border-purple-500 text-purple-400 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Structured Challan
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`pb-2.5 px-4 text-xs font-semibold tracking-wide border-b-2 transition-all ${
                      activeTab === 'raw'
                        ? 'border-purple-500 text-purple-400 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Raw Extracted Text
                  </button>
                </div>
              )}

              {/* Text Output Pane */}
              <div className="flex-1 overflow-y-auto pr-0.5 rounded-xl bg-slate-950/80 border border-slate-900/80 p-4">
                {selectedDoc.status === 'completed' ? (
                  activeTab === 'structured' ? (
                    /* Structured Cards Mode */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-450">
                          Challan Structured Information
                        </span>
                        {!isEditing ? (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-850 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-purple-400 transition-all select-none"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit Fields
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveStructuredData}
                              disabled={savingFields}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-all select-none disabled:opacity-50"
                            >
                              {savingFields ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setIsEditing(false);
                                setEditedData({
                                  challan_date: selectedDoc.structured_data?.challan_date || '',
                                  source_address: selectedDoc.structured_data?.source_address || '',
                                  destination_address: selectedDoc.structured_data?.destination_address || '',
                                  total_kg: selectedDoc.structured_data?.total_kg !== null && selectedDoc.structured_data?.total_kg !== undefined ? selectedDoc.structured_data.total_kg : '',
                                  total_cost: selectedDoc.structured_data?.total_cost !== null && selectedDoc.structured_data?.total_cost !== undefined ? selectedDoc.structured_data.total_cost : ''
                                });
                              }}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all select-none"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Info Fields Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Challan Date */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                              <Calendar className="h-4 w-4 text-purple-450" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Challan Date</span>
                            </div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editedData.challan_date}
                                onChange={(e) => setEditedData(prev => ({ ...prev, challan_date: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="YYYY-MM-DD or DD/MM/YYYY"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-slate-200 min-h-[24px]">
                                {selectedDoc.structured_data?.challan_date || <span className="text-slate-600 font-normal italic">Not detected</span>}
                              </p>
                            )}
                          </div>
                          {!isEditing && selectedDoc.structured_data?.challan_date && (
                            <button
                              onClick={() => copyField('challan_date', selectedDoc.structured_data.challan_date)}
                              className="self-end mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-350 transition-colors"
                            >
                              {copiedField === 'challan_date' ? (
                                <><Check className="h-3 w-3 text-emerald-450" /> <span className="text-emerald-400">Copied</span></>
                              ) : (
                                <><Copy className="h-3 w-3" /> Copy</>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Total KG */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                              <Scale className="h-4 w-4 text-amber-450" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total KG</span>
                            </div>
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editedData.total_kg}
                                onChange={(e) => setEditedData(prev => ({ ...prev, total_kg: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="e.g. 12000"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-slate-200 min-h-[24px]">
                                {selectedDoc.structured_data?.total_kg !== null && selectedDoc.structured_data?.total_kg !== undefined ? (
                                  `${selectedDoc.structured_data.total_kg.toLocaleString()} KG`
                                ) : (
                                  <span className="text-slate-650 font-normal italic text-slate-500">Not detected</span>
                                )}
                              </p>
                            )}
                          </div>
                          {!isEditing && selectedDoc.structured_data?.total_kg !== null && selectedDoc.structured_data?.total_kg !== undefined && (
                            <button
                              onClick={() => copyField('total_kg', selectedDoc.structured_data.total_kg)}
                              className="self-end mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-355 transition-colors"
                            >
                              {copiedField === 'total_kg' ? (
                                <><Check className="h-3 w-3 text-emerald-450" /> <span className="text-emerald-405">Copied</span></>
                              ) : (
                                <><Copy className="h-3 w-3" /> Copy</>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Total Cost */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                              <Coins className="h-4 w-4 text-emerald-450" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Cost</span>
                            </div>
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editedData.total_cost}
                                onChange={(e) => setEditedData(prev => ({ ...prev, total_cost: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="e.g. 25000"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-slate-200 min-h-[24px]">
                                {selectedDoc.structured_data?.total_cost !== null && selectedDoc.structured_data?.total_cost !== undefined ? (
                                  `₹ ${selectedDoc.structured_data.total_cost.toLocaleString()}`
                                ) : (
                                  <span className="text-slate-650 font-normal italic text-slate-500">Not detected</span>
                                )}
                              </p>
                            )}
                          </div>
                          {!isEditing && selectedDoc.structured_data?.total_cost !== null && selectedDoc.structured_data?.total_cost !== undefined && (
                            <button
                              onClick={() => copyField('total_cost', selectedDoc.structured_data.total_cost)}
                              className="self-end mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-355 transition-colors"
                            >
                              {copiedField === 'total_cost' ? (
                                <><Check className="h-3 w-3 text-emerald-455" /> <span className="text-emerald-405">Copied</span></>
                              ) : (
                                <><Copy className="h-3 w-3" /> Copy</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Addresses */}
                      <div className="space-y-4 mt-2">
                        {/* Source Address */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                              <MapPin className="h-4 w-4 text-purple-450" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Source Address</span>
                            </div>
                            {isEditing ? (
                              <textarea
                                rows={2}
                                value={editedData.source_address}
                                onChange={(e) => setEditedData(prev => ({ ...prev, source_address: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors resize-y font-sans"
                                placeholder="Origin Address"
                              />
                            ) : (
                              <p className="text-xs text-slate-200 leading-relaxed font-medium min-h-[24px] whitespace-pre-wrap">
                                {selectedDoc.structured_data?.source_address || <span className="text-slate-655 font-normal italic text-slate-500">Not detected</span>}
                              </p>
                            )}
                          </div>
                          {!isEditing && selectedDoc.structured_data?.source_address && (
                            <button
                              onClick={() => copyField('source_address', selectedDoc.structured_data.source_address)}
                              className="self-end mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-350 transition-colors"
                            >
                              {copiedField === 'source_address' ? (
                                <><Check className="h-3 w-3 text-emerald-450" /> <span className="text-emerald-400">Copied</span></>
                              ) : (
                                <><Copy className="h-3 w-3" /> Copy Address</>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Destination Address */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                              <MapPin className="h-4 w-4 text-sky-450" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Destination Address</span>
                            </div>
                            {isEditing ? (
                              <textarea
                                rows={2}
                                value={editedData.destination_address}
                                onChange={(e) => setEditedData(prev => ({ ...prev, destination_address: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors resize-y font-sans"
                                placeholder="Destination Address"
                              />
                            ) : (
                              <p className="text-xs text-slate-200 leading-relaxed font-medium min-h-[24px] whitespace-pre-wrap">
                                {selectedDoc.structured_data?.destination_address || <span className="text-slate-655 font-normal italic text-slate-500">Not detected</span>}
                              </p>
                            )}
                          </div>
                          {!isEditing && selectedDoc.structured_data?.destination_address && (
                            <button
                              onClick={() => copyField('destination_address', selectedDoc.structured_data.destination_address)}
                              className="self-end mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-350 transition-colors"
                            >
                              {copiedField === 'destination_address' ? (
                                <><Check className="h-3 w-3 text-emerald-450" /> <span className="text-emerald-400">Copied</span></>
                              ) : (
                                <><Copy className="h-3 w-3" /> Copy Address</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Raw text display mode */
                    selectedDoc.raw_text ? (
                      <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text selection:bg-purple-500/35">
                        {selectedDoc.raw_text}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-600">
                        <FileCheck className="h-10 w-10 mb-2 stroke-[1.5] text-slate-700" />
                        <p className="text-xs">Document processed, but no text characters were detected.</p>
                      </div>
                    )
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
