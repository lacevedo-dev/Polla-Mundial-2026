import React from 'react';
import { Card, Button, Badge, Input, Checkbox } from '../components/UI';
import { AppView } from '../types';
import { 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  Clock, 
  Wallet, 
  MoreVertical, 
  Download,
  AlertCircle,
  MessageCircle,
  Banknote,
  PieChart,
  ChevronDown,
  Filter,
  Check,
  Send,
  FileText,
  X,
  Smartphone,
  Hash,
  Landmark,
  History,
  Trash2,
  User,
  Mail,
  MessageSquare,
  Share2,
  Eye,
  Users,
  Phone,
  ExternalLink
} from 'lucide-react';

interface ManagePaymentsProps {
  onViewChange: (view: AppView) => void;
}

type PaymentStatus = 'paid' | 'pending' | 'review';

interface PaymentConcept {
  id: string;
  label: string;
  type: 'general' | 'phase' | 'round' | 'match';
  amount: number;
  date: string;
}

interface UserPaymentData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  paymentStatus: Record<string, PaymentStatus>;
  lastUpdate: string;
}

interface Transaction {
  id: string;
  userId: string;
  conceptIds: string[];
  amount: number;
  date: string;
  method: string;
  reference?: string;
  note?: string;
}

const PAYMENT_CONCEPTS: PaymentConcept[] = [
  { id: 'general', label: 'Cuota General', type: 'general', amount: 50000, date: 'Inicio' },
  { id: 'phase-1', label: 'Fase de Grupos', type: 'phase', amount: 20000, date: '10 Jun' },
  { id: 'match-col-bra', label: 'Partido: COL vs BRA', type: 'match', amount: 5000, date: 'Hoy' },
  { id: 'round-16', label: 'Octavos de Final', type: 'round', amount: 10000, date: '25 Jun' },
];

const PAYMENT_METHODS = [
  { id: 'Efectivo', label: 'Efectivo', icon: Banknote, color: 'text-lime-600' },
  { id: 'Nequi', label: 'Nequi', icon: Smartphone, color: 'text-purple-600' },
  { id: 'Daviplata', label: 'Daviplata', icon: Smartphone, color: 'text-rose-600' },
  { id: 'Bancolombia', label: 'Bancolombia', icon: Landmark, color: 'text-slate-900' },
];

const MOCK_USERS_DATA: UserPaymentData[] = [
  { 
    id: '1', name: 'Luis Morales', email: 'luis.m@gmail.com', phone: '3001234567', avatar: 'https://picsum.photos/seed/luis/40/40', lastUpdate: 'Hoy',
    paymentStatus: { 'general': 'paid', 'phase-1': 'paid', 'match-col-bra': 'paid', 'round-16': 'paid' } 
  },
  { 
    id: '2', name: 'Leo Castiblanco', email: 'leo.c@hotmail.com', phone: '3109876543', avatar: 'https://picsum.photos/seed/leo/40/40', lastUpdate: 'Ayer',
    paymentStatus: { 'general': 'paid', 'phase-1': 'review', 'match-col-bra': 'pending', 'round-16': 'pending' } 
  },
  { 
    id: '3', name: 'Nubia Sarmiento', email: 'nubia.s@outlook.com', phone: '3205551234', avatar: 'https://picsum.photos/seed/nubia/40/40', lastUpdate: 'Hace 2h',
    paymentStatus: { 'general': 'pending', 'phase-1': 'pending', 'match-col-bra': 'pending', 'round-16': 'pending' } 
  },
  { 
    id: '4', name: 'Carlos Ruiz', email: 'carlos.r@gmail.com', phone: '3001112233', avatar: 'https://picsum.photos/seed/carlos/40/40', lastUpdate: 'Hoy',
    paymentStatus: { 'general': 'paid', 'phase-1': 'paid', 'match-col-bra': 'pending', 'round-16': 'pending' } 
  },
  { 
    id: '5', name: 'Andres Cepeda', email: 'andres.c@music.com', phone: '3159998877', avatar: 'https://picsum.photos/seed/andres/40/40', lastUpdate: '-',
    paymentStatus: { 'general': 'paid', 'phase-1': 'pending', 'match-col-bra': 'pending', 'round-16': 'pending' } 
  },
  { 
    id: '6', name: 'Maria Fernanda', email: 'mafe@gmail.com', phone: '3104445566', avatar: 'https://picsum.photos/seed/mafe/40/40', lastUpdate: 'Hoy',
    paymentStatus: { 'general': 'review', 'phase-1': 'pending', 'match-col-bra': 'pending', 'round-16': 'pending' } 
  },
];

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: 't1', userId: '1', conceptIds: ['general', 'phase-1', 'match-col-bra', 'round-16'], amount: 85000, date: '2026-06-01', method: 'Nequi', reference: 'M12345' },
    { id: 't2', userId: '2', conceptIds: ['general'], amount: 50000, date: '2026-06-02', method: 'Efectivo', note: 'Pago en oficina' },
    { id: 't3', userId: '4', conceptIds: ['general', 'phase-1'], amount: 70000, date: '2026-06-03', method: 'Bancolombia' },
];

const LEAGUE_INFO = {
    name: 'LOS CRACKS DEL BARRIO',
    plan: 'GOLD',
    role: 'ADMIN'
};

const ManagePayments: React.FC<ManagePaymentsProps> = ({ onViewChange }) => {
  const [selectedConceptIds, setSelectedConceptIds] = React.useState<string[]>(PAYMENT_CONCEPTS.map(c => c.id));
  const [isConceptMenuOpen, setIsConceptMenuOpen] = React.useState(false);
  const [users, setUsers] = React.useState<UserPaymentData[]>(MOCK_USERS_DATA);
  const [transactions, setTransactions] = React.useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [filter, setFilter] = React.useState<'all' | 'debtors' | 'solvents' | 'review'>('all');
  const [search, setSearch] = React.useState('');
  
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

  const [paymentModal, setPaymentModal] = React.useState<{isOpen: boolean, userId: string | null}>({ isOpen: false, userId: null });
  const [historyModal, setHistoryModal] = React.useState<{isOpen: boolean, userId: string | null}>({ isOpen: false, userId: null });
  const [quickPayModal, setQuickPayModal] = React.useState<{isOpen: boolean, userId: string | null, amount: number}>({ isOpen: false, userId: null, amount: 0 });
  const [bulkPayModal, setBulkPayModal] = React.useState<{isOpen: boolean, totalAmount: number, userCount: number}>({ isOpen: false, totalAmount: 0, userCount: 0 });
  const [reminderModal, setReminderModal] = React.useState<{isOpen: boolean, channel: 'whatsapp' | 'email' | 'sms' | 'all'}>({ isOpen: false, channel: 'whatsapp' });

  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(null);

  const [paymentForm, setPaymentForm] = React.useState({
    selectedConcepts: [] as string[],
    amount: 0,
    method: 'Efectivo',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const selectorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsConceptMenuOpen(false);
      }
      const target = event.target as HTMLElement;
      if (!target.closest('.action-menu-trigger')) {
         setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleConcept = (id: string) => {
    setSelectedConceptIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const calculateFinancials = () => {
    let totalExpected = 0;
    let totalCollected = 0;
    const activeConcepts = PAYMENT_CONCEPTS.filter(c => selectedConceptIds.includes(c.id));
    activeConcepts.forEach(concept => {
       const conceptTotal = concept.amount * users.length;
       totalExpected += conceptTotal;
       users.forEach(user => {
          if (user.paymentStatus[concept.id] === 'paid') totalCollected += concept.amount;
       });
    });
    return { totalExpected, totalCollected, progress: totalExpected === 0 ? 0 : Math.round((totalCollected / totalExpected) * 100) };
  };

  const getUserAggregates = (user: UserPaymentData) => {
    let totalToPay = 0;
    let totalPaid = 0;
    let pendingAmount = 0;
    let hasReview = false;

    selectedConceptIds.forEach(id => {
       const concept = PAYMENT_CONCEPTS.find(c => c.id === id);
       if (concept) {
          totalToPay += concept.amount;
          if (user.paymentStatus[id] === 'paid') totalPaid += concept.amount;
          else pendingAmount += concept.amount;
          if (user.paymentStatus[id] === 'review') hasReview = true;
       }
    });

    const isFullyPaid = totalPaid === totalToPay && totalToPay > 0;
    const isPartial = totalPaid > 0 && totalPaid < totalToPay;
    
    return { totalToPay, totalPaid, pendingAmount, hasReview, isFullyPaid, isPartial, percentage: totalToPay === 0 ? 0 : (totalPaid/totalToPay)*100 };
  };

  const { totalExpected, totalCollected, progress } = calculateFinancials();

  const filteredUsers = users.filter(user => {
    const { isFullyPaid, hasReview } = getUserAggregates(user);
    const matchesFilter = filter === 'all' ? true : 
                          filter === 'solvents' ? isFullyPaid : 
                          filter === 'review' ? hasReview :
                          !isFullyPaid;
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Nequi': return <Smartphone size={14} className="text-purple-600" />;
      case 'Daviplata': return <Smartphone size={14} className="text-rose-600" />;
      case 'Bancolombia': return <Landmark size={14} className="text-slate-900" />;
      case 'Efectivo': return <Banknote size={14} className="text-lime-600" />;
      default: return <Wallet size={14} className="text-slate-400" />;
    }
  };

  const toggleUserSelection = (userId: string) => {
      setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const toggleAllUsers = () => {
      if (selectedUserIds.length === filteredUsers.length) {
          setSelectedUserIds([]);
      } else {
          setSelectedUserIds(filteredUsers.map(u => u.id));
      }
  };

  const handleSendReminder = () => {
      alert(`Enviando recordatorio a ${selectedUserIds.length} usuarios.`);
      setReminderModal({ ...reminderModal, isOpen: false });
      setSelectedUserIds([]);
  };

  const handleIndividualReminder = (user: UserPaymentData) => {
      const { pendingAmount } = getUserAggregates(user);
      const message = `Hola ${user.name}, te recordamos un saldo pendiente de $${pendingAmount.toLocaleString()} en ${LEAGUE_INFO.name}.`;
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      setOpenActionMenuId(null);
  };

  const renderStatusBadge = (isFullyPaid: boolean, hasReview: boolean, percentage: number) => {
      if (hasReview) return <Badge color="bg-amber-100 text-amber-700 border border-amber-200">REVISIÓN</Badge>;
      if (isFullyPaid) return <Badge color="bg-lime-100 text-lime-700 border border-lime-200">AL DÍA</Badge>;
      return <Badge color="bg-slate-100 text-slate-600 border border-slate-200">{percentage > 0 ? 'PARCIAL' : 'PENDIENTE'}</Badge>;
  };

  const openPaymentModal = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const pendingConcepts = selectedConceptIds.filter(id => user.paymentStatus[id] !== 'paid');
    const initialAmount = pendingConcepts.reduce((sum, id) => sum + (PAYMENT_CONCEPTS.find(pc => pc.id === id)?.amount || 0), 0);

    setPaymentForm({
        selectedConcepts: pendingConcepts,
        amount: initialAmount,
        method: 'Efectivo',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
    });
    setPaymentModal({ isOpen: true, userId });
  };

  const handleModalConceptToggle = (conceptId: string) => {
      setPaymentForm(prev => {
          const newSelection = prev.selectedConcepts.includes(conceptId) 
             ? prev.selectedConcepts.filter(id => id !== conceptId)
             : [...prev.selectedConcepts, conceptId];
          const newAmount = newSelection.reduce((sum, id) => sum + (PAYMENT_CONCEPTS.find(pc => pc.id === id)?.amount || 0), 0);
          return { ...prev, selectedConcepts: newSelection, amount: newAmount };
      });
  };

  const submitPayment = (e: React.FormEvent) => {
      e.preventDefault();
      if (!paymentModal.userId) return;
      setUsers(prev => prev.map(u => {
          if (u.id !== paymentModal.userId) return u;
          const newStatus = { ...u.paymentStatus };
          paymentForm.selectedConcepts.forEach(id => newStatus[id] = 'paid');
          return { ...u, paymentStatus: newStatus };
      }));
      setTransactions(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          userId: paymentModal.userId!,
          conceptIds: paymentForm.selectedConcepts,
          amount: paymentForm.amount,
          date: paymentForm.date,
          method: paymentForm.method,
          reference: paymentForm.reference,
          note: paymentForm.note
      }, ...prev]);
      setPaymentModal({ isOpen: false, userId: null });
  };

  const initQuickPay = (userId: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      const { pendingAmount } = getUserAggregates(user);
      if (pendingAmount <= 0) return;
      setQuickPayModal({ isOpen: true, userId, amount: pendingAmount });
  };

  const confirmQuickPay = () => {
      const { userId, amount } = quickPayModal;
      if (!userId) return;
      const user = users.find(u => u.id === userId);
      if (!user) return;
      const pendingConceptIds = selectedConceptIds.filter(id => user.paymentStatus[id] !== 'paid');
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        const newStatus = { ...u.paymentStatus };
        pendingConceptIds.forEach(id => newStatus[id] = 'paid');
        return { ...u, paymentStatus: newStatus };
      }));
      setTransactions(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          userId,
          conceptIds: pendingConceptIds,
          amount: amount,
          date: new Date().toISOString().split('T')[0],
          method: 'Efectivo',
          note: 'Pago Rápido'
      }, ...prev]);
      setQuickPayModal({ isOpen: false, userId: null, amount: 0 });
  };

  const initBulkPay = () => {
      let totalAmount = 0;
      let userCount = 0;
      users.filter(u => selectedUserIds.includes(u.id)).forEach(u => {
          const { pendingAmount } = getUserAggregates(u);
          if (pendingAmount > 0) {
              totalAmount += pendingAmount;
              userCount++;
          }
      });
      if (totalAmount === 0) return alert('Sin deuda en selección.');
      setBulkPayModal({ isOpen: true, totalAmount, userCount });
  };

  const confirmBulkPay = () => {
      const newTransactions: Transaction[] = [];
      const updatedUsers = users.map(u => {
          if (!selectedUserIds.includes(u.id)) return u;
          const { pendingAmount } = getUserAggregates(u);
          if (pendingAmount <= 0) return u;
          const pendingConceptIds = selectedConceptIds.filter(id => u.paymentStatus[id] !== 'paid');
          const newStatus = { ...u.paymentStatus };
          pendingConceptIds.forEach(id => newStatus[id] = 'paid');
          newTransactions.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: u.id,
              conceptIds: pendingConceptIds,
              amount: pendingAmount,
              date: new Date().toISOString().split('T')[0],
              method: 'Efectivo',
              note: 'Pago Masivo'
          });
          return { ...u, paymentStatus: newStatus };
      });
      setUsers(updatedUsers);
      setTransactions(prev => [...newTransactions, ...prev]);
      setBulkPayModal({ isOpen: false, totalAmount: 0, userCount: 0 });
      setSelectedUserIds([]); 
  };

  const handleResetUserPayments = (userId: string) => {
      if(!window.confirm("¿Seguro que deseas anular todos los pagos?")) return;
      setUsers(prev => prev.map(u => {
          if (u.id !== userId) return u;
          const newStatus = { ...u.paymentStatus };
          selectedConceptIds.forEach(id => newStatus[id] = 'pending');
          return { ...u, paymentStatus: newStatus };
      }));
      setOpenActionMenuId(null);
  };

  const handleExportCSV = () => {
    const headers = ['Nombre', 'Email', 'Deuda', 'Estado'];
    const rows = filteredUsers.map(u => {
       const { pendingAmount, isFullyPaid } = getUserAggregates(u);
       return [u.name, u.email, pendingAmount, isFullyPaid ? 'Al día' : 'Pendiente'].join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "reporte_pagos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>

      {/* HEADER & FINANCIAL SUMMARY */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" className="rounded-xl w-10 h-10 p-0 border-slate-200" onClick={() => onViewChange('dashboard')}><ArrowLeft size={20} /></Button>
            <div>
              <div className="flex items-center gap-2">
                 <h1 className="text-2xl font-black font-brand uppercase tracking-tighter text-slate-900">{LEAGUE_INFO.name}</h1>
                 <Badge color="bg-amber-100 text-amber-700 border border-amber-200">{LEAGUE_INFO.plan}</Badge>
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestión de Pagos • {selectedConceptIds.length} Conceptos Activos</div>
            </div>
          </div>
          <div className="relative z-30" ref={selectorRef}>
             <button onClick={() => setIsConceptMenuOpen(!isConceptMenuOpen)} className="w-full md:w-auto bg-white border border-slate-200 shadow-sm rounded-2xl p-2.5 px-4 flex items-center justify-between gap-4 hover:border-lime-400 transition-all group">
                <div className="flex items-center gap-3"><div className="bg-lime-100 text-lime-700 w-8 h-8 rounded-lg flex items-center justify-center"><Filter size={16} /></div><div className="text-left"><p className="text-[9px] font-black uppercase text-slate-400">Conceptos</p><p className="text-xs font-black text-slate-900">{selectedConceptIds.length} Seleccionados</p></div></div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform ${isConceptMenuOpen ? 'rotate-180' : ''}`} />
             </button>
             {isConceptMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-full md:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 p-2">
                   {PAYMENT_CONCEPTS.map(concept => (
                       <button key={concept.id} onClick={() => toggleConcept(concept.id)} className={`w-full text-left p-2 rounded-xl flex items-center gap-3 transition-colors ${selectedConceptIds.includes(concept.id) ? 'bg-lime-50' : 'hover:bg-slate-50'}`}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedConceptIds.includes(concept.id) ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300 bg-white'}`}>{selectedConceptIds.includes(concept.id) && <Check size={12} strokeWidth={4} />}</div>
                          <div className="flex-1"><p className="text-xs font-bold uppercase">{concept.label}</p><span className="text-[10px] font-black text-slate-900">${concept.amount.toLocaleString()}</span></div>
                       </button>
                   ))}
                </div>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl col-span-1 md:col-span-2">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6 h-full">
                 <div className="space-y-2"><Badge color="bg-lime-400 text-black">RECAUDO GLOBAL</Badge><h2 className="text-5xl font-black font-brand tracking-tighter">${totalCollected.toLocaleString()}</h2><div className="flex items-center gap-2"><div className="h-1.5 w-32 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-lime-400 transition-all duration-1000" style={{width: `${progress}%`}}></div></div><p className="text-sm font-bold text-slate-400">de ${totalExpected.toLocaleString()}</p></div></div>
                 <div className="text-right"><p className="text-5xl font-black font-brand text-lime-400">{progress}%</p></div>
              </div>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl"></div>
           </div>
           <Card className="p-6 flex flex-col justify-center space-y-4 border-slate-200">
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><PieChart size={16} className="text-slate-400" /><span className="text-[10px] font-black uppercase text-slate-400">Estado Usuarios</span></div><button onClick={handleExportCSV} className="text-[9px] font-bold text-lime-600 flex items-center gap-1"><Download size={10} /> CSV</button></div>
              <div className="space-y-3">
                 <div className="flex justify-between items-center p-3 bg-lime-50 rounded-xl border border-lime-100"><span className="text-xs font-bold text-lime-800">Al Día</span><span className="text-lg font-black text-lime-700">{users.filter(u => getUserAggregates(u).isFullyPaid).length}</span></div>
                 <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100"><span className="text-xs font-bold text-rose-800">Deudores</span><span className="text-lg font-black text-rose-700">{users.filter(u => !getUserAggregates(u).isFullyPaid).length}</span></div>
              </div>
           </Card>
        </div>

        {/* TOOLBAR RESPONSIVE */}
        <div className="space-y-4 pt-4">
           {/* Top Row: Tabs & Search */}
           <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
               <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-full md:w-auto overflow-x-auto custom-scrollbar shrink-0">
                  {[ { id: 'all', label: 'Todos' }, { id: 'debtors', label: 'Deudores' }, { id: 'review', label: 'Revisión' }, { id: 'solvents', label: 'Al día' } ].map(tab => (
                     <button key={tab.id} onClick={() => setFilter(tab.id as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{tab.label}</button>
                  ))}
               </div>
               <div className="w-full md:w-64">
                  <Input placeholder="Buscar..." leftIcon={<Search size={16} />} className="text-xs font-bold h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
               </div>
           </div>

           {/* Action Buttons Row - Contextual */}
           {selectedUserIds.length > 0 && (
               <div className="flex gap-2 w-full animate-in slide-in-from-top-2 duration-200">
                  <Button variant="secondary" className="flex-1 md:flex-none text-xs font-bold uppercase shadow-lg shadow-lime-400/20" onClick={initBulkPay}>
                      <Banknote size={16} className="mr-2" />
                      Pago Masivo ({selectedUserIds.length})
                  </Button>
                  <Button 
                      variant="secondary" 
                      className="flex-1 md:flex-none text-xs font-bold uppercase bg-indigo-100 text-indigo-700 hover:bg-indigo-200" 
                      onClick={() => setReminderModal({ ...reminderModal, isOpen: true })}
                  >
                      <Send size={16} className="mr-2" />
                      Recordar ({selectedUserIds.length})
                  </Button>
               </div>
           )}
        </div>

        {/* MOBILE LIST VIEW (Cards) */}
        <div className="md:hidden space-y-3">
             {filteredUsers.length > 0 ? filteredUsers.map(user => {
                  const { pendingAmount, percentage, isFullyPaid, hasReview } = getUserAggregates(user);
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                      <div key={user.id} className={`bg-white p-4 rounded-2xl border transition-all ${isSelected ? 'border-lime-500 shadow-md ring-1 ring-lime-500' : 'border-slate-200 shadow-sm'}`}>
                          <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                  <Checkbox id={`mobile-check-${user.id}`} label="" checked={isSelected} onChange={() => toggleUserSelection(user.id)} />
                                  <img src={user.avatar} className="w-10 h-10 rounded-xl" alt={user.name} />
                                  <div>
                                      <p className="text-sm font-black text-slate-900">{user.name}</p>
                                      <p className="text-xs text-slate-500 truncate max-w-[120px]">{user.email}</p>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                  {renderStatusBadge(isFullyPaid, hasReview, percentage)}
                                  {pendingAmount > 0 && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg">-${pendingAmount.toLocaleString()}</span>}
                              </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="space-y-1 mb-4">
                              <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                  <span>Progreso Pago</span>
                                  <span>{Math.round(percentage)}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{width: `${percentage}%`}}></div>
                              </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                              {!isFullyPaid && (
                                  <Button size="sm" className="flex-1 h-9 text-[10px] font-black uppercase" onClick={() => openPaymentModal(user.id)}>Cobrar</Button>
                              )}
                              <button onClick={() => initQuickPay(user.id)} className="w-9 h-9 bg-lime-50 rounded-xl flex items-center justify-center text-lime-600 border border-lime-100 hover:bg-lime-100 transition-colors">
                                  <CheckCircle2 size={16} />
                              </button>
                              <button onClick={() => setHistoryModal({isOpen: true, userId: user.id})} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 transition-colors">
                                  <History size={16} />
                              </button>
                              <div className="relative">
                                  <button onClick={() => setOpenActionMenuId(openActionMenuId === user.id ? null : user.id)} className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${openActionMenuId === user.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                      <MoreVertical size={16} />
                                  </button>
                                  {openActionMenuId === user.id && (
                                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                          <button onClick={() => handleIndividualReminder(user)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Send size={14} /> Recordatorio</button>
                                          <button onClick={() => setHistoryModal({isOpen: true, userId: user.id})} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><History size={14} /> Historial</button>
                                          <div className="h-px bg-slate-100"></div>
                                          <button onClick={() => handleResetUserPayments(user.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Anular Pagos</button>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  );
             }) : (
                <div className="text-center py-8 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
                    <p className="text-xs font-bold uppercase">No se encontraron resultados.</p>
                </div>
             )}
        </div>

        {/* DESKTOP LIST VIEW (Table) */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
           <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                 <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                       <th className="p-6 w-16 text-center"><Checkbox id="select-all" label="" checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0} onChange={toggleAllUsers} /></th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400">Participante</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 text-center">Estado</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 text-center">Deuda</th>
                       <th className="p-6 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => {
                          const { pendingAmount, percentage, isFullyPaid, hasReview } = getUserAggregates(user);
                          const isSelected = selectedUserIds.includes(user.id);
                          return (
                             <tr key={user.id} className={`group hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-lime-50/30' : ''}`}>
                                <td className="p-6 text-center"><Checkbox id={`check-${user.id}`} label="" checked={isSelected} onChange={() => toggleUserSelection(user.id)} /></td>
                                <td className="p-6">
                                   <div className="flex items-center gap-4">
                                      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-xl shadow-sm" />
                                      <div><p className="text-sm font-black text-slate-900">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p></div>
                                   </div>
                                </td>
                                <td className="p-6 align-middle text-center">
                                   <div className="w-full max-w-[150px] mx-auto space-y-1">
                                      <div className="flex justify-center">{renderStatusBadge(isFullyPaid, hasReview, percentage)}</div>
                                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${isFullyPaid ? 'bg-lime-500' : 'bg-amber-400'}`} style={{width: `${percentage}%`}}></div></div>
                                   </div>
                                </td>
                                <td className="p-6 align-middle text-center">{pendingAmount > 0 ? <span className="font-mono font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">-${pendingAmount.toLocaleString()}</span> : <span className="text-slate-300">-</span>}</td>
                                <td className="p-6 text-right">
                                   <div className="flex items-center justify-end gap-2 relative action-menu-trigger">
                                      <Button onClick={() => setHistoryModal({isOpen: true, userId: user.id})} className="h-9 px-4 text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-500" variant="outline">Historial</Button>
                                      {!isFullyPaid && (
                                          <>
                                              <Button onClick={() => openPaymentModal(user.id)} className="h-9 px-4 text-[10px] font-black uppercase bg-slate-900 text-white" variant="primary">Cobrar</Button>
                                              <button onClick={() => initQuickPay(user.id)} className="w-9 h-9 rounded-xl bg-lime-50 text-lime-600 flex items-center justify-center hover:bg-lime-400 hover:text-black transition-all"><CheckCircle2 size={18} /></button>
                                          </>
                                      )}
                                      <div className="relative">
                                          <button onClick={() => setOpenActionMenuId(openActionMenuId === user.id ? null : user.id)} className={`w-9 h-9 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center ${openActionMenuId === user.id ? 'bg-slate-100 text-slate-900' : 'bg-white'}`}><MoreVertical size={18} /></button>
                                          {openActionMenuId === user.id && (
                                              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left">
                                                  <button onClick={() => handleIndividualReminder(user)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Send size={14} /> Recordatorio</button>
                                                  <div className="h-px bg-slate-100"></div>
                                                  <button onClick={() => handleResetUserPayments(user.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Anular Pagos</button>
                                              </div>
                                          )}
                                      </div>
                                   </div>
                                </td>
                             </tr>
                          );
                       }) : <tr><td colSpan={5} className="p-12 text-center text-slate-400">No se encontraron participantes</td></tr>}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* MODALS */}
      {paymentModal.isOpen && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[90vh] flex flex-col p-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-lime-400 rounded-xl flex items-center justify-center text-black"><Wallet size={20} /></div><h3 className="text-lg font-black font-brand uppercase">Registrar Pago</h3></div>
                    <button onClick={() => setPaymentModal({ isOpen: false, userId: null })} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <form onSubmit={submitPayment} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <div className="space-y-2">
                       {selectedConceptIds.map(id => {
                           const concept = PAYMENT_CONCEPTS.find(c => c.id === id);
                           const isPaid = users.find(u => u.id === paymentModal.userId)?.paymentStatus[id] === 'paid';
                           if (!concept) return null;
                           return (
                               <div key={id} onClick={() => !isPaid && handleModalConceptToggle(id)} className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${isPaid ? 'bg-slate-50 opacity-60 pointer-events-none' : paymentForm.selectedConcepts.includes(id) ? 'bg-lime-50 border-lime-400' : 'bg-white border-slate-200'}`}>
                                   <div className="flex items-center gap-3"><div className={`w-5 h-5 rounded border flex items-center justify-center ${paymentForm.selectedConcepts.includes(id) ? 'bg-lime-500 border-lime-500 text-white' : 'border-slate-300'}`}>{paymentForm.selectedConcepts.includes(id) && <Check size={12} strokeWidth={4} />}</div><span className="text-xs font-bold">{concept.label}</span></div>
                                   <span className="text-xs font-black">${concept.amount.toLocaleString()}</span>
                               </div>
                           );
                       })}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-xs font-black uppercase">Total</span><span className="text-2xl font-black font-brand text-slate-900">${paymentForm.amount.toLocaleString()}</span></div>
                        
                        <div className="grid grid-cols-2 gap-2">
                             {PAYMENT_METHODS.map(method => (
                                 <button 
                                    key={method.id}
                                    type="button" 
                                    onClick={() => setPaymentForm({...paymentForm, method: method.id})}
                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${paymentForm.method === method.id ? 'bg-white border-lime-500 shadow-sm ring-1 ring-lime-500' : 'bg-slate-100 border-transparent text-slate-400 hover:bg-slate-200'}`}
                                 >
                                    <method.icon size={16} className={method.color} />
                                    <span className={`text-[10px] font-black uppercase ${paymentForm.method === method.id ? 'text-slate-900' : 'text-slate-500'}`}>{method.label}</span>
                                 </button>
                             ))}
                        </div>

                        <Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="h-9 text-xs" />
                        <Input placeholder="Referencia" value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} className="h-9 text-xs" leftIcon={<Hash size={12}/>} />
                    </div>
                </form>
                <div className="p-4 border-t border-slate-100 bg-white"><Button onClick={submitPayment} className="w-full h-12 rounded-xl font-black uppercase text-xs" variant="secondary" disabled={paymentForm.amount === 0}>Confirmar Pago</Button></div>
            </Card>
         </div>
      )}

      {historyModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <Card className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border-0 overflow-hidden max-h-[85vh] flex flex-col p-0">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3"><History size={20} /><h3 className="text-lg font-black uppercase">Historial</h3></div>
                      <button onClick={() => setHistoryModal({ isOpen: false, userId: null })} className="text-slate-400 hover:text-white"><X size={24} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                      {transactions.filter(t => t.userId === historyModal.userId).length > 0 ? (
                          transactions.filter(t => t.userId === historyModal.userId).map(tx => (
                              <div key={tx.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-2"><div className="flex justify-between items-start"><Badge color="bg-white border border-slate-200 text-slate-500">{tx.date}</Badge><span className="text-lg font-black text-lime-600">+${tx.amount.toLocaleString()}</span></div><div className="flex flex-wrap gap-1">{tx.conceptIds.map(cid => <span key={cid} className="text-[8px] font-black uppercase bg-slate-200 px-1.5 py-0.5 rounded">{PAYMENT_CONCEPTS.find(pc => pc.id === cid)?.label}</span>)}</div><div className="flex items-center gap-2 pt-1 border-t border-slate-200/50 mt-1">{getMethodIcon(tx.method)}<span className="text-[10px] font-bold text-slate-500 uppercase">{tx.method}</span></div></div>
                          ))
                      ) : <div className="text-center py-10 text-slate-400">Sin movimientos.</div>}
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-white shrink-0 text-center"><Button variant="ghost" size="sm" className="text-[10px] font-black uppercase" onClick={() => setHistoryModal({isOpen:false, userId:null})}>Cerrar</Button></div>
              </Card>
          </div>
      )}

      {quickPayModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <Card className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 space-y-4 text-center">
                 <div className="w-14 h-14 bg-lime-100 rounded-full flex items-center justify-center text-lime-600 mx-auto"><Banknote size={28} /></div>
                 <h3 className="text-xl font-black font-brand uppercase">Confirmar Pago?</h3>
                 <div className="bg-slate-900 p-4 rounded-2xl text-white font-black font-brand text-2xl">${quickPayModal.amount.toLocaleString()}</div>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button variant="outline" className="rounded-xl font-black text-xs uppercase" onClick={() => setQuickPayModal({isOpen: false, userId: null, amount: 0})}>Cancelar</Button>
                    <Button variant="secondary" className="rounded-xl font-black text-xs uppercase" onClick={confirmQuickPay}>Confirmar</Button>
                 </div>
             </Card>
          </div>
      )}

      {bulkPayModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <Card className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 space-y-4 text-center">
                 <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mx-auto"><Users size={28} /></div>
                 <h3 className="text-xl font-black font-brand uppercase">Pago Masivo</h3>
                 <p className="text-xs text-slate-500 font-medium">{bulkPayModal.userCount} usuarios seleccionados</p>
                 <div className="bg-slate-900 p-4 rounded-2xl text-white font-black font-brand text-2xl">${bulkPayModal.totalAmount.toLocaleString()}</div>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button variant="outline" className="rounded-xl font-black text-xs uppercase" onClick={() => setBulkPayModal({isOpen: false, totalAmount: 0, userCount: 0})}>Cancelar</Button>
                    <Button variant="secondary" className="rounded-xl font-black text-xs uppercase" onClick={confirmBulkPay}>Confirmar</Button>
                 </div>
             </Card>
          </div>
      )}

      {reminderModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <Card className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 space-y-5">
                 <div className="flex items-center gap-3"><Send size={24} className="text-indigo-600" /><h3 className="text-lg font-black font-brand uppercase">Enviar Recordatorio</h3></div>
                 <p className="text-xs text-slate-500">Destinatarios: <strong>{selectedUserIds.length} Usuarios</strong></p>
                 <div className="grid grid-cols-2 gap-3">
                    {['whatsapp', 'email', 'sms', 'all'].map(ch => (
                        <button key={ch} onClick={() => setReminderModal({...reminderModal, channel: ch as any})} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${reminderModal.channel === ch ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                           <span className="text-[10px] font-black uppercase">{ch}</span>
                        </button>
                    ))}
                 </div>
                 <Button className="w-full h-12 rounded-xl font-black text-xs uppercase" onClick={handleSendReminder} variant="primary">Enviar Mensajes</Button>
             </Card>
          </div>
      )}
    </div>
  );
};

export default ManagePayments;