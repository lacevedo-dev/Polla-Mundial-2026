
import React from 'react';
import { Button, Card, Badge, Input, Checkbox } from '../components/UI';
import { Match, AppView, PrizeWinner, CategoryDistribution, StageType } from '../types';
import { 
  Trophy, 
  Target, 
  Coins, 
  CheckCircle2, 
  Share2, 
  ListChecks, 
  Zap, 
  TrendingUp, 
  Clock, 
  Sparkles, 
  Users, 
  ChevronDown, 
  Shield, 
  User, 
  LayoutDashboard, 
  Wallet, 
  Settings, 
  ArrowUpRight, 
  AlertCircle, 
  Pencil, 
  X, 
  Copy, 
  QrCode, 
  MessageCircle, 
  Trash2, 
  Crown, 
  UserPlus, 
  Send, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Bot, 
  Edit3, 
  ArrowLeft, 
  Bell, 
  Eye, 
  Download, 
  Image as ImageIcon, 
  Palette, 
  Wand2, 
  LayoutTemplate, 
  List, 
  FileText, 
  RefreshCcw, 
  Globe, 
  Lock, 
  Minus, 
  Plus, 
  AlertTriangle, 
  Calendar, 
  PieChart, 
  Calculator
} from 'lucide-react';

interface DashboardProps {
  onViewChange: (view: AppView) => void;
}

// Mock Data Structure for Multiple Leagues
interface LeagueContext {
  id: string;
  name: string;
  description?: string;
  role: 'admin' | 'user';
  plan: 'free' | 'gold' | 'diamond';
  participants: { current: number; max: number };
  privacy: 'public' | 'private';
  includeBaseFee: boolean;
  baseFeeAmount: string;
  includeStageFees: boolean;
  stageFees: {
    match: { active: boolean; amount: string };
    round: { active: boolean; amount: string };
    phase: { active: boolean; amount: string };
  };
  adminFeePercent: number;
  distributions: {
    general: CategoryDistribution;
    match: CategoryDistribution;
    round: CategoryDistribution;
    phase: CategoryDistribution;
  };
  stats: {
    rank?: number;
    points?: number;
    collected?: string;
    totalPrize?: string;
  };
  code?: string;
}

// Extended Match interface for Dashboard state
interface DashboardMatch extends Match {
  status: 'active' | 'saved';
  userPrediction: {
    home: string;
    away: string;
  };
}

// Invite System Types
type InviteChannel = 'whatsapp' | 'email' | 'sms' | 'copy' | 'push';
type InviteTemplate = 'friendly' | 'challenger' | 'formal' | 'ai' | 'custom';
type CardStyle = 'neon' | 'pro' | 'stadium' | 'ai-generated';

interface Recipient {
  id: string;
  name: string;
  contact: string; // Email or Phone
  type: 'email' | 'phone';
  selectedChannels: InviteChannel[];
}

// Helper for distribution logic (Shared with CreateLeague logic)
const getInitialDistribution = (winnersCount: number, adminFee: number): PrizeWinner[] => {
  const prizes: PrizeWinner[] = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    label: `${i + 1}º PUESTO`,
    percentage: 0,
    active: false
  }));
  const netPool = 100 - adminFee;
  const templates: Record<number, number[]> = {
    1: [100], 2: [60, 40], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [35, 25, 20, 10, 10],
    6: [30, 20, 15, 15, 10, 10], 7: [25, 20, 15, 10, 10, 10, 10], 8: [20, 15, 15, 10, 10, 10, 10, 10],
    9: [20, 15, 10, 10, 10, 10, 10, 10, 5], 10: [15, 15, 10, 10, 10, 10, 10, 10, 5, 5]
  };
  const weights = templates[winnersCount] || Array(winnersCount).fill(100 / winnersCount);
  let currentSum = 0;
  for (let i = 0; i < winnersCount; i++) {
    prizes[i].active = true;
    let val = Math.round((netPool * (weights[i] / 100)) / 5) * 5;
    if (i === winnersCount - 1) val = netPool - currentSum;
    prizes[i].percentage = val;
    currentSum += val;
  }
  return prizes;
};

const MY_LEAGUES: LeagueContext[] = [
  {
    id: 'league-1',
    name: 'LOS CRACKS DEL BARRIO',
    description: 'La liga oficial del barrio para el mundial.',
    role: 'admin',
    plan: 'gold',
    privacy: 'private',
    participants: { current: 24, max: 50 },
    includeBaseFee: true,
    baseFeeAmount: '50000',
    includeStageFees: true,
    stageFees: {
        match: { active: true, amount: '2000' },
        round: { active: true, amount: '5000' },
        phase: { active: false, amount: '10000' }
    },
    adminFeePercent: 10,
    distributions: {
        general: { winnersCount: 3, distribution: getInitialDistribution(3, 10) },
        match: { winnersCount: 1, distribution: getInitialDistribution(1, 10) },
        round: { winnersCount: 1, distribution: getInitialDistribution(1, 10) },
        phase: { winnersCount: 1, distribution: getInitialDistribution(1, 10) }
    },
    stats: { collected: '$1.200k', totalPrize: '$1.080k' },
    code: 'CRACKS-2026'
  },
  {
    id: 'league-2',
    name: 'OFICINA 2026',
    description: 'Solo personal de contabilidad y ventas.',
    role: 'user',
    plan: 'diamond',
    privacy: 'private',
    participants: { current: 156, max: 200 },
    includeBaseFee: true,
    baseFeeAmount: '100000',
    includeStageFees: false,
    stageFees: {
        match: { active: false, amount: '0' },
        round: { active: false, amount: '0' },
        phase: { active: false, amount: '0' }
    },
    adminFeePercent: 5,
    distributions: {
        general: { winnersCount: 5, distribution: getInitialDistribution(5, 5) },
        match: { winnersCount: 1, distribution: getInitialDistribution(1, 5) },
        round: { winnersCount: 1, distribution: getInitialDistribution(1, 5) },
        phase: { winnersCount: 1, distribution: getInitialDistribution(1, 5) }
    },
    stats: { rank: 12, points: 45, totalPrize: '$5.000k' }
  },
  {
    id: 'league-3',
    name: 'FAMILIA PEREZ',
    role: 'user',
    plan: 'free',
    privacy: 'public',
    participants: { current: 8, max: 10 },
    includeBaseFee: false,
    baseFeeAmount: '0',
    includeStageFees: false,
    stageFees: {
        match: { active: false, amount: '0' },
        round: { active: false, amount: '0' },
        phase: { active: false, amount: '0' }
    },
    adminFeePercent: 0,
    distributions: {
        general: { winnersCount: 1, distribution: getInitialDistribution(1, 0) },
        match: { winnersCount: 1, distribution: getInitialDistribution(1, 0) },
        round: { winnersCount: 1, distribution: getInitialDistribution(1, 0) },
        phase: { winnersCount: 1, distribution: getInitialDistribution(1, 0) }
    },
    stats: { rank: 1, points: 12, totalPrize: '$0' }
  }
];

const MOCK_PARTICIPANTS = [
    { id: '1', name: 'Luis Morales', role: 'admin', status: 'active', avatar: 'https://picsum.photos/seed/luis/40/40' },
    { id: '2', name: 'Leo Castiblanco', role: 'user', status: 'active', avatar: 'https://picsum.photos/seed/leo/40/40' },
    { id: '3', name: 'Nubia Sarmiento', role: 'user', status: 'pending', avatar: 'https://picsum.photos/seed/nubia/40/40' },
    { id: '4', name: 'Carlos Ruiz', role: 'user', status: 'active', avatar: 'https://picsum.photos/seed/carlos/40/40' },
    { id: '5', name: 'Andres Cepeda', role: 'user', status: 'pending', avatar: 'https://picsum.photos/seed/andres/40/40' },
];

const INVITE_TEMPLATES = {
    friendly: {
        label: 'Amigable',
        whatsapp: "¡Hola {nombre}! 👋 Te invito a mi polla mundialista '{liga}'. Demuestra cuánto sabes de fútbol. Únete aquí: {link}",
        email: "Hola {nombre},\n\nTe invito a participar en la polla '{liga}' para el Mundial 2026. ¡Habrá premios y mucha diversión!\n\nÚnete aquí: {link}",
        sms: "{nombre}, únete a mi polla '{liga}' del Mundial 2026. Link: {link}",
        copy: "¡Hola! Te invito a mi polla mundialista '{liga}'. Únete aquí: {link}",
        push: "👋 {nombre}, ¡te invitaron a la polla '{liga}'! Únete y demuestra lo que sabes."
    },
    challenger: {
        label: 'Retador',
        whatsapp: "⚽ {nombre}, apuesto a que no puedes ganarme en la polla '{liga}'. Si te atreves, entra aquí: {link}",
        email: "Hola {nombre},\n\nHe creado la liga '{liga}' y estoy buscando rivales dignos. ¿Crees que sabes más de fútbol que yo?\n\nDemuéstralo aquí: {link}",
        sms: "{nombre}, ¿aceptas el reto? Únete a '{liga}' y gáname si puedes: {link}",
        copy: "⚽ ¿Crees que sabes de fútbol? Te reto a unirte a '{liga}'. Entra aquí: {link}",
        push: "⚽ {nombre}, ¿aceptas el reto en '{liga}'? Demuestra que sabes más que yo."
    },
    formal: {
        label: 'Formal',
        whatsapp: "Estimado/a {nombre}, le extiendo una invitación formal para participar en el torneo de predicciones '{liga}'. Enlace: {link}",
        email: "Estimado/a {nombre},\n\nLe invitamos cordialmente a formar parte de nuestra liga de predicciones '{liga}' para la Copa Mundial 2026.\n\nPuede inscribirse a través del siguiente enlace: {link}",
        sms: "Invitación a '{liga}'. Participe en nuestro torneo de predicciones: {link}",
        copy: "Invitación formal a la liga de predicciones '{liga}'. Enlace de registro: {link}",
        push: "Invitación: {nombre}, se le solicita su participación en la liga '{liga}'."
    }
};

const CHANNEL_CONFIG = {
    whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
    email: { label: 'Email', icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
    sms: { label: 'SMS', icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
    copy: { label: 'Link', icon: Copy, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
    push: { label: 'Push', icon: Bell, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
};

const PLAN_LIMITS = {
    free: 10,
    gold: 50,
    diamond: 200
};

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const [activeLeague, setActiveLeague] = React.useState<LeagueContext>(MY_LEAGUES[0]);
  const [isLeagueMenuOpen, setIsLeagueMenuOpen] = React.useState(false);
  
  // Modal States
  const [showConfigModal, setShowConfigModal] = React.useState(false);
  const [configTab, setConfigTab] = React.useState<'details' | 'participants' | 'prizes'>('details');
  const [participants, setParticipants] = React.useState(MOCK_PARTICIPANTS);
  const [prizeCategory, setPrizeCategory] = React.useState<StageType | 'general'>('general');

  // Invite Modal States
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [inviteStep, setInviteStep] = React.useState<1 | 2>(1);
  const [showShareCard, setShowShareCard] = React.useState(false); // New state for Share Card View
  
  // New Input States (Manual vs Bulk)
  const [inviteMode, setInviteMode] = React.useState<'single' | 'bulk'>('single');
  const [contactType, setContactType] = React.useState<'email' | 'phone'>('phone');
  const [newRecipient, setNewRecipient] = React.useState({ name: '', contact: '' });
  const [bulkText, setBulkText] = React.useState('');
  const [isProcessingBulk, setIsProcessingBulk] = React.useState(false);
  
  // Card Customization States
  const [cardStyle, setCardStyle] = React.useState<CardStyle>('neon');
  const [cardHeadline, setCardHeadline] = React.useState('TE HAN INVITADO A JUGAR');
  const [isGeneratingCardAI, setIsGeneratingCardAI] = React.useState(false);

  const [recipients, setRecipients] = React.useState<Recipient[]>([]);
  const [activeTab, setActiveTab] = React.useState<InviteChannel>('whatsapp');
  const [messageDrafts, setMessageDrafts] = React.useState<Record<InviteChannel, string>>({
      whatsapp: INVITE_TEMPLATES.friendly.whatsapp,
      email: INVITE_TEMPLATES.friendly.email,
      sms: INVITE_TEMPLATES.friendly.sms,
      copy: INVITE_TEMPLATES.friendly.copy,
      push: INVITE_TEMPLATES.friendly.push
  });
  const [selectedTemplate, setSelectedTemplate] = React.useState<Record<InviteChannel, InviteTemplate>>({
      whatsapp: 'friendly', email: 'friendly', sms: 'friendly', copy: 'friendly', push: 'friendly'
  });
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);

  // State for Matches to handle predictions
  const [matches, setMatches] = React.useState<DashboardMatch[]>([
    { 
      id: '1', 
      homeTeam: 'EEUU', 
      awayTeam: 'México', 
      homeFlag: '🇺🇸', 
      awayFlag: '🇲🇽', 
      date: 'Hoy, 20:00', 
      venue: 'SoFi Stadium',
      status: 'active',
      userPrediction: { home: '', away: '' }
    },
    { 
      id: '2', 
      homeTeam: 'Colombia', 
      awayTeam: 'Argentina', 
      homeFlag: '🇨🇴', 
      awayFlag: '🇦🇷', 
      date: 'Mañana, 18:00', 
      venue: 'Azteca Stadium',
      status: 'active',
      userPrediction: { home: '', away: '' }
    },
  ]);

  const handleLeagueSwitch = (league: LeagueContext) => {
    setActiveLeague(league);
    setIsLeagueMenuOpen(false);
  };

  const toggleRole = () => {
    setActiveLeague(prev => ({
      ...prev,
      role: prev.role === 'admin' ? 'user' : 'admin'
    }));
  };

  const handleScoreChange = (id: string, team: 'home' | 'away', value: string) => {
    if (value !== '' && !/^[0-9]+$/.test(value)) return;
    if (value.length > 2) return;

    setMatches(prev => prev.map(m => m.id === id ? {
      ...m,
      status: 'active',
      userPrediction: { ...m.userPrediction, [team]: value }
    } : m));
  };

  const handleSavePrediction = (id: string) => {
    setMatches(prev => prev.map(m => m.id === id ? {
      ...m,
      status: 'saved'
    } : m));
  };

  const handleRemoveParticipant = (id: string) => {
      if(window.confirm('¿Estás seguro de eliminar a este participante?')) {
          setParticipants(prev => prev.filter(p => p.id !== id));
      }
  };

  const updateQuota = (increment: boolean) => {
      const currentMax = activeLeague.participants.max;
      const newMax = increment ? currentMax + 1 : currentMax - 1;
      
      // Prevent going below current participants
      if (!increment && newMax < participants.length) return;
      
      // Upper limit (arbitrary hard limit or based on Diamond)
      if (newMax > 500) return;

      setActiveLeague(prev => ({
          ...prev,
          participants: { ...prev.participants, max: newMax }
      }));
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert('¡Código copiado al portapapeles!');
  };

  // --- CONFIG HELPERS ---
  const handleStageFeeChange = (key: 'match' | 'round' | 'phase', field: 'active' | 'amount', value: any) => {
      setActiveLeague(prev => ({
          ...prev,
          stageFees: {
              ...prev.stageFees,
              [key]: {
                  ...prev.stageFees[key],
                  [field]: value
              }
          }
      }));
  };

  const updateWinnerCount = (category: StageType | 'general', count: number) => {
    if (count < 1 || count > 10) return;
    setActiveLeague(prev => {
      const newDists = { ...prev.distributions };
      const catKey = category as keyof typeof newDists;
      newDists[catKey] = {
        ...newDists[catKey],
        winnersCount: count,
        distribution: getInitialDistribution(count, prev.adminFeePercent)
      };
      return { ...prev, distributions: newDists };
    });
  };

  const handleAdminFeeChange = (val: number) => {
    setActiveLeague(prev => ({ ...prev, adminFeePercent: val }));
  };

  const handlePrizePercentageChange = (category: StageType | 'general', position: number, value: string) => {
    const numValue = parseFloat(value);
    setActiveLeague(prev => {
        const newDists = { ...prev.distributions };
        const catKey = category as keyof typeof newDists;
        const newDistribution = newDists[catKey].distribution.map(p =>
            p.position === position ? { ...p, percentage: isNaN(numValue) ? 0 : numValue } : p
        );
        newDists[catKey] = { ...newDists[catKey], distribution: newDistribution };
        return { ...prev, distributions: newDists };
    });
  };

  // --- FINANCIAL CALCS ---
  const calculateTotalGrossForCategory = (cat: StageType | 'general') => {
    const base = activeLeague.includeBaseFee ? parseInt(activeLeague.baseFeeAmount || '0') : 0;
    const participants = activeLeague.participants.max; // Use Max or Current? Typically use projection
    if (cat === 'general') return base * participants;
    const amount = parseInt(activeLeague.stageFees[cat as StageType].amount || '0');
    const multiplier = cat === 'match' ? 104 : cat === 'round' ? 15 : 1; 
    return amount * multiplier * participants;
  };
  const calculateNetForCategory = (cat: StageType | 'general') => calculateTotalGrossForCategory(cat); // Returns Gross now, percentage math handles net/admin split

  const currentDist = activeLeague.distributions[prizeCategory as keyof typeof activeLeague.distributions];
  const activeWinners = currentDist.distribution.filter((p) => p.active);
  const totalAllocated = activeWinners.reduce((acc, curr) => acc + curr.percentage, 0) + activeLeague.adminFeePercent;
  const isValidTotal = Math.abs(totalAllocated - 100) < 0.1;

  // --- INVITE LOGIC ---

  const addRecipient = () => {
      if (!newRecipient.name || !newRecipient.contact) return;
      
      // Auto-select channels based on user choice
      const initialChannels: InviteChannel[] = contactType === 'email' ? ['email'] : ['whatsapp', 'sms'];

      setRecipients(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          name: newRecipient.name,
          contact: newRecipient.contact,
          type: contactType,
          selectedChannels: initialChannels
      }]);
      setNewRecipient({ name: '', contact: '' });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          addRecipient();
      }
  };

  const handleBulkProcess = () => {
      if (!bulkText.trim()) return;
      setIsProcessingBulk(true);

      setTimeout(() => {
          // Soporte para listas separadas por nueva línea (\n) o punto y coma (;) estilo Outlook
          const rawEntries = bulkText.split(/[\n;]+/);
          const newRecipients: Recipient[] = [];

          rawEntries.forEach(entry => {
              const cleanLine = entry.trim();
              if (!cleanLine) return;

              let name = 'Amigo';
              let contact = cleanLine;

              // 1. Detección Formato Outlook: Nombre <email>
              // Ej: ADRIANA AGUDELO <ayagudelo@educacionbogota.gov.co>
              const outlookMatch = cleanLine.match(/^(.*)<(.+)>$/);

              if (outlookMatch) {
                  name = outlookMatch[1].trim().replace(/['"]/g, ''); // Limpiar comillas si existen
                  contact = outlookMatch[2].trim();
              } else {
                  // 2. Lógica existente (CSV, Tabs, Espacios)
                  if (cleanLine.includes(',') || cleanLine.includes('\t')) {
                      const parts = cleanLine.split(/,|\t/);
                      if (parts.length >= 2) {
                          name = parts[0].trim();
                          contact = parts[1].trim();
                      }
                  } else if (cleanLine.includes(' ')) {
                       // Heurística: ¿La última parte es el contacto?
                       const parts = cleanLine.split(' ');
                       const potentialContact = parts[parts.length - 1];
                       if (potentialContact.includes('@') || /\d{7,}/.test(potentialContact)) {
                           contact = potentialContact;
                           name = parts.slice(0, parts.length - 1).join(' ').trim() || 'Amigo';
                       }
                  }
              }

              // Detect Type (Email vs Phone)
              const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
              const isPhone = /\d{7,}/.test(contact.replace(/\D/g, ''));

              if (isEmail || isPhone) {
                  const type = isEmail ? 'email' : 'phone';
                  const channels: InviteChannel[] = isEmail ? ['email'] : ['whatsapp', 'sms'];
                  
                  newRecipients.push({
                      id: Math.random().toString(36).substr(2, 9),
                      name: name,
                      contact: contact,
                      type,
                      selectedChannels: channels
                  });
              }
          });

          setRecipients(prev => [...prev, ...newRecipients]);
          setBulkText('');
          setIsProcessingBulk(false);
      }, 800);
  };

  const toggleRecipientChannel = (id: string, channel: InviteChannel) => {
      setRecipients(prev => prev.map(r => {
          if (r.id !== id) return r;
          const current = r.selectedChannels;
          const updated = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel];
          return { ...r, selectedChannels: updated };
      }));
  };

  const applyTemplate = (templateKey: 'friendly' | 'challenger' | 'formal') => {
      const template = INVITE_TEMPLATES[templateKey];
      setMessageDrafts(prev => ({ ...prev, [activeTab]: template[activeTab] }));
      setSelectedTemplate(prev => ({ ...prev, [activeTab]: templateKey }));
  };

  const insertVariable = (v: string) => {
      setMessageDrafts(prev => ({ ...prev, [activeTab]: prev[activeTab] + ` {${v}}` }));
      setSelectedTemplate(prev => ({ ...prev, [activeTab]: 'custom' }));
  };

  const generateAIMessage = () => {
      setIsGeneratingAI(true);
      setTimeout(() => {
          const aiMessages: Record<InviteChannel, string> = {
              whatsapp: "🤖 ¡Atención {nombre}! La IA predice que te divertirás mucho en '{liga}'. ¿Aceptas el desafío del algoritmo? Entra: {link}",
              email: "Asunto: Invitación Inteligente a '{liga}'\n\nHola {nombre},\n\nSegún mis cálculos, tienes un 99% de probabilidad de disfrutar nuestra polla mundialista. Únete aquí: {link}",
              sms: "La IA te invita a '{liga}'. Demuestra tu nivel: {link}",
              copy: "🤖 Invitación generada por IA para '{liga}'. Únete: {link}",
              push: "🤖 IA: {nombre}, tus probabilidades de ganar en '{liga}' son altas. ¡Entra ya!"
          };
          setMessageDrafts(prev => ({ ...prev, [activeTab]: aiMessages[activeTab] }));
          setSelectedTemplate(prev => ({ ...prev, [activeTab]: 'ai' }));
          setIsGeneratingAI(false);
      }, 1200);
  };

  const handleGenerateAICard = () => {
      setIsGeneratingCardAI(true);
      setTimeout(() => {
          const headlines = [
              "¿TIENES LO QUE SE NECESITA?",
              "LA GLORIA TE ESPERA",
              "DEMUESTRA TU PASIÓN",
              "TU MOMENTO HA LLEGADO"
          ];
          const randomHeadline = headlines[Math.floor(Math.random() * headlines.length)];
          setCardHeadline(randomHeadline);
          setCardStyle('ai-generated');
          setIsGeneratingCardAI(false);
      }, 1500);
  };

  const getActiveChannels = () => {
      const channels = new Set<InviteChannel>();
      recipients.forEach(r => r.selectedChannels.forEach(c => channels.add(c)));
      // Always include active tab if it's there, to avoid empty states
      if (recipients.length > 0) return Array.from(channels);
      return ['whatsapp', 'email', 'sms'] as InviteChannel[]; 
  };

  const handleSendInvites = async () => {
      const hasPush = recipients.some(r => r.selectedChannels.includes('push'));
      if (hasPush) {
          if (!("Notification" in window)) {
              alert("Tu navegador no soporta notificaciones.");
          } else if (Notification.permission !== "granted") {
              const permission = await Notification.requestPermission();
              if (permission !== "granted") {
                  alert("Necesitamos permiso para enviar notificaciones push.");
                  return;
              }
          }
          
          if (Notification.permission === "granted") {
               new Notification("Invitaciones Enviadas", {
                   body: `Se han enviado notificaciones a ${recipients.filter(r => r.selectedChannels.includes('push')).length} usuarios.`,
                   icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png'
               });
          }
      }

      alert(`Enviando invitaciones a ${recipients.length} personas.`);
      setShowInviteModal(false);
      setRecipients([]);
      setInviteStep(1);
  };

  // --- RENDER HELPERS ---

  const renderRoleBadge = () => {
    if (activeLeague.role === 'admin') {
      return (
        <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded-full border border-slate-700 shadow-sm">
          <Shield size={12} className="text-lime-400" />
          <span className="text-[9px] font-black uppercase tracking-widest">Administrador</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 bg-white text-slate-700 px-3 py-1 rounded-full border border-slate-200 shadow-sm">
        <User size={12} className="text-blue-500" />
        <span className="text-[9px] font-black uppercase tracking-widest">Participante</span>
      </div>
    );
  };

  const renderAdminStats = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-black text-white p-8 border-0 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={120} /></div>
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado Financiero</span>
            <Badge color="bg-lime-400 text-black">EN CURSO</Badge>
          </div>
          <div>
            <div className="text-5xl font-black font-brand tracking-tighter text-white">{activeLeague.stats.collected}</div>
            <p className="text-xs text-slate-400 font-bold mt-1">RECAUDO TOTAL</p>
          </div>
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 text-[9px] uppercase">BOLSA PREMIOS (NETO)</span>
              <span className="text-xs font-black text-lime-400">{activeLeague.stats.totalPrize}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 text-[9px] uppercase">COMISIÓN ADMIN (10%)</span>
              <span className="text-xs font-black text-rose-400">$120k</span>
            </div>
          </div>
          <Button 
            variant="secondary" 
            className="w-full mt-4 font-black text-xs uppercase tracking-widest h-10"
            onClick={() => onViewChange('manage-payments')}
          >
            Gestionar Pagos
          </Button>
        </div>
      </Card>

      <Card className="p-8 space-y-6">
         <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Cupos de Liga</h3>
            <Users size={14} className="text-slate-400" />
         </div>
         <div className="space-y-2">
            <div className="flex justify-between text-xs font-black">
               <span className="text-slate-700">{participants.length} / {activeLeague.participants.max}</span>
               <span className="text-lime-600">{Math.round((participants.length / activeLeague.participants.max) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-lime-400 rounded-full transition-all duration-1000" style={{ width: `${(participants.length / activeLeague.participants.max) * 100}%` }}></div>
            </div>
         </div>
         <div className="flex gap-2">
            <Button 
                variant="outline" 
                className="flex-1 text-[10px] font-black h-10 border-slate-200"
                onClick={() => setShowConfigModal(true)}
            >
                <Settings size={14} className="mr-2"/> CONFIGURAR
            </Button>
            <Button 
                variant="primary" 
                className="flex-1 text-[10px] font-black h-10"
                onClick={() => setShowInviteModal(true)}
            >
                <Share2 size={14} className="mr-2"/> INVITAR
            </Button>
         </div>
      </Card>
    </div>
  );

  const renderUserStats = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 border-0 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={120} /></div>
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Mi Desempeño</span>
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                <Trophy size={10} className="text-yellow-300" />
                <span className="text-[9px] font-black">PUESTO #{activeLeague.stats.rank}</span>
            </div>
          </div>
          <div>
            <div className="text-6xl font-black font-brand tracking-tighter text-white">{activeLeague.stats.points}</div>
            <p className="text-xs text-blue-200 font-bold mt-1">PUNTOS ACUMULADOS</p>
          </div>
          <div className="pt-4 border-t border-white/10">
             <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-green-400 flex items-center justify-center text-black font-bold text-xs">+5</div>
                <div>
                   <p className="text-[9px] font-black uppercase text-blue-200">ÚLTIMO ACIERTO</p>
                   <p className="text-xs font-bold">Marcador Exacto (COL vs BRA)</p>
                </div>
             </div>
          </div>
        </div>
      </Card>

      <Card className="p-8 space-y-6 border-slate-200 bg-white">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Tu Próximo Reto</h3>
            <Clock size={14} className="text-slate-400" />
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇸</span>
                  <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900">USA</span>
                      <span className="text-[9px] font-bold text-slate-400">vs MEX</span>
                  </div>
              </div>
              <Button size="sm" variant="secondary" className="px-4 h-8 text-[9px] font-black uppercase tracking-widest shadow-none">
                  PRONOSTICAR
              </Button>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
             <Clock size={12} className="text-amber-500" />
             Cierre en 2 horas 30 min
          </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-700 relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      {/* --- MODAL: CONFIGURAR LIGA --- */}
      {showConfigModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <Card className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
                 
                 {/* Header */}
                 <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
                          <Settings size={20} />
                       </div>
                       <div>
                          <h3 className="text-lg font-black font-brand uppercase text-slate-900">Configuración</h3>
                          <p className="text-xs text-slate-500 font-medium">Administra tu liga</p>
                       </div>
                    </div>
                    <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-black"><X size={24}/></button>
                 </div>

                 {/* Tabs */}
                 <div className="flex p-2 gap-2 px-6">
                    {['details', 'prizes', 'participants'].map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setConfigTab(tab as any)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${configTab === tab ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            {tab === 'details' ? 'Detalles' : tab === 'prizes' ? 'Premios' : 'Participantes'}
                        </button>
                    ))}
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 space-y-6">
                    {configTab === 'details' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre de la Liga</label>
                                <Input 
                                    value={activeLeague.name} 
                                    onChange={(e) => setActiveLeague({...activeLeague, name: e.target.value})}
                                    className="font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Descripción</label>
                                <textarea 
                                    value={activeLeague.description || ''} 
                                    onChange={(e) => setActiveLeague({...activeLeague, description: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-lime-400 focus:border-lime-500 outline-none transition-all text-xs font-medium text-slate-900 resize-none h-24"
                                    placeholder="Describe tu liga..."
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Privacidad</label>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setActiveLeague({...activeLeague, privacy: 'private'})}
                                        className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeLeague.privacy === 'private' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <Lock size={14} /> Privada
                                    </button>
                                    <button 
                                        onClick={() => setActiveLeague({...activeLeague, privacy: 'public'})}
                                        className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeLeague.privacy === 'public' ? 'bg-lime-400 text-black border-lime-400 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <Globe size={14} /> Pública
                                    </button>
                                </div>
                            </div>

                            {/* Configuración Financiera */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Configuración Financiera</label>
                                
                                <div className="bg-white border border-lime-200 rounded-xl p-3 overflow-hidden shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <Coins size={16} className={activeLeague.includeBaseFee ? "text-lime-600" : "text-slate-400"} />
                                            <span className="text-[10px] font-bold uppercase text-slate-700">Cuota General</span>
                                        </div>
                                        <Checkbox 
                                            id="conf-base-fee" 
                                            label="" 
                                            checked={activeLeague.includeBaseFee} 
                                            onChange={(v) => setActiveLeague({...activeLeague, includeBaseFee: v})} 
                                        />
                                    </div>
                                    <div className={`relative ${!activeLeague.includeBaseFee ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                                        <input 
                                            type="number" 
                                            value={activeLeague.baseFeeAmount} 
                                            onChange={(e) => setActiveLeague({...activeLeague, baseFeeAmount: e.target.value})}
                                            className="w-full h-9 pl-6 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-lime-400 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white border border-lime-200 rounded-xl p-3 overflow-hidden shadow-sm mt-2">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} className={activeLeague.includeStageFees ? "text-lime-600" : "text-slate-400"} />
                                            <span className="text-[10px] font-bold uppercase text-slate-700">Costos por Etapa</span>
                                        </div>
                                        <Checkbox 
                                            id="conf-stage-fees" 
                                            label="" 
                                            checked={activeLeague.includeStageFees} 
                                            onChange={(v) => setActiveLeague({...activeLeague, includeStageFees: v})} 
                                        />
                                    </div>
                                    
                                    <div className={`space-y-2 ${!activeLeague.includeStageFees ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {(['match', 'round', 'phase'] as const).map(key => (
                                            <div key={key} className="flex items-center gap-2">
                                                <Checkbox 
                                                    id={`conf-check-${key}`} 
                                                    label="" 
                                                    checked={activeLeague.stageFees[key].active} 
                                                    onChange={(v) => handleStageFeeChange(key, 'active', v)}
                                                />
                                                <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                                    <Zap size={12} />
                                                </div>
                                                <span className="text-[9px] font-bold uppercase text-slate-500 w-12">{key === 'match' ? 'Partido' : key === 'round' ? 'Ronda' : 'Fase'}</span>
                                                <div className={`relative flex-1 ${!activeLeague.stageFees[key].active ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">$</span>
                                                    <input 
                                                        type="number"
                                                        value={activeLeague.stageFees[key].amount}
                                                        onChange={(e) => handleStageFeeChange(key, 'amount', e.target.value)}
                                                        className="w-full h-7 pl-4 pr-2 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-900 outline-none focus:border-lime-400 transition-all text-right"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : configTab === 'prizes' ? (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-2">
                            {/* Admin Fee Slider - NEW */}
                            <div className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-200 mb-4 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">% ADMIN</span>
                                    <span className="text-sm font-black text-lime-600">{activeLeague.adminFeePercent}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="50" 
                                    step="1" 
                                    value={activeLeague.adminFeePercent} 
                                    onChange={e => handleAdminFeeChange(parseInt(e.target.value))} 
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none accent-lime-500 cursor-pointer" 
                                />
                            </div>

                            {/* Pestañas Filtradas - DISEÑO CAPSULA */}
                            <div className="flex p-1 bg-white rounded-[2rem] gap-1 border border-slate-100 shadow-sm overflow-x-auto scrollbar-hide mb-4">
                               {([
                                 { id: 'general', label: 'GENERAL', active: activeLeague.includeBaseFee },
                                 { id: 'match', label: 'PARTIDO', active: activeLeague.includeStageFees && activeLeague.stageFees.match.active },
                                 { id: 'round', label: 'RONDA', active: activeLeague.includeStageFees && activeLeague.stageFees.round.active },
                                 { id: 'phase', label: 'FASE', active: activeLeague.includeStageFees && activeLeague.stageFees.phase.active }
                               ] as const).filter(t => t.active).map(cat => (
                                 <button key={cat.id} onClick={() => setPrizeCategory(cat.id as StageType | 'general')} className={`flex-1 py-2.5 px-4 rounded-[1.8rem] font-black text-[9px] tracking-widest transition-all uppercase whitespace-nowrap ${prizeCategory === cat.id ? 'bg-white text-black shadow-md border border-slate-100' : 'text-slate-400 hover:bg-slate-50'}`}>{cat.label}</button>
                               ))}
                            </div>

                            <Card className="p-0 rounded-[2.5rem] shadow-none border border-lime-500 border-opacity-50 relative overflow-hidden flex flex-col flex-1 bg-white">
                               <div className="flex justify-between items-center p-6 bg-white">
                                  <div className="flex items-center gap-2">
                                    <PieChart size={18} className="text-lime-600" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">PUESTOS A PREMIAR</span>
                                  </div>
                                  <div className="flex items-center gap-4 bg-slate-50 p-1 px-4 rounded-xl border border-slate-200">
                                     <button onClick={() => updateWinnerCount(prizeCategory, currentDist.winnersCount - 1)} className="text-slate-400 hover:text-slate-900"><Minus size={16}/></button>
                                     <span className="text-2xl font-black font-brand text-slate-900 w-8 text-center">{currentDist.winnersCount}</span>
                                     <button onClick={() => updateWinnerCount(prizeCategory, currentDist.winnersCount + 1)} className="text-slate-400 hover:text-slate-900"><Plus size={16}/></button>
                                  </div>
                               </div>

                               {/* Linea Separadora */}
                               <div className="h-px bg-slate-100 mx-6"></div>
                               
                               <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-3 bg-white mb-20">
                                  {activeWinners.map((winner, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                       <span className="text-[10px] font-black text-slate-900 uppercase">{winner.label}</span>
                                       <div className="flex items-center gap-4 justify-end">
                                         {/* EDITABLE INPUT FOR PERCENTAGE */}
                                         <div className="relative w-16">
                                            <input 
                                                type="number" 
                                                value={winner.percentage} 
                                                onChange={(e) => handlePrizePercentageChange(prizeCategory, winner.position, e.target.value)}
                                                className="w-full text-right text-[10px] font-black text-slate-600 border-b border-slate-200 focus:border-lime-500 outline-none pr-3 bg-transparent"
                                            />
                                            <span className="absolute right-0 top-0 text-[10px] font-black text-slate-400">%</span>
                                         </div>
                                         <span className="text-sm font-black text-lime-600 w-24 text-right">${Math.round(calculateTotalGrossForCategory(prizeCategory) * (winner.percentage / 100)).toLocaleString()}</span>
                                       </div>
                                    </div>
                                  ))}
                               </div>
                               
                               {/* FOOTER TOTAL - DARK THEME WITH VALIDATION */}
                               <div className={`absolute bottom-0 left-0 right-0 px-6 py-5 flex justify-between items-center border-t z-20 rounded-b-[2.3rem] transition-colors ${isValidTotal ? 'bg-slate-900 border-white/10' : 'bg-rose-50 border-rose-200'}`}>
                                  <div className="space-y-1">
                                      <p className={`text-[7px] font-black uppercase tracking-widest ${isValidTotal ? 'text-lime-500' : 'text-rose-500'}`}>
                                          {isValidTotal ? 'FONDO NETO GENERAL' : 'TOTAL INVÁLIDO'}
                                      </p>
                                      <p className={`text-2xl font-black font-brand leading-none ${isValidTotal ? 'text-white' : 'text-rose-600'}`}>
                                          {isValidTotal ? `$${Math.round(calculateNetForCategory(prizeCategory)).toLocaleString()}` : `${totalAllocated.toFixed(1)}%`}
                                      </p>
                                  </div>
                                  <div className="text-right space-y-1">
                                      <p className={`text-[7px] font-black uppercase tracking-widest ${isValidTotal ? 'text-rose-400' : 'text-slate-400'}`}>ADMIN ({activeLeague.adminFeePercent}%)</p>
                                      <p className={`text-lg font-black font-brand leading-none ${isValidTotal ? 'text-white/80' : 'text-slate-500'}`}>${Math.round(calculateTotalGrossForCategory(prizeCategory) * (activeLeague.adminFeePercent / 100)).toLocaleString()}</p>
                                  </div>
                               </div>
                            </Card>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Cupos Manager */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-500">Cupos Máximos</span>
                                    <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-slate-200">
                                        <button onClick={() => updateQuota(false)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"><Minus size={14}/></button>
                                        <span className="text-sm font-black text-slate-900 w-6 text-center">{activeLeague.participants.max}</span>
                                        <button onClick={() => updateQuota(true)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"><Plus size={14}/></button>
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                                        <span>Ocupados: {participants.length}</span>
                                        <span>Límite Plan: {PLAN_LIMITS[activeLeague.plan]}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-300 ${activeLeague.participants.max > PLAN_LIMITS[activeLeague.plan] ? 'bg-rose-500' : 'bg-lime-500'}`} style={{ width: `${(participants.length / activeLeague.participants.max) * 100}%` }}></div>
                                    </div>
                                </div>

                                {activeLeague.participants.max > PLAN_LIMITS[activeLeague.plan] && (
                                    <div className="flex items-start gap-2 p-2 bg-rose-50 rounded-xl border border-rose-100">
                                        <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-rose-700 uppercase">Límite de Plan Excedido</p>
                                            <p className="text-[9px] text-rose-600 leading-tight">Tu plan actual solo permite {PLAN_LIMITS[activeLeague.plan]} jugadores. Debes mejorar tu plan para guardar esta configuración.</p>
                                            <Button size="sm" className="h-7 text-[8px] bg-rose-500 hover:bg-rose-600 text-white w-full mt-1" onClick={() => { setShowConfigModal(false); onViewChange('checkout'); }}>MEJORAR PLAN AHORA</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Invite Button for Admins */}
                            {activeLeague.role === 'admin' && (
                                <Button 
                                    variant="secondary" 
                                    className="w-full h-10 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-lime-400/20"
                                    onClick={() => { setShowConfigModal(false); setShowInviteModal(true); }}
                                >
                                    <UserPlus size={14} className="mr-2" /> Invitar Participantes
                                </Button>
                            )}

                            <div className="space-y-2 pt-2">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Lista de Jugadores</p>
                                {participants.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatar} className="w-8 h-8 rounded-lg" alt={user.name} />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-black text-slate-900 uppercase">{user.name}</p>
                                                    {user.role === 'admin' && <Crown size={10} className="text-amber-500 fill-amber-500" />}
                                                </div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${user.status === 'active' ? 'text-lime-600' : 'text-slate-400'}`}>
                                                    {user.status === 'active' ? 'ACTIVO' : 'PENDIENTE'}
                                                </p>
                                            </div>
                                        </div>
                                        {user.role !== 'admin' && (
                                            <button 
                                                onClick={() => handleRemoveParticipant(user.id)}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>

                 <div className="p-4 border-t border-slate-100 bg-white">
                    <Button 
                        className="w-full h-12 rounded-xl font-black uppercase text-xs" 
                        onClick={() => setShowConfigModal(false)}
                        disabled={(configTab === 'participants' && activeLeague.participants.max > PLAN_LIMITS[activeLeague.plan]) || (configTab === 'prizes' && !isValidTotal)}
                    >
                        {configTab === 'details' ? 'Guardar Cambios' : configTab === 'prizes' ? (isValidTotal ? 'Confirmar Premios' : 'Corregir Totales') : 'Cerrar'}
                    </Button>
                 </div>
             </Card>
          </div>
      )}

      {/* --- MODAL: INVITAR AVANZADO --- */}
      {showInviteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <Card className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center"><UserPlus size={20} /></div>
                        <div>
                           <h3 className="text-lg font-black font-brand uppercase tracking-tight text-slate-900">
                              {showShareCard ? 'Promocionar Liga' : inviteStep === 1 ? 'Agregar Amigos' : 'Personalizar Invitación'}
                           </h3>
                           {!showShareCard && <p className="text-xs text-slate-500 font-bold">{recipients.length} Invitados</p>}
                        </div>
                     </div>
                     <button onClick={() => {
                         if (showShareCard) {
                             setShowShareCard(false);
                         } else {
                             setShowInviteModal(false); 
                             setInviteStep(1); 
                             setRecipients([]);
                         }
                     }}>
                         {showShareCard ? <ArrowLeft size={20} className="text-slate-400 hover:text-black"/> : <X size={20} className="text-slate-400 hover:text-black"/>}
                     </button>
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {showShareCard ? (
                        <div className="flex flex-col items-center space-y-6 animate-in zoom-in duration-300">
                            
                            {/* Template Controls */}
                            <div className="flex items-center gap-2 w-full max-w-sm">
                                <div className="flex bg-slate-100 p-1 rounded-xl overflow-hidden flex-1">
                                    {(['neon', 'pro', 'stadium'] as CardStyle[]).map(style => (
                                        <button 
                                            key={style}
                                            onClick={() => { setCardStyle(style); setCardHeadline('TE HAN INVITADO A JUGAR'); }}
                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${cardStyle === style ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {style}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={handleGenerateAICard}
                                    disabled={isGeneratingCardAI}
                                    className="px-3 py-2 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-xl shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95 flex items-center gap-1 disabled:opacity-70"
                                >
                                    {isGeneratingCardAI ? <Bot size={14} className="animate-bounce" /> : <Wand2 size={14} />}
                                    <span className="text-[9px] font-black uppercase">IA Magic</span>
                                </button>
                            </div>

                            {/* SOCIAL CARD PREVIEW - DYNAMIC */}
                            <div 
                                className={`w-full max-w-sm rounded-[2rem] p-8 text-center relative overflow-hidden shadow-2xl transition-all duration-500 border
                                ${cardStyle === 'neon' ? 'bg-black text-white border-lime-500/30' : ''}
                                ${cardStyle === 'pro' ? 'bg-white text-slate-900 border-slate-200' : ''}
                                ${cardStyle === 'stadium' ? 'bg-slate-900 text-white border-white/20' : ''}
                                ${cardStyle === 'ai-generated' ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white border-indigo-500/30' : ''}
                                `}
                            >
                                {/* Background Effects */}
                                {cardStyle === 'neon' && (
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                                )}
                                {cardStyle === 'stadium' && (
                                    <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1522770179533-24471fcdba45?w=500&auto=format&fit=crop&q=60')] bg-cover bg-center"></div>
                                )}
                                {cardStyle === 'ai-generated' && (
                                    <div className="absolute inset-0 opacity-30">
                                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent"></div>
                                        <Sparkles className="absolute top-4 left-4 text-purple-400 opacity-50" size={40} />
                                        <Sparkles className="absolute bottom-10 right-4 text-cyan-400 opacity-50" size={24} />
                                    </div>
                                )}

                                <div className="relative z-10 flex flex-col items-center">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg 
                                        ${cardStyle === 'pro' ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}>
                                        <Trophy size={28} />
                                    </div>
                                    
                                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${cardStyle === 'pro' ? 'text-slate-400' : 'text-lime-400'}`}>
                                        {cardHeadline}
                                    </p>
                                    
                                    <h3 className="text-3xl font-black font-brand uppercase leading-none mb-6 tracking-tighter">
                                        {activeLeague.name}
                                    </h3>
                                    
                                    {/* Promotional Stats Grid - REDESIGNED */}
                                    <div className={`grid grid-cols-2 gap-3 w-full mb-4 ${cardStyle === 'pro' ? 'text-slate-700' : 'text-white'}`}>
                                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center border ${cardStyle === 'pro' ? 'bg-slate-50 border-slate-100' : 'bg-white/10 border-white/10 backdrop-blur-sm'}`}>
                                            <Wallet size={16} className={`mb-1 ${cardStyle === 'pro' ? 'text-lime-600' : 'text-lime-400'}`} />
                                            <span className={`text-[7px] font-black uppercase tracking-widest ${cardStyle === 'pro' ? 'text-slate-400' : 'text-slate-300'}`}>ENTRADA</span>
                                            <span className="text-sm font-black font-brand">COP $50k</span>
                                        </div>
                                        <div className={`p-3 rounded-xl flex flex-col items-center justify-center border ${cardStyle === 'pro' ? 'bg-slate-50 border-slate-100' : 'bg-white/10 border-white/10 backdrop-blur-sm'}`}>
                                            <Users size={16} className={`mb-1 ${cardStyle === 'pro' ? 'text-purple-600' : 'text-purple-400'}`} />
                                            <span className={`text-[7px] font-black uppercase tracking-widest ${cardStyle === 'pro' ? 'text-slate-400' : 'text-slate-300'}`}>JUGADORES</span>
                                            <span className="text-sm font-black font-brand">{activeLeague.participants.current} / {activeLeague.participants.max}</span>
                                        </div>
                                    </div>

                                    {/* Prizes List - NEW SECTION */}
                                    <div className="w-full mb-6 space-y-2">
                                        <p className={`text-[8px] font-black uppercase tracking-widest text-center mb-2 ${cardStyle === 'pro' ? 'text-slate-400' : 'text-slate-400'}`}>PREMIOS ACTIVOS</p>
                                        {[
                                            { label: '1er Puesto', amount: '$648.000' },
                                            { label: '2do Puesto', amount: '$324.000' },
                                            { label: '3er Puesto', amount: '$108.000' }
                                        ].map((prize, i) => (
                                            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${cardStyle === 'pro' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10'}`}>
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 size={10} className={cardStyle === 'pro' ? 'text-lime-500' : 'text-lime-400'} />
                                                    <span className={`text-[9px] font-bold uppercase ${cardStyle === 'pro' ? 'text-slate-600' : 'text-slate-200'}`}>{prize.label}</span>
                                                </div>
                                                <span className={`text-[9px] font-black ${cardStyle === 'pro' ? 'text-slate-900' : 'text-white'}`}>{prize.amount}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-white p-2 rounded-xl mb-4 shadow-sm">
                                        <QrCode size={100} className="text-black" />
                                    </div>
                                    
                                    <div className={`px-4 py-2 rounded-lg backdrop-blur-sm border ${cardStyle === 'pro' ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/10'}`}>
                                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${cardStyle === 'pro' ? 'text-slate-400' : 'text-slate-300'}`}>CÓDIGO DE ACCESO</p>
                                        <p className="text-xl font-mono font-bold tracking-widest">{activeLeague.code}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                                <Button variant="secondary" className="rounded-xl font-black uppercase text-xs h-12 shadow-lg" onClick={() => alert('Imagen descargada (Simulación)')}>
                                    <Download size={16} className="mr-2" /> Descargar
                                </Button>
                                <Button variant="outline" className="rounded-xl font-black uppercase text-xs h-12 border-slate-200" onClick={() => alert('Copiado al portapapeles')}>
                                    <Copy size={16} className="mr-2" /> Copiar
                                </Button>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Comparte esta tarjeta en tus historias o grupos</p>
                        </div>
                    ) : inviteStep === 1 ? (
                        <div className="space-y-6">
                           {/* Quick Share Top Block */}
                           <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex justify-between items-center">
                               <div>
                                  <p className="text-[10px] font-black uppercase text-lime-400 tracking-widest mb-1">ACCESO RÁPIDO</p>
                                  <div className="flex items-center gap-2">
                                     <p className="text-xl font-black font-brand tracking-widest">{activeLeague.code || 'CRACKS-2026'}</p>
                                     <button onClick={() => copyToClipboard(activeLeague.code || 'CRACKS-2026')} className="text-slate-400 hover:text-white"><Copy size={16}/></button>
                                  </div>
                               </div>
                               <div className="flex gap-2">
                                  <button onClick={() => setShowShareCard(true)} className="w-10 h-10 rounded-xl bg-lime-400 text-black flex items-center justify-center hover:bg-lime-500 transition-all shadow-lg shadow-lime-400/20" title="Generar Tarjeta"><ImageIcon size={18} /></button>
                                  <button onClick={() => {navigator.clipboard.writeText(`https://polla2026.com/join/${activeLeague.code}`); alert('Link copiado');}} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><Share2 size={18} /></button>
                                  <button onClick={() => onViewChange('join-league')} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all" title="Ver Landing"><Eye size={18} /></button>
                               </div>
                           </div>

                           <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AGREGAR MANUALMENTE</p>
                                
                                {/* Mode Switcher */}
                                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                    <button 
                                        onClick={() => setInviteMode('single')}
                                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all flex items-center gap-1 ${inviteMode === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                                    >
                                        <UserPlus size={10} /> Uno a Uno
                                    </button>
                                    <button 
                                        onClick={() => setInviteMode('bulk')}
                                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all flex items-center gap-1 ${inviteMode === 'bulk' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                                    >
                                        <List size={10} /> Lista Rápida
                                    </button>
                                </div>
                              </div>
                              
                              {inviteMode === 'single' ? (
                                  <div className="space-y-3 animate-in fade-in slide-in-from-right-2">
                                      {/* NEW: Contact Type Toggle */}
                                      <div className="bg-slate-50 p-1 rounded-xl flex gap-1 mb-1">
                                          <button 
                                              onClick={() => { setContactType('phone'); setNewRecipient({...newRecipient, contact: ''}); }}
                                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${contactType === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                          >
                                              <Smartphone size={14} /> Celular
                                          </button>
                                          <button 
                                              onClick={() => { setContactType('email'); setNewRecipient({...newRecipient, contact: ''}); }}
                                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${contactType === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                          >
                                              <Mail size={14} /> Correo
                                          </button>
                                      </div>

                                      <div className="flex flex-col gap-3">
                                         <Input 
                                            placeholder="Nombre del Amigo *" 
                                            className="text-xs h-11 font-bold" 
                                            value={newRecipient.name}
                                            onChange={(e) => setNewRecipient({...newRecipient, name: e.target.value})}
                                            onKeyDown={handleInputKeyDown}
                                            leftIcon={<User size={14} />}
                                         />
                                         
                                         {contactType === 'phone' ? (
                                             <Input 
                                                placeholder="Número de Celular" 
                                                className="text-xs h-11" 
                                                value={newRecipient.contact}
                                                onChange={(e) => setNewRecipient({...newRecipient, contact: e.target.value})}
                                                leftIcon={<Smartphone size={14}/>}
                                                onKeyDown={handleInputKeyDown}
                                                type="tel"
                                             />
                                         ) : (
                                             <Input 
                                                placeholder="Correo Electrónico" 
                                                className="text-xs h-11" 
                                                value={newRecipient.contact}
                                                onChange={(e) => setNewRecipient({...newRecipient, contact: e.target.value})}
                                                leftIcon={<Mail size={14}/>}
                                                onKeyDown={handleInputKeyDown}
                                                type="email"
                                             />
                                         )}
                                         
                                         <Button 
                                            variant="secondary" 
                                            className="h-11 w-full rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md" 
                                            onClick={addRecipient}
                                            disabled={!newRecipient.name || !newRecipient.contact}
                                         >
                                            <Plus size={14} className="mr-2"/> AGREGAR A LA LISTA
                                         </Button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="space-y-3 animate-in fade-in slide-in-from-right-2">
                                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                          <textarea 
                                              className="w-full h-24 bg-transparent outline-none text-xs font-mono resize-none placeholder:text-slate-400"
                                              placeholder={`Formatos soportados:\nJuan Perez, 3001234567\nMaria <maria@email.com>; Pedro <pedro@email.com>\npepe@gmail.com`}
                                              value={bulkText}
                                              onChange={(e) => setBulkText(e.target.value)}
                                          />
                                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                                              <p className="text-[9px] text-slate-400 font-medium">Soporta Excel, CSV y listas de Outlook (;)</p>
                                              <Button 
                                                  variant="secondary" 
                                                  size="sm" 
                                                  className="h-8 text-[9px] font-black uppercase tracking-widest"
                                                  onClick={handleBulkProcess}
                                                  isLoading={isProcessingBulk}
                                                  disabled={!bulkText.trim()}
                                              >
                                                  PROCESAR Y AGREGAR
                                              </Button>
                                          </div>
                                      </div>
                                  </div>
                              )}
                           </div>

                           {recipients.length > 0 && (
                               <div className="space-y-2 pt-2 border-t border-slate-100">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">LISTA DE INVITADOS ({recipients.length})</p>
                                  {recipients.map(recipient => (
                                      <div key={recipient.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-2xl bg-white animate-in slide-in-from-top-2">
                                          <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                  {recipient.name.charAt(0)}
                                              </div>
                                              <div>
                                                  <p className="text-xs font-black text-slate-900 uppercase">{recipient.name}</p>
                                                  <div className="flex flex-wrap gap-2">
                                                      <p className="text-[9px] font-medium text-slate-400 flex items-center gap-1">{recipient.contact}</p>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="flex gap-2">
                                              <button 
                                                onClick={() => toggleRecipientChannel(recipient.id, 'whatsapp')}
                                                disabled={recipient.type === 'email'}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${recipient.selectedChannels.includes('whatsapp') ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-slate-50 text-slate-300'} ${recipient.type === 'email' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                              ><MessageCircle size={14}/></button>
                                              <button 
                                                onClick={() => toggleRecipientChannel(recipient.id, 'email')}
                                                disabled={recipient.type === 'phone'}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${recipient.selectedChannels.includes('email') ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'bg-slate-50 text-slate-300'} ${recipient.type === 'phone' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                              ><Mail size={14}/></button>
                                              
                                              {/* NEW: PUSH CHANNEL BUTTON */}
                                              <button 
                                                onClick={() => toggleRecipientChannel(recipient.id, 'push')}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${recipient.selectedChannels.includes('push') ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-slate-50 text-slate-300'} hover:bg-slate-100`}
                                                title="Notificación Push"
                                              ><Bell size={14}/></button>

                                              <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                              
                                              <button onClick={() => setRecipients(recipients.filter(r => r.id !== recipient.id))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                          </div>
                                      </div>
                                  ))}
                               </div>
                           )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Templates Quick Actions */}
                            <div className="flex justify-between items-end mb-2">
                                <div className="space-y-2 flex-1 mr-4">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANTILLAS</span>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {(['friendly', 'challenger', 'formal'] as const).map(tKey => {
                                            const isActive = selectedTemplate[activeTab] === tKey;
                                            return (
                                                <button 
                                                    key={tKey}
                                                    onClick={() => applyTemplate(tKey)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                >
                                                    {INVITE_TEMPLATES[tKey].label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={generateAIMessage}
                                    disabled={isGeneratingAI}
                                    className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
                                >
                                    {isGeneratingAI ? <Bot size={16} className="animate-bounce" /> : <Sparkles size={16} />}
                                    <span className="text-[9px] font-black uppercase tracking-widest">{isGeneratingAI ? '...' : 'IA Magic'}</span>
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
                                        value={messageDrafts[activeTab]}
                                        onChange={(e) => {
                                            setMessageDrafts({...messageDrafts, [activeTab]: e.target.value});
                                            if (selectedTemplate[activeTab] !== 'custom') setSelectedTemplate(prev => ({ ...prev, [activeTab]: 'custom' }));
                                        }}
                                    />
                                    {selectedTemplate[activeTab] === 'ai' && (
                                        <div className="absolute top-2 right-2 pointer-events-none opacity-10"><Sparkles size={80} className="text-purple-500" /></div>
                                    )}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                                        <span className="text-[10px] font-black text-slate-400 uppercase mr-1">Variables:</span>
                                        {['nombre', 'link', 'liga'].map(v => (
                                            <button key={v} onClick={() => insertVariable(v)} className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition-colors">{`{${v}}`}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                 </div>

                 {!showShareCard && (
                     <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                         {inviteStep === 2 && (
                             <Button variant="outline" onClick={() => setInviteStep(1)} className="w-14 rounded-xl border-slate-200 text-slate-500">
                                 <ArrowLeft size={18} />
                             </Button>
                         )}
                         <Button 
                            variant="secondary" 
                            onClick={() => inviteStep === 1 ? setInviteStep(2) : handleSendInvites()} 
                            disabled={inviteStep === 1 && recipients.length === 0}
                            className="flex-1 h-12 rounded-xl font-black text-xs uppercase shadow-xl"
                         >
                             {inviteStep === 1 ? 'PERSONALIZAR MENSAJE' : 'ENVIAR INVITACIONES'} <Send size={16} className="ml-2" />
                         </Button>
                     </div>
                 )}
             </Card>
          </div>
      )}

      {/* HEADER WITH CONTEXT SWITCHER */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 relative">
            <div className="flex items-center gap-3">
              {renderRoleBadge()}
              
              <button 
                 onClick={toggleRole}
                 className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors text-[9px] font-bold text-slate-500 uppercase tracking-widest"
                 title="Simular vista de otro rol"
              >
                 <RefreshCcw size={10} />
                 <span>{activeLeague.role === 'admin' ? 'Ver como Jugador' : 'Ver como Admin'}</span>
              </button>

              <Badge color={activeLeague.plan === 'diamond' ? 'bg-cyan-100 text-cyan-700' : activeLeague.plan === 'gold' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                 PLAN {activeLeague.plan.toUpperCase()}
              </Badge>
            </div>
            
            {/* LEAGUE SELECTOR */}
            <div className="relative group">
                <button 
                  onClick={() => setIsLeagueMenuOpen(!isLeagueMenuOpen)}
                  className="flex items-center gap-3 text-3xl md:text-5xl font-black font-brand uppercase tracking-tighter leading-tight text-slate-900 hover:text-lime-600 transition-colors text-left"
                >
                  {activeLeague.name}
                  <ChevronDown size={32} className={`transition-transform duration-300 text-slate-300 group-hover:text-lime-400 ${isLeagueMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* DROPDOWN MENU */}
                {isLeagueMenuOpen && (
                  <div className="absolute top-full left-0 mt-4 w-full md:w-96 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tus Ligas Activas</span>
                          <span className="text-[10px] font-bold text-lime-600 bg-lime-50 px-2 py-1 rounded-lg cursor-pointer hover:bg-lime-100" onClick={() => onViewChange('create-league')}>+ NUEVA</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {MY_LEAGUES.map(league => (
                           <button 
                             key={league.id}
                             onClick={() => handleLeagueSwitch(league)}
                             className={`w-full text-left p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${activeLeague.id === league.id ? 'bg-lime-50/50' : ''}`}
                           >
                              <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${league.role === 'admin' ? 'bg-slate-900' : 'bg-blue-500'}`}>
                                    {league.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                                 </div>
                                 <div>
                                    <p className={`text-sm font-black uppercase ${activeLeague.id === league.id ? 'text-lime-700' : 'text-slate-900'}`}>{league.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{league.role === 'admin' ? 'Administrando' : `Puesto #${league.stats.rank || '-'}`}</p>
                                 </div>
                              </div>
                              {activeLeague.id === league.id && <CheckCircle2 size={18} className="text-lime-500" />}
                           </button>
                        ))}
                      </div>
                  </div>
                )}
            </div>
            {/* Backdrop for menu */}
            {isLeagueMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsLeagueMenuOpen(false)}></div>}

          </div>
          
          {/* Top Actions based on Role */}
          <div className="flex gap-3 pt-2">
            {activeLeague.role === 'admin' ? (
                <>
                  <Button variant="outline" className="rounded-2xl border-slate-200 group text-slate-900 font-bold hover:bg-slate-100" onClick={() => setShowInviteModal(true)}>
                    <Share2 size={18} className="mr-2 group-hover:text-lime-600" /> INVITAR
                  </Button>
                  <Button variant="secondary" className="rounded-2xl font-black px-6 shadow-lg shadow-lime-400/20" onClick={() => setShowConfigModal(true)}>
                    <Settings size={18} className="mr-2" /> CONFIGURAR
                  </Button>
                </>
            ) : (
                <Button variant="secondary" className="rounded-2xl font-black px-8 shadow-lg shadow-lime-400/20 h-12 text-sm">
                   PRONOSTICAR <Zap size={18} className="ml-2" />
                </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: PRIMARY STATS (Dynamic based on Role) */}
        {activeLeague.role === 'admin' ? renderAdminStats() : renderUserStats()}

        {/* MIDDLE COLUMN: LEAGUE INFO (Shared) */}
        <div className="space-y-8">
          <Card className="p-8 space-y-6 bg-slate-50 border-slate-200 shadow-none">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Reglas de Puntos</h3>
                <ListChecks size={14} className="text-slate-400" />
             </div>
             <div className="grid grid-cols-1 gap-3">
                {[
                  { label: 'Marcador Exacto', val: '5', color: 'text-lime-600', icon: Target },
                  { label: 'Ganador Acertado', val: '2', color: 'text-slate-700', icon: CheckCircle2 },
                  { label: 'Gol Acertado', val: '1', color: 'text-slate-500', icon: Zap },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-lime-400 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 ${rule.color}`}><rule.icon size={16} /></div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">{rule.label}</span>
                    </div>
                    <span className={`text-sm font-black ${rule.color}`}>{rule.val}</span>
                  </div>
                ))}
             </div>
          </Card>

          <Card className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Premios</h3>
              <Badge color="bg-slate-100 text-slate-600 font-bold">Bolsa: {activeLeague.stats.totalPrize}</Badge>
            </div>
            <div className="space-y-5">
               {[
                 { label: '1er Puesto', perc: '60%', amount: '$648.000', width: '60%' },
                 { label: '2do Puesto', perc: '30%', amount: '$324.000', width: '30%' },
                 { label: '3er Puesto', perc: '10%', amount: '$108.000', width: '10%' },
               ].map((dist, i) => (
                 <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-900">
                      <span>{dist.label} ({dist.perc})</span>
                      <span className="text-lime-600">{dist.amount}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div 
                        className="h-full bg-lime-400 rounded-full shadow-sm" 
                        style={{ width: dist.width }}
                       ></div>
                    </div>
                 </div>
               ))}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: MATCHES & RANKING */}
        <div className="space-y-8">
           
           {/* RANKING CARD */}
           <Card className="p-8 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2">
              <Trophy size={14} className="text-lime-500" /> Top Actual
            </h3>
            <div className="space-y-4">
              {[
                { pos: '1º', name: 'Luis Morales', pts: '85 pts', prize: '$648k', color: 'bg-yellow-400' },
                { pos: '2º', name: 'Leo Castiblanco', pts: '78 pts', prize: '$324k', color: 'bg-slate-200' },
                { pos: '3º', name: 'Nubia Sarmiento', pts: '72 pts', prize: '$108k', color: 'bg-orange-100 text-orange-600' },
              ].map((win, i) => (
                <div key={i} className="flex items-center gap-4 group cursor-pointer hover:translate-x-1 transition-transform p-2 rounded-xl hover:bg-slate-50">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${win.color} text-black shadow-sm`}>
                    {win.pos}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase text-slate-900 leading-tight">{win.name}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{win.pts}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-lime-600">{win.prize}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 h-8">Ver Ranking Completo <ArrowUpRight size={12} className="ml-1"/></Button>
          </Card>

           {/* MATCHES */}
           <div className="space-y-6">
             <div className="flex justify-between items-center">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Próximos Partidos</h3>
               <Clock size={14} className="text-slate-400" />
             </div>
             
             {matches.map((match) => (
               <Card key={match.id} className={`group hover:border-lime-400 transition-all duration-500 overflow-hidden relative border-slate-200 ${match.status === 'saved' ? 'border-lime-400 shadow-md' : ''}`}>
                  <div className="flex justify-between items-center mb-6">
                     <Badge color="bg-slate-100 text-slate-500 uppercase tracking-widest font-black text-[9px]">{match.date}</Badge>
                     {match.status === 'saved' ? (
                       <div className="flex items-center gap-1.5 bg-lime-100 px-2 py-1 rounded-lg">
                          <CheckCircle2 size={12} className="text-lime-600" />
                          <span className="text-[9px] font-black text-lime-700 uppercase tracking-widest">GUARDADO</span>
                       </div>
                     ) : (
                       <span className="text-[9px] font-black text-lime-600 uppercase tracking-widest animate-pulse">ACTIVO</span>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                     <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-3xl block group-hover:scale-110 transition-transform filter drop-shadow-sm">{match.homeFlag}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest block text-slate-900 leading-tight">{match.homeTeam}</span>
                     </div>
                     
                     <div className="flex items-center gap-2">
                        {activeLeague.role === 'admin' ? (
                            <span className="text-xs font-black bg-slate-100 px-3 py-1 rounded-lg text-slate-400">VS</span>
                        ) : (
                          <>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0" 
                              value={match.userPrediction.home}
                              onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                              className="w-10 h-10 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none text-slate-900 placeholder:text-slate-300 transition-all" 
                            />
                            <span className="text-slate-300 font-bold">-</span>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0" 
                              value={match.userPrediction.away}
                              onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                              className="w-10 h-10 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none text-slate-900 placeholder:text-slate-300 transition-all" 
                            />
                          </>
                        )}
                     </div>
                     
                     <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-3xl block group-hover:scale-110 transition-transform filter drop-shadow-sm">{match.awayFlag}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest block text-slate-900 leading-tight">{match.awayTeam}</span>
                     </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                     {activeLeague.role === 'admin' ? (
                       <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
                          Gestionar Resultado <Settings size={12} />
                       </button>
                     ) : (
                       <button 
                         onClick={() => handleSavePrediction(match.id)}
                         disabled={match.status === 'saved' && (match.userPrediction.home === '' || match.userPrediction.away === '')}
                         className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-colors ${match.status === 'saved' ? 'text-lime-600 hover:text-lime-700' : 'text-slate-400 hover:text-lime-600'}`}
                       >
                          {match.status === 'saved' ? (
                             <>Modificar <Pencil size={12} /></>
                          ) : (
                             <>Guardar <CheckCircle2 size={12} /></>
                          )}
                       </button>
                     )}
                  </div>
               </Card>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
