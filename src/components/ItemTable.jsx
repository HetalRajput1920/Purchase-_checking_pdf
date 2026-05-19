import React, { useState, useEffect, useMemo } from 'react';
import { Package, CheckCircle, Hash, MousePointer2, Target, ChevronRight, ChevronDown, Layers, Plus, Minus, Timer, Trophy, Send, Loader2, FileText } from 'lucide-react';

const parseQty = (qtyStr) => {
  if (typeof qtyStr !== 'string') return parseInt(qtyStr) || 0;
  return qtyStr.split('+').reduce((acc, part) => acc + (parseInt(part.trim()) || 0), 0);
};

const EditableCell = ({ value, onSave, type = "text", className = "" }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentValue, setCurrentValue] = React.useState(value);

  React.useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (currentValue !== value) {
      onSave(currentValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setCurrentValue(value);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        type={type}
        step={type === "number" ? "any" : undefined}
        className={`w-full px-2 py-1 text-gray-900 border border-blue-500 rounded outline-none bg-white font-bold ${className}`}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      className={`cursor-pointer hover:bg-blue-400/20 rounded px-2 py-1 transition-all border border-transparent hover:border-blue-400/30 ${className}`}
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
    >
      {value}
    </div>
  );
};

const ItemTable = ({ items, isScanningMode, searchTerm, onUpdateQty, onAddBatch, onEditItem, onUpdateItemField, onConfirmAndSave, onFinishScanning, isSending, billNo, poNo }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const totalItems = items.length;
  const totalTargetQty = items.reduce((acc, item) => acc + parseQty(item.qty) + (parseInt(item.fqty) || 0), 0);
  const totalScanned = items.reduce((acc, item) => acc + (parseInt(item.scannedQty) || 0), 0);

  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const groupedItems = useMemo(() => {
    const groups = new Map();
    items.forEach(item => {
      const name = item.itemName;
      if (!groups.has(name)) {
        groups.set(name, []);
      }
      groups.get(name).push(item);
    });
    return groups;
  }, [items]);

  const uniqueItemCount = groupedItems.size;
  const scannedItemCount = useMemo(() => {
    let count = 0;
    groupedItems.forEach((groupItems) => {
      const target = groupItems.reduce((acc, item) => acc + parseQty(item.qty) + (parseInt(item.fqty) || 0), 0);
      const scanned = groupItems.reduce((acc, item) => acc + (parseInt(item.scannedQty) || 0), 0);
      if (scanned >= target && target > 0) {
        count++;
      }
    });
    return count;
  }, [groupedItems]);


  const [elapsedTime, setElapsedTime] = useState(0);
  const expectedTime = totalTargetQty * 2.5;

  useEffect(() => {
    let interval;
    if (isScanningMode) {
      interval = setInterval(() => {
        const startTimeStr = localStorage.getItem('scanStartTime');
        if (startTimeStr) {
          const startTime = parseInt(startTimeStr);
          setElapsedTime(Math.round((Date.now() - startTime) / 1000));
        }
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isScanningMode]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredGroups = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const result = [];
    groupedItems.forEach((groupItems, itemName) => {
      if (itemName.toLowerCase().includes(search)) {
        result.push({ itemName, items: groupItems });
      }
    });
    return result;
  }, [groupedItems, searchTerm]);

  const visibleRows = useMemo(() => {
    const rows = [];
    filteredGroups.forEach(group => {
      const isExpanded = expandedGroups.has(group.itemName);
      const isMultiBatch = group.items.length > 1;

      rows.push({
        type: 'group',
        itemName: group.itemName,
        data: group.items[0], // First item properties for MRP/Exp/etc
        allSubItems: group.items,
        isMultiBatch,
        isExpanded
      });

      if (isExpanded) {
        group.items.forEach(item => {
          rows.push({
            type: 'subItem',
            itemName: group.itemName,
            data: item
          });
        });
        // Add a special row for adding a batch
        rows.push({
          type: 'addBatchAction',
          itemName: group.itemName,
          data: group.items[0]
        });
      }
    });
    return rows;
  }, [filteredGroups, expandedGroups]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      const newExpanded = new Set();
      filteredGroups.forEach(group => {
        newExpanded.add(group.itemName);
      });
      setExpandedGroups(newExpanded);
    }
  }, [searchTerm]); // Only auto-expand when user types in search

  // Keyboard navigation for row selector
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (visibleRows.length === 0) return;

      let newIndex = selectedIndex;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = selectedIndex < visibleRows.length - 1 ? selectedIndex + 1 : selectedIndex;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = selectedIndex > 0 ? selectedIndex - 1 : selectedIndex;
      } else if (e.key === 'Enter') {
        const row = visibleRows[selectedIndex];
        if (row) {
          if (row.type === 'group') {
            toggleGroup(row.itemName);
          } else if (row.type === 'subItem') {
            onEditItem(row.data);
          } else if (row.type === 'addBatchAction') {
            onAddBatch(row.itemName);
          }
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const row = visibleRows[selectedIndex];
        if (row && row.type === 'subItem') {
          onUpdateQty(row.data, 1);
        }
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const row = visibleRows[selectedIndex];
        if (row && row.type === 'subItem') {
          onUpdateQty(row.data, -1);
        }
      }

      if (newIndex !== selectedIndex) {
        setSelectedIndex(newIndex);
        const rowElement = document.getElementById(`row-${newIndex}`);
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, visibleRows, expandedGroups]);

  const toggleGroup = (itemName) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  return (
    <div className="w-full flex-1 flex flex-col animate-in fade-in duration-700 overflow-hidden">

      {/* Stat Cards Header */}
      <div className={`w-full grid gap-4 px-10 py-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 animate-in slide-in-from-top-4 duration-700`}>
        {/* Unique Items Card */}
        <div className="bg-indigo-50/40 rounded-[1rem] p-3 border border-indigo-100 flex items-center justify-between transition-all hover:bg-indigo-50 hover:shadow-md active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <div className="bg-white text-indigo-600 p-2 rounded-lg shadow-sm border border-indigo-100">
              <Package size={18} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-indigo-400 font-bold text-[8px] uppercase tracking-[0.2em] mb-0.5 leading-tight">Manifest Items</p>
              <h3 className="text-xl font-extrabold text-indigo-900 tracking-tight leading-none">{totalItems}</h3>
            </div>
          </div>
        </div>

        {/* Bill Number Card */}
        <div className="bg-purple-50/40 rounded-[1rem] p-3 border border-purple-100 flex items-center justify-between transition-all hover:bg-purple-50 hover:shadow-md active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <div className="bg-white text-purple-600 p-2 rounded-lg shadow-sm border border-purple-100">
              <FileText size={18} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-purple-400 font-bold text-[8px] uppercase tracking-[0.2em] mb-0.5 leading-tight">Invoice No</p>
              <h3 className="text-xl font-extrabold text-purple-900 tracking-tight leading-none">{billNo || 'N/A'}</h3>
            </div>
          </div>
        </div>



        {/* Scan Progress Card */}
        <div className="bg-blue-50/40 rounded-[1rem] p-3 border border-blue-100 flex items-center justify-between transition-all hover:bg-blue-50 hover:shadow-md active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <div className="bg-white text-blue-600 p-2 rounded-lg shadow-sm border border-blue-100">
              <Target size={18} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-blue-400 font-bold text-[8px] uppercase tracking-[0.2em] mb-0.5 leading-tight">Items Scanned</p>
              <h3 className="text-xl font-extrabold text-blue-900 tracking-tight leading-none">
                <span className={scannedItemCount === uniqueItemCount ? 'text-green-600' : 'text-blue-700'}>{scannedItemCount}</span>
                <span className="text-blue-300 text-base mx-1 font-medium">/</span>
                <span className="text-blue-800/60 font-medium">{uniqueItemCount}</span>
              </h3>
            </div>
          </div>
        </div>

        {/* Scanning Efficiency / Timer Card */}
        <div className={`rounded-[1rem] p-3 border flex items-center justify-between transition-all hover:shadow-md active:scale-[0.98] ${!isScanningMode ? 'bg-gray-50/40 border-gray-100 opacity-60' : elapsedTime > expectedTime ? 'bg-orange-50/40 border-orange-100' : 'bg-green-50/40 border-green-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg shadow-sm border ${!isScanningMode ? 'bg-white text-gray-400 border-gray-100' : elapsedTime > expectedTime ? 'bg-white text-orange-600 border-orange-100' : 'bg-white text-green-600 border-green-100'}`}>
              <Timer size={18} strokeWidth={2.5} className={elapsedTime > 0 ? "animate-pulse" : ""} />
            </div>
            <div>
              <p className={`font-bold text-[8px] uppercase tracking-[0.2em] mb-0.5 leading-tight ${!isScanningMode ? 'text-gray-400' : elapsedTime > expectedTime ? 'text-orange-400' : 'text-green-500'}`}>Performance</p>
              <h3 className="text-xl font-extrabold tracking-tight leading-none">
                <span className={!isScanningMode ? 'text-gray-400' : elapsedTime > expectedTime ? 'text-orange-600' : 'text-green-700'}>{formatTime(elapsedTime)}</span>
                <span className="text-gray-300 text-base mx-1 font-medium">/</span>
                <span className="text-gray-400 font-medium">{formatTime(Math.round(expectedTime))}</span>
              </h3>
            </div>
          </div>
        </div>

        {/* Primary Action Card */}
        <div className="flex items-center">
          {!isScanningMode ? (
            <button
              onClick={onConfirmAndSave}
              disabled={isSending}
              className={`w-full py-3.5 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl font-extrabold text-sm shadow-md shadow-blue-500/30 border border-white/10 transition-all active:scale-95 disabled:opacity-50 ${!isSending ? 'animate-bounce' : ''}`}
            >
              {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={16} />}
              <span>{isSending ? 'Syncing...' : 'CONFIRM & START'}</span>
            </button>
          ) : (
            <button
              onClick={onFinishScanning}
              disabled={isSending}
              className={`w-full py-3.5 flex items-center justify-center gap-3 bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl font-extrabold text-sm shadow-md shadow-green-500/30 border border-white/10 transition-all active:scale-95 disabled:opacity-50`}
            >
              {isSending ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} className="animate-bounce" />}
              <span>{isSending ? 'GENERATING...' : 'SUBMIT REPORT'}</span>
            </button>
          )}
        </div>
      </div>
      {/* Scrollable Table Section - Premium Edge-to-Edge */}
      <div className="w-full flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="sticky top-0 z-20 bg-gray-900 backdrop-blur-md text-gray-200 text-sm font-black uppercase tracking-[0.15em] shadow-lg border-b border-gray-800">
              <th className="px-6 py-3.5 text-center w-20">S.No</th>
              <th className="px-6 py-3.5">Item Name</th>
              <th className="px-6 py-3.5">Batch ID</th>
              <th className="px-6 py-3.5">Pack</th>
              <th className="px-6 py-3.5 text-right w-40">MRP</th>
              <th className="px-6 py-3.5 text-center w-36">Expiry</th>
              {isScanningMode && <th className="px-6 py-3.5 text-center w-36 text-blue-400">Scanned</th>}
              <th className="px-6 py-3.5 text-center w-32">Free Qty</th>
              <th className="px-6 py-3.5 text-center w-36">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {visibleRows.map((row, index) => {
              const isGroup = row.type === 'group';
              const isSubItem = row.type === 'subItem';
              const isAddBatchAction = row.type === 'addBatchAction';
              const isSelected = selectedIndex === index;

              if (isAddBatchAction) {
                return (
                  <tr
                    id={`row-${index}`}
                    key={`${row.itemName}-add-action`}
                    onClick={() => {
                      setSelectedIndex(index);
                      onAddBatch(row.itemName);
                    }}
                    className={`group transition-all duration-200 cursor-pointer text-xl font-bold border-l-[6px] border-b border-purple-200 shadow-sm ${isSelected ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-900 shadow-xl relative z-10 scale-[1.002]' :
                      'bg-purple-50/40 text-purple-600 hover:bg-purple-100/50'
                      }`}
                  >
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4" colSpan={isScanningMode ? "8" : "7"}>
                      <div className="flex items-center gap-3 ml-12">
                        <div className={`p-1.5 rounded-full ${isSelected ? 'bg-white text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>
                          <Plus size={16} strokeWidth={3} />
                        </div>
                        <span className="tracking-tight uppercase text-sm font-black">Add New Batch for {row.itemName}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              // Base data for display
              const item = row.data;
              let targetQty, scannedQty;

              if (isGroup) {
                targetQty = row.allSubItems.reduce((acc, si) => acc + parseQty(si.qty) + (parseInt(si.fqty) || 0), 0);
                scannedQty = row.allSubItems.reduce((acc, si) => acc + (si.scannedQty || 0), 0);
              } else {
                targetQty = parseQty(item.qty) + (parseInt(item.fqty) || 0);
                scannedQty = item.scannedQty || 0;
              }

              const isFullyScanned = isScanningMode && scannedQty >= targetQty;
              const isPartiallyScanned = isScanningMode && scannedQty > 0 && scannedQty < targetQty;

              return (
                <tr
                  id={`row-${index}`}
                  key={`${row.itemName}-${isSubItem ? item.batch : 'parent'}`}
                  onClick={() => {
                    setSelectedIndex(index);
                    if (isGroup) toggleGroup(row.itemName);
                  }}
                  className={`group transition-all duration-200 cursor-pointer text-xl font-bold border-l-[6px] border-b border-gray-300 shadow-sm ${isSelected ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-900 shadow-xl relative z-10 scale-[1.002]' :
                    isSubItem ? 'bg-purple-50/60 text-purple-900 border-purple-200 hover:bg-purple-100/60' :
                      isFullyScanned ? 'bg-green-50/80 text-gray-900 border-green-500' :
                        isPartiallyScanned ? 'bg-orange-50/80 text-gray-900 border-orange-400' :
                          'bg-white text-gray-700 border-transparent hover:bg-gray-50'
                    }`}
                >
                  <td className={`px-6 py-4 text-center font-black ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                    {item.sNo || index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {isGroup && (
                        <div className={`p-1 rounded-md ${isSelected ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                          {row.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                      )}
                      {isSubItem && <div className="w-6 h-[2px] bg-gray-200 ml-4 mr-2" />}
                      {isSubItem && <div className="w-6 h-[2px] bg-gray-200 ml-4 mr-2" />}
                      <div className={`tracking-tight ${isSubItem ? 'text-lg font-medium opacity-70' : ''}`}>
                        {isSubItem ? '• ' : ''}
                        <EditableCell
                          value={item.itemName}
                          onSave={(val) => onUpdateItemField(item, 'itemName', val)}
                        />
                      </div>
                      {isGroup && (
                        <div className="flex items-center gap-2">
                          {row.isMultiBatch && (
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                              {row.allSubItems.length} Batches
                            </span>
                          )}

                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 font-black ${isSelected ? 'text-blue-200' : isSubItem ? 'text-gray-400' : 'text-blue-600'}`}>
                      <Hash size={16} />
                      <div className={isSubItem ? 'font-mono' : ''}>
                        {isGroup && row.isMultiBatch ? 'MULTIPLE' : (
                          <EditableCell
                            value={item.batch}
                            onSave={(val) => onUpdateItemField(item, 'batch', val)}
                          />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <EditableCell
                      value={item.pack}
                      className={`text-base ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}
                      onSave={(val) => onUpdateItemField(item, 'pack', val)}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`px-3 py-1 rounded text-sm font-black shadow-sm flex justify-end ${isSelected ? 'bg-white/10 text-white border border-white/20' :
                      'bg-white text-green-700 border border-green-200'
                      }`}>
                      ₹<EditableCell
                        value={typeof item.mrp === 'number' ? item.mrp.toFixed(2) : item.mrp}
                        type="number"
                        onSave={(val) => onUpdateItemField(item, 'mrp', parseFloat(val) || 0)}
                      />
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-center font-black text-base ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                    <EditableCell
                      value={item.expiry}
                      onSave={(val) => onUpdateItemField(item, 'expiry', val)}
                    />
                  </td>
                  {isScanningMode && (
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-3">
                        {isSubItem && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onUpdateQty(item, -1); }}
                            className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                          >
                            <Minus size={14} strokeWidth={3} />
                          </button>
                        )}
                        <div className={`inline-flex items-center px-4 py-1.5 rounded-lg border font-black text-xl shadow-sm ${isSelected ? 'bg-white text-blue-700 border-white shadow-xl shadow-white/20' :
                          isFullyScanned ? 'bg-green-500 text-white border-green-600' :
                            isPartiallyScanned ? 'bg-orange-500 text-white border-orange-600' :
                              'bg-white border-gray-200 text-gray-600'
                          }`}>
                          {scannedQty}
                        </div>
                        {isSubItem && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onUpdateQty(item, 1); }}
                            className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                          >
                            <Plus size={14} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-center">
                    <div className={`inline-flex items-center px-4 py-1.5 rounded-lg border font-black text-lg ${isSelected ? 'bg-white/10 border-white/20 text-white' :
                      'bg-gray-100/50 border-gray-200 text-gray-800'
                      }`}>
                      <EditableCell
                        value={item.fqty || 0}
                        type="number"
                        onSave={(val) => onUpdateItemField(item, 'fqty', val)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`inline-flex items-center px-4 py-1.5 rounded-lg border font-black text-lg ${isSelected ? 'bg-white/10 border-white/20 text-white' :
                      'bg-gray-100/50 border-gray-200 text-gray-800'
                      }`}>
                      <EditableCell
                        value={targetQty}
                        type="number"
                        onSave={(val) => onUpdateItemField(item, 'qty', val)}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={isScanningMode ? "9" : "8"} className="px-4 py-20 text-center text-gray-400 italic text-lg font-bold bg-gray-50/50">
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ItemTable;
