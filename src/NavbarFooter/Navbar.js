import React from 'react';
import './Navbar.css';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

function Navbar({ currentPage, setCurrentPage }) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  return (
    <nav className="navbar">
      <h2>Nabil Lab Information System</h2>
      <div className="navbar-actions">
        <button
          className={`nav-btn ${currentPage === 'form' ? 'active' : ''}`}
          onClick={() => setCurrentPage('form')}
        >
          إضافة مريض
        </button>

        <button
          className={`nav-btn ${currentPage === 'pdfs' ? 'active' : ''}`}
          onClick={() => setCurrentPage('pdfs')}
        >
          📁 ملفات الـ PDF
        </button>

        <button
          className={`nav-btn ${currentPage === 'list' ? 'active' : ''}`}
          onClick={() => setCurrentPage('list')}
        >
          عرض البيانات
        </button>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;