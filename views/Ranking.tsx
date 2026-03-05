
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Star, TrendingUp, TrendingDown, Minus, Search, Filter, ArrowUpRight, Crown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RankingUser {
    id: string;
    rank: number;
    name: string;
    username: string;
    points: number;
    avatar: string;
    trend: 'up' | 'down' | 'stable';
    matchesPredicted: number;
    successRate: number;
}

const mockRanking: RankingUser[] = [
    { id: '1', rank: 1, name: 'Andrés Mendoza', username: '@amendoza_gol', points: 450, avatar: 'https://picsum.photos/seed/user1/100/100', trend: 'stable', matchesPredicted: 48, successRate: 85 },
    { id: '2', rank: 2, name: 'Sofía Rodríguez', username: '@sofia_predice', points: 435, avatar: 'https://picsum.photos/seed/user2/100/100', trend: 'up', matchesPredicted: 48, successRate: 82 },
    { id: '3', rank: 3, name: 'Carlos Ruiz', username: '@cruiz_crack', points: 420, avatar: 'https://picsum.photos/seed/user3/100/100', trend: 'down', matchesPredicted: 48, successRate: 79 },
    { id: '4', rank: 4, name: 'Valentina López', username: '@val_futbol', points: 410, avatar: 'https://picsum.photos/seed/user4/100/100', trend: 'up', matchesPredicted: 48, successRate: 77 },
    { id: '5', rank: 5, name: 'Diego Torres', username: '@dtorres_stats', points: 395, avatar: 'https://picsum.photos/seed/user5/100/100', trend: 'stable', matchesPredicted: 48, successRate: 75 },
    { id: '6', rank: 6, name: 'Mariana Silva', username: '@mari_gol', points: 380, avatar: 'https://picsum.photos/seed/user6/100/100', trend: 'down', matchesPredicted: 48, successRate: 72 },
    { id: '7', rank: 7, name: 'Javier Ortiz', username: '@javi_polla', points: 375, avatar: 'https://picsum.photos/seed/user7/100/100', trend: 'up', matchesPredicted: 48, successRate: 71 },
    { id: '8', rank: 8, name: 'Lucía Gómez', username: '@lucia_pro', points: 360, avatar: 'https://picsum.photos/seed/user8/100/100', trend: 'stable', matchesPredicted: 48, successRate: 68 },
    { id: '9', rank: 9, name: 'Fernando Paz', username: '@fer_mundial', points: 355, avatar: 'https://picsum.photos/seed/user9/100/100', trend: 'down', matchesPredicted: 48, successRate: 67 },
    { id: '10', rank: 10, name: 'Camila Herrera', username: '@cami_fan', points: 340, avatar: 'https://picsum.photos/seed/user10/100/100', trend: 'up', matchesPredicted: 48, successRate: 64 },
];

const Ranking: React.FC<{ onViewChange: (view: any) => void }> = ({ onViewChange }) => {
    const [activeTab, setActiveTab] = useState<'global' | 'friends' | 'league'>('global');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRanking = mockRanking.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const top3 = filteredRanking.slice(0, 3);
    const rest = filteredRanking.slice(3);

    const renderTrend = (trend: RankingUser['trend']) => {
        switch (trend) {
            case 'up': return <TrendingUp className="w-4 h-4 text-lime-500" />;
            case 'down': return <TrendingDown className="w-4 h-4 text-rose-500" />;
            default: return <Minus className="w-4 h-4 text-slate-300" />;
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black font-brand uppercase tracking-tighter text-slate-900 leading-none mb-2">
                        Ranking de Líderes
                    </h1>
                    <p className="text-slate-500 font-medium">Compite por el primer lugar y demuestra tus conocimientos.</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                    {(['global', 'friends', 'league'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                activeTab === tab
                                    ? "bg-lime-400 text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {tab === 'global' ? 'Global' : tab === 'friends' ? 'Amigos' : 'Mi Liga'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Podium Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8">
                {/* Second Place */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="order-2 md:order-1"
                >
                    <div className="bg-white rounded-[2.5rem] p-8 text-center shadow-sm border border-slate-100 relative overflow-hidden group hover:border-lime-200 transition-colors">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-200" />
                        <div className="relative inline-block mb-4">
                            <img src={top3[1]?.avatar} className="w-24 h-24 rounded-full ring-4 ring-slate-50 shadow-xl mx-auto object-cover" alt="2nd" />
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm">
                                <Medal className="w-5 h-5 text-slate-400" />
                            </div>
                        </div>
                        <h3 className="font-black text-xl text-slate-900 truncate">{top3[1]?.name}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{top3[1]?.username}</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-black text-slate-900">{top3[1]?.points}</span>
                            <span className="text-xs font-black text-slate-400 uppercase">pts</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                            <span>#{top3[1]?.rank} LUGAR</span>
                            <span className="flex items-center gap-1 text-lime-500">
                                <ArrowUpRight className="w-3 h-3" /> +12 PTS
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* First Place */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="order-1 md:order-2"
                >
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-2 bg-lime-400" />
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-lime-400/10 rounded-full blur-3xl group-hover:bg-lime-400/20 transition-all" />

                        <div className="relative inline-block mb-6">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                                <motion.div
                                    animate={{ y: [0, -5, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                >
                                    <Crown className="w-10 h-10 text-lime-400 fill-lime-400" />
                                </motion.div>
                            </div>
                            <img src={top3[0]?.avatar} className="w-32 h-32 rounded-full ring-4 ring-lime-400/30 shadow-2xl mx-auto object-cover" alt="1st" />
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-lime-400 rounded-2xl flex items-center justify-center border-4 border-slate-900 shadow-lg">
                                <Trophy className="w-6 h-6 text-slate-900" />
                            </div>
                        </div>

                        <h3 className="font-black text-2xl text-white truncate">{top3[0]?.name}</h3>
                        <p className="text-xs font-bold text-lime-400/60 uppercase tracking-widest mb-6">{top3[0]?.username}</p>

                        <div className="flex items-center justify-center gap-3 mb-6">
                            <span className="text-5xl font-black text-white">{top3[0]?.points}</span>
                            <div className="text-left">
                                <p className="text-xs font-black text-lime-400 uppercase leading-none">PUNTOS</p>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">LÍDER ACTUAL</p>
                            </div>
                        </div>

                        <button className="w-full py-4 bg-lime-400 hover:bg-lime-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                            Ver Perfil
                        </button>
                    </div>
                </motion.div>

                {/* Third Place */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="order-3"
                >
                    <div className="bg-white rounded-[2.5rem] p-8 text-center shadow-sm border border-slate-100 relative overflow-hidden group hover:border-orange-200 transition-colors">
                        <div className="absolute top-0 left-0 w-full h-1 bg-orange-200" />
                        <div className="relative inline-block mb-4">
                            <img src={top3[2]?.avatar} className="w-24 h-24 rounded-full ring-4 ring-slate-50 shadow-xl mx-auto object-cover" alt="3rd" />
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm">
                                <Medal className="w-5 h-5 text-orange-400" />
                            </div>
                        </div>
                        <h3 className="font-black text-xl text-slate-900 truncate">{top3[2]?.name}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{top3[2]?.username}</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-black text-slate-900">{top3[2]?.points}</span>
                            <span className="text-xs font-black text-slate-400 uppercase">pts</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                            <span>#{top3[2]?.rank} LUGAR</span>
                            <span className="flex items-center gap-1 text-rose-500">
                                <TrendingDown className="w-3 h-3" /> -5 PTS
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o usuario..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-3xl py-5 pl-14 pr-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400/20 transition-all shadow-sm"
                    />
                </div>
                <button className="bg-white border border-slate-100 p-5 rounded-3xl text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                    <Filter className="w-5 h-5" />
                </button>
            </div>

            {/* Ranking List */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-6 border-b border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="col-span-1 text-center">Pos</div>
                    <div className="col-span-5 md:col-span-6">Usuario</div>
                    <div className="col-span-3 md:col-span-2 text-center">Efectividad</div>
                    <div className="col-span-3 md:col-span-3 text-right">Puntos</div>
                </div>

                <div className="divide-y divide-slate-50">
                    <AnimatePresence mode="popLayout">
                        {rest.map((user, index) => (
                            <motion.div
                                key={user.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.05 }}
                                className="grid grid-cols-12 gap-4 p-6 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                            >
                                <div className="col-span-1 flex flex-col items-center gap-1">
                                    <span className="text-lg font-black text-slate-300 group-hover:text-slate-900 transition-colors">
                                        #{user.rank}
                                    </span>
                                    {renderTrend(user.trend)}
                                </div>

                                <div className="col-span-5 md:col-span-6 flex items-center gap-4">
                                    <div className="relative">
                                        <img src={user.avatar} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white shadow-sm" alt={user.name} />
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-lime-400 rounded-full border-2 border-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black text-slate-900 truncate">{user.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{user.username}</p>
                                    </div>
                                </div>

                                <div className="col-span-3 md:col-span-2 text-center">
                                    <div className="inline-flex flex-col items-center">
                                        <span className="text-sm font-black text-slate-900">{user.successRate}%</span>
                                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                                            <div
                                                className="h-full bg-lime-400 rounded-full"
                                                style={{ width: `${user.successRate}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-3 md:col-span-3 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xl font-black text-lime-600 leading-none">{user.points}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Puntos</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {rest.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                            <Search className="w-8 h-8 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No se encontraron resultados</h3>
                        <p className="text-slate-400 font-medium">Intenta con otro nombre de usuario o ajusta los filtros.</p>
                    </div>
                )}
            </div>

            {/* User's Current Position Sticky (Optional but cool) */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-40"
            >
                <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl border border-white/10 flex items-center justify-between backdrop-blur-xl bg-opacity-90">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-lime-400 rounded-2xl flex items-center justify-center">
                            <span className="text-slate-900 font-black text-lg">#42</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Tu Posición Actual</p>
                            <p className="font-black text-white">Administrador <span className="text-lime-400">(Tú)</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden sm:block text-right">
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Predicciones</p>
                            <p className="font-black text-white">32 / 48</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Puntos</p>
                            <p className="text-2xl font-black text-lime-400">215</p>
                        </div>
                        <button
                            onClick={() => onViewChange('predictions')}
                            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-colors"
                        >
                            <Medal className="w-5 h-5 text-lime-400" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Ranking;
