import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/apiClient';
import { Upload, Loader2, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

const PdfUploader = ({ onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      Swal.fire({
        icon: 'error',
        title: 'Invalid File',
        text: 'Please upload a PDF file.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);

    const startTime = performance.now();
    console.group(`[API Request] PDF Extraction: ${file.name}`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Endpoint:', 'http://192.168.1.110:3007/extract-invoice-items-from-pdf');

    // Gmail-style simulated progress sequence
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) {
          // Fast starting phase
          return prev + Math.floor(Math.random() * 12) + 6;
        } else if (prev < 75) {
          // Normal intermediate progress
          return prev + Math.floor(Math.random() * 4) + 2;
        } else if (prev < 92) {
          // Slow down near the end of expected time
          return prev + Math.floor(Math.random() * 2) + 1;
        } else if (prev < 98) {
          // Slowest crawl while waiting for API completion
          return prev + 0.4;
        }
        return prev;
      });
    }, 300);

    const formData = new FormData();
    formData.append('pdf', file);

    Swal.fire({
      title: 'Extracting...',
      text: 'The file is extracting, please wait. It will take a few seconds.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const result = await apiClient.upload(
        'http://192.168.1.110:3007/extract-invoice-items-from-pdf',
        formData
      );

      Swal.close();

      // Success: Clear interval and finish progress bar to 100%
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);
      
      // Short delay for visual completion before firing callbacks
      await new Promise(resolve => setTimeout(resolve, 400));

      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`Success in ${duration}ms`);
      console.log('Response Data:', result);

      onUploadSuccess(result, file.name);
    } catch (err) {
      Swal.close();

      // Error: Force finish bar
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 400));

      const duration = (performance.now() - startTime).toFixed(2);
      console.error(`Failed after ${duration}ms`);
      console.error('Error Details:', err);

      Swal.fire({
        icon: 'error',
        title: 'Extraction Failed',
        html: `
          <div className="text-sm text-gray-600">
            <p className="mb-2">We couldn't process this invoice.</p>
            <p className="font-mono text-xs bg-gray-100 p-2 rounded">Status: ${err.message || 'Server Error (502)'}</p>
          </div>
        `,
        confirmButtonColor: '#2563eb',
        footer: 'Check if the OCR server at 1.110:3008 is running.'
      });
    } finally {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      console.groupEnd();
      setIsUploading(false);
      setProgress(0);
    }
  };

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-12 animate-in slide-in-from-bottom-8 duration-700">
      <div
        className={`relative rounded-[2.5rem] p-20 text-center transition-all duration-500 cursor-pointer overflow-hidden backdrop-blur-2xl
          ${dragActive
            ? 'border-transparent bg-gradient-to-br from-blue-50/90 to-indigo-50/90 scale-[1.02] shadow-2xl shadow-blue-500/20 ring-4 ring-blue-400/30'
            : 'border-2 border-dashed border-gray-300/80 bg-white/60 shadow-xl hover:shadow-2xl hover:border-blue-300/80 hover:bg-white/80 hover:scale-[1.01]'
          }
          ${isUploading ? 'cursor-wait pointer-events-none border-transparent bg-white/80' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Gmail-style progress bar pinned to the top edge */}
        {isUploading && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-50/60 overflow-hidden z-20">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${progress}%` }}
            />
            {/* Horizontal shimmer effect inside progress bar */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.45)_50%,transparent_100%)] animate-[shimmer_1.5s_infinite] w-[50%]" />
          </div>
        )}

        {/* Animated Background Gradient overlay when uploading */}
        {isUploading && (
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(59,130,246,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-[gradient_2s_linear_infinite]" />
        )}

        {isUploading ? (
          <div className="flex flex-col items-center gap-8 relative z-10 animate-in fade-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-30 shadow-2xl shadow-blue-500"></div>
              <div className="absolute inset-2 bg-indigo-400 rounded-full animate-pulse opacity-40"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-full shadow-lg shadow-blue-500/40">
                <Loader2 className="w-12 h-12 text-white animate-spin" strokeWidth={2.5} />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700">Processing Invoice</h3>
              <p className="text-gray-500 font-bold text-lg animate-pulse">Extracting line items using AI ({Math.round(progress)}%)...</p>
            </div>
          </div>
        ) : (
          <div className="relative z-10">
            <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-lg transition-transform duration-500 ${dragActive ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/40 scale-110 -translate-y-2' : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-gray-400 hover:text-blue-600 shadow-sm'}`}>
              <Upload className={`w-12 h-12 transition-colors duration-500 ${dragActive ? 'text-white' : 'text-blue-500'}`} strokeWidth={2} />
            </div>
            <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Upload PDF Invoice</h3>
            <p className="text-gray-500 text-xl mb-10 font-medium">Drag and drop your document here, or click to browse</p>

            <div className="inline-flex items-center gap-3 bg-gray-100/80 backdrop-blur text-gray-600 px-6 py-3 rounded-xl text-sm font-bold border border-gray-200/50 shadow-inner">
              <FileText size={18} className="text-blue-500" /> Only accepts standard .pdf format
            </div>

            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf"
              onChange={(e) => handleUpload(e.target.files[0])}
            />
          </div>
        )}
      </div>

      {/* Styled JSX block for the shimmer animation keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default PdfUploader;