import { useState, useEffect, useCallback } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Header from './components/Header'
import { initializeSocket, disconnectSocket } from './utils/socket'
import Swal from 'sweetalert2'
import './App.css'

const parseQty = (qtyStr) => {
  if (typeof qtyStr !== 'string') return parseInt(qtyStr) || 0;
  return qtyStr.split('+').reduce((acc, part) => acc + (parseInt(part.trim()) || 0), 0);
};

/**
 * Merge items that share the same batch number.
 * qty and fqty are summed as integers; amount is summed as floats.
 */
const mergeDuplicateBatches = (items) => {
  const map = new Map();
  items.forEach(item => {
    const key = item.batch?.trim();
    if (!key || !map.has(key)) {
      map.set(key || Symbol(), { ...item });
    } else {
      const existing = map.get(key);
      const mergedQty = parseQty(existing.qty) + parseQty(item.qty);
      const mergedFqty = parseQty(existing.fqty) + parseQty(item.fqty);
      const mergedAmt = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
      map.set(key, {
        ...existing,
        qty: String(mergedQty),
        fqty: String(mergedFqty),
        amount: parseFloat(mergedAmt.toFixed(2))
      });
    }
  });
  return Array.from(map.values());
};

const sortAndSerialize = (items) => {
  return [...items]
    .map((item, index) => ({
      ...item,
      sNo: index + 1,
      uuid: item.uuid || Math.random().toString(36).substr(2, 9)
    }));
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))

  // Lifted state from Home
  const [extractedData, setExtractedData] = useState(() => {
    const saved = localStorage.getItem('extractedInvoiceItems')
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? mergeDuplicateBatches(parsed) : parsed;
  })
  const [fileName, setFileName] = useState(() => localStorage.getItem('lastInvoiceName'))
  const [isScanningMode, setIsScanningMode] = useState(() => localStorage.getItem('isScanningMode') === 'true')
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(() => {
    const saved = localStorage.getItem('selectedSupplier')
    return saved ? JSON.parse(saved) : null
  });
  const [billNo, setBillNo] = useState(() => localStorage.getItem('lastBillNo') || '');

  useEffect(() => {
    if (selectedSupplier) localStorage.setItem('selectedSupplier', JSON.stringify(selectedSupplier));
    else localStorage.removeItem('selectedSupplier');
  }, [selectedSupplier]);

  const handleUpdateQty = (targetItem, change) => {
    setExtractedData(prevData => {
      if (!prevData) return prevData;

      const sameNameItems = prevData.filter(i => i.itemName === targetItem.itemName);
      const totalNameTarget = sameNameItems.reduce((acc, i) => acc + parseQty(i.qty) + (parseInt(i.fqty) || 0), 0);
      const totalNameScanned = sameNameItems.reduce((acc, i) => acc + (i.scannedQty || 0), 0);

      if (isScanningMode && change > 0 && !localStorage.getItem('scanStartTime')) {
        localStorage.setItem('scanStartTime', Date.now().toString());
      }

      if (change > 0 && totalNameScanned + 1 > totalNameTarget) {
        Swal.fire({
          title: 'Inventory Full',
          text: `Cannot increase! ${targetItem.itemName} total target of ${totalNameTarget} already reached.`,
          icon: 'error',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          background: '#fef2f2',
          color: '#991b1b'
        });
        return prevData;
      }

      const newData = prevData.map(item => {
        if (item.itemName === targetItem.itemName && item.batch === targetItem.batch) {
          const current = item.scannedQty || 0;
          return { ...item, scannedQty: Math.max(0, current + change) };
        }
        return item;
      });

      localStorage.setItem('extractedInvoiceItems', JSON.stringify(newData));
      return newData;
    });
  };

  const handleAddBatch = (itemName) => {
    Swal.fire({
      title: `<div class="text-2xl font-black text-gray-800 mb-2">Add New Batch</div><div class="text-sm font-bold text-blue-600 uppercase tracking-wider">${itemName}</div>`,
      html: `
        <div class="flex flex-col gap-4 mt-6 text-left">
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Batch ID</label>
            <input id="swal-batch" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" placeholder="e.g. B12345">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Pack</label>
              <input id="swal-pack" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" placeholder="e.g. 10s">
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">MRP</label>
              <input id="swal-mrp" type="number" step="0.01" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" placeholder="0.00">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Expiry</label>
              <input id="swal-expiry" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" placeholder="MM/YY">
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Discount</label>
              <input id="swal-dis" type="number" step="0.01" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" placeholder="0.00">
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Free Qty</label>
            <input id="swal-fqty" type="number" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" placeholder="0">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Add Batch',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      customClass: {
        container: 'rounded-3xl',
        popup: 'rounded-3xl p-6',
        confirmButton: 'rounded-xl px-8 py-3 font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/30',
        cancelButton: 'rounded-xl px-8 py-3 font-bold text-sm uppercase tracking-wider'
      },
      didOpen: () => {
        const templateItem = extractedData.find(i => i.itemName === itemName) || {};
        document.getElementById('swal-pack').value = templateItem.pack || '';
        document.getElementById('swal-mrp').value = templateItem.mrp || '';
        document.getElementById('swal-expiry').value = templateItem.expiry || '';
        document.getElementById('swal-dis').value = templateItem.dis || templateItem.discount || '';
        document.getElementById('swal-batch').focus();
      },
      preConfirm: () => {
        const batch = document.getElementById('swal-batch').value;
        const pack = document.getElementById('swal-pack').value;
        const mrp = document.getElementById('swal-mrp').value;
        const expiry = document.getElementById('swal-expiry').value;
        const fqty = document.getElementById('swal-fqty').value;
        const dis = document.getElementById('swal-dis').value;

        if (!batch) {
          Swal.showValidationMessage('Batch ID is required');
          return false;
        }
        if (extractedData.some(item => item.itemName === itemName && item.batch === batch)) {
          Swal.showValidationMessage('This batch already exists for this item!');
          return false;
        }

        return { batch, pack, mrp, expiry, fqty, dis };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const { batch, pack, mrp, expiry, fqty, dis } = result.value;
        setExtractedData(prevData => {
          const templateItem = prevData.find(i => i.itemName === itemName) || {};
          const newBatchEntry = {
            ...templateItem,
            batch,
            pack: pack || templateItem.pack,
            mrp: mrp ? parseFloat(mrp) : templateItem.mrp,
            expiry: expiry || templateItem.expiry,
            dis: (dis !== "" ? dis : (templateItem.dis || templateItem.discount)) || "0",
            qty: "0",
            fqty: fqty || "0",
            scannedQty: 0,
            uuid: Math.random().toString(36).substr(2, 9)
          };
          const newData = sortAndSerialize([...prevData, newBatchEntry]);
          localStorage.setItem('extractedInvoiceItems', JSON.stringify(newData));
          return newData;
        });
        Swal.fire({
          icon: 'success',
          title: 'Batch Added',
          text: `Batch ${batch} added to ${itemName}`,
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  };

  const handleUpdateItemField = (item, field, value) => {
    setExtractedData(prevData => {
      if (!prevData) return prevData;
      const newData = prevData.map(i => {
        if (field === 'itemName' && i.itemName === item.itemName) {
          return { ...i, itemName: value };
        }
        if (i.uuid === item.uuid) {
          return { ...i, [field]: value };
        }
        return i;
      });
      localStorage.setItem('extractedInvoiceItems', JSON.stringify(newData));
      return newData;
    });
  };

  const handleEditItem = (item) => {
    Swal.fire({
      title: `<div class="text-2xl font-black text-gray-800 mb-2">Edit Batch</div><div class="text-sm font-bold text-blue-600 uppercase tracking-wider">${item.itemName}</div>`,
      html: `
        <div class="flex flex-col gap-4 mt-6 text-left">
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Batch ID</label>
            <input id="swal-batch" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.batch || ''}">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Pack</label>
              <input id="swal-pack" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.pack || ''}">
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">MRP</label>
              <input id="swal-mrp" type="number" step="0.01" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.mrp || ''}">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Expiry</label>
              <input id="swal-expiry" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.expiry || ''}">
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Discount %</label>
              <input id="swal-dis" type="number" step="0.01" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.dis || '0.00'}">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Qty</label>
              <input id="swal-qty" type="number" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.qty || '0'}">
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Free Qty</label>
              <input id="swal-fqty" type="number" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold text-gray-900" value="${item.fqty || '0'}">
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save Changes',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      customClass: {
        container: 'rounded-3xl',
        popup: 'rounded-3xl p-6',
        confirmButton: 'rounded-xl px-8 py-3 font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-500/30',
        cancelButton: 'rounded-xl px-8 py-3 font-bold text-sm uppercase tracking-wider'
      },
      preConfirm: () => {
        return {
          batch: document.getElementById('swal-batch').value,
          pack: document.getElementById('swal-pack').value,
          mrp: parseFloat(document.getElementById('swal-mrp').value) || 0,
          expiry: document.getElementById('swal-expiry').value,
          dis: document.getElementById('swal-dis').value,
          qty: document.getElementById('swal-qty').value,
          fqty: document.getElementById('swal-fqty').value
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setExtractedData(prevData => {
          const newData = prevData.map(i => {
            if (i.uuid === item.uuid) {
              return { ...i, ...result.value };
            }
            return i;
          });
          localStorage.setItem('extractedInvoiceItems', JSON.stringify(newData));
          return newData;
        });
        Swal.fire({
          icon: 'success',
          title: 'Batch Updated',
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  };


  // Socket logic lifted to App for global header status
  useEffect(() => {
    if (!token || !isScanningMode) {
      disconnectSocket()
      setConnectionStatus('disconnected')
      return
    }

    const socket = initializeSocket(token)

    const handleConnect = () => setConnectionStatus('connected')
    const handleDisconnect = () => setConnectionStatus('disconnected')
    const handleConnectError = (error) => {
      setConnectionStatus('error');
      Swal.fire({
        icon: 'error',
        title: 'Connection Error',
        text: 'Failed to connect to the Live Matcher server.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: '#fef2f2',
        color: '#991b1b'
      });
    }

    const handleSocketError = (error) => {
      console.error("Socket Error:", error);
      Swal.fire({
        icon: 'error',
        title: 'Live Scanner Error',
        text: typeof error === 'string' ? error : (error?.message || 'A socket error occurred'),
        background: '#fff',
        confirmButtonColor: '#3b82f6'
      });
    }

    const handleProductVerified = (data) => {
      console.log("Socket Data:", data);

      // Handle Success (Normal Match) or Partial Match with Mismatches
      const isSuccess = data.success;
      const mismatches = data.mismatches || {};
      const hasMismatches = Object.keys(mismatches).length > 0;

      // Depending on the API, mismatches.batch might be a string or an object { expected, scanned }
      let mismatchedBatch = mismatches.batch;
      if (mismatchedBatch && typeof mismatchedBatch === 'object') {
        mismatchedBatch = mismatchedBatch.scanned || mismatchedBatch.Batch;
      }

      const matchedProduct = data.matched_product;

      // If not success and no mismatches at all (completely unmatched product)
      if (!isSuccess && !hasMismatches) {
        if (!matchedProduct) {
          Swal.fire({
            title: 'Unknown Product',
            text: data.message || 'No product found matching this name.',
            icon: 'warning',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            background: '#fff7ed',
            color: '#9a3412',
            iconColor: '#f97316'
          });
        }
        return;
      }
      if (!matchedProduct) return;

      const currentItemName = matchedProduct.itemName || matchedProduct.ITEM_NAME || matchedProduct.ItemName || "";

      // Determine batch to use:
      // - If batch mismatch exists → use the scanned (mismatched) batch to create new entry
      // - Otherwise → use the matched product's batch to increment its qty
      const productBatch = mismatchedBatch || matchedProduct.batch || matchedProduct.BATCH || matchedProduct.Batch;
      const hasBatchMismatch = !!mismatchedBatch;

      if (!productBatch || !currentItemName) return;

      const safeItemName = currentItemName.toString().trim().toLowerCase();

      setExtractedData(prevData => {
        if (!prevData) return prevData;

        // Calculate totals for all items with this name for global validation (Case Insensitive)
        const sameNameItems = prevData.filter(i => (i.itemName || '').toString().trim().toLowerCase() === safeItemName);

        if (sameNameItems.length === 0) {
          console.warn(`No matching item name found in manifest for: ${currentItemName}`);
          return prevData;
        }

        if (isScanningMode && !localStorage.getItem('scanStartTime')) {
          localStorage.setItem('scanStartTime', Date.now().toString());
        }

        const totalNameTarget = sameNameItems.reduce((acc, i) => acc + parseQty(i.qty) + (parseInt(i.fqty) || 0), 0);
        const totalNameScanned = sameNameItems.reduce((acc, i) => acc + (i.scannedQty || 0), 0);

        // Global validation check
        if (totalNameScanned + 1 > totalNameTarget) {
          Swal.fire({
            title: 'Inventory Full',
            text: `Cannot add ${productBatch}! ${currentItemName} total target of ${totalNameTarget} already reached.`,
            icon: 'error',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
            background: '#fef2f2',
            color: '#991b1b',
            iconColor: '#ef4444'
          });
          return prevData;
        }

        // Check if this specific batch already exists in our local state
        const existingBatchIndex = prevData.findIndex(item =>
          (item.itemName || '').toString().trim().toLowerCase() === safeItemName &&
          (item.batch || '').toString().trim().toLowerCase() === productBatch.toString().trim().toLowerCase()
        );

        let newData;
        if (existingBatchIndex !== -1) {
          // Increment existing batch scannedQty
          newData = prevData.map((item, idx) =>
            idx === existingBatchIndex ? { ...item, scannedQty: (item.scannedQty || 0) + 1 } : item
          );

          // Show info toast for non-batch mismatches (e.g., pack mismatch) so user is aware
          if (!isSuccess && hasMismatches && !hasBatchMismatch) {
            const mismatchDetails = Object.entries(mismatches)
              .map(([key, val]) => `${key}: expected "${val.expected}" got "${val.scanned}"`)
              .join(', ');
            Swal.fire({
              title: 'Mismatch Detected (Qty Updated)',
              text: `${currentItemName} — ${mismatchDetails}`,
              icon: 'warning',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
              background: '#fff7ed',
              color: '#9a3412',
              iconColor: '#f97316'
            });
          }
        } else {
          // Create new batch entry
          const templateItem = sameNameItems[0] || {};
          const newBatchEntry = {
            ...templateItem,
            batch: productBatch,
            qty: "0",
            fqty: "0",
            scannedQty: 1,
            uuid: Math.random().toString(36).substr(2, 9)
          };
          newData = sortAndSerialize([...prevData, newBatchEntry]);

          Swal.fire({
            title: 'New Batch Added',
            text: `Added batch ${productBatch} for ${currentItemName}`,
            icon: 'info',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            background: '#eff6ff',
            color: '#1e40af'
          });
        }

        localStorage.setItem('extractedInvoiceItems', JSON.stringify(newData));
        return newData;
      });
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('error', handleSocketError)
    socket.on('product_verified', handleProductVerified)

    if (socket.connected) setConnectionStatus('connected')

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('error', handleSocketError)
      socket.off('product_verified', handleProductVerified)
    }
  }, [token, isScanningMode])

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'))
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleLogout = () => {
    Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to logout? All unsaved scanning progress will be lost.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#000000',
      confirmButtonText: 'Yes, sign out',
      cancelButtonText: 'Cancel',
      customClass: {
        confirmButton: 'rounded-xl px-6 py-3 font-bold',
        cancelButton: 'rounded-xl px-6 py-3 font-bold text-gray-600'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.clear()
        setToken(null)
        setExtractedData(null)
        setFileName(null)
        setIsScanningMode(false)
        setSelectedSupplier(null)
        disconnectSocket()
      }
    });
  }

  const handleDirectUpload = async (file) => {
    if (!file) return;

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls');

    if (!isPDF && !isExcel) {
      Swal.fire({ icon: 'error', title: 'Invalid File', text: 'Please upload a PDF or Excel file.' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();

    // For PDF, the field name is 'pdf'. For sheets, it's also usually 'pdf' or 'file'? 
    // The user said "rest of things are same", so I'll keep the field name as 'pdf' or adjust if needed.
    // Actually, looking at the previous PDF code, it used 'pdf'.
    formData.append(isPDF ? 'pdf' : 'sheet', file);

    const endpoint = isPDF
      ? 'http://192.168.1.110:3007/extract-invoice-items-from-pdf'
      : 'http://192.168.1.110:3007/extract-invoice-items-from-sheet';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      console.log(`${isPDF ? 'PDF' : 'Sheet'} Extraction Response:`, result.data);

      if (result.success && result.data?.items) {
        const rawItems = result.data.items.map(item => ({
          ...item,
          dis: item.dis || item.discount || item.Discount || "0",
          scannedQty: 0,
          uuid: Math.random().toString(36).substr(2, 9)
        }));
        const merged = mergeDuplicateBatches(rawItems);
        const items = sortAndSerialize(merged);

        const billno = result.data.billno || result.data.bill_no || '';
        setExtractedData(items);
        setBillNo(billno);
        setFileName(file.name);
        setIsScanningMode(false);
        localStorage.setItem('extractedInvoiceItems', JSON.stringify(items));
        localStorage.setItem('lastBillNo', billno);
        localStorage.setItem('lastInvoiceName', file.name);
        localStorage.setItem('isScanningMode', 'false');
        Swal.fire({ icon: 'success', title: 'Extraction Success', text: `${file.name} processed successfully.`, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
      } else {
        throw new Error(result.message || 'Failed to extract data');
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Extraction Failed', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const clearData = useCallback(async () => {
    // Call the clear-cache API
    const startTime = performance.now();
    console.group('[Clear Flow] Resetting Invoice & Clearing Cache');
    console.log('Timestamp:', new Date().toISOString());

    try {
      const storedToken = localStorage.getItem('token');
      const response = await fetch(`http://192.168.1.110:3000/api/ocr/clear-cache`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        }
      });

      const duration = (performance.now() - startTime).toFixed(2);
      if (response.ok) {
        console.log(`API clear-cache successful in ${duration}ms`);
      } else {
        console.warn(`API clear-cache failed in ${duration}ms, status: ${response.status}`);
      }
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.error(`API clear-cache error after ${duration}ms:`, error);

      Swal.fire({
        icon: 'warning',
        title: 'Cache Clear Warning',
        text: 'The server cache might not have been cleared, but your local session has been reset.',
        confirmButtonColor: '#2563eb',
        toast: true,
        position: 'top-end',
        timer: 4000
      });
    }

    setExtractedData(null)
    setBillNo('')
    setFileName(null)
    setIsScanningMode(false)
    disconnectSocket()
    localStorage.removeItem('extractedInvoiceItems')
    localStorage.removeItem('lastBillNo')
    localStorage.removeItem('lastInvoiceName')
    localStorage.removeItem('lastExtractionDate')
    localStorage.removeItem('scanStartTime')
    localStorage.setItem('isScanningMode', 'false')

    console.log('Local context cleared successfully');
    console.groupEnd();
  }, [token])

  if (!token) {
    return <Login setToken={setToken} />
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      <Header
        onLogout={handleLogout}
        isScanningMode={isScanningMode}
        fileName={fileName}
        connectionStatus={connectionStatus}
        onReset={clearData}
        hasData={!!extractedData}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onUpload={handleDirectUpload}
        isUploading={isUploading}
        selectedSupplier={selectedSupplier}
      />
      <main className="flex-1 w-full overflow-hidden">
        <Home
          extractedData={extractedData}
          setExtractedData={setExtractedData}
          fileName={fileName}
          setFileName={setFileName}
          isScanningMode={isScanningMode}
          setIsScanningMode={setIsScanningMode}
          clearData={clearData}
          searchTerm={searchTerm}
          onUpdateQty={handleUpdateQty}
          onAddBatch={handleAddBatch}
          onEditItem={handleEditItem}
          onUpdateItemField={handleUpdateItemField}
          selectedSupplier={selectedSupplier}
          setSelectedSupplier={setSelectedSupplier}
          billNo={billNo}
          setBillNo={setBillNo}
        />
      </main>
    </div>
  )
}

export default App
