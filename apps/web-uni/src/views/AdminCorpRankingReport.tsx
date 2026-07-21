import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle, Download, FileText, Loader2, Mail, RefreshCw, Send, Trophy, Users, X,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { ApiError, downloadBlob, request } from '../api';
import { useTenantStore } from '../stores/tenant.store';

interface RankingReportRow {
    rank: number;
    documentNumber: string;
    name: string;
    totalPoints: number;
}

interface RankingReportPayload {
    league: { id: string; name: string } | null;
    category: string;
    generatedAt: string;
    totalParticipants: number;
    rows: RankingReportRow[];
}

function formatPoints(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatGeneratedAt(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AdminCorpRankingReport() {
    const tenant = useTenantStore((s) => s.tenant);
    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';

    const [data, setData] = useState<RankingReportPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [emailOpen, setEmailOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [emailMsg, setEmailMsg] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = await request<RankingReportPayload>('/corp/admin/ranking-report');
            setData(payload);
        } catch (err) {
            const msg = err instanceof ApiError
                ? err.message
                : 'No se pudo cargar el listado de participantes.';
            setError(msg);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleDownloadPdf = async () => {
        setDownloading(true);
        setError(null);
        try {
            await downloadBlob('/corp/admin/ranking-report/pdf', 'ranking_participantes.pdf');
        } catch (err) {
            const msg = err instanceof ApiError
                ? err.message
                : 'No se pudo descargar el PDF.';
            setError(msg);
        } finally {
            setDownloading(false);
        }
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) {
            setEmailError('Indica un correo destino.');
            return;
        }
        setSending(true);
        setEmailError(null);
        setEmailMsg(null);
        try {
            const result = await request<{ message: string }>('/corp/admin/ranking-report/email', {
                method: 'POST',
                body: JSON.stringify({ email: trimmed }),
            });
            setEmailMsg(result.message ?? `Listado encolado para envío a ${trimmed}`);
            setEmail('');
        } catch (err) {
            const msg = err instanceof ApiError
                ? err.message
                : 'No se pudo enviar el correo.';
            setEmailError(msg);
        } finally {
            setSending(false);
        }
    };

    const hasLeague = Boolean(data?.league);
    const canExport = hasLeague && !loading;

    return (
        <CorpLayout>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <FileText size={20} className="text-emerald-600" />
                        <h1 className="text-2xl font-black text-slate-900">Listado por puntaje</h1>
                    </div>
                    <p className="text-slate-500 text-sm">
                        Participantes de la polla activa de {orgName}, ordenados por puntaje.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleDownloadPdf()}
                        disabled={!canExport || downloading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
                    >
                        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Descargar PDF
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEmailOpen(true);
                            setEmailMsg(null);
                            setEmailError(null);
                        }}
                        disabled={!canExport}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                    >
                        <Mail size={14} />
                        Enviar por correo
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                        <Trophy size={14} /> Polla
                    </div>
                    <p className="font-black text-slate-900 truncate">
                        {loading ? '—' : (data?.league?.name ?? 'Sin polla activa')}
                    </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                        <Users size={14} /> Participantes
                    </div>
                    <p className="font-black text-slate-900 text-2xl">
                        {loading ? '—' : (data?.totalParticipants ?? 0).toLocaleString()}
                    </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 p-4 col-span-2 md:col-span-1">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                        Generado
                    </div>
                    <p className="font-bold text-slate-700 text-sm">
                        {loading || !data ? '—' : formatGeneratedAt(data.generatedAt)}
                    </p>
                </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm font-medium">Cargando listado…</span>
                    </div>
                ) : !hasLeague ? (
                    <div className="py-16 text-center px-6">
                        <Trophy size={28} className="mx-auto text-slate-300 mb-3" />
                        <p className="font-bold text-slate-700">No hay polla activa</p>
                        <p className="text-sm text-slate-400 mt-1">
                            Activa una polla para generar el listado de participantes por puntaje.
                        </p>
                    </div>
                ) : data!.rows.length === 0 ? (
                    <div className="py-16 text-center px-6">
                        <Users size={28} className="mx-auto text-slate-300 mb-3" />
                        <p className="font-bold text-slate-700">Sin participantes</p>
                        <p className="text-sm text-slate-400 mt-1">
                            La polla activa aún no tiene miembros con puntaje.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="px-4 py-3 w-16">Pos.</th>
                                    <th className="px-4 py-3">Cédula</th>
                                    <th className="px-4 py-3">Nombres</th>
                                    <th className="px-4 py-3 text-right">Puntaje</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data!.rows.map((row) => (
                                    <tr key={`${row.rank}-${row.documentNumber}-${row.name}`} className="hover:bg-slate-50/80">
                                        <td className="px-4 py-3 font-black text-slate-900">{row.rank}</td>
                                        <td className="px-4 py-3 font-mono text-slate-600">
                                            {row.documentNumber || '—'}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-800">{row.name}</td>
                                        <td className="px-4 py-3 text-right font-black text-emerald-700">
                                            {formatPoints(row.totalPoints)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {emailOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Mail size={18} className="text-emerald-600" />
                                <h2 className="font-black text-slate-900">Enviar listado por correo</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEmailOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={(e) => void handleSendEmail(e)} className="p-5 space-y-4">
                            <p className="text-sm text-slate-500">
                                Se adjuntará el PDF del ranking de{' '}
                                <strong className="text-slate-700">{data?.league?.name}</strong>.
                            </p>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                    Correo destino
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@empresa.com"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    required
                                    autoFocus
                                />
                            </div>
                            {emailError && (
                                <p className="text-sm text-rose-600 flex items-center gap-1.5">
                                    <AlertCircle size={14} /> {emailError}
                                </p>
                            )}
                            {emailMsg && (
                                <p className="text-sm text-emerald-700 font-medium">{emailMsg}</p>
                            )}
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setEmailOpen(false)}
                                    className="px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Enviar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </CorpLayout>
    );
}
