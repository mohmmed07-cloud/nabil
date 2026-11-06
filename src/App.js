import React, { useState, useEffect } from 'react';
import './App.css';
import Home from './Pages/Home';
import PatientsList from './Pages/PatientsList';
import PdfFilesList from './Pages/PdfFilesList'; // استيراد صفحة الـ PDF الجديدة
import Login from './Pages/Login';
import Signup from './Pages/Signup';
import Navbar from './NavbarFooter/Navbar';
import Footer from './NavbarFooter/Footer';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [loading, setLoading] = useState(true);
  const [hide, setHide] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [currentPage, setCurrentPage] = useState('form'); // 'form' أو 'list' أو 'pdfs'

  useEffect(() => {
    const timer1 = setTimeout(() => setHide(true), 2000);
    const timer2 = setTimeout(() => setLoading(false), 2700);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // دالة ذكية لاختيار الصفحة المناسبة بناءً على قيمة currentPage
  const renderPage = () => {
    if (currentPage === 'form') return <Home />;
    if (currentPage === 'list') return <PatientsList />;
    if (currentPage === 'pdfs') return <PdfFilesList />;
    return <Home />;
  };

  return (
    <div className="App">
      {loading && (
        <div className={`loader ${hide ? 'hide' : ''}`} id="loader">
          <div className="loader-logo">NABIL ABBAS LAB INFORMATION SYSTEM</div>
          <div className="loader-bar"><div className="loader-fill"></div></div>
        </div>
      )}

      {!loading && authChecked && (
        <>
          {user ? (
            <>
              <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
              {renderPage()}
              <Footer />
            </>
          ) : showSignup ? (
            <Signup onSwitchToLogin={() => setShowSignup(false)} />
          ) : (
            <Login onSwitchToSignup={() => setShowSignup(true)} />
          )}
        </>
      )}
    </div>
  );
}

export default App;