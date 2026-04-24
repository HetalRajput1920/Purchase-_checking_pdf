import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, Check, Loader2, X } from 'lucide-react';
import Swal from 'sweetalert2';

const SupplierSearch = ({ onSelect, selectedSupplier }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchSuppliers = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://192.168.1.110:3000/api/ocr/search-customer/${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setResults(data);
        setActiveIndex(-1);
      } else {
        setResults([]);
        setActiveIndex(-1);
      }
    } catch (error) {
      console.error('Supplier search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchSuppliers(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (supplier) => {
    onSelect(supplier);
    setShowDropdown(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto relative" ref={dropdownRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search supplier by name..."
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-lg shadow-sm placeholder:text-gray-400"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <Loader2 size={20} className="animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {/* Suggested Results Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[300px] overflow-y-auto">
            {results.map((supplier, index) => (
              <button
                key={supplier.VCode || `supplier-${index}`}
                onClick={() => handleSelect(supplier)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full px-5 py-4 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 group text-left ${activeIndex === index ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-50 group-hover:bg-blue-100 rounded-lg text-gray-400 group-hover:text-blue-600 transition-colors">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 leading-tight">{supplier.Name}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">VCODE: {supplier.VCode}</p>
                  </div>
                </div>
                {selectedSupplier?.VCode === supplier.VCode && (
                  <Check size={20} className="text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Supplier Badge */}
      {selectedSupplier && !showDropdown && !query && (
        <div className="mt-4 flex items-center justify-center animate-in zoom-in duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4 border border-white/10">
            <div className="p-2 bg-white/20 rounded-xl">
              <Building2 size={20} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Selected Supplier</p>
              <p className="font-bold text-lg leading-tight">{selectedSupplier.Name}</p>
            </div>
            <button 
              onClick={() => onSelect(null)}
              className="ml-2 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierSearch;
