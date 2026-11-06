import React, { useState, useRef } from 'react';
import './Home.css';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const IMGBB_API_KEY = "875be18cca7c2fcde6c8e84c6ad86143";

function Home() {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    birthDate: '',
    DoctorName: '',
    PayerName: '',
    PatientTel: '',
    Note: ''
  });
  const [imagesFiles, setImagesFiles] = useState([null, null, null, null, null, null]);
  const [documentFile, setDocumentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const fileInputsRef = useRef([]);
  const docInputRef = useRef(null);

  const compressAndConvertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const uploadToImgBB = async (base64) => {
    if (!base64) return null;
    const cleanBase64 = base64.split(',')[1];
    const bodyFormData = new FormData();
    bodyFormData.append('image', cleanBase64);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: bodyFormData
    });

    const data = await response.json();
    if (data.success) {
      return data.data.url;
    }
    throw new Error(data.error?.message || 'فشل رفع الصورة إلى imgBB');
  };

  const handleImageChange = (index, file) => {
    const updated = [...imagesFiles];
    updated[index] = file || null;
    setImagesFiles(updated);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFormData({
      name: '',
      age: '',
      gender: '',
      DoctorName: '',
      PayerName: '',
      PatientTel: '',
      Note: '',
      birthDate: ''
    });
    setImagesFiles([null, null, null, null, null, null]);
    setDocumentFile(null);
    fileInputsRef.current.forEach((input) => {
      if (input) input.value = '';
    });
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validUrls = [];

      for (let i = 0; i < imagesFiles.length; i++) {
        const file = imagesFiles[i];
        if (file) {
          const compressed = await compressAndConvertToBase64(file);
          if (compressed) {
            const url = await uploadToImgBB(compressed);
            if (url) {
              validUrls.push(url);
            }
          }
        }
      }

      let documentData = null;
      if (documentFile) {
        const base64Doc = await convertFileToBase64(documentFile);
        documentData = {
          name: documentFile.name,
          url: base64Doc
        };
      }

      await addDoc(collection(db, 'patients'), {
        name: formData.name,
        age: Number(formData.age),
        gender: formData.gender,
        DoctorName: formData.DoctorName,
        PayerName: formData.PayerName,
        PatientTel: formData.PatientTel,
        Note: formData.Note,
        birthDate: formData.birthDate || null,
        images: validUrls,
        document: documentData,
        createdAt: new Date()
      });

      alert('تم حفظ بيانات المريض ورفع الملفات بنجاح!');
      handleReset();
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('حدث خطأ أثناء الحفظ والرفع: ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'patients'));
      const patientsList = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        patientsList.push({
          'Document ID': docSnap.id,
          'Name': data.name || '',
          'Doctor Name': data.DoctorName || '',
          'Payer Name': data.PayerName || '',
          'Phone': data.PatientTel || '',
          'Age': data.age || '',
          'Gender': data.gender || '',
          'Birth Date': data.birthDate || '',
          'Note': data.Note || '',
          'Images': Array.isArray(data.images) ? data.images.join(', ') : '',
          'Document': data.document?.name || '',
          'Date': data.createdAt?.toDate()?.toLocaleDateString() || ''
        });
      });

      if (patientsList.length === 0) {
        alert('لا توجد بيانات مرضى لتصديرها.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(patientsList);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(data, 'Patients_List.xlsx');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('حدث خطأ أثناء تصدير ملف الإكسل.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="lab-container">
      <div className="form-group">
        <h1>Patient Information Form</h1>

        <form onSubmit={handleSubmit} className="patient-form">
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            placeholder="Enter patient name"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />

          <label htmlFor="DoctorName">Doctor Name:</label>
          <input
            id="DoctorName"
            placeholder="Enter doctor name"
            name="DoctorName"
            value={formData.DoctorName}
            onChange={handleChange}
          />

          <label htmlFor="PayerName">Payer Name:</label>
          <input
            id="PayerName"
            placeholder="Enter payer name"
            name="PayerName"
            value={formData.PayerName}
            onChange={handleChange}
          />

          <label htmlFor="PatientTel">Patient Telephone:</label>
          <input
            type="tel"
            placeholder="e.g., +962 7 1234 5678"
            id="PatientTel"
            name="PatientTel"
            value={formData.PatientTel}
            onChange={handleChange}
          />

          <label htmlFor="age">Age:</label>
          <input
            type="number"
            id="age"
            name="age"
            value={formData.age}
            onChange={handleChange}
          />

          <label htmlFor="birthDate">Birth Date:</label>
          <DatePicker
            id="birthDate"
            selected={formData.birthDate ? new Date(formData.birthDate) : null}
            onChange={(date) => {
              const formatted = date ? date.toISOString().split('T')[0] : '';
              setFormData({ ...formData, birthDate: formatted });
            }}
            dateFormat="dd/MM/yyyy"
            placeholderText="اختر تاريخ الميلاد"
            className="custom-datepicker"
            maxDate={new Date()}
            showYearDropdown
            yearDropdownItemNumber={80}
            scrollableYearDropdown
          />

          <label htmlFor="gender">Gender:</label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={handleChange}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <div className="upload-section">
            <label className="section-title">Patient Reports / Images (حتى 6 صور)</label>
            <div className="upload-grid">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const file = imagesFiles[idx];
                return (
                  <div key={idx} className={`upload-card ${file ? 'has-file' : ''}`}>
                    <input
                      type="file"
                      id={`file-input-${idx}`}
                      className="file-hidden-input"
                      accept="image/*"
                      ref={(el) => (fileInputsRef.current[idx] = el)}
                      onChange={(e) => handleImageChange(idx, e.target.files[0])}
                    />
                    <label htmlFor={`file-input-${idx}`} className="upload-card-label">
                      <span className="card-badge">صورة {idx + 1}</span>
                      <div className="upload-icon">
                        {file ? '✅' : '📷'}
                      </div>
                      <span className="upload-text">
                        {file ? file.name : 'اختر صورة'}
                      </span>
                    </label>
                    {file && (
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={() => {
                          handleImageChange(idx, null);
                          if (fileInputsRef.current[idx]) {
                            fileInputsRef.current[idx].value = '';
                          }
                        }}
                        title="إزالة الصورة"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="upload-section" style={{ marginTop: '15px' }}>
            <label className="section-title">Patient Document / File (.docx, .pdf)</label>
            <div className={`upload-card ${documentFile ? 'has-file' : ''}`} style={{ width: '100%', maxWidth: 'none' }}>
              <input
                type="file"
                id="document-file-input"
                className="file-hidden-input"
                accept=".docx,.pdf,.doc,.txt"
                ref={docInputRef}
                onChange={(e) => setDocumentFile(e.target.files[0] || null)}
              />
              <label htmlFor="document-file-input" className="upload-card-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px' }}>
                <span className="upload-icon" style={{ fontSize: '20px' }}>
                  {documentFile ? '✅' : '📄'}
                </span>
                <span className="upload-text" style={{ fontWeight: '600' }}>
                  {documentFile ? documentFile.name : 'اختر ملف مستند المريض (اختياري)'}
                </span>
              </label>
              {documentFile && (
                <button
                  type="button"
                  className="btn-remove-file"
                  onClick={() => {
                    setDocumentFile(null);
                    if (docInputRef.current) docInputRef.current.value = '';
                  }}
                  title="إزالة الملف"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <label htmlFor="Note">Note:</label>
          <textarea
            className="note-textarea"
            id="Note"
            name="Note"
            value={formData.Note}
            onChange={handleChange}
          />

          <div className="buttons-container">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'جاري رفع الملفات والحفظ...' : 'Submit'}
            </button>

            <button type="button" onClick={handleReset}>
              Reset
            </button>

            <button
              type="button"
              className="btn-export"
              onClick={exportToExcel}
              disabled={exporting}
            >
              {exporting ? 'جاري التحميل...' : '📥 Export to Excel'}
            </button>

            <a 
              href="/patient-template.docx" 
              download="patient-template.docx"
              style={{
                padding: '10px 18px',
                background: '#10b981',
                color: '#fff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              📥 تحميل نموذج التقرير
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Home;