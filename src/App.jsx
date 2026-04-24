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
      const mergedQty  = parseQty(existing.qty)  + parseQty(item.qty);
      const mergedFqty = parseQty(existing.fqty) + parseQty(item.fqty);
      const mergedAmt  = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
      map.set(key, {
        ...existing,
        qty:    String(mergedQty),
        fqty:   String(mergedFqty),
        amount: parseFloat(mergedAmt.toFixed(2))
      });
    }
  });
  return Array.from(map.values());
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
      title: `Add Batch for ${itemName}`,
      input: 'text',
      inputLabel: 'Batch ID',
      inputPlaceholder: 'Enter new batch ID...',
      showCancelButton: true,
      confirmButtonText: 'Add Batch',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value) return 'You need to enter a batch ID!';
        if (extractedData.some(item => item.itemName === itemName && item.batch === value)) {
          return 'This batch already exists for this item!';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setExtractedData(prevData => {
          const templateItem = prevData.find(i => i.itemName === itemName) || {};
          const newBatchEntry = {
            ...templateItem,
            batch: result.value,
            qty: "0",
            fqty: "0",
            scannedQty: 0
          };
          const newData = [...prevData, newBatchEntry];
          localStorage.setItem('extractedInvoiceItems', JSON.stringify(newData));
          return newData;
        });
        Swal.fire({
          icon: 'success',
          title: 'Batch Added',
          text: `Batch ${result.value} added to ${itemName}`,
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

      // Handle Success (Normal Match) or Partial Match with Batch Mismatch
      const isSuccess = data.success;
      // Depending on the API, mismatches.batch might be a string or an object { expected, scanned }
      let mismatchedBatch = data.mismatches?.batch;
      if (mismatchedBatch && typeof mismatchedBatch === 'object') {
        mismatchedBatch = mismatchedBatch.scanned || mismatchedBatch.Batch;
      }

      const matchedProduct = data.matched_product;

      if (!isSuccess && !mismatchedBatch) {
        // Show alert for completely unmatched products
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

      const productBatch = mismatchedBatch || matchedProduct.batch || matchedProduct.BATCH || matchedProduct.Batch;
      const currentItemName = matchedProduct.itemName || matchedProduct.ITEM_NAME || matchedProduct.ItemName || "";

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
          // Increment existing batch
          newData = prevData.map((item, idx) =>
            idx === existingBatchIndex ? { ...item, scannedQty: (item.scannedQty || 0) + 1 } : item
          );
        } else {
          // Create new batch entry
          const templateItem = sameNameItems[0] || {};
          const newBatchEntry = {
            ...templateItem,
            batch: productBatch,
            qty: "0",
            fqty: "0",
            scannedQty: 1
          };
          newData = [...prevData, newBatchEntry];

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

    if (file.type !== 'application/pdf') {
      Swal.fire({ icon: 'error', title: 'Invalid File', text: 'Please upload a PDF file.' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('http://192.168.1.110:3007/extract-invoice-items-from-pdf', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      console.log("PDF Extraction Response:", result.data);

      if (result.success && result.data?.items) {
        const rawItems = result.data.items.map(item => ({ ...item, scannedQty: 0 }));
        const items = mergeDuplicateBatches(rawItems);
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
        throw new Error('Failed to extract data');
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
