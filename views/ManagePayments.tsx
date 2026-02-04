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
  ExternalLink,
  Calendar,
  Bell,
  Edit3,
  Copy,
  Sparkles,
  Bot
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

// Advanced Reminder Types
type ReminderChannel = 'whatsapp' | 'email' | 'sms' | 'push';
type TemplateType = 'friendly' | 'formal' | 'urgent' | 'ai' | 'custom';

const CHANNEL_CONFIG = {
    whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
    email: { label: 'Email', icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
    sms: { label: 'SMS', icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
    push: { label: 'Push', icon: Bell, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
};

const TEMPLATES = {
    friendly: {
        label: 'Amigable',
        whatsapp: "Hola {nombre} 👋! Te recuerdo que tienes un saldo pendiente de {deuda} en la polla {liga}. Agradecemos tu pago para seguir jugando!",
        email: "Hola {nombre},\n\nEsperamos que estés bien. Te escribimos para recordarte amablemente sobre tu saldo pendiente de {deuda} en {liga}.\n\n¡Gracias por participar!",
        sms: "{nombre}, recuerda tu pago de {deuda} en {liga}. ¡No te quedes fuera!",
        push: "👋 {nombre}, no olvides ponerte al día en {liga}."
    },
    formal: {
        label: 'Formal',
        whatsapp: "Estimado(a) {nombre}. Le informamos un saldo vencido de {deuda} en la liga {liga}. Por favor regularizar su estado.",
        email: "Estimado/a {nombre},\n\nLe notificamos que presenta un saldo pendiente de {deuda} correspondiente a la liga {liga}. Agradecemos realizar el pago a la brevedad posible.\n\nAtentamente,\nLa Administración.",
        sms: "Aviso de Cobro: {nombre}, saldo pendiente {deuda} en {liga}. Regularice hoy.",
        push: "Aviso: Saldo pendiente de {deuda} en {liga}."
    },
    urgent: {
        label: 'Urgente',
        whatsapp: "🚨 {nombre}, ÚLTIMO AVISO. Tu deuda de {deuda} en {liga} debe ser pagada hoy para evitar sanciones.",
        email: "URGENTE: {nombre}, tu participación en {liga} está en riesgo.\n\nSaldo: {deuda}\n\nPor favor realiza el pago inmediatamente.",
        sms: "URGENTE {nombre}: Paga {deuda} hoy en {liga} para evitar bloqueo.",
        push: "🚨 {nombre}, tu pago de {deuda} en {liga} requiere atención inmediata."
    }
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
  const [quickPayModal, setQuickPayModal] = React.useState<{isOpen: boolean, userId: string | null, amount: number, method: string, reference: string, date: string}>({ 
    isOpen: false, userId: null, amount: 0, method: 'Efectivo', reference: '', date: new Date().toISOString().split('T')[0] 
  });
  const [bulkPayModal, setBulkPayModal] = React.useState<{isOpen: boolean, totalAmount: number, userCount: number}>({ isOpen: false, totalAmount: 0, userCount: 0 });
  
  // Advanced Reminder Modal State
  const [reminderModal, setReminderModal] = React.useState<{isOpen: boolean, step: 1 | 2}>({ isOpen: false, step: 1 });
  const [userChannels, setUserChannels] = React.useState<Record<string, ReminderChannel[]>>({});
  const [messageDrafts, setMessageDrafts] = React.useState<Record<ReminderChannel, string>>({
      whatsapp: TEMPLATES.friendly.whatsapp,
      email: TEMPLATES.friendly.email,
      sms: TEMPLATES.friendly.sms,
      push: TEMPLATES.friendly.push
  });
  // Track selected template per channel to highlight buttons
  const [selectedTemplate, setSelectedTemplate] = React.useState<Record<ReminderChannel, TemplateType>>({
      whatsapp: 'friendly',
      email: 'friendly',
      sms: 'friendly',
      push: 'friendly'
  });
  const [activeTab, setActiveTab] = React.useState<ReminderChannel>('whatsapp');
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);

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

  // --- REMINDER LOGIC ---

  // Compute active channels based on selection
  const getActiveChannels = () => {
      const channels = new Set<ReminderChannel>();
      selectedUserIds.forEach(uid => {
          const uChannels = userChannels[uid] || [];
          uChannels.forEach(c => channels.add(c));
      });
      return Array.from(channels);
  };

  const initReminder = () => {
      // Initialize channels for selected users (default: WhatsApp & Push)
      const initialChannels: Record<string, ReminderChannel[]> = {};
      selectedUserIds.forEach(id => {
          initialChannels[id] = ['whatsapp', 'push'];
      });
      setUserChannels(initialChannels);
      setReminderModal({ isOpen: true, step: 1 });
  };

  const toggleUserChannel = (userId: string, channel: ReminderChannel) => {
      setUserChannels(prev => {
          const current = prev[userId] || [];
          const updated = current.includes(channel) 
              ? current.filter(c => c !== channel) 
              : [...current, channel];
          return { ...prev, [userId]: updated };
      });
  };

  const applyTemplate = (templateKey: 'friendly' | 'formal' | 'urgent') => {
      const template = TEMPLATES[templateKey];
      // Only update the active tab text
      setMessageDrafts(prev => ({
          ...prev,
          [activeTab]: template[activeTab]
      }));
      setSelectedTemplate(prev => ({ ...prev, [activeTab]: templateKey }));
  };

  const generateAIMessage = () => {
      setIsGeneratingAI(true);
      // Simulate AI Latency
      setTimeout(() => {
          const aiMessages: Record<ReminderChannel, string> = {
              whatsapp: "🤖 Hola {nombre}, noté que se nos pasó la fecha de tu aporte en {liga}. Para mantener el juego emocionante, ¿podrías revisar tu saldo de {deuda}? ¡Gracias!",
              email: "Asunto: Pequeño recordatorio de {liga}\n\nHola {nombre},\n\nLa inteligencia artificial de nuestra liga ha detectado un saldo pendiente. Ayúdanos a mantener la competencia al día.\n\nSaldo: {deuda}",
              sms: "Hola {nombre}, un recordatorio amigable de tu IA favorita: saldo de {deuda} en {liga}.",
              push: "🤖 Tu asistente de liga: {nombre}, no olvides tu aporte pendiente."
          };
          
          setMessageDrafts(prev => ({ ...prev, [activeTab]: aiMessages[activeTab] }));
          setSelectedTemplate(prev => ({ ...prev, [activeTab]: 'ai' }));
          setIsGeneratingAI(false);
      }, 1500);
  };

  const insertVariable = (variable: string) => {
      setMessageDrafts(prev => ({
          ...prev,
          [activeTab]: prev[activeTab] + ` {${variable}}`
      }));
      setSelectedTemplate(prev => ({ ...prev, [activeTab]: 'custom' }));
  };

  const handleSendReminder = () => {
      let count = 0;
      selectedUserIds.forEach(uid => {
          const channels = userChannels[uid];
          if(channels && channels.length > 0) count++;
      });
      
      alert(`Enviando recordatorios a ${count} usuarios por sus canales seleccionados.`);
      setReminderModal({ isOpen: false, step: 1 });
      setSelectedUserIds([]);
  };

  const handleIndividualReminder = (user: UserPaymentData) => {
      setSelectedUserIds([user.id]);
      initReminder(); // Reuse main logic for single user
      setOpenActionMenuId(null);
  };

  // Ensure activeTab is valid when switching to Step 2
  React.useEffect(() => {
      if (reminderModal.step === 2) {
          const activeCh = getActiveChannels();
          if (activeCh.length > 0 && !activeCh.includes(activeTab)) {
              setActiveTab(activeCh[0]);
          }
      }
  }, [reminderModal.step]);

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
      setQuickPayModal({ 
        isOpen: true, 
        userId, 
        amount: pendingAmount,
        method: 'Efectivo',
        reference: '',
        date: new Date().toISOString().split('T')[0]
      });
  };

  const confirmQuickPay = () => {
      const { userId, amount, method, reference, date } = quickPayModal;
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
          date: date,
          method: method,
          reference: reference,
          note: 'Pago Rápido'
      }, ...prev]);
      setQuickPayModal({ isOpen: false, userId: null, amount: 0, method: 'Efectivo', reference: '', date: '' });
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
                      onClick={initReminder}
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
             <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-0 overflow-hidden animate-in zoom-in duration-300">
                 <div className="p-6 text-center space-y-4">
                     <div className="w-14 h-14 bg-lime-100 rounded-full flex items-center justify-center text-lime-600 mx-auto shadow-inner"><Banknote size={28} /></div>
                     <h3 className="text-xl font-black font-brand uppercase tracking-tight text-slate-900">¿CONFIRMAR PAGO?</h3>
                     
                     <div className="bg-slate-900 p-4 rounded-2xl text-white font-black font-brand text-3xl shadow-lg">
                        ${quickPayModal.amount.toLocaleString()}
                     </div>

                     <div className="space-y-4 text-left pt-2">
                        {/* Método de Pago */}
                        <div className="space-y-2">
                           <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Método de Pago</p>
                           <div className="grid grid-cols-2 gap-2">
                                {PAYMENT_METHODS.map(method => (
                                    <button 
                                       key={method.id}
                                       type="button" 
                                       onClick={() => setQuickPayModal({...quickPayModal, method: method.id})}
                                       className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${quickPayModal.method === method.id ? 'bg-white border-lime-500 shadow-sm ring-1 ring-lime-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                       <method.icon size={14} className={method.color} />
                                       <span className={`text-[9px] font-black uppercase ${quickPayModal.method === method.id ? 'text-slate-900' : 'text-slate-500'}`}>{method.label}</span>
                                    </button>
                                ))}
                           </div>
                        </div>

                        {/* Reporte Rápido (Fecha/Referencia) */}
                        <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Fecha</p>
                              <Input 
                                 type="date" 
                                 value={quickPayModal.date} 
                                 onChange={e => setQuickPayModal({...quickPayModal, date: e.target.value})} 
                                 className="h-9 text-[10px] font-bold px-2 rounded-xl" 
                              />
                           </div>
                           <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Referencia</p>
                              <Input 
                                 placeholder="Nº Ref" 
                                 value={quickPayModal.reference} 
                                 onChange={e => setQuickPayModal({...quickPayModal, reference: e.target.value})} 
                                 className="h-9 text-[10px] font-bold px-2 rounded-xl"
                                 leftIcon={<Hash size={10}/>}
                              />
                           </div>
                        </div>
                     </div>
                 </div>

                 <div className="grid grid-cols-2 p-4 pt-0 gap-3">
                    <Button variant="outline" className="rounded-xl font-black text-xs uppercase h-12" onClick={() => setQuickPayModal({isOpen: false, userId: null, amount: 0, method: 'Efectivo', reference: '', date: ''})}>CANCELAR</Button>
                    <Button variant="secondary" className="rounded-xl font-black text-xs uppercase h-12 shadow-lg shadow-lime-400/20" onClick={confirmQuickPay}>CONFIRMAR</Button>
                 </div>
             </Card>
          </div>
      )}

      {reminderModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <Card className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center"><Send size={20} /></div>
                        <div>
                           <h3 className="text-lg font-black font-brand uppercase tracking-tight text-slate-900">
                              {reminderModal.step === 1 ? 'Canales de Envío' : 'Personalizar Mensaje'}
                           </h3>
                           <p className="text-xs text-slate-500 font-bold">{selectedUserIds.length} Destinatarios Seleccionados</p>
                        </div>
                     </div>
                     <button onClick={() => setReminderModal({...reminderModal, isOpen: false})}><X size={20} className="text-slate-400 hover:text-black"/></button>
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {reminderModal.step === 1 ? (
                        <div className="space-y-4">
                           <div className="flex justify-between items-center mb-2 px-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">SELECCIÓN POR USUARIO</span>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Total: ${selectedUserIds.reduce((acc, uid) => {
                                  const u = users.find(u => u.id === uid);
                                  return acc + (u ? getUserAggregates(u).pendingAmount : 0);
                              }, 0).toLocaleString()}</span>
                           </div>
                           <div className="space-y-2">
                              {selectedUserIds.map(uid => {
                                  const user = users.find(u => u.id === uid);
                                  if(!user) return null;
                                  const channels = userChannels[uid] || [];
                                  const { pendingAmount } = getUserAggregates(user);
                                  
                                  return (
                                      <div key={uid} className="flex items-center justify-between p-3 border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors bg-white">
                                          <div className="flex items-center gap-3">
                                              <img src={user.avatar} className="w-10 h-10 rounded-xl" alt={user.name} />
                                              <div>
                                                  <p className="text-xs font-black text-slate-900 uppercase">{user.name}</p>
                                                  <p className="text-[10px] font-bold text-rose-500 bg-rose-50 inline-block px-1.5 rounded mt-0.5">Deuda: ${pendingAmount.toLocaleString()}</p>
                                              </div>
                                          </div>
                                          <div className="flex gap-2">
                                              {(['whatsapp', 'email', 'sms', 'push'] as ReminderChannel[]).map(ch => {
                                                  const isActive = channels.includes(ch);
                                                  const Config = CHANNEL_CONFIG[ch];
                                                  const Icon = Config.icon;
                                                  return (
                                                      <button 
                                                        key={ch}
                                                        onClick={() => toggleUserChannel(uid, ch)}
                                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isActive ? `${Config.bg} ${Config.color} border ${Config.border}` : 'bg-slate-50 text-slate-300 border border-slate-100 hover:bg-slate-100'}`}
                                                        title={Config.label}
                                                      >
                                                          <Icon size={16} />
                                                      </button>
                                                  )
                                              })}
                                          </div>
                                      </div>
                                  )
                              })}
                           </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Templates Quick Actions */}
                            <div className="flex justify-between items-end mb-2">
                                <div className="space-y-2 flex-1 mr-4">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANTILLAS SUGERIDAS</span>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {(['friendly', 'formal', 'urgent'] as const).map(tKey => {
                                            const isActive = selectedTemplate[activeTab] === tKey;
                                            return (
                                                <button 
                                                    key={tKey}
                                                    onClick={() => applyTemplate(tKey)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                >
                                                    {TEMPLATES[tKey].label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                
                                {/* AI Premium Feature */}
                                <button 
                                    onClick={generateAIMessage}
                                    disabled={isGeneratingAI}
                                    className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
                                >
                                    {isGeneratingAI ? <Bot size={16} className="animate-bounce" /> : <Sparkles size={16} />}
                                    <span className="text-[9px] font-black uppercase tracking-widest">{isGeneratingAI ? 'Pensando...' : 'Redactar con IA'}</span>
                                </button>
                            </div>

                            {/* Editor */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                                <div className="flex bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-hide">
                                    {getActiveChannels().map(ch => {
                                        const Config = CHANNEL_CONFIG[ch];
                                        const Icon = Config.icon;
                                        return (
                                            <button 
                                                key={ch} 
                                                onClick={() => setActiveTab(ch)}
                                                className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-w-[100px] ${activeTab === ch ? 'bg-white text-slate-900 shadow-sm border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                <Icon size={14} className={activeTab === ch ? Config.color : ''} />
                                                <span>{Config.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="p-4 bg-white space-y-3 relative">
                                    <textarea 
                                        className="w-full h-32 resize-none outline-none text-sm text-slate-700 placeholder:text-slate-300 font-medium bg-transparent relative z-10"
                                        placeholder={`Escribe tu mensaje para ${CHANNEL_CONFIG[activeTab].label}...`}
                                        value={messageDrafts[activeTab]}
                                        onChange={(e) => {
                                            setMessageDrafts({...messageDrafts, [activeTab]: e.target.value});
                                            if (selectedTemplate[activeTab] !== 'custom') {
                                                setSelectedTemplate(prev => ({ ...prev, [activeTab]: 'custom' }));
                                            }
                                        }}
                                    />
                                    {/* AI Decoration Background */}
                                    {selectedTemplate[activeTab] === 'ai' && (
                                        <div className="absolute top-2 right-2 pointer-events-none opacity-10">
                                            <Sparkles size={80} className="text-purple-500" />
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                                        <span className="text-[10px] font-black text-slate-400 uppercase mr-1">Variables:</span>
                                        {['nombre', 'deuda', 'liga'].map(v => (
                                            <button key={v} onClick={() => insertVariable(v)} className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition-colors">{`{${v}}`}</button>
                                        ))}
                                        <div className="ml-auto flex items-center text-[10px] text-slate-400">
                                            <Edit3 size={12} className="mr-1"/> 
                                            {selectedTemplate[activeTab] === 'ai' ? (
                                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 font-bold">Generado por IA</span>
                                            ) : (
                                                <span>Editando para {CHANNEL_CONFIG[activeTab].label}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                 </div>

                 <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                     {reminderModal.step === 2 && (
                         <Button variant="outline" onClick={() => setReminderModal({...reminderModal, step: 1})} className="w-14 rounded-xl border-slate-200 text-slate-500">
                             <ArrowLeft size={18} />
                         </Button>
                     )}
                     <Button 
                        variant="secondary" 
                        onClick={() => reminderModal.step === 1 ? setReminderModal({...reminderModal, step: 2}) : handleSendReminder()} 
                        className="flex-1 h-12 rounded-xl font-black text-xs uppercase shadow-xl"
                     >
                         {reminderModal.step === 1 ? 'Personalizar Mensaje' : 'Enviar Notificaciones'} <Send size={16} className="ml-2" />
                     </Button>
                 </div>
             </Card>
          </div>
      )}
    </div>
  );
};

export default ManagePayments;