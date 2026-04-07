import React, { useState } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, FileText, Printer, 
  Calendar, CheckCircle, Plus, Minus, Upload, Paperclip, 
  FileSpreadsheet, DownloadCloud, Edit, Trash2, Filter,
  LogOut, UserCircle, UserPlus, Lock, XCircle, Info
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// Gunakan config dari environment Canvas, ATAU gunakan config manual Anda untuk GitHub Pages
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  // GANTI BAGIAN INI DENGAN FIREBASE CONFIG MILIK ANDA!
  apiKey: "AIzaSyDANtwjAFmNtBAJIUBXX6rhHJ1BGBO2gBo",
  authDomain: "petty-cash-baru.firebaseapp.com",
  projectId: "petty-cash-baru",
  storageBucket: "petty-cash-baru.firebasestorage.app",
  messagingSenderId: "418862976845",
  appId: "1:418862976845:web:90f4356063dc88ec5f7104"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'petty-cash-app';

export default function App() {
  // --- NOTIFICATION STATE ---
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- AUTHENTICATION STATE ---
  const [users, setUsers] = useState([
    { username: 'admin', password: 'password', role: 'admin' },
    { username: 'staff1', password: 'password', role: 'staff' }
  ]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // Admin Create User State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'staff' });

  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'form', 'laporan'
  
  // Data Master Kas
  const [transactions, setTransactions] = useState([]);

  // State Form Pengajuan (Hanya untuk cetak/PDF)
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    judulDokumen: '',
    estimasiBiaya: '',
    keterangan: ''
  });

  // State Modal Transaksi (Create)
  const [incomeModal, setIncomeModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [transactionForm, setTransactionForm] = useState({ 
    deskripsi: '', 
    jumlah: '',
    file: null,
    tanggal: new Date().toISOString().split('T')[0]
  });

  // State Laporan (Filter & Update/Delete)
  const [filterTipe, setFilterTipe] = useState('semua');
  const [filterMulai, setFilterMulai] = useState('');
  const [filterAkhir, setFilterAkhir] = useState('');
  const [editModal, setEditModal] = useState(null);

  // --- FIREBASE STATE & EFFECT ---
  const [fbUser, setFbUser] = useState(null);

  // 1. Inisialisasi Autentikasi Anonymous Firebase (Wajib untuk database cloud)
  React.useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // 2. Tarik data secara Real-Time dari Firestore
  React.useEffect(() => {
    if (!fbUser) return;
    
    // Path khusus data publik antar staff/admin
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Urutkan dari yang terbaru (berdasarkan ID timestamp)
      txs.sort((a, b) => b.id.localeCompare(a.id));
      setTransactions(txs);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      showToast('Gagal memuat data dari database cloud!', 'error');
    });

    return () => unsubscribe();
  }, [fbUser]);

  // --- HELPER FUNCTIONS ---
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(angka || 0);
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const totalPemasukan = transactions.filter(t => t.tipe === 'masuk').reduce((acc, curr) => acc + curr.jumlah, 0);
  const totalPengeluaran = transactions.filter(t => t.tipe === 'keluar').reduce((acc, curr) => acc + curr.jumlah, 0);
  const saldo = totalPemasukan - totalPengeluaran;

  // Kalkulasi form print
  const estimasiFloat = Number(formData.estimasiBiaya) || 0;
  const sisaSaldo = saldo - estimasiFloat;

  // --- AUTH HANDLERS ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.username === authForm.username && u.password === authForm.password);
    if (user) {
      setCurrentUser(user);
      setAuthForm({ username: '', password: '' });
      showToast(`Selamat datang, ${user.username}!`, 'success');
    } else {
      showToast('Username atau password salah!', 'error');
    }
  };

  const handleAdminCreateUser = (e) => {
    e.preventDefault();
    if (users.find(u => u.username === newUserForm.username)) {
      showToast('Username sudah digunakan!', 'error');
      return;
    }
    setUsers([...users, { ...newUserForm }]);
    showToast(`User ${newUserForm.username} berhasil dibuat!`, 'success');
    setShowUserModal(false);
    setNewUserForm({ username: '', password: '', role: 'staff' });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // --- TRANSACTIONS HANDLERS ---
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Fungsi Download PDF Menggunakan html2pdf
  const handleDownloadPDF = async () => {
    if (!formData.judulDokumen || !formData.estimasiBiaya) {
      showToast('Keperluan dan Nominal Pengajuan wajib diisi sebelum di-download!', 'error');
      return;
    }

    if (sisaSaldo < 0) {
      showToast('Formulir tidak dapat diproses: Sisa saldo kas tidak mencukupi (Minus).', 'error');
      return;
    }

    try {
      // Dinamis meload html2pdf jika belum ada
      if (!window.html2pdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.body.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }

      const element = document.getElementById('pdf-content');
      const opt = {
        margin:       10,
        filename:     `Form_PettyCash_${formData.tanggal}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Buat file PDF dan save
      window.html2pdf().set(opt).from(element).save();

    } catch (error) {
      console.error('Gagal memuat PDF generator, menggunakan fungsi print browser.', error);
      window.print(); // Fallback jika library gagal dimuat
    }
  };

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();
    const newTransaction = {
      id: 'TRX-IN-' + Date.now(), // Memastikan unik setiap milidetik
      deskripsi: transactionForm.deskripsi,
      jumlah: Number(transactionForm.jumlah),
      tipe: 'masuk',
      tanggal: transactionForm.tanggal,
      lampiran: null
    };
    
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', newTransaction.id);
      await setDoc(docRef, newTransaction);
      setIncomeModal(false);
      resetTransactionForm();
      showToast('Pemasukan berhasil dicatat ke Cloud!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menyimpan pemasukan ke database!', 'error');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(transactionForm.jumlah);
    
    // Validasi saldo agar tidak minus setelah pengeluaran
    if (saldo - amount < 0) {
      showToast('Transaksi ditolak: Saldo kas tidak mencukupi untuk pengeluaran ini!', 'error');
      return;
    }

    if (!transactionForm.file) {
      showToast('Anda wajib mengunggah file form persetujuan (PDF) sebagai lampiran arsip!', 'error');
      return;
    }

    const newTransaction = {
      id: 'TRX-OUT-' + Date.now(), // Memastikan unik setiap milidetik
      deskripsi: transactionForm.deskripsi,
      jumlah: amount,
      tipe: 'keluar',
      tanggal: transactionForm.tanggal,
      lampiran: transactionForm.file.name
    };
    
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', newTransaction.id);
      await setDoc(docRef, newTransaction);
      setExpenseModal(false);
      resetTransactionForm();
      showToast('Pengeluaran berhasil dicatat ke Cloud!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal menyimpan pengeluaran ke database!', 'error');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    const amount = Number(editModal.jumlah);
    // Jika ganti ke pengeluaran, pastikan saldo tidak minus
    if (editModal.tipe === 'keluar') {
      const saldoTanpaTxIni = saldo + transactions.find(t => t.id === editModal.id).jumlah;
      if (saldoTanpaTxIni - amount < 0) {
        showToast('Edit ditolak: Saldo kas tidak mencukupi (Minus).', 'error');
        return;
      }
    }

    try {
      const updatedData = {
        deskripsi: editModal.deskripsi,
        jumlah: amount,
        tanggal: editModal.tanggal,
        tipe: editModal.tipe
      };
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editModal.id);
      await setDoc(docRef, updatedData, { merge: true });
      
      setEditModal(null);
      showToast('Perubahan transaksi berhasil disimpan!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal memperbarui data!', 'error');
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo akan disesuaikan secara otomatis.')){
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id);
        await deleteDoc(docRef);
        showToast('Transaksi berhasil dihapus dari sistem!', 'info');
      } catch (error) {
        console.error(error);
        showToast('Gagal menghapus transaksi!', 'error');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setTransactionForm({ ...transactionForm, file: e.target.files[0] });
    }
  };

  const resetTransactionForm = () => {
    setTransactionForm({ 
      deskripsi: '', 
      jumlah: '', 
      file: null, 
      tanggal: new Date().toISOString().split('T')[0] 
    });
  };

  // Filter Data Transaksi
  const filteredTransactions = transactions.filter(tx => {
    const isTipeMatch = filterTipe === 'semua' || tx.tipe === filterTipe;
    let isDateMatch = true;
    if (filterMulai) isDateMatch = isDateMatch && tx.tanggal >= filterMulai;
    if (filterAkhir) isDateMatch = isDateMatch && tx.tanggal <= filterAkhir;
    return isTipeMatch && isDateMatch;
  });


  // --- RENDER VIEWS ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        {/* TOAST NOTIFICATION FOR LOGIN */}
        {toast && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animation-fade-in text-white ${
            toast.type === 'success' ? 'bg-green-600' :
            toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <XCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 animation-fade-in">
          <div className="text-center mb-8">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">PettyCash Pro</h1>
            <p className="text-slate-500 text-sm mt-1">Sistem Manajemen Kas Perusahaan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <div className="relative">
                <UserCircle size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" required 
                  value={authForm.username}
                  onChange={e => setAuthForm({...authForm, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Masukkan username"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="password" required 
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition mt-6">
              Masuk ke Sistem
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="space-y-6 print:hidden animation-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Keuangan</h2>
          <p className="text-slate-500">Ringkasan kas proyek</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIncomeModal(true)}
            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Plus size={18} /> Catat Pemasukan
          </button>
          <button 
            onClick={() => {
              if (saldo <= 0) {
                showToast('Tidak dapat mencatat pengeluaran karena saldo kas Rp 0 atau kurang.', 'error');
              } else {
                setExpenseModal(true);
              }
            }}
            className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Minus size={18} /> Catat Pengeluaran
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 text-white rounded-2xl p-6 shadow-lg md:col-span-3 lg:col-span-1">
          <p className="text-slate-300 mb-1 text-sm font-medium">Saldo Kas Saat Ini</p>
          <h2 className="text-4xl font-bold truncate">{formatRupiah(saldo)}</h2>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl"><TrendingUp size={24} /></div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">Total Pemasukan</p>
            <p className="text-lg font-bold text-slate-800">{formatRupiah(totalPemasukan)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl"><TrendingDown size={24} /></div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">Total Pengeluaran</p>
            <p className="text-lg font-bold text-slate-800">{formatRupiah(totalPengeluaran)}</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions Widget */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-bold text-slate-800">Transaksi Terbaru</h3>
          <button onClick={() => setActiveTab('laporan')} className="text-sm text-blue-600 font-medium hover:underline">Lihat Semua Laporan</button>
        </div>
        
        {transactions.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Wallet size={48} className="mx-auto mb-3 opacity-20" />
            <p>Belum ada data transaksi dicatat.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${tx.tipe === 'masuk' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {tx.tipe === 'masuk' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{tx.deskripsi}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{formatDateLabel(tx.tanggal)}</span>
                      {tx.lampiran && (
                        <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          <Paperclip size={12} /> Tersimpan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`font-bold ${tx.tipe === 'masuk' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.tipe === 'masuk' ? '+' : '-'}{formatRupiah(tx.jumlah)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderFormLayout = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* KOLOM KIRI: INPUT */}
      <div className="lg:col-span-5 space-y-6 print:hidden animation-fade-in">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h2 className="text-lg font-bold text-slate-800">Buat Formulir (Untuk Download)</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pengajuan</label>
              <input type="date" name="tanggal" value={formData.tanggal} onChange={handleFormChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            
            <div className="pt-2 border-t mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Keperluan / Deskripsi Pengajuan *</label>
              <input type="text" name="judulDokumen" value={formData.judulDokumen} onChange={handleFormChange} placeholder="Cth: Beli Perlengkapan ATK" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nominal Pengajuan (Rp) *</label>
              <input type="number" min="0" name="estimasiBiaya" value={formData.estimasiBiaya} onChange={handleFormChange} placeholder="150000" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan Tambahan</label>
              <textarea name="keterangan" value={formData.keterangan} onChange={handleFormChange} rows="3" placeholder="Opsional..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

            <button 
              onClick={handleDownloadPDF}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-md"
            >
              <DownloadCloud size={20} />
              Download Form (PDF)
            </button>
            <p className="text-xs text-center text-slate-500 mt-2">Data ini hanya untuk diexport, tidak memotong saldo kas sebelum Anda mencatatnya di menu Dashboard.</p>
          </div>
        </div>
      </div>

      {/* KOLOM KANAN: PREVIEW DOKUMEN */}
      <div className="lg:col-span-7 print:col-span-12 overflow-auto">
        <div className="flex items-center gap-2 mb-4 text-slate-500 print:hidden">
          <FileText size={20} />
          <span className="font-medium">Pratinjau Kertas A4 (Akan Diexport)</span>
        </div>

        <div id="pdf-content" className="bg-white p-10 md:p-14 shadow-lg print:shadow-none mx-auto print:mx-0 print:p-0" style={{ minHeight: '297mm', width: '210mm', maxWidth: '100%' }}>
          <div className="text-center border-b-2 border-black pb-6 mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">FORM PERMOHONAN BIAYA PETTY CASH</h1>
            <h2 className="text-lg text-gray-700">Project PT. Etika Beverages Indonesia</h2>
          </div>

          <div className="space-y-6 text-gray-800">
            <table className="w-full text-left border-collapse">
              <tbody>
                <tr>
                  <td className="py-2 w-1/4 font-semibold">Tanggal</td>
                  <td className="py-2 w-4">:</td>
                  <td className="py-2">{formatDateLabel(formData.tanggal)}</td>
                </tr>
              </tbody>
            </table>

            <div className="bg-white border-2 border-black p-5 rounded-none mt-4">
              <h3 className="font-bold text-lg mb-4 border-b border-black pb-2 uppercase tracking-wide">Rincian Permohonan</h3>
              <table className="w-full text-left">
                <tbody>
                  <tr>
                    <td className="py-3 w-1/3 font-semibold align-top">Keperluan</td>
                    <td className="py-3 w-4 align-top">:</td>
                    <td className="py-3 font-medium align-top">{formData.judulDokumen || '(Belum diisi)'}</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-semibold align-top">Keterangan</td>
                    <td className="py-3 align-top">:</td>
                    <td className="py-3 text-justify align-top">{formData.keterangan || '-'}</td>
                  </tr>
                </tbody>
              </table>
              
              {/* Simulasi Saldo */}
              <div className="mt-6 pt-4 border-t border-dashed border-gray-400">
                <table className="w-full text-left">
                  <tbody>
                    <tr>
                      <td className="py-1 w-1/3 text-gray-600">Saldo Kas Saat Ini</td>
                      <td className="py-1 w-4">:</td>
                      <td className="py-1">{formatRupiah(saldo)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold">Pengajuan Biaya</td>
                      <td className="py-1 font-semibold">:</td>
                      <td className="py-1 font-bold text-lg">{formatRupiah(formData.estimasiBiaya)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-gray-800">Sisa Saldo Kas</td>
                      <td className="py-2 font-bold text-gray-800">:</td>
                      <td className="py-2 font-bold text-gray-800">
                        <span className={sisaSaldo < 0 ? "text-red-600" : "text-black"}>{formatRupiah(sisaSaldo)}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Area Tanda Tangan */}
            <div className="mt-20">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div className="flex flex-col items-center">
                  <p className="text-sm mb-2">Dibuat Oleh,</p>
                  <div className="h-24 w-full border-b border-black mb-2"></div>
                  <p className="font-bold whitespace-nowrap">( Admin )</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-sm mb-2">Mengetahui,</p>
                  <div className="h-24 w-full border-b border-black mb-2"></div>
                  <p className="font-bold whitespace-nowrap">( OM )</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-sm mb-2">Disetujui Oleh,</p>
                  <div className="h-24 w-full border-b border-black mb-2"></div>
                  <p className="font-bold whitespace-nowrap">( GM )</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLaporan = () => (
    <div className="space-y-6 print:hidden animation-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Laporan Transaksi Kas</h2>
          <p className="text-slate-500">Kelola dan filter data transaksi perusahaan</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Tipe Transaksi</label>
          <select 
            value={filterTipe} 
            onChange={(e) => setFilterTipe(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="semua">Semua Transaksi</option>
            <option value="masuk">Pemasukan (Masuk)</option>
            <option value="keluar">Pengeluaran (Keluar)</option>
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Mulai Tanggal</label>
          <input 
            type="date" 
            value={filterMulai} 
            onChange={(e) => setFilterMulai(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Sampai Tanggal</label>
          <input 
            type="date" 
            value={filterAkhir} 
            onChange={(e) => setFilterAkhir(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>
        <div className="w-full md:w-auto">
          <button 
            onClick={() => { setFilterTipe('semua'); setFilterMulai(''); setFilterAkhir(''); }}
            className="w-full md:w-auto px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            <Filter size={16} /> Reset Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                <th className="py-4 px-6 font-semibold">Tanggal</th>
                <th className="py-4 px-6 font-semibold">Deskripsi Transaksi</th>
                <th className="py-4 px-6 font-semibold">Tipe</th>
                <th className="py-4 px-6 font-semibold text-right">Jumlah (Rp)</th>
                <th className="py-4 px-6 font-semibold">Lampiran Arsip</th>
                {/* Admin Only Aksi Header */}
                {currentUser.role === 'admin' && (
                  <th className="py-4 px-6 font-semibold text-center">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={currentUser.role === 'admin' ? 6 : 5} className="text-center py-12 text-slate-400">
                    <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-20" />
                    Tidak ada data yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition group">
                    <td className="py-4 px-6 text-slate-500 whitespace-nowrap">{formatDateLabel(tx.tanggal)}</td>
                    <td className="py-4 px-6 font-medium text-slate-800">{tx.deskripsi}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tx.tipe === 'masuk' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {tx.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td className={`py-4 px-6 text-right font-bold whitespace-nowrap ${tx.tipe === 'masuk' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.tipe === 'masuk' ? '+' : '-'} {formatRupiah(tx.jumlah)}
                    </td>
                    <td className="py-4 px-6">
                      {tx.lampiran ? (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 w-max text-xs cursor-pointer hover:bg-blue-100 transition">
                          <Paperclip size={14} />
                          <span className="truncate max-w-[150px] block" title={tx.lampiran}>{tx.lampiran}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    
                    {/* Admin Only Aksi Body */}
                    {currentUser.role === 'admin' && (
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditModal(tx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Edit Transaksi"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition" title="Hapus Transaksi"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animation-fade-in text-white ${
          toast.type === 'success' ? 'bg-green-600' :
          toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          {toast.type === 'success' && <CheckCircle size={20} />}
          {toast.type === 'error' && <XCircle size={20} />}
          {toast.type === 'info' && <Info size={20} />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2 text-slate-800">
              <Wallet size={28} className="text-blue-600" />
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight">PettyCash</span>
              </div>
            </div>

            <div className="flex space-x-1 sm:space-x-2 items-center">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('form')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${activeTab === 'form' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <DownloadCloud size={16} className="hidden sm:block"/> Form PDF
              </button>
              <button 
                onClick={() => setActiveTab('laporan')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${activeTab === 'laporan' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <FileSpreadsheet size={16} className="hidden sm:block"/> Laporan
              </button>
              
              {/* User Profile & Logout */}
              <div className="pl-4 ml-2 border-l border-slate-200 flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-slate-800 capitalize">{currentUser.username}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{currentUser.role}</p>
                </div>
                {currentUser.role === 'admin' && (
                  <button 
                    onClick={() => setShowUserModal(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Buat User Baru"
                  >
                    <UserPlus size={18} />
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'form' && renderFormLayout()}
        {activeTab === 'laporan' && renderLaporan()}
      </main>

      {/* MODAL CATAT PEMASUKAN */}
      {incomeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animation-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-green-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Input Pemasukan Kas</h3>
              <button onClick={() => setIncomeModal(false)} className="text-white/70 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleIncomeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal *</label>
                <input 
                  type="date" required 
                  value={transactionForm.tanggal}
                  onChange={(e) => setTransactionForm({...transactionForm, tanggal: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sumber Dana / Deskripsi *</label>
                <input 
                  type="text" required 
                  value={transactionForm.deskripsi}
                  onChange={(e) => setTransactionForm({...transactionForm, deskripsi: e.target.value})}
                  placeholder="Cth: Top Up Kas dari Pusat"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Nominal (Rp) *</label>
                <input 
                  type="number" min="0" required 
                  value={transactionForm.jumlah}
                  onChange={(e) => setTransactionForm({...transactionForm, jumlah: e.target.value})}
                  placeholder="5000000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIncomeModal(false)} className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition">Simpan Kas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CATAT PENGELUARAN */}
      {expenseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animation-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Input Pengeluaran Kas</h3>
              <button onClick={() => setExpenseModal(false)} className="text-white/70 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal *</label>
                <input 
                  type="date" required 
                  value={transactionForm.tanggal}
                  onChange={(e) => setTransactionForm({...transactionForm, tanggal: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keperluan / Deskripsi *</label>
                <input 
                  type="text" required 
                  value={transactionForm.deskripsi}
                  onChange={(e) => setTransactionForm({...transactionForm, deskripsi: e.target.value})}
                  placeholder="Sesuai form yang disetujui"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nominal Aktual Keluar (Rp) *</label>
                <input 
                  type="number" min="0" required 
                  value={transactionForm.jumlah}
                  onChange={(e) => setTransactionForm({...transactionForm, jumlah: e.target.value})}
                  placeholder="150000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" 
                />
              </div>

              {/* Upload Mandatori */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <label className="block text-sm font-bold text-red-800 mb-2">Upload Lampiran (Wajib) *</label>
                <p className="text-xs text-red-600 mb-3">Harap lampirkan PDF Form Permohonan yang sudah ditandatangani manual (ACC).</p>
                <input 
                  type="file" accept=".pdf, image/*" required 
                  onChange={handleFileChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 file:cursor-pointer cursor-pointer border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setExpenseModal(false)} className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition">Potong Kas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT TRANSAKSI (HANYA ADMIN Yg Bisa Buka) */}
      {editModal && currentUser.role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animation-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Edit Transaksi</h3>
              <button onClick={() => setEditModal(null)} className="text-white/70 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Transaksi</label>
                <select 
                  value={editModal.tipe}
                  onChange={(e) => setEditModal({...editModal, tipe: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50" 
                >
                  <option value="masuk">Pemasukan</option>
                  <option value="keluar">Pengeluaran</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal *</label>
                <input 
                  type="date" required 
                  value={editModal.tanggal}
                  onChange={(e) => setEditModal({...editModal, tanggal: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi *</label>
                <input 
                  type="text" required 
                  value={editModal.deskripsi}
                  onChange={(e) => setEditModal({...editModal, deskripsi: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Nominal (Rp) *</label>
                <input 
                  type="number" min="0" required 
                  value={editModal.jumlah}
                  onChange={(e) => setEditModal({...editModal, jumlah: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditModal(null)} className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUAT USER (HANYA ADMIN) */}
      {showUserModal && currentUser.role === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animation-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Buat User Baru</h3>
              <button onClick={() => setShowUserModal(false)} className="text-white/70 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleAdminCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username Baru</label>
                <input 
                  type="text" required 
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="username_staff"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="password" required 
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hak Akses (Role)</label>
                <select 
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" 
                >
                  <option value="staff">Staff (Hanya Input & View)</option>
                  <option value="admin">Admin (Full Akses)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition">Batal</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition">Simpan User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS Overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background-color: white !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
        .animation-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}