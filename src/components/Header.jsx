import React, { useEffect, useRef, useState } from 'react';
import { LogOut, User, Scan, Wifi, WifiOff, Trash2, FileText, CheckCircle2, Search, Loader2, Building2, Hash } from 'lucide-react';

const Header = ({ onLogout, isScanningMode, fileName, connectionStatus, onReset, hasData, searchTerm, setSearchTerm, onUpload, isUploading, selectedSupplier, poNo }) => {
  const userName = localStorage.getItem('userName') || 'User';
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [leaderboardData, setLeaderboardData] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://192.168.1.110:3000/api/ocr/get-ocr-checker-leaderboard', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setLeaderboardData(data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      }
    };
    
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Focus search input on 'f' key press, only if not already typing in an input
      if (e.key.toLowerCase() === 'f' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {
        if (hasData) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasData]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm transition-all duration-300">
      <div className="w-full px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className={`p-2.5 rounded-2xl shadow-lg transition-all duration-500 scale-100 group-hover:scale-105 ${isScanningMode ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/30' : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/30'}`}>
              <Scan size={24} strokeWidth={2.5} className={isScanningMode ? 'animate-pulse' : ''} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-gray-900 leading-none">
                {userName.toUpperCase()}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                purchase verification
              </span>
            </div>
          </div>

          {/* Supplier Display in Header */}
          {selectedSupplier && (
            <div className="hidden xl:flex items-center gap-4 pl-6 border-l border-gray-200/60 ml-2 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Supplier</span>
                <div className="flex items-center gap-1.5 text-gray-700 mt-0.5">
                  <Building2 size={14} className="text-indigo-400" />
                  <span className="text-sm font-bold truncate max-w-[250px]">{selectedSupplier.Name}</span>
                </div>
              </div>
            </div>
          )}

          {/* Scanning Status in Header */}
          {hasData && (
            <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-gray-200/60 ml-2 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isScanningMode ? 'text-green-600' : 'text-blue-600'}`}>
                    {isScanningMode ? 'Scanning Mode Active' : 'Reviewing Data'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                  <FileText size={14} className="text-gray-400" />
                  <span className="text-sm font-bold truncate max-w-[200px] text-gray-700">{fileName || 'Invoice'}</span>
                </div>
              </div>

              {isScanningMode && (
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.1em] shadow-inner ${connectionStatus === 'connected' ? 'bg-green-50/50 border-green-200 text-green-700' :
                  connectionStatus === 'error' ? 'bg-red-50/50 border-red-200 text-red-700' :
                    'bg-yellow-50/50 border-yellow-200 text-yellow-700'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                  {connectionStatus === 'connected' ? 'Live Matcher' : 'Offline'}
                </div>
              )}
            </div>
          )}

          {/* PO Number Display in Header */}
          {poNo && (
            <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-gray-200/60 ml-2 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">PO Number</span>
                <div className="flex items-center gap-1.5 text-gray-700 mt-0.5">
                  <Hash size={14} className="text-amber-400" />
                  <span className="text-sm font-bold">{poNo}</span>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Data Display */}
          {leaderboardData && (
            <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-gray-200/60 ml-2 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600">Overview</span>
                <div className="flex items-center gap-3 text-gray-700 mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-500">Bills:</span>
                    <span className="text-sm font-bold">{leaderboardData.BillCnt}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-500">Items:</span>
                    <span className="text-sm font-bold">{leaderboardData.ItemCnt}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-500">Qty:</span>
                    <span className="text-sm font-bold">{leaderboardData.Qty}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {hasData && (
          <div className="flex-grow hidden md:flex justify-center px-6 animate-in fade-in duration-500">
            <div className="relative group max-w-xl w-full">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <Search size={18} strokeWidth={3} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search items by name..."
                className="w-full pl-12 pr-5 py-2.5 bg-white border border-gray-200 rounded-[14px] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-sm text-gray-900 placeholder:text-gray-400 font-bold shadow-sm"
                value={searchTerm || ''}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-5">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv, text/csv, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={hasData || isUploading || !selectedSupplier}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-sm shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              ${!hasData && !isUploading && selectedSupplier ? 'bg-blue-600 text-white shadow-blue-500/20 animate-bounce hover:bg-blue-700' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'}
            `}
            title={!selectedSupplier ? "Please select a supplier first" : ""}
          >
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            <span>{isUploading ? 'Extracting...' : 'Upload File'}</span>
          </button>

          {hasData && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/50 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-xl transition-all font-bold text-sm shadow-sm hover:shadow-md active:scale-95 group"
              title="Reset current invoice"
            >
              <Trash2 size={16} className="group-hover:rotate-12 transition-transform" />
              <span>Reset</span>
            </button>
          )}

          <div className="h-8 w-[1px] bg-gray-200/80 mx-2"></div>

          <div className="flex items-center gap-4">
            <button
              className="group flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-xl active:scale-95"
              onClick={onLogout}
            >
              <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
