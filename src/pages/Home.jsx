import React, { useState } from 'react';
import PdfUploader from '../components/PdfUploader';
import ItemTable from '../components/ItemTable';
import SupplierSearch from '../components/SupplierSearch';
import { Loader2, CheckCircle2, Send, Trophy, Timer, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

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
      // First occurrence — clone and store
      map.set(key || Symbol(), { ...item });
    } else {
      // Duplicate batch — merge numeric fields
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
      sNo: index + 1
    }));
};

const Home = ({
  extractedData,
  setExtractedData,
  fileName,
  setFileName,
  isScanningMode,
  setIsScanningMode,
  clearData,
  searchTerm,
  onUpdateQty,
  onAddBatch,
  onUpdateItemField,
  onEditItem,
  selectedSupplier,
  setSelectedSupplier,
  billNo,
  setBillNo,
  poNo,
  setPoNo
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // 'success' | 'error' | null

  const handleUploadSuccess = (response, name) => {
    if (response.success && response.data?.items) {
      // Merge duplicate batch entries then initialise scannedQty
      const rawItems = response.data.items.map(item => ({
        ...item,
        dis: item.dis || item.discount || item.Discount || "0",
        scannedQty: 0,
        uuid: Math.random().toString(36).substr(2, 9)
      }));
      const merged = mergeDuplicateBatches(rawItems);
      const items = sortAndSerialize(merged);

      const bNo = response.data.billno || response.data.bill_no || '';
      setExtractedData(items);
      setBillNo(bNo);
      setFileName(name);
      setSendStatus(null);
      setIsScanningMode(false);
      localStorage.setItem('extractedInvoiceItems', JSON.stringify(items));
      localStorage.setItem('lastBillNo', bNo);
      localStorage.setItem('lastInvoiceName', name);
      localStorage.setItem('lastExtractionDate', new Date().toLocaleString());
      localStorage.setItem('isScanningMode', 'false');
    }
  };

  const handleConfirmAndSave = async () => {
    if (!extractedData || extractedData.length === 0) return;

    setIsSending(true);
    setSendStatus(null);

    const startTime = performance.now();
    console.group(`[API Request] Process Invoice JSON`);
    console.log('Timestamp:', new Date().toISOString());

    try {
      const apiData = extractedData.map(item => ({
        ITEM_NAME: item.itemName || '',
        PACK: item.pack || '',
        MRP: typeof item.mrp === 'number' ? item.mrp : parseFloat(item.mrp) || 0,
        EXPIRY: item.expiry || '',
        QTY: item.qty || '0',
        BATCH: item.batch || ''
      }));

      console.log('Payload:', apiData);

      const response = await fetch('http://192.168.1.110:6500/api/ocr/process_json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(apiData)
      });

      const duration = (performance.now() - startTime).toFixed(2);

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      console.log(`Success in ${duration}ms`);

      Swal.fire({
        icon: 'success',
        title: 'Data Processed',
        text: 'Invoice items saved successfully. Scanner is now live.',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      setSendStatus('success');
      setIsScanningMode(true);
      localStorage.setItem('isScanningMode', 'true');
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

      setSendStatus('error');
    } finally {
      console.groupEnd();
      setIsSending(false);
    }
  };

  const handleFinishScanning = () => {
    if (!extractedData || extractedData.length === 0) return;

    const totalTargetQty = extractedData.reduce((acc, item) => acc + parseQty(item.qty), 0);
    const totalScannedQty = extractedData.reduce((acc, item) => acc + (item.scannedQty || 0), 0);

    if (totalScannedQty < totalTargetQty / 2) {
      Swal.fire({
        title: 'Keep Going! 💪',
        text: `You've only scanned ${totalScannedQty} items out of ${totalTargetQty}. Please scan at least half before submitting!`,
        icon: 'warning',
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'Back to Scanning'
      });
      return;
    }

    const startTimeStr = localStorage.getItem('scanStartTime');
    if (!startTimeStr) {
      Swal.fire({
        title: 'No Scanning Data',
        text: 'It looks like you haven\'t started scanning items yet.',
        icon: 'info',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const startTime = parseInt(startTimeStr);
    const endTime = Date.now();
    const timeElapsedSeconds = (endTime - startTime) / 1000;
    const expectedTimeSeconds = totalTargetQty * 2.5;

    // Send data to EasySol report API
    const generateReport = async () => {
      try {
        const currentPoNo = localStorage.getItem('lastPoNo') || '';
        const apiData = extractedData
          .filter(item => (item.scannedQty || 0) > 0)
          .map(item => ({
            BillNo: billNo || localStorage.getItem('lastBillNo') || '',
            SuppCode: selectedSupplier?.VCode || '',
            BillDate: " ",
            item: " ",
            Barcode: "",
            name: item.itemName || '',
            pack: item.pack || '',
            batch: item.batch || '',
            Expiry: item.expiry || '',
            quantity: item.scannedQty - (item.fqty || 0) || 0,
            freequanti: item.fqty || "0",
            HALFP: "",
            FTrate: item.ftrate || item.rate || 0,
            SRate: item.rate || 0,
            mrp: item.mrp || 0,
            Discount: item.dis || "0",
            EXCISE: "",
            TAX: "",
            Scm1: "",
            Scm2: "",
            ScmPer: "",
            HSNCode: item.hsn || '',
            CGST: item.cgst || "0",
            SGST: item.sgst || "0",
            IGST: item.igst || "0",
            EOC: "",
            EOR: "",
            PONO: currentPoNo,
            manual_count: item.manual_count || 0,
            scan_count: item.scan_count || 0,
          }));

        console.log('[REPORT PAYLOAD]:', apiData);

        const response = await fetch('http://192.168.1.110:3000/api/ocr/generate-easysol-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(apiData)
        });

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }

        const textData = await response.text();
        console.log("Report Response (Text):", textData);

        // Trigger CSV download
        const blob = new Blob([textData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `EasySol_Report_${billNo || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      } catch (error) {
        console.error("EasySol report generation failed:", error);
        Swal.fire({
          icon: 'error',
          title: 'Report Failed',
          text: 'Failed to generate the EasySol report. Please try again.',
          confirmButtonColor: '#ef4444'
        });
        return false;
      }
    };

    const runSubmission = async () => {
      setIsSending(true);
      const success = await generateReport();
      setIsSending(false);

      if (success) {
        if (timeElapsedSeconds <= expectedTimeSeconds) {
          Swal.fire({
            title: '🎉 HURRAY! Lightning Fast! 🚀',
            html: `
              <div style="font-size: 1.1rem; line-height: 1.6;">
                You completed the manifest in <b><span style="color: #10b981; font-size: 1.4rem;">${Math.round(timeElapsedSeconds)}s</span></b>!<br/>
                That's well under the expected time of ${Math.round(expectedTimeSeconds)}s.<br/>
                <span style="color: #6366f1; font-weight: bold; margin-top: 10px; display: inline-block;">Amazing efficiency! Keep up the great work!</span>
              </div>
            `,
            icon: 'success',
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Awesome!'
          }).then(() => {
            clearData();
          });
        } else {
          Swal.fire({
            title: 'Great Effort! 👏',
            html: `
              <div style="font-size: 1.1rem; line-height: 1.6;">
                You completed the manifest in <b><span style="color: #f59e0b; font-size: 1.4rem;">${Math.round(timeElapsedSeconds)}s</span></b>.<br/>
                The expected expert time is ${Math.round(expectedTimeSeconds)}s.<br/>
                <span style="color: #3b82f6; font-weight: bold; margin-top: 10px; display: inline-block;">You're doing great! Try to beat the clock next time! 📈</span>
              </div>
            `,
            icon: 'info',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'I Will Improve!'
          }).then(() => {
            clearData();
          });
        }
      }
    };

    runSubmission();
  };

  return (

    <div className="flex flex-col items-center w-full h-full bg-white transition-all duration-500 overflow-hidden">
      {!extractedData ? (
        <div className="w-full flex-grow flex flex-col items-center justify-center p-12 text-center space-y-10 animate-in fade-in duration-1000">
          <div className="space-y-6">
            <div className="p-6 bg-blue-50 rounded-full text-blue-600 inline-block">
              <FileText size={48} strokeWidth={1.5} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">Ready to Process</h2>
              <p className="text-gray-500 font-bold max-w-sm mx-auto uppercase tracking-widest text-[10px]">
                Step 1: Search & Select your supplier
              </p>
            </div>
          </div>

          <SupplierSearch onSelect={setSelectedSupplier} selectedSupplier={selectedSupplier} />

          {selectedSupplier && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-green-50 text-green-700 px-6 py-3 rounded-full border border-green-200 font-bold text-sm flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span>Supplier set! Now click <span className="uppercase text-blue-600">Upload File</span> in the header.</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
          <ItemTable
            items={extractedData}
            isScanningMode={isScanningMode}
            searchTerm={searchTerm}
            onUpdateQty={onUpdateQty}
            onAddBatch={onAddBatch}
            onEditItem={onEditItem}
            onUpdateItemField={onUpdateItemField}
            onConfirmAndSave={handleConfirmAndSave}
            onFinishScanning={handleFinishScanning}
            isSending={isSending}
            billNo={billNo}
            poNo={poNo}
          />
        </div>
      )}
    </div>
  );
};

export default Home;
