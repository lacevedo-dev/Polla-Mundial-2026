import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FlaskConical, Users, Trophy, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';

interface CreateTestLeaguesModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface CreateResult {
    created: number;
    totalMembers: number;
    totalTournamentsLinked: number;
    totalMatchesActivated: number;
    leagues: Array<{
        id: string;
        name: string;
        code: string;
        members: number;
        tournaments: number;
        matches: number;
    }>;
    tournamentsAvailable: Array<{
        id: string;
        name: string;
        matches: number;
    }>;
}

export function CreateTestLeaguesModal({ open, onClose, onSuccess }: CreateTestLeaguesModalProps) {
    const [step, setStep] = useState<'form' | 'creating' | 'success' | 'error'>('form');
    const [count, setCount] = useState('5');
    const [membersPerLeague, setMembersPerLeague] = useState('10');
    const [useExistingUsers, setUseExistingUsers] = useState(false);
    const [result, setResult] = useState<CreateResult | null>(null);
    const [error, setError] = useState('');

    const handleClose = () => {
        if (step === 'creating') return;
        setStep('form');
        setCount('5');
        setMembersPerLeague('10');
        setUseExistingUsers(false);
        setResult(null);
        setError('');
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const countNum = parseInt(count);
        const membersNum = parseInt(membersPerLeague);

        if (isNaN(countNum) || countNum < 1 || countNum > 50) {
            setError('El número de pollas debe estar entre 1 y 50');
            return;
        }

        if (isNaN(membersNum) || membersNum < 2 || membersNum > 100) {
            setError('El número de miembros debe estar entre 2 y 100');
            return;
        }

        setStep('creating');
        setError('');

        try {
            const response = await fetch('/api/admin/leagues/bulk-create-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    count: countNum,
                    membersPerLeague: membersNum,
                    useExistingUsers,
                    namePrefix: 'Polla Test',
                    linkTournaments: true,
                    activateMatches: true,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }

            const data: CreateResult = await response.json();
            setResult(data);
            setStep('success');
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'No se pudieron crear las pollas de prueba');
            setStep('error');
        }
    };

    const handleRetry = () => {
        setStep('form');
        setError('');
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="w-full max-w-2xl px-5 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-6">
                <AnimatePresence mode="wait">
                    {step === 'form' && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <DialogHeader className="min-w-0 flex-1">
                                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
                                        <FlaskConical className="h-5 w-5" />
                                    </div>
                                    <DialogTitle>Crear pollas de prueba</DialogTitle>
                                    <DialogDescription>
                                        Genera pollas con usuarios, torneos y partidos para pruebas de estrés
                                    </DialogDescription>
                                </DialogHeader>
                                <button
                                    onClick={handleClose}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                                    aria-label="Cerrar diálogo"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="count" className="block text-sm font-semibold text-slate-900 mb-2">
                                            Número de pollas
                                        </label>
                                        <input
                                            id="count"
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={count}
                                            onChange={(e) => setCount(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                            placeholder="Ej: 5"
                                            required
                                        />
                                        <p className="mt-1.5 text-xs text-slate-500">Máximo 50 pollas por operación</p>
                                    </div>

                                    <div>
                                        <label htmlFor="members" className="block text-sm font-semibold text-slate-900 mb-2">
                                            Miembros por polla
                                        </label>
                                        <input
                                            id="members"
                                            type="number"
                                            min="2"
                                            max="100"
                                            value={membersPerLeague}
                                            onChange={(e) => setMembersPerLeague(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                            placeholder="Ej: 10"
                                            required
                                        />
                                        <p className="mt-1.5 text-xs text-slate-500">Máximo 100 miembros por polla</p>
                                    </div>

                                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                        <input
                                            id="useExisting"
                                            type="checkbox"
                                            checked={useExistingUsers}
                                            onChange={(e) => setUseExistingUsers(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-lime-600 focus:ring-2 focus:ring-lime-400/20 focus:ring-offset-0"
                                        />
                                        <label htmlFor="useExisting" className="flex-1 cursor-pointer">
                                            <div className="text-sm font-medium text-slate-900">Usar usuarios existentes</div>
                                            <div className="mt-0.5 text-xs text-slate-500">
                                                Si está desactivado, se crearán usuarios de prueba nuevos
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                                        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                                        <div className="flex-1 text-sm text-red-900">{error}</div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                                    >
                                        Crear pollas
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {step === 'creating' && (
                        <motion.div
                            key="creating"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="py-12 text-center"
                        >
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Creando pollas de prueba</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                Esto puede tomar unos momentos...
                            </p>
                        </motion.div>
                    )}

                    {step === 'success' && result && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <DialogHeader className="min-w-0 flex-1">
                                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <DialogTitle>¡Pollas creadas exitosamente!</DialogTitle>
                                    <DialogDescription>
                                        Se crearon {result.created} pollas de prueba con todos sus datos
                                    </DialogDescription>
                                </DialogHeader>
                                <button
                                    onClick={handleClose}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                                    aria-label="Cerrar diálogo"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-6 space-y-3">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <FlaskConical className="h-4 w-4" />
                                            <span className="text-xs font-medium">Pollas</span>
                                        </div>
                                        <div className="mt-2 text-2xl font-bold text-slate-900">{result.created}</div>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Users className="h-4 w-4" />
                                            <span className="text-xs font-medium">Miembros</span>
                                        </div>
                                        <div className="mt-2 text-2xl font-bold text-slate-900">{result.totalMembers}</div>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 col-span-2 sm:col-span-1">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Trophy className="h-4 w-4" />
                                            <span className="text-xs font-medium">Partidos</span>
                                        </div>
                                        <div className="mt-2 text-2xl font-bold text-slate-900">{result.totalMatchesActivated}</div>
                                    </div>
                                </div>

                                {result.tournamentsAvailable.length > 0 && (
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                                            Torneos vinculados
                                        </h4>
                                        <div className="space-y-2">
                                            {result.tournamentsAvailable.map((tournament) => (
                                                <div
                                                    key={tournament.id}
                                                    className="flex items-center justify-between text-sm"
                                                >
                                                    <span className="font-medium text-slate-900">{tournament.name}</span>
                                                    <span className="text-slate-500">{tournament.matches} partidos</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                                        <div className="flex-1 text-sm text-blue-900">
                                            <p className="font-medium mb-1">Pollas creadas para pruebas</p>
                                            <p className="text-blue-700">
                                                Estas pollas son solo para testing. Puedes eliminarlas cuando termines las pruebas.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={handleClose}
                                    className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                >
                                    Entendido
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <DialogHeader className="min-w-0 flex-1">
                                    <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                                        <AlertCircle className="h-5 w-5" />
                                    </div>
                                    <DialogTitle>Error al crear pollas</DialogTitle>
                                    <DialogDescription>
                                        No se pudieron crear las pollas de prueba
                                    </DialogDescription>
                                </DialogHeader>
                                <button
                                    onClick={handleClose}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                                    aria-label="Cerrar diálogo"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-6 space-y-4">
                                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                                        <div className="flex-1 text-sm text-red-900">
                                            <p className="font-medium mb-1">Detalles del error</p>
                                            <p className="text-red-700">{error}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleRetry}
                                        className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
