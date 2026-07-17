import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Languages,
  Download,
  AlertCircle,
  ArrowRight,
  Edit2,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { exportToDocx } from "./utils/docxExport";

export default function App() {
  // File details
  const [file, setFile] = useState<File | null>(null);
  const [base64Data, setBase64Data] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Document structure and pages
  const [originalPages, setOriginalPages] = useState<string[]>([]);
  const [translatedPages, setTranslatedPages] = useState<string[]>([]);
  const [editedTranslations, setEditedTranslations] = useState<string[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<"assamese" | "bodo">("assamese");
  
  // App states
  const [currentStep, setCurrentStep] = useState<"upload" | "parsed" | "translating" | "result">("upload");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Refinement states
  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");
  
  // Download styling
  const [docxMode, setDocxMode] = useState<"translated-only" | "side-by-side" | "alternating">("translated-only");
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [dragOver, setDragOver] = useState(false);

  // Handle file selection
  const processFile = (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      setErrorMessage("Only PDF documents are supported.");
      return;
    }
    setErrorMessage(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Get base64 string without data:application/pdf;base64, prefix
      const base64 = result.split(",")[1];
      setBase64Data(base64);
      parsePdf(base64, selectedFile.name);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Hit the backend parser
  const parsePdf = async (base64String: string, name: string) => {
    setIsParsing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64String }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to parse PDF file.");
      }

      setOriginalPages(data.pages);
      setCurrentPageIndex(0);
      setCurrentStep("parsed");
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while parsing the document.");
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  // Perform translation page-by-page
  const startTranslation = async () => {
    setIsTranslating(true);
    setCurrentStep("translating");
    setTranslationProgress(0);
    setErrorMessage(null);

    const translations: string[] = [];

    try {
      for (let i = 0; i < originalPages.length; i++) {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: originalPages[i],
            targetLanguage: targetLanguage,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to translate page ${i + 1}`);
        }

        translations.push(data.translation);
        setTranslationProgress(i + 1);
      }

      setTranslatedPages(translations);
      setEditedTranslations([...translations]);
      setCurrentPageIndex(0);
      setCurrentStep("result");
    } catch (err: any) {
      setErrorMessage(err.message || "Translation process was interrupted.");
      setCurrentStep("parsed");
    } finally {
      setIsTranslating(false);
    }
  };

  // Trigger download of DOCX using our custom utility
  const handleDownloadDocx = async () => {
    if (editedTranslations.length === 0) return;
    setIsDownloading(true);

    try {
      const langLabel = targetLanguage === "assamese" ? "Assamese" : "Bodo";
      const blob = await exportToDocx({
        originalPages,
        translatedPages: editedTranslations,
        language: langLabel,
        fileName: file?.name || "translated_doc.pdf",
        mode: docxMode,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const fileBaseName = file?.name.replace(/\.[^/.]+$/, "") || "translated";
      link.download = `${fileBaseName}_translated_${targetLanguage}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setErrorMessage("Export failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEditStart = () => {
    setEditBuffer(editedTranslations[currentPageIndex] || "");
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const updated = [...editedTranslations];
    updated[currentPageIndex] = editBuffer;
    setEditedTranslations(updated);
    setIsEditing(false);
  };

  const resetWorkspace = () => {
    setFile(null);
    setBase64Data("");
    setOriginalPages([]);
    setTranslatedPages([]);
    setEditedTranslations([]);
    setCurrentStep("upload");
    setCurrentPageIndex(0);
    setTranslationProgress(0);
    setErrorMessage(null);
    setIsEditing(false);
  };

  return (
    <div id="app-root" className="min-h-screen bg-[#0a0a0c] text-[#e0e0e6] font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header Bar */}
      <nav id="app-header" className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-[#0f0f14] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-white shadow-md">
            L
          </div>
          <span className="text-xl font-semibold tracking-tight font-serif italic text-white">
            Linguist Pro
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <span className="hidden sm:inline hover:text-white transition-colors cursor-pointer">Documentation</span>
          <span className="hidden sm:inline hover:text-white transition-colors cursor-pointer">Pricing</span>
          <div className="hidden sm:block h-4 w-[1px] bg-white/10"></div>
          <div className="flex items-center gap-2 text-white">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini Powered
            </span>
          </div>
        </div>
      </nav>

      {/* Main Workspace Layout */}
      <main id="app-main" className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Error notification banner */}
        {errorMessage && (
          <div id="error-banner" className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="grow">
              <h4 className="font-semibold text-sm text-white">Operation Alert</h4>
              <p className="text-xs text-rose-300/80 mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-300 font-semibold text-xs py-1 px-2 hover:bg-white/5 rounded"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Stages Wrapper */}
        <AnimatePresence mode="wait">
          
          {/* STEP 1: PDF UPLOAD STAGE */}
          {currentStep === "upload" && (
            <motion.div
              id="stage-upload"
              key="upload"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto mt-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  Translate PDFs with Absolute Precision
                </h2>
                <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-md mx-auto">
                  Upload English PDF documents to translate them into 100% accurate Assamese or Bodo.
                  Numerical values and layouts are strictly preserved.
                </p>
              </div>

              {/* Upload Drag Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  dragOver
                    ? "border-indigo-500 bg-indigo-500/5 shadow-inner"
                    : "border-white/10 bg-[#0f0f14] hover:border-indigo-500/40 hover:bg-[#16161e] hover:shadow-lg"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                />

                <div className="flex flex-col items-center">
                  <div className={`p-4 rounded-full mb-4 transition-transform duration-300 ${
                    dragOver ? "bg-indigo-500/20 scale-110" : "bg-white/5 group-hover:scale-105"
                  }`}>
                    {isParsing ? (
                      <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                    ) : (
                      <UploadCloud className="h-10 w-10 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                    )}
                  </div>

                  {isParsing ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-indigo-400 text-sm">Ingesting PDF Content...</p>
                      <p className="text-xs text-gray-500">Extracting original text and scanning layout lines</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-gray-200 text-sm">
                        Drag and drop your PDF here, or <span className="text-indigo-400 group-hover:underline">browse files</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Limit: 50MB per file • 100% Accuracy Guarantee
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Guarantees Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                <div className="bg-[#16161e] border border-white/5 rounded-xl p-4 text-center">
                  <div className="mx-auto h-7 w-7 rounded bg-indigo-500/10 flex items-center justify-center mb-2">
                    <span className="text-xs font-bold text-indigo-400">123</span>
                  </div>
                  <h4 className="font-semibold text-xs text-white">No Number Shifts</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Numerical figures remain exactly intact</p>
                </div>
                <div className="bg-[#16161e] border border-white/5 rounded-xl p-4 text-center">
                  <div className="mx-auto h-7 w-7 rounded bg-indigo-500/10 flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                  </div>
                  <h4 className="font-semibold text-xs text-white">100% Accuracy</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Review, tweak and touch up every line</p>
                </div>
                <div className="bg-[#16161e] border border-white/5 rounded-xl p-4 text-center">
                  <div className="mx-auto h-7 w-7 rounded bg-indigo-500/10 flex items-center justify-center mb-2">
                    <Download className="h-4 w-4 text-indigo-400" />
                  </div>
                  <h4 className="font-semibold text-xs text-white">DOCX Exports</h4>
                  <p className="text-[10px] text-gray-400 mt-1">Export cleanly into MS Word layout</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: PARSED PREVIEW & TARGET SELECTION */}
          {currentStep === "parsed" && (
            <motion.div
              id="stage-parsed"
              key="parsed"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4"
            >
              {/* Configuration panel */}
              <div className="space-y-6">
                <div className="bg-[#0f0f14] border border-white/5 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Document Loaded</span>
                      <h3 className="font-bold text-lg text-white line-clamp-2 mt-1">{file?.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Total Pages: {originalPages.length} | Size: {(file!.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={resetWorkspace}
                      className="text-gray-400 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-colors"
                      title="Clear and upload new PDF"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <hr className="my-6 border-white/5" />

                  {/* Target Language selector */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      Select Target Language
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTargetLanguage("assamese")}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                          targetLanguage === "assamese"
                            ? "border-indigo-600 bg-indigo-500/10 text-indigo-300 font-bold shadow-sm"
                            : "border-white/5 bg-white/5 hover:border-white/10 text-gray-300 hover:text-white"
                        }`}
                      >
                        <span className="text-xl mb-1">অ</span>
                        <span className="text-xs font-medium">Assamese</span>
                        <span className="text-[10px] opacity-75 mt-0.5">অসমীয়া</span>
                      </button>

                      <button
                        onClick={() => setTargetLanguage("bodo")}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                          targetLanguage === "bodo"
                            ? "border-indigo-600 bg-indigo-500/10 text-indigo-300 font-bold shadow-sm"
                            : "border-white/5 bg-white/5 hover:border-white/10 text-gray-300 hover:text-white"
                        }`}
                      >
                        <span className="text-xl mb-1">ब</span>
                        <span className="text-xs font-medium">Bodo</span>
                        <span className="text-[10px] opacity-75 mt-0.5">बर'</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={startTranslation}
                    className="w-full mt-6 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-900/40 hover:shadow-lg flex items-center justify-center gap-2 transition-all group"
                  >
                    Start Translation
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="bg-indigo-500/5 text-indigo-200 border border-indigo-500/15 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                  <h4 className="font-bold text-sm mb-2 text-white">Translation Protocol</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Our process converts each PDF page independently to avoid layout overflows. All numbers, metrics, dates, and currency values are isolated from the neural dictionary to ensure 100% exact retention.
                  </p>
                </div>
              </div>

              {/* Original Content Preview Scroll */}
              <div className="md:col-span-2 bg-[#0f0f14] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-[520px]">
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    <h3 className="font-bold text-sm text-white">Extracted PDF Preview</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentPageIndex === 0}
                      className="p-1.5 rounded bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-semibold text-gray-300">
                      Page {currentPageIndex + 1} of {originalPages.length}
                    </span>
                    <button
                      onClick={() => setCurrentPageIndex(prev => Math.min(originalPages.length - 1, prev + 1))}
                      disabled={currentPageIndex === originalPages.length - 1}
                      className="p-1.5 rounded bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Preformatted preview text box */}
                <div className="grow overflow-y-auto mt-4 p-4 rounded-xl bg-[#0a0a0c] border border-white/5 text-xs leading-relaxed font-mono whitespace-pre-wrap text-gray-300">
                  {originalPages[currentPageIndex]}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: TRANSLATING ACTIVE STATE */}
          {currentStep === "translating" && (
            <motion.div
              id="stage-translating"
              key="translating"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto mt-12 bg-[#0f0f14] border border-white/5 rounded-2xl p-8 shadow-md text-center"
            >
              <div className="relative inline-flex items-center justify-center mb-6">
                {/* Circular pulsing borders */}
                <span className="absolute h-20 w-20 rounded-full border-4 border-indigo-500/20 animate-ping" />
                <div className="relative h-16 w-16 rounded-full bg-indigo-500/10 border-2 border-indigo-500 flex items-center justify-center">
                  <RefreshCw className="h-7 w-7 text-indigo-400 animate-spin" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-white">Translating to {targetLanguage === "assamese" ? "Assamese" : "Bodo"}</h3>
              <p className="text-xs text-indigo-400 mt-1 uppercase tracking-widest font-semibold">Please keep this tab open</p>

              {/* Page-by-page progress bar */}
              <div className="mt-8 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-400">
                  <span>Translating pages</span>
                  <span>
                    {translationProgress} / {originalPages.length} ({Math.round((translationProgress / originalPages.length) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                  <motion.div
                    className="bg-indigo-600 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(translationProgress / originalPages.length) * 100}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>

              {/* Status information carousel */}
              <div className="mt-8 p-4 rounded-xl bg-[#0a0a0c] border border-white/5 text-left">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-indigo-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing Active Content Block</span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-3 italic leading-relaxed">
                  &ldquo;{originalPages[translationProgress === originalPages.length ? translationProgress - 1 : translationProgress]}&rdquo;
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 4: INTERACTIVE RESULTS WORKSPACE */}
          {currentStep === "result" && (
            <motion.div
              id="stage-result"
              key="result"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Toolbar & controls header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f0f14] border border-white/5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">Translation Complete</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Check each page to review correctness or refine manually before generating your doc.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetWorkspace}
                    className="px-3.5 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  
                  {/* Page Navigator */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0c] border border-white/5 rounded-xl">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setCurrentPageIndex(prev => Math.max(0, prev - 1));
                      }}
                      disabled={currentPageIndex === 0}
                      className="p-1 rounded hover:bg-white/5 text-gray-300 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold text-gray-300 min-w-[70px] text-center">
                      Page {currentPageIndex + 1} / {originalPages.length}
                    </span>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setCurrentPageIndex(prev => Math.min(originalPages.length - 1, prev + 1));
                      }}
                      disabled={currentPageIndex === originalPages.length - 1}
                      className="p-1 rounded hover:bg-white/5 text-gray-300 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main side-by-side translation desk */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: Original English */}
                <div className="bg-[#0f0f14] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-[480px]">
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-white/5 px-2 py-0.5 rounded text-gray-300 uppercase">en</span>
                      <h4 className="font-bold text-sm text-white">Original English</h4>
                    </div>
                  </div>
                  <div className="grow overflow-y-auto mt-4 p-4 rounded-xl bg-[#0a0a0c] border border-white/5 text-xs font-mono whitespace-pre-wrap leading-relaxed text-gray-400">
                    {originalPages[currentPageIndex]}
                  </div>
                </div>

                {/* Right Side: Translation Workspace */}
                <div className="bg-[#0f0f14] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-[480px]">
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-400 uppercase">
                        {targetLanguage === "assamese" ? "as" : "br"}
                      </span>
                      <h4 className="font-bold text-sm text-white">
                        {targetLanguage === "assamese" ? "Assamese" : "Bodo"} Translation
                      </h4>
                    </div>

                    {!isEditing ? (
                      <button
                        onClick={handleEditStart}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit / Refine
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-2 py-1 text-xs text-gray-400 hover:text-white font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleEditSave}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          <Check className="h-3 w-3" />
                          Apply Changes
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grow mt-4 flex flex-col">
                    {isEditing ? (
                      <textarea
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        className="w-full grow p-4 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-sans leading-relaxed resize-none bg-[#0a0a0c] text-white transition-colors outline-none"
                        placeholder="Write translation..."
                      />
                    ) : (
                      <div className="w-full grow overflow-y-auto p-4 rounded-xl bg-[#0a0a0c] border border-white/5 text-xs leading-relaxed text-gray-200 whitespace-pre-wrap">
                        {editedTranslations[currentPageIndex]}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DOCX exporting panel */}
              <div className="p-6 bg-[#0f0f14] border border-white/5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Download Configuration</h4>
                  <p className="text-xs text-gray-400">Configure how you want to export your document to MS Word (DOCX).</p>
                  
                  {/* Select Mode */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => setDocxMode("translated-only")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        docxMode === "translated-only"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                          : "border-white/5 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      Translated Content Only
                    </button>
                    <button
                      onClick={() => setDocxMode("side-by-side")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        docxMode === "side-by-side"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                          : "border-white/5 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      Side-by-Side Table (EN / {targetLanguage === "assamese" ? "AS" : "BR"})
                    </button>
                    <button
                      onClick={() => setDocxMode("alternating")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        docxMode === "alternating"
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                          : "border-white/5 text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      Alternating Paragraphs
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDownloadDocx}
                  disabled={isDownloading}
                  className="w-full md:w-auto shrink-0 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-900/40 hover:shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating DOCX...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export to DOCX File
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
