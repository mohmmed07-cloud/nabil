import React, { useState, useEffect } from 'react';
import './PatientsList.css';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import rawPatientsData from '../tableConvert.com_v77qv5.json';

function PatientsList() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // حالات نافذة استعراض الصور
  const [activeGallery, setActiveGallery] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'patients'));
      const list = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPatients(list);
    } catch (error) {
      console.error('Error fetching patients:', error);
      alert('حدث خطأ أثناء جلب البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleUploadBatch = async () => {
    if (!rawPatientsData || rawPatientsData.length === 0) {
      alert('الملف فارغ أو غير موجود');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من رغبتك في رفع ${rawPatientsData.length} سجل إلى قاعدة البيانات؟`)) return;

    setLoading(true);
    try {
      const formatPhone = (val) => {
        if (!val) return '';
        let s = String(val).trim();
        if (s.toLowerCase().includes('e')) {
          try {
            s = String(Math.floor(Number(s)));
          } catch (e) {}
        }
        return s.replace('.0', '');
      };

      const BATCH_SIZE = 400;
      const total = rawPatientsData.length;
      const patientsRef = collection(db, 'patients');

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = rawPatientsData.slice(i, i + BATCH_SIZE);

        chunk.forEach((item) => {
          const newDoc = doc(patientsRef);
          const sexRaw = String(item['Sex'] || '').trim();
          const gender = sexRaw.includes('ذكر') ? 'male' : (sexRaw.includes('أنث') ? 'female' : '');
          const ageNum = Number(item['Age']) || 0;

          const notes = [];
          if (item['File.No']) notes.push(`File: ${item['File.No']}`);
          if (item['Lab.No']) notes.push(`Lab: ${item['Lab.No']}`);
          if (item['PIC']) notes.push(`PIC: ${item['PIC']}`);

          batch.set(newDoc, {
            name: String(item['Patient Name'] || '').trim(),
            age: ageNum,
            gender: gender,
            birthDate: null,
            DoctorName: String(item['Doctore'] || '').trim(),
            PayerName: String(item['Insurance '] || '').trim(),
            PatientTel: formatPhone(item['Phone No.']),
            Note: notes.join(' | '),
            images: [],
            document: null,
            createdAt: new Date()
          });
        });

        await batch.commit();
      }

      alert(`تم رفع جميع السجلات بنجاح (${total} مريض)!`);
      fetchPatients();
    } catch (err) {
      console.error('Error during bulk upload:', err);
      alert('حدث خطأ أثناء الرفع: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllPatients = async () => {
    if (patients.length === 0) {
      alert('القائمة فارغة بالفعل.');
      return;
    }

    if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من رغبتك في حذف جميع السجلات (${patients.length} مريض)؟`)) return;
    if (!window.confirm('🚨 تأكيد نهائي: لن تتمكن من استرجاع البيانات بعد الحذف!')) return;

    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'patients'));
      const docs = querySnapshot.docs;
      const BATCH_SIZE = 450;

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }

      setPatients([]);
      alert('تم تفريغ وحذف جميع سجلات المرضى بنجاح!');
    } catch (error) {
      console.error('Error clearing patients:', error);
      alert('حدث خطأ أثناء التصفير: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف بيانات هذا المريض؟')) return;

    try {
      await deleteDoc(doc(db, 'patients', id));
      setPatients((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  const openGallery = (patient, images) => {
    setActiveGallery({ patient, images });
    setSelectedImage(images[0]);
  };

  const closeGallery = () => {
    setActiveGallery(null);
    setSelectedImage('');
  };

  const filteredPatients = patients.filter((p) => {
    const term = search.toLowerCase();
    return (
      String(p.name || '').toLowerCase().includes(term) ||
      String(p.DoctorName || '').toLowerCase().includes(term) ||
      String(p.PayerName || '').toLowerCase().includes(term) ||
      String(p.PatientTel || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="patients-list-container">
      <h1>Patients List</h1>

      <div className="list-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="بحث بالاسم، الدكتور، الجهة، أو الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="btn-refresh" onClick={fetchPatients} disabled={loading}>
          {loading ? 'جاري التحديث...' : '🔄 تحديث'}
        </button>

        <button 
          type="button" 
          onClick={handleUploadBatch} 
          disabled={loading}
          style={{ padding: '10px 18px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          🚀 رفع بيانات المرضى دفعة واحدة
        </button>

        <button
          type="button"
          onClick={handleClearAllPatients}
          disabled={loading}
          style={{ padding: '10px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          🧹 تصفير القائمة بالكامل
        </button>

        <a 
          href="/patient-template.docx" 
          download="patient-template.docx"
          style={{ padding: '10px 18px', background: '#10b981', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', display: 'inline-block' }}
        >
          📥 تحميل نموذج التقرير (.docx)
        </a>
      </div>

      {loading ? (
        <p className="status-text">جاري التحميل...</p>
      ) : filteredPatients.length === 0 ? (
        <p className="status-text">لا توجد بيانات مطابقة.</p>
      ) : (
        <div className="table-wrapper">
          <table className="patients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Reports & Files</th> {/* عمود التقارير والمرفقات الأساسي */}
                <th>Doctor</th>
                <th>Payer</th>
                <th>Phone</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Birth Date</th>
                <th>Note</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => {
                const patientImages = Array.isArray(p.images) ? p.images : p.imageUrl ? [p.imageUrl] : [];
                const patientDoc = p.document; // الملف المرفق

                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                        {/* زر استعراض الصور */}
                        {patientImages.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openGallery(p, patientImages)}
                            style={{ background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                          >
                            📷 استعراض الصور ({patientImages.length})
                          </button>
                        )}

                        {/* زر تحميل الملف المرفق إذا وجد */}
                        {patientDoc && patientDoc.url ? (
                          <a
                            href={patientDoc.url}
                            download={patientDoc.name || 'patient-document.docx'}
                            style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            📥 تحميل: {patientDoc.name.length > 15 ? patientDoc.name.substring(0, 15) + '...' : patientDoc.name}
                          </a>
                        ) : null}

                        {/* إذا لم توجد صور أو ملفات */}
                        {patientImages.length === 0 && (!patientDoc || !patientDoc.url) && (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </div>
                    </td>
                    <td>{p.DoctorName}</td>
                    <td>{p.PayerName}</td>
                    <td>{p.PatientTel}</td>
                    <td>{p.age}</td>
                    <td>{p.gender}</td>
                    <td>{p.birthDate}</td>
                    <td>{p.Note}</td>
                    <td>{p.createdAt?.toDate()?.toLocaleDateString() || ''}</td>
                    <td>
                      <button className="btn-delete" onClick={() => handleDelete(p.id)}>
                        🗑️ حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* نافذة استعراض وتكبير الصور (Modal Gallery) */}
      {activeGallery && (
        <div
          onClick={closeGallery}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '850px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b' }}>مرفقات المريض: {activeGallery.patient.name}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>عدد الصور: {activeGallery.images.length}</span>
              </div>
              <button onClick={closeGallery} style={{ background: '#f1f5f9', border: 'none', fontSize: '18px', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '50%', color: '#475569' }}>✕</button>
            </div>

            <div style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', overflow: 'hidden', position: 'relative' }}>
              <img src={selectedImage} alt="Selected preview" style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '6px' }} />
              <a href={selectedImage} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', bottom: '15px', right: '15px', backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#0f172a', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
                ↗ فتح بالحجم الكامل
              </a>
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', gap: '12px', overflowX: 'auto', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              {activeGallery.images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedImage(imgUrl)}
                  style={{ border: selectedImage === imgUrl ? '3px solid #2563eb' : '2px solid transparent', borderRadius: '8px', cursor: 'pointer', opacity: selectedImage === imgUrl ? 1 : 0.6, transform: selectedImage === imgUrl ? 'scale(1.05)' : 'none', transition: 'all 0.2s ease', flexShrink: 0 }}
                >
                  <img src={imgUrl} alt={`Thumb ${idx + 1}`} style={{ width: '65px', height: '65px', objectFit: 'cover', borderRadius: '5px', display: 'block' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientsList;