/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc,
  Timestamp,
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { 
  signInAnonymously, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  CreditCard, 
  History, 
  Bell, 
  LogOut, 
  Trash2, 
  CheckCircle2, 
  Clock,
  ArrowRight,
  MessageSquare,
  FileText,
  X,
  ChevronRight,
  Calendar,
  Edit2,
  TrendingUp,
  ArrowLeft,
  Download,
  Users2
} from 'lucide-react';
import { format, addMonths, isBefore, addDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import * as XLSX from 'xlsx';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WhatsAppIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// --- Types ---
interface Debtor {
  id: string;
  name: string;
  phone: string;
  totalAmount: number;
  remainingAmount: number;
  createdAt: any;
}

interface Payment {
  id: string;
  debtorId: string;
  debtorName: string;
  amount: number;
  date: any;
  remainingBalance: number;
}

interface Installment {
  id: string;
  debtorId: string;
  amount: number;
  originalAmount: number;
  dueDate: any;
  status: 'pending' | 'paid';
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'debtors' | 'reminders' | 'history'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditDebtorModalOpen, setIsEditDebtorModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [debtorDetailId, setDebtorDetailId] = useState<string | null>(null);

  const [customInstallments, setCustomInstallments] = useState<{amount: number, dueDate: string}[]>([]);
  const [newDebtor, setNewDebtor] = useState({ 
    name: '', 
    phone: '+90', 
    totalAmount: '', 
    installments: '1',
    startDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [editDebtorData, setEditDebtorData] = useState({
    id: '',
    name: '',
    phone: '',
    totalAmount: 0,
    remainingAmount: 0,
    paidAmount: 0
  });
  const [editInstallments, setEditInstallments] = useState<Installment[]>([]);
  const [deletedInstallmentIds, setDeletedInstallmentIds] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsLoggedIn(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qDebtors = query(collection(db, 'debtors'), orderBy('createdAt', 'desc'));
    const unsubDebtors = onSnapshot(qDebtors, (snapshot) => {
      setDebtors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debtor)));
    });

    const qPayments = query(collection(db, 'payments'), orderBy('date', 'desc'));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const qInstallments = query(collection(db, 'installments'), orderBy('dueDate', 'asc'));
    const unsubInstallments = onSnapshot(qInstallments, (snapshot) => {
      setInstallments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Installment)));
    });

    return () => {
      unsubDebtors();
      unsubPayments();
      unsubInstallments();
    };
  }, [user]);

  // --- Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === '1453') {
      try {
        await signInAnonymously(auth);
        setIsLoggedIn(true);
        setLoginError('');
      } catch (err: any) {
        console.error("Login Error:", err);
        if (err.code === 'auth/operation-not-allowed') {
          setLoginError('Hata: Firebase Console üzerinden "Anonymous Auth" özelliğini etkinleştirmeniz gerekmektedir.');
        } else if (err.code === 'auth/admin-restricted-operation') {
          setLoginError('Hata: Firebase projenizde "Anonymous Auth" kısıtlanmış görünüyor. Lütfen Firebase Console -> Authentication -> Sign-in method sekmesinden Anonymous özelliğini aktif ettiğinizden emin olun.');
        } else {
          setLoginError('Firebase bağlantı hatası: ' + (err.message || 'Bilinmeyen hata'));
        }
      }
    } else {
      setLoginError('Hatalı kullanıcı adı veya şifre.');
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setIsLoggedIn(false);
    setLoginForm({ username: '', password: '' });
  };

  const applyPaymentsToInstallments = async (debtorId: string, totalPaidAmount: number, batch: any, currentPaymentAmount: number = 0) => {
    const qInst = query(collection(db, 'installments'), where('debtorId', '==', debtorId), orderBy('dueDate', 'asc'));
    const instSnap = await getDocs(qInst);
    const debtorInsts = instSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Installment));

    let remainingTotalPaid = totalPaidAmount;
    let previousTotalPaid = totalPaidAmount - currentPaymentAmount;
    const distribution: string[] = [];

    for (const inst of debtorInsts) {
      // Fallback for old data: if originalAmount is missing, use current amount
      // If status is paid and amount is 0, we try to find a sibling installment to guess the original amount
      let originalAmt = inst.originalAmount;
      if (originalAmt === undefined || originalAmt === null) {
        if (inst.amount > 0) {
          originalAmt = inst.amount;
        } else {
          // Try to find a sibling with an amount to guess the original amount
          const sibling = debtorInsts.find(i => (i.originalAmount && i.originalAmount > 0) || (i.amount && i.amount > 0));
          originalAmt = sibling ? (sibling.originalAmount || sibling.amount) : 0;
        }
      }
      
      if (originalAmt <= 0) continue;

      // Calculate how much was paid before this payment for this installment
      let paidBefore = Math.max(0, Math.min(originalAmt, previousTotalPaid));
      previousTotalPaid -= paidBefore;

      // Calculate how much is paid after this payment for this installment
      let paidAfter = Math.max(0, Math.min(originalAmt, remainingTotalPaid));
      remainingTotalPaid -= paidAfter;

      // The amount contributed by the current payment to this installment
      let currentContribution = paidAfter - paidBefore;

      if (currentContribution > 0) {
        distribution.push(`📅 *${format(inst.dueDate.toDate(), 'MMMM yyyy', { locale: tr })}:* ${currentContribution.toLocaleString('tr-TR')} TL`);
      }

      if (paidAfter >= originalAmt) {
        batch.update(doc(db, 'installments', inst.id), {
          amount: 0,
          originalAmount: originalAmt,
          status: 'paid'
        });
      } else {
        batch.update(doc(db, 'installments', inst.id), {
          amount: originalAmt - paidAfter,
          originalAmount: originalAmt,
          status: 'pending'
        });
      }
    }
    return distribution;
  };

  const addDebtor = async () => {
    if (!newDebtor.name || !newDebtor.phone || !newDebtor.totalAmount) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    const amount = Number(newDebtor.totalAmount);

    try {
      const debtorRef = await addDoc(collection(db, 'debtors'), {
        name: newDebtor.name,
        phone: newDebtor.phone,
        totalAmount: amount,
        remainingAmount: amount,
        createdAt: Timestamp.now()
      });

      if (customInstallments.length > 0) {
        for (const inst of customInstallments) {
          await addDoc(collection(db, 'installments'), {
            debtorId: debtorRef.id,
            amount: inst.amount,
            originalAmount: inst.amount,
            dueDate: Timestamp.fromDate(new Date(inst.dueDate)),
            status: 'pending'
          });
        }
      }

      setIsAddModalOpen(false);
      setNewDebtor({ 
        name: '', 
        phone: '+90', 
        totalAmount: '', 
        installments: '1',
        startDate: format(new Date(), 'yyyy-MM-dd')
      });
      setCustomInstallments([]);
    } catch (err) {
      console.error(err);
    }
  };

  const updateDebtor = async () => {
    if (!editDebtorData.name || !editDebtorData.phone) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Update debtor
      batch.update(doc(db, 'debtors', editDebtorData.id), {
        name: editDebtorData.name,
        phone: editDebtorData.phone,
        totalAmount: Number(editDebtorData.totalAmount),
        remainingAmount: Number(editDebtorData.remainingAmount)
      });

      // Update debtor name in payments
      const relatedPayments = payments.filter(p => p.debtorId === editDebtorData.id);
      relatedPayments.forEach(p => {
        batch.update(doc(db, 'payments', p.id), {
          debtorName: editDebtorData.name
        });
      });

      // Handle installments
      // 1. Delete removed installments
      deletedInstallmentIds.forEach(id => {
        batch.delete(doc(db, 'installments', id));
      });

      // 2. Update or Create installments
      editInstallments.forEach(inst => {
        const instData = {
          debtorId: editDebtorData.id,
          amount: Number(inst.amount),
          originalAmount: Number(inst.originalAmount),
          dueDate: inst.dueDate instanceof Timestamp 
            ? inst.dueDate 
            : Timestamp.fromDate(new Date(inst.dueDate)),
          status: inst.status
        };

        if (inst.id.startsWith('new-')) {
          // Create new installment
          const newInstRef = doc(collection(db, 'installments'));
          batch.set(newInstRef, instData);
        } else {
          // Update existing installment
          batch.update(doc(db, 'installments', inst.id), instData);
        }
      });

      await batch.commit();
      setIsEditDebtorModalOpen(false);
      setEditDebtorData({ id: '', name: '', phone: '', totalAmount: 0, remainingAmount: 0, paidAmount: 0 });
      setEditInstallments([]);
      setDeletedInstallmentIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkAddText.trim()) return;

    const lines = bulkAddText.split('\n').filter(line => line.trim());
    const batch = writeBatch(db);
    let addedCount = 0;

    for (const line of lines) {
      // Format: Name, Phone, Amount, Installments (optional), Start Date (optional: DD.MM.YYYY)
      // Example: Ahmet Yılmaz, 05321234567, 12000, 12, 15.03.2024
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 3) continue;

      const name = parts[0];
      const phone = parts[1].startsWith('+90') ? parts[1] : `+90${parts[1].replace(/^0/, '')}`;
      const totalAmount = parseFloat(parts[2]);
      const installmentsCount = parseInt(parts[3]) || 1;
      
      let baseDate = new Date();
      if (parts[4]) {
        const dateParts = parts[4].split('.');
        if (dateParts.length === 3) {
          // DD.MM.YYYY
          const d = parseInt(dateParts[0]);
          const m = parseInt(dateParts[1]) - 1;
          const y = parseInt(dateParts[2]);
          const parsedDate = new Date(y, m, d);
          if (!isNaN(parsedDate.getTime())) {
            baseDate = parsedDate;
          }
        } else {
          const dashParts = parts[4].split('-');
          if (dashParts.length === 3) {
            // YYYY-MM-DD
            const parsedDate = new Date(parts[4]);
            if (!isNaN(parsedDate.getTime())) {
              baseDate = parsedDate;
            }
          }
        }
      }

      if (isNaN(totalAmount)) continue;

      const debtorRef = doc(collection(db, 'debtors'));
      batch.set(debtorRef, {
        name,
        phone,
        totalAmount,
        remainingAmount: totalAmount,
        createdAt: Timestamp.now()
      });

      // Create installments
      const amountPerInstallment = Math.floor(totalAmount / installmentsCount);
      for (let i = 0; i < installmentsCount; i++) {
        const instRef = doc(collection(db, 'installments'));
        batch.set(instRef, {
          debtorId: debtorRef.id,
          amount: i === installmentsCount - 1 
            ? totalAmount - (amountPerInstallment * (installmentsCount - 1))
            : amountPerInstallment,
          originalAmount: i === installmentsCount - 1 
            ? totalAmount - (amountPerInstallment * (installmentsCount - 1))
            : amountPerInstallment,
          dueDate: Timestamp.fromDate(addMonths(baseDate, i)),
          status: 'pending'
        });
      }
      addedCount++;
    }

    if (addedCount > 0) {
      await batch.commit();
      alert(`${addedCount} kişi başarıyla eklendi.`);
      setBulkAddText('');
      setIsBulkAddModalOpen(false);
    } else {
      alert('Geçerli veri bulunamadı. Lütfen formatı kontrol edin: İsim, Telefon, Miktar, Taksit(opsiyonel), Vade Başlangıcı(opsiyonel)');
    }
  };

  const handleExportPayments = () => {
    const data = payments.map(p => ({
      'Kişi Adı': p.debtorName,
      'Miktar (TL)': p.amount,
      'Tarih': format(p.date.toDate(), 'dd.MM.yyyy HH:mm', { locale: tr }),
      'Kalan Bakiye (TL)': p.remainingBalance
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ödemeler');
    XLSX.writeFile(wb, `Arifler_Odeme_Gecmisi_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  const updatePayment = async () => {
    if (!selectedPayment || !paymentAmount) return;

    const newAmount = Number(paymentAmount);
    const diff = newAmount - selectedPayment.amount;

    try {
      const debtor = debtors.find(d => d.id === selectedPayment.debtorId);
      if (!debtor) return;

      const batch = writeBatch(db);
      
      batch.update(doc(db, 'payments', selectedPayment.id), {
        amount: newAmount,
        remainingBalance: selectedPayment.remainingBalance - diff
      });

      const newRemaining = debtor.remainingAmount - diff;
      batch.update(doc(db, 'debtors', debtor.id), {
        remainingAmount: newRemaining
      });

      // Re-apply all payments to installments
      await applyPaymentsToInstallments(debtor.id, debtor.totalAmount - newRemaining, batch);

      await batch.commit();

      setIsEditPaymentModalOpen(false);
      setSelectedPayment(null);
      setPaymentAmount('');
    } catch (err) {
      console.error(err);
    }
  };

  const deletePayment = (payment: Payment) => {
    setConfirmModal({
      isOpen: true,
      title: 'Ödemeyi Sil',
      message: 'Bu ödeme kaydını silmek istediğinize emin misiniz? Bakiye geri yüklenecektir.',
      onConfirm: async () => {
        try {
          const debtor = debtors.find(d => d.id === payment.debtorId);
          if (debtor) {
            const batch = writeBatch(db);
            const newRemaining = debtor.remainingAmount + payment.amount;
            
            batch.update(doc(db, 'debtors', debtor.id), {
              remainingAmount: newRemaining
            });
            
            batch.delete(doc(db, 'payments', payment.id));
            
            // Re-apply all payments to installments
            await applyPaymentsToInstallments(debtor.id, debtor.totalAmount - newRemaining, batch);
            
            await batch.commit();
          } else {
            await deleteDoc(doc(db, 'payments', payment.id));
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const recordPayment = async (sendWhatsApp: boolean = false) => {
    if (!selectedDebtor || !paymentAmount) return;
    const amount = Number(paymentAmount);
    const date = Timestamp.now();
    const newRemaining = selectedDebtor.remainingAmount - amount;

    try {
      const batch = writeBatch(db);
      
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        debtorId: selectedDebtor.id,
        debtorName: selectedDebtor.name,
        amount,
        date,
        remainingBalance: newRemaining
      });

      const debtorRef = doc(db, 'debtors', selectedDebtor.id);
      batch.update(debtorRef, {
        remainingAmount: newRemaining
      });

      // Apply payment to installments (FIFO)
      const distribution = await applyPaymentsToInstallments(selectedDebtor.id, selectedDebtor.totalAmount - newRemaining, batch, amount);

      await batch.commit();

      if (sendWhatsApp) {
        // WhatsApp Message
        const message = `🧾 *ÖDEME DEKONTU - Aidat Takip Sistemi*\n\n` +
          `👤 *Sayın:* ${selectedDebtor.name}\n` +
          `💰 *Ödenen Miktar:* ${amount.toLocaleString('tr-TR')} TL\n` +
          `📅 *Tarih:* ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}\n` +
          `📉 *Kalan Bakiye:* ${newRemaining.toLocaleString('tr-TR')} TL\n\n` +
          `📋 *Ödeme Detayları (Düşülen Vadeler):*\n` +
          (distribution.length > 0 ? distribution.join('\n') : 'Genel borçtan düşüldü.') + `\n\n` +
          `✨ Ödemeniz için teşekkür ederiz.`;
        
        const whatsappUrl = `https://wa.me/${selectedDebtor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      setIsPaymentModalOpen(false);
      setSelectedDebtor(null);
      setPaymentAmount('');
    } catch (err) {
      console.error(err);
    }
  };

  const sendReminder = (debtor: Debtor) => {
    // Calculate due amount (overdue or due today)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const debtorInstallments = installments
      .filter(inst => inst.debtorId === debtor.id)
      .sort((a, b) => a.dueDate.toDate().getTime() - b.dueDate.toDate().getTime());

    const dueAmount = debtorInstallments
      .filter(inst => inst.status === 'pending' && isBefore(inst.dueDate.toDate(), today))
      .reduce((sum, inst) => sum + inst.amount, 0);

    const installmentList = debtorInstallments.map((inst) => {
      const dateStr = format(inst.dueDate.toDate(), 'MMMM yyyy', { locale: tr });
      const statusIcon = inst.status === 'paid' ? '✅' : '⏳';
      const amountStr = inst.status === 'paid' ? 'Ödendi' : `${inst.amount.toLocaleString('tr-TR')} TL`;
      return `${statusIcon} *${dateStr}:* ${amountStr}`;
    }).join('\n');

    const message = `🔔 *Hatırlatma-Aidat Takip Sistemi*\n\n` +
      `Muhterem Efendim *${debtor.name}*,\n\n` +
      `Sistemimizde kayıtlı olan ödeme detaylarınız:\n\n` +
      `💵 *Vadesi Gelen Borç:* ${dueAmount.toLocaleString('tr-TR')} TL\n` +
      `📊 *Toplam Kalan Bakiye:* ${debtor.remainingAmount.toLocaleString('tr-TR')} TL\n\n` +
      `📋 *Tüm Taksit Planınız:*\n` +
      installmentList + `\n\n` +
      `✨ Ödemeleriniz için şimdiden teşekkür eder, hayırlı günler dileriz.`;
    
    const whatsappUrl = `https://wa.me/${debtor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const deleteDebtor = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Kişiyi Sil',
      message: 'Bu kişiyi ve tüm kayıtlarını silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          
          // Delete debtor
          batch.delete(doc(db, 'debtors', id));
          
          // Delete related installments
          const relatedInstallments = installments.filter(i => i.debtorId === id);
          relatedInstallments.forEach(inst => {
            batch.delete(doc(db, 'installments', inst.id));
          });
          
          // Delete related payments
          const relatedPayments = payments.filter(p => p.debtorId === id);
          relatedPayments.forEach(pay => {
            batch.delete(doc(db, 'payments', pay.id));
          });

          await batch.commit();
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // --- Filtered Data ---
  const filteredDebtors = useMemo(() => {
    return debtors.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [debtors, searchTerm]);

  const stats = useMemo(() => {
    const total = debtors.reduce((acc, d) => acc + d.remainingAmount, 0);
    const count = debtors.length;
    const recentPayments = payments.slice(0, 5);

    // Monthly data for chart
    const monthlyData: { [key: string]: number } = {};
    installments.forEach(inst => {
      if (inst.status === 'pending') {
        const month = format(inst.dueDate.toDate(), 'MMM yyyy', { locale: tr });
        monthlyData[month] = (monthlyData[month] || 0) + inst.amount;
      }
    });

    const chartData = Object.keys(monthlyData).map(month => ({
      name: month,
      amount: monthlyData[month]
    })).sort((a, b) => {
      const dateA = new Date(a.name);
      const dateB = new Date(b.name);
      return dateA.getTime() - dateB.getTime();
    });

    return { total, count, recentPayments, chartData };
  }, [debtors, payments, installments]);

  const upcomingInstallments = useMemo(() => {
    const oneMonthFromNow = addMonths(new Date(), 1);
    return installments.filter(i => 
      i.status === 'pending' && 
      isBefore(i.dueDate.toDate(), oneMonthFromNow)
    );
  }, [installments]);

  // --- Render ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-stone-200"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
              <Users className="text-white w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Arifler Veli Takip</h1>
            <p className="text-stone-500 mt-2">Yönetici Girişi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Kullanıcı Adı</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="admin"
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Şifre</label>
              <input 
                type="password" 
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="••••"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
            >
              Giriş Yap <ArrowRight size={18} />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      {/* Header */}
      <header className="bg-white border-bottom border-stone-200 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Users className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Arifler Veli Takip</h1>
              <p className="text-xs text-stone-500">Hoşgeldiniz, Admin</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-stone-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Search & Add */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Kişi ara..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsBulkAddModalOpen(true)}
                className="bg-stone-800 text-white px-6 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-stone-100 hover:bg-stone-900 transition-all"
              >
                <Users2 size={20} /> Toplu Ekle
              </button>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
              >
                <Plus size={20} /> Yeni Kişi Ekle
              </button>
            </div>
          </div>

        {/* Tabs Content */}
        {debtorDetailId ? (
          <div className="space-y-6">
            <button 
              onClick={() => setDebtorDetailId(null)}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors font-semibold"
            >
              <ArrowLeft size={20} /> Geri Dön
            </button>
            
            {(() => {
              const debtor = debtors.find(d => d.id === debtorDetailId);
              if (!debtor) return <p>Kişi bulunamadı.</p>;
              const debtorPayments = payments.filter(p => p.debtorId === debtor.id);
              const debtorInstallments = installments.filter(i => i.debtorId === debtor.id);
              
              return (
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div>
                        <h2 className="text-3xl font-bold text-stone-800">{debtor.name}</h2>
                        <p className="text-stone-500 flex items-center gap-2 mt-2">
                          <Phone size={18} /> {debtor.phone}
                        </p>
                        <p className="text-xs text-stone-400 mt-1">Kayıt Tarihi: {format(debtor.createdAt.toDate(), 'dd MMMM yyyy', { locale: tr })}</p>
                      </div>
                      <div className="bg-stone-50 p-6 rounded-2xl min-w-[240px]">
                        <p className="text-xs text-stone-500 uppercase font-bold tracking-widest mb-2">Güncel Bakiye</p>
                        <p className="text-4xl font-black text-emerald-600">{debtor.remainingAmount.toLocaleString('tr-TR')} TL</p>
                        <div className="mt-4 pt-4 border-t border-stone-200 flex justify-between text-sm">
                          <span className="text-stone-500">Toplam Borç:</span>
                          <span className="font-bold text-stone-700">{debtor.totalAmount.toLocaleString('tr-TR')} TL</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                      <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                        <History className="text-emerald-600" size={20} /> Ödeme Geçmişi
                      </h3>
                      <div className="space-y-4">
                        {debtorPayments.length > 0 ? debtorPayments.map(p => (
                          <div key={p.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                            <div>
                              <p className="font-bold text-stone-800">{p.amount.toLocaleString('tr-TR')} TL</p>
                              <p className="text-xs text-stone-500">{format(p.date.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setIsEditPaymentModalOpen(true);
                                }}
                                className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => deletePayment(p)}
                                className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        )) : (
                          <p className="text-stone-400 text-center py-8 italic">Henüz ödeme yapılmamış.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                      <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                        <Calendar className="text-amber-500" size={20} /> Taksit Planı
                      </h3>
                      <div className="space-y-4">
                        {debtorInstallments.map((inst, idx) => (
                          <div key={inst.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                            <div>
                              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Taksit {idx + 1}</p>
                              <p className="font-bold text-stone-800">{inst.amount.toLocaleString('tr-TR')} TL</p>
                              <p className="text-xs text-stone-500">{format(inst.dueDate.toDate(), 'dd MMMM yyyy', { locale: tr })}</p>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                              inst.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {inst.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-100"
              >
                <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider">Toplam Alacak</p>
                <h2 className="text-4xl font-bold mt-1">{stats.total.toLocaleString('tr-TR')} TL</h2>
                <div className="mt-4 flex items-center gap-2 text-emerald-100 text-sm">
                  <Users size={16} /> {stats.count} Kayıtlı Kişi
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-stone-800 flex items-center gap-2">
                    <History className="text-emerald-600" size={18} /> Son Ödemeler
                  </h3>
                  <button onClick={() => setActiveTab('history')} className="text-xs text-emerald-600 font-semibold">Tümünü Gör</button>
                </div>
                <div className="space-y-3">
                  {stats.recentPayments.length > 0 ? stats.recentPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm border-b border-stone-50 pb-2">
                      <div>
                        <p className="font-semibold text-stone-800">{p.debtorName}</p>
                        <p className="text-xs text-stone-500">{format(p.date.toDate(), 'dd MMM yyyy', { locale: tr })}</p>
                      </div>
                      <span className="text-emerald-600 font-bold">+{p.amount.toLocaleString('tr-TR')} TL</span>
                    </div>
                  )) : (
                    <p className="text-stone-400 text-center py-4 text-sm italic">Henüz ödeme kaydı yok.</p>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Monthly Chart */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-orange-600" size={18} /> Aylık Beklenen Tahsilat
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#888', fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#aaa' }}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#fff7ed' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [`${value.toLocaleString('tr-TR')} TL`, 'Beklenen']}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={40}>
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ea580c' : '#f97316'} />
                      ))}
                      <LabelList 
                        dataKey="amount" 
                        position="top" 
                        formatter={(value: number) => value > 0 ? `${(value / 1000).toFixed(1)}k` : ''}
                        style={{ fontSize: 11, fontWeight: 700, fill: '#ea580c' }}
                        offset={10}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Upcoming Installments */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                <Clock className="text-amber-500" size={18} /> Yaklaşan Taksitler (1 Ay İçinde)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingInstallments.length > 0 ? upcomingInstallments.slice(0, 6).map(inst => {
                  const debtor = debtors.find(d => d.id === inst.debtorId);
                  return (
                    <div key={inst.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-stone-800">{debtor?.name || 'Bilinmeyen'}</p>
                        <p className="text-xs text-stone-500">{format(inst.dueDate.toDate(), 'dd MMMM yyyy', { locale: tr })}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-stone-700 font-semibold">{inst.amount.toLocaleString('tr-TR')} TL</span>
                        <button 
                          onClick={() => {
                            setSelectedDebtor(debtor || null);
                            setIsPaymentModalOpen(true);
                          }}
                          className="text-xs bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all font-medium"
                        >
                          Öde
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-stone-400 text-center py-4 text-sm italic col-span-full">Yakın zamanda beklenen taksit yok.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'debtors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDebtors.map(debtor => (
              <motion.div 
                layout
                key={debtor.id}
                className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-stone-800">{debtor.name}</h3>
                    <p className="text-sm text-stone-500 flex items-center gap-1">
                      <Phone size={14} /> {debtor.phone}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        const paid = debtor.totalAmount - debtor.remainingAmount;
                        setEditDebtorData({
                          id: debtor.id,
                          name: debtor.name,
                          phone: debtor.phone,
                          totalAmount: debtor.totalAmount,
                          remainingAmount: debtor.remainingAmount,
                          paidAmount: paid
                        });
                        const debtorInsts = installments.filter(i => i.debtorId === debtor.id);
                        setEditInstallments(debtorInsts.map(i => ({
                          ...i,
                          dueDate: i.dueDate instanceof Timestamp 
                            ? format(i.dueDate.toDate(), 'yyyy-MM-dd') 
                            : i.dueDate
                        })));
                        setDeletedInstallmentIds([]);
                        setIsEditDebtorModalOpen(true);
                      }}
                      className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      title="Kişiyi Düzenle"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => deleteDebtor(debtor.id)}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Kişiyi Sil"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="bg-stone-50 p-4 rounded-2xl mb-4">
                  <div className="flex justify-between text-xs text-stone-500 uppercase font-bold tracking-wider mb-1">
                    <span>Kalan Borç</span>
                    <span>Toplam</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-black text-emerald-600">{debtor.remainingAmount.toLocaleString('tr-TR')} TL</span>
                    <span className="text-sm text-stone-400 font-medium">{debtor.totalAmount.toLocaleString('tr-TR')} TL</span>
                  </div>
                  <div className="w-full bg-stone-200 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-1000" 
                      style={{ width: `${Math.max(0, 100 - (debtor.remainingAmount / debtor.totalAmount * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setDebtorDetailId(debtor.id)}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-800 transition-all"
                  >
                    <Users size={16} /> Detaylar
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedDebtor(debtor);
                      setIsPaymentModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all"
                  >
                    <CreditCard size={16} /> Ödeme Al
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 flex items-center gap-2">
                <Bell className="text-amber-500" size={20} /> Borç Hatırlatma Modülü
              </h3>
              <p className="text-sm text-stone-500 mt-1">Bakiyesi olan kişilere nazik bir hatırlatma mesajı gönderin.</p>
            </div>
            <div className="divide-y divide-stone-50">
              {debtors.filter(d => d.remainingAmount > 0).map(debtor => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);

                const debtorInsts = installments
                  .filter(i => i.debtorId === debtor.id)
                  .sort((a, b) => a.dueDate.toDate().getTime() - b.dueDate.toDate().getTime());

                const dueAmount = debtorInsts
                  .filter(i => i.status === 'pending' && isBefore(i.dueDate.toDate(), today))
                  .reduce((sum, i) => sum + i.amount, 0);

                return (
                  <div key={debtor.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-stone-50 transition-colors gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 font-bold shrink-0">
                        {debtor.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-lg text-stone-800">{debtor.name}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <p className="text-sm text-stone-500">
                            <span className="font-semibold text-amber-600">Vadesi Gelen:</span> {dueAmount.toLocaleString('tr-TR')} TL
                          </p>
                          <p className="text-sm text-stone-400 hidden sm:block">•</p>
                          <p className="text-sm text-stone-500">
                            <span className="font-semibold text-stone-600">Toplam Kalan:</span> {debtor.remainingAmount.toLocaleString('tr-TR')} TL
                          </p>
                        </div>
                        
                        {/* Installment Summary in UI */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {debtorInsts.map((inst, idx) => (
                            <div 
                              key={inst.id} 
                              className={cn(
                                "text-[10px] px-2 py-1 rounded-md font-bold border",
                                inst.status === 'paid' 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                  : isBefore(inst.dueDate.toDate(), today)
                                    ? "bg-red-50 text-red-700 border-red-100"
                                    : "bg-stone-50 text-stone-600 border-stone-200"
                              )}
                            >
                              {format(inst.dueDate.toDate(), 'MMM yy', { locale: tr })}: {inst.status === 'paid' ? '✓' : `${inst.amount} TL`}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => sendReminder(debtor)}
                      className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all shrink-0"
                    >
                      <WhatsAppIcon size={18} /> Hatırlatma Gönder
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-bold text-stone-800 flex items-center gap-2">
                <History className="text-emerald-600" size={20} /> Ödeme Geçmişi
              </h3>
              <button 
                onClick={handleExportPayments}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all"
              >
                <Download size={18} /> Excel İndir
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Kişi</th>
                    <th className="px-6 py-4">Miktar</th>
                    <th className="px-6 py-4">Tarih</th>
                    <th className="px-6 py-4">Kalan</th>
                    <th className="px-6 py-4">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-stone-800">{p.debtorName}</td>
                      <td className="px-6 py-4 text-emerald-600 font-bold">+{p.amount.toLocaleString('tr-TR')} TL</td>
                      <td className="px-6 py-4 text-stone-500 text-sm">{format(p.date.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}</td>
                      <td className="px-6 py-4 text-stone-600 font-medium">{p.remainingBalance.toLocaleString('tr-TR')} TL</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              setSelectedPayment(p);
                              setIsEditPaymentModalOpen(true);
                            }}
                            className="text-stone-400 hover:text-emerald-600"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => deletePayment(p)}
                            className="text-stone-400 hover:text-red-500"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              const message = `🧾 *ÖDEME DEKONTU - Aidat Takip Sistemi*\n\n` +
                                `👤 *Sayın:* ${p.debtorName}\n` +
                                `💰 *Ödenen Miktar:* ${p.amount.toLocaleString('tr-TR')} TL\n` +
                                `📅 *Tarih:* ${format(p.date.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}\n` +
                                `📉 *Kalan Bakiye:* ${p.remainingBalance.toLocaleString('tr-TR')} TL\n\n` +
                                `✨ Ödemeniz için teşekkür ederiz.`;
                              const debtor = debtors.find(d => d.id === p.debtorId);
                              if (debtor) {
                                const whatsappUrl = `https://wa.me/${debtor.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                                window.open(whatsappUrl, '_blank');
                              }
                            }}
                            className="text-emerald-600 hover:text-emerald-700"
                            title="WhatsApp'tan Gönder"
                          >
                            <WhatsAppIcon size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 z-40 flex justify-around items-center">
        <button 
          onClick={() => {
            setActiveTab('dashboard');
            setDebtorDetailId(null);
          }}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'dashboard' ? "text-emerald-600" : "text-stone-400")}
        >
          <CreditCard size={22} />
          <span className="text-[10px] font-bold uppercase">Panel</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('debtors');
            setDebtorDetailId(null);
          }}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'debtors' ? "text-emerald-600" : "text-stone-400")}
        >
          <Users size={22} />
          <span className="text-[10px] font-bold uppercase">Kişiler</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('reminders');
            setDebtorDetailId(null);
          }}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'reminders' ? "text-emerald-600" : "text-stone-400")}
        >
          <Bell size={22} />
          <span className="text-[10px] font-bold uppercase">Mesajlar</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('history');
            setDebtorDetailId(null);
          }}
          className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'history' ? "text-emerald-600" : "text-stone-400")}
        >
          <History size={22} />
          <span className="text-[10px] font-bold uppercase">Geçmiş</span>
        </button>
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <h3 className="text-xl font-bold text-stone-800">Yeni Kişi Ekle</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-2"><X size={24} /></button>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ad Soyad</label>
                    <input 
                      type="text" 
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newDebtor.name}
                      onChange={(e) => setNewDebtor({...newDebtor, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Telefon</label>
                    <input 
                      type="tel" 
                      placeholder="+90 5xx xxx xxxx"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newDebtor.phone}
                      onChange={(e) => setNewDebtor({...newDebtor, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Toplam Borç (TL)</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-emerald-700"
                      value={newDebtor.totalAmount}
                      onChange={(e) => {
                        const amount = e.target.value;
                        setNewDebtor({...newDebtor, totalAmount: amount});
                        // Recalculate installments if count exists
                        const count = parseInt(newDebtor.installments) || 0;
                        if (count > 0 && amount) {
                          const amountPerInstallment = Math.floor(parseFloat(amount) / count);
                          const baseDate = new Date(newDebtor.startDate);
                          const newInsts = Array.from({ length: count }, (_, i) => ({
                            amount: i === count - 1 
                              ? parseFloat(amount) - (amountPerInstallment * (count - 1))
                              : amountPerInstallment,
                            dueDate: format(addMonths(baseDate, i), 'yyyy-MM-dd')
                          }));
                          setCustomInstallments(newInsts);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Taksit Sayısı</label>
                    <input 
                      type="number" 
                      placeholder="Örn: 12"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newDebtor.installments}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 0;
                        setNewDebtor({...newDebtor, installments: e.target.value});
                        if (count > 0 && newDebtor.totalAmount) {
                          const amountPerInstallment = Math.floor(parseFloat(newDebtor.totalAmount) / count);
                          const baseDate = new Date(newDebtor.startDate);
                          const newInsts = Array.from({ length: count }, (_, i) => ({
                            amount: i === count - 1 
                              ? parseFloat(newDebtor.totalAmount) - (amountPerInstallment * (count - 1))
                              : amountPerInstallment,
                            dueDate: format(addMonths(baseDate, i), 'yyyy-MM-dd')
                          }));
                          setCustomInstallments(newInsts);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">İlk Taksit Tarihi (Vade Başlangıcı)</label>
                    <input 
                      type="date" 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newDebtor.startDate}
                      onChange={(e) => {
                        const date = e.target.value;
                        setNewDebtor({...newDebtor, startDate: date});
                        const count = parseInt(newDebtor.installments) || 0;
                        if (count > 0 && newDebtor.totalAmount) {
                          const amountPerInstallment = Math.floor(parseFloat(newDebtor.totalAmount) / count);
                          const baseDate = new Date(date);
                          const newInsts = Array.from({ length: count }, (_, i) => ({
                            amount: i === count - 1 
                              ? parseFloat(newDebtor.totalAmount) - (amountPerInstallment * (count - 1))
                              : amountPerInstallment,
                            dueDate: format(addMonths(baseDate, i), 'yyyy-MM-dd')
                          }));
                          setCustomInstallments(newInsts);
                        }
                      }}
                    />
                  </div>
                </div>

                {customInstallments.length > 0 && (
                  <div className="space-y-4 border-t border-stone-100 pt-6">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-stone-800 flex items-center gap-2">
                        <Calendar size={18} className="text-emerald-600" /> Taksit Detayları
                      </h4>
                      <div className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold",
                        customInstallments.reduce((sum, inst) => sum + inst.amount, 0) === parseFloat(newDebtor.totalAmount)
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-red-50 text-red-700 border border-red-100"
                      )}>
                        Toplam: {customInstallments.reduce((sum, inst) => sum + inst.amount, 0).toLocaleString('tr-TR')} / {parseFloat(newDebtor.totalAmount || '0').toLocaleString('tr-TR')} TL
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {customInstallments.map((inst, idx) => (
                        <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-stone-400 uppercase">Taksit {idx + 1}</span>
                          </div>
                          <div className="space-y-2">
                            <input 
                              type="number"
                              className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm font-bold"
                              value={inst.amount}
                              onChange={(e) => {
                                const newInsts = [...customInstallments];
                                newInsts[idx].amount = parseFloat(e.target.value) || 0;
                                setCustomInstallments(newInsts);
                              }}
                            />
                            <input 
                              type="date"
                              className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs"
                              value={inst.dueDate}
                              onChange={(e) => {
                                const newInsts = [...customInstallments];
                                newInsts[idx].dueDate = e.target.value;
                                setCustomInstallments(newInsts);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-stone-50 flex gap-3">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-4 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-100 transition-all"
                >
                  İptal
                </button>
                <button 
                  onClick={addDebtor}
                  disabled={
                    !newDebtor.name || 
                    !newDebtor.phone || 
                    !newDebtor.totalAmount || 
                    customInstallments.reduce((sum, inst) => sum + inst.amount, 0) !== parseFloat(newDebtor.totalAmount)
                  }
                  className={cn(
                    "flex-2 py-4 rounded-2xl font-bold transition-all shadow-lg",
                    (!newDebtor.name || !newDebtor.phone || !newDebtor.totalAmount || customInstallments.reduce((sum, inst) => sum + inst.amount, 0) !== parseFloat(newDebtor.totalAmount))
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                      : "bg-stone-900 text-white hover:bg-stone-800"
                  )}
                >
                  Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isEditDebtorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditDebtorModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-900 text-white shrink-0">
                <h3 className="text-xl font-bold">Kişi ve Borç Düzenle</h3>
                <button onClick={() => setIsEditDebtorModalOpen(false)} className="text-white/80 hover:text-white p-2"><X size={24} /></button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ad Soyad</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={editDebtorData.name}
                      onChange={(e) => setEditDebtorData({...editDebtorData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Telefon</label>
                    <input 
                      type="tel" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={editDebtorData.phone}
                      onChange={(e) => setEditDebtorData({...editDebtorData, phone: e.target.value})}
                    />
                  </div>
                </div>

                {/* Debt Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-emerald-50 rounded-2xl">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Toplam Borç (₺)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={editDebtorData.totalAmount}
                      onChange={(e) => {
                        const newTotal = Number(e.target.value);
                        setEditDebtorData({
                          ...editDebtorData, 
                          totalAmount: newTotal,
                          remainingAmount: Math.max(0, newTotal - editDebtorData.paidAmount)
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Kalan Borç (₺)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-stone-100 border border-emerald-100 rounded-xl focus:ring-0 outline-none cursor-not-allowed opacity-70"
                      value={editDebtorData.remainingAmount}
                      readOnly
                    />
                    {editDebtorData.paidAmount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-bold">
                        (Ödenen: {editDebtorData.paidAmount.toLocaleString('tr-TR')} TL düşüldü)
                      </p>
                    )}
                  </div>
                </div>

                {/* Installments */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-stone-700 uppercase tracking-widest">Taksitler</h4>
                    <button 
                      onClick={() => {
                        const nextDate = editInstallments.length > 0 
                          ? format(addMonths(new Date(editInstallments[editInstallments.length - 1].dueDate), 1), 'yyyy-MM-dd')
                          : format(new Date(), 'yyyy-MM-dd');
                        
                        setEditInstallments([...editInstallments, {
                          id: `new-${Date.now()}`,
                          debtorId: editDebtorData.id,
                          amount: 0,
                          originalAmount: 0,
                          dueDate: nextDate,
                          status: 'pending'
                        }]);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <Plus size={14} /> Taksit Ekle
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editInstallments.map((inst, idx) => (
                      <div key={inst.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <div className="w-8 h-8 flex items-center justify-center bg-stone-200 rounded-full text-xs font-bold text-stone-600">
                          {idx + 1}
                        </div>
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <input 
                            type="number"
                            placeholder="Miktar"
                            className="p-2 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={inst.amount}
                            onChange={(e) => {
                              const newInsts = [...editInstallments];
                              newInsts[idx].amount = Number(e.target.value);
                              newInsts[idx].originalAmount = Number(e.target.value);
                              setEditInstallments(newInsts);
                            }}
                          />
                          <input 
                            type="date"
                            className="p-2 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const newInsts = [...editInstallments];
                              newInsts[idx].dueDate = e.target.value;
                              setEditInstallments(newInsts);
                            }}
                          />
                          <select 
                            className="p-2 bg-stone-100 border border-stone-200 rounded-lg text-sm outline-none cursor-not-allowed opacity-70"
                            value={inst.status}
                            disabled
                          >
                            <option value="pending">Bekliyor</option>
                            <option value="paid">Ödendi</option>
                          </select>
                        </div>
                        <button 
                          onClick={() => {
                            if (!inst.id.startsWith('new-')) {
                              setDeletedInstallmentIds([...deletedInstallmentIds, inst.id]);
                            }
                            setEditInstallments(editInstallments.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {editInstallments.length === 0 && (
                      <div className="text-center py-8 text-stone-400 text-sm italic">
                        Taksit bulunamadı.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-stone-50 flex flex-col gap-3 shrink-0">
                {editInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0) !== Number(editDebtorData.totalAmount) && (
                  <p className="text-xs text-red-500 font-bold text-center mb-1">
                    Taksitlerin toplamı ({editInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0)} ₺) toplam borçla ({editDebtorData.totalAmount} ₺) eşit olmalıdır.
                  </p>
                )}
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsEditDebtorModalOpen(false)}
                    className="flex-1 py-3 border border-stone-200 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-all"
                  >
                    İptal
                  </button>
                  <button 
                    onClick={updateDebtor}
                    disabled={
                      !editDebtorData.name || 
                      !editDebtorData.phone || 
                      editInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0) !== Number(editDebtorData.totalAmount)
                    }
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold transition-all shadow-lg",
                      (!editDebtorData.name || !editDebtorData.phone || editInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0) !== Number(editDebtorData.totalAmount))
                        ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                        : "bg-stone-900 text-white hover:bg-stone-800"
                    )}
                  >
                    Güncelle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isBulkAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkAddModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-800 text-white">
                <h3 className="text-xl font-bold">Toplu Kişi Ekle</h3>
                <button onClick={() => setIsBulkAddModalOpen(false)} className="text-white/80 hover:text-white p-2"><X size={24} /></button>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-sm text-amber-800">
                  <p className="font-bold mb-1">Nasıl Kullanılır?</p>
                  <p>Her satıra bir kişi gelecek şekilde şu formatta yazın:</p>
                  <code className="block bg-white/50 p-2 rounded mt-2 font-mono">
                    İsim Soyisim, Telefon, Toplam Borç, Taksit Sayısı, Vade Başlangıcı
                  </code>
                  <p className="mt-2 text-xs italic">Örn: Ahmet Yılmaz, 05321234567, 12000, 12, 15.03.2024</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Kişi Listesi</label>
                  <textarea 
                    rows={10}
                    placeholder="Ahmet Yılmaz, 05321234567, 12000, 12, 15.03.2024&#10;Mehmet Demir, 05449876543, 8500, 10, 01.04.2024"
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                    value={bulkAddText}
                    onChange={(e) => setBulkAddText(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-8 bg-stone-50 flex gap-3">
                <button 
                  onClick={() => setIsBulkAddModalOpen(false)}
                  className="flex-1 py-4 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-100 transition-all"
                >
                  İptal
                </button>
                <button 
                  onClick={handleBulkAdd}
                  disabled={!bulkAddText.trim()}
                  className={cn(
                    "flex-2 py-4 rounded-2xl font-bold transition-all shadow-lg",
                    !bulkAddText.trim()
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                      : "bg-stone-900 text-white hover:bg-stone-800"
                  )}
                >
                  Toplu Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isPaymentModalOpen && selectedDebtor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-emerald-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Ödeme Al</h3>
                  <p className="text-emerald-100 text-sm">{selectedDebtor.name}</p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-white/80 hover:text-white"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-xs text-stone-500 uppercase font-bold tracking-widest">Mevcut Bakiye</p>
                  <p className="text-3xl font-black text-stone-800">{selectedDebtor.remainingAmount.toLocaleString('tr-TR')} TL</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Ödeme Miktarı (TL)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-4 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 text-2xl font-bold text-center" 
                    placeholder="0" 
                    autoFocus 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => recordPayment(false)}
                    className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} /> Ödemeyi Onayla
                  </button>
                  <button 
                    onClick={() => recordPayment(true)}
                    className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    <WhatsAppIcon size={20} /> Ödemeyi Onayla ve WhatsApp'tan Gönder
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isEditPaymentModalOpen && selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditPaymentModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-900 text-white">
                <div>
                  <h3 className="text-xl font-bold">Ödemeyi Düzenle</h3>
                  <p className="text-stone-300 text-sm">{selectedPayment.debtorName}</p>
                </div>
                <button onClick={() => setIsEditPaymentModalOpen(false)} className="text-white/80 hover:text-white"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-stone-50 p-4 rounded-2xl text-center">
                  <p className="text-xs text-stone-500 uppercase font-bold tracking-widest">Eski Miktar</p>
                  <p className="text-2xl font-black text-stone-800">{selectedPayment.amount.toLocaleString('tr-TR')} TL</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Yeni Miktar (TL)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-4 rounded-2xl border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 text-2xl font-bold text-center" 
                    placeholder="0" 
                    autoFocus 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => updatePayment()}
                  className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-stone-800 transition-all"
                >
                  Güncelle
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({...confirmModal, isOpen: false})}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-stone-800">{confirmModal.title}</h3>
                <p className="text-stone-500 text-sm">{confirmModal.message}</p>
              </div>
              <div className="p-6 bg-stone-50 flex gap-3">
                <button 
                  onClick={() => setConfirmModal({...confirmModal, isOpen: false})}
                  className="flex-1 py-3 border border-stone-200 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-all"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({...confirmModal, isOpen: false});
                  }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Evet, Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
