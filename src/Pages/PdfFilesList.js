import React, { useState, useEffect } from 'react';
import './PdfFilesList.css';
import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import rawPdfData from '../pdfFilesData.json';

function PdfFilesList() {
  const [pdfPatients, setPdfPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null);

  const fetchPdfPatients = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'patients'));
      const list = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.document && data.document.url) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPdfPatients(list);
    } catch (error) {
      console.error('Error fetching PDF patients:', error);
      alert('حدث خطأ أثناء جلب ملفات الـ PDF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfPatients();
  }, []);

  const handleUploadJsonBatch = async () => {
    if (!rawPdfData || rawPdfData.length === 0) {
      alert('ملف الـ JSON غير موجود أو فارغ في مسار src!');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من رغبتك في رفع وربط ${rawPdfData.length} سجل PDF أونلاين؟`)) {
      return;
    }

    setUploading(true);
    try {
      const patientsRef = collection(db, 'patients');
      const BATCH_SIZE = 400;
      const total = rawPdfData.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = rawPdfData.slice(i, i + BATCH_SIZE);

        chunk.forEach((item) => {
          const newDocRef = doc(patientsRef);
          
          const patientName = String(item['Patient Name'] || item.name || 'مريض بدون اسم').trim();
          const fileName = String(item['File Name'] || item.fileName || 'report.pdf').trim();
          const fileUrl = String(item['URL'] || item.url || '').trim();

          batch.set(newDocRef, {
            name: patientName,
            age: Number(item.age) || 0,
            gender: String(item.gender || '').trim(),
            birthDate: null,
            DoctorName: String(item.doctor || '').trim(),
            PayerName: '',
            PatientTel: '',
            Note: `Google Drive PDF: ${fileName}`,
            images: [],
            document: {
              name: fileName,
              url: fileUrl
            },
            createdAt: new Date()
          });
        });

        await batch.commit();
      }

      alert(`تم رفع وربط ${total} سجل PDF بنجاح في قاعدة البيانات أونلاين!`);
      fetchPdfPatients();
    } catch (error) {
      console.error('Error during JSON upload:', error);
      alert('حدث خطأ أثناء الرفع: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const filteredPatients = pdfPatients.filter((p) => {
    const term = search.toLowerCase();
    return (
      String(p.name || '').toLowerCase().includes(term) ||
      String(p.document?.name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="pdf-list-container">
      <h1>PDF Reports & Documents</h1>

      <div className="list-controls">
        <input
          type="text"
          placeholder="بحث باسم المريض أو اسم ملف الـ PDF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        
        <button className="btn-refresh" onClick={fetchPdfPatients} disabled={loading || uploading} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? 'جاري التحديث...' : '🔄 تحديث'}
        </button>

        <button
          type="button"
          onClick={handleUploadJsonBatch}
          disabled={uploading}
          style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          {uploading ? 'جاري الرفع والربط...' : '🚀 رفع وربط الـ PDF أونلاين'}
        </button>
      </div>

      {loading ? (
        <p className="status-text">جاري تحميل ملفات الـ PDF من السحابة...</p>
      ) : filteredPatients.length === 0 ? (
        <p className="status-text">لا توجد ملفات PDF مرفوعة حالياً. اضغط على زر "رفع وربط الـ PDF أونلاين" إذا لم تقم برفعها من قبل.</p>
      ) : (
        <div className="table-wrapper">
          <table className="patients-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>File Name</th>
                <th>Upload Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: '600', color: '#1e293b' }}>{p.name}</td>
                  <td style={{ color: '#0284c7' }}>{p.document?.name || 'document.pdf'}</td>
                  <td>{p.createdAt?.toDate()?.toLocaleDateString() || ''}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {p.document?.url && (
                        <button
                          type="button"
                          onClick={() => setSelectedPdf(p)}
                          style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          👁️ خيارات التقرير
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* النافذة المنبثقة الاحترافية لتجنب حظر جوجل درايف */}
      {selectedPdf && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            width: '100%',
            maxWidth: '500px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            {/* رأس النافذة */}
            <div style={{
              padding: '15px 20px',
              background: '#1e293b',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>تقرير المريض: {selectedPdf.name}</h3>
              <button
                onClick={() => setSelectedPdf(null)}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>

            {/* محتوى النافذة المنبثقة وأزرار المعاينة الآمنة */}
            <div style={{ padding: '30px', textAlign: 'center', background: '#f8fafc' }}>
              <p style={{ fontSize: '15px', color: '#334155', marginBottom: '20px', fontWeight: '600' }}>
                اسم الملف: {selectedPdf.document?.name}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a
                  href={selectedPdf.document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    display: 'block',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  📂 فتح وعرض التقرير في Google Drive
                </a>

                <button
                  type="button"
                  onClick={() => setSelectedPdf(null)}
                  style={{
                    background: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfFilesList;