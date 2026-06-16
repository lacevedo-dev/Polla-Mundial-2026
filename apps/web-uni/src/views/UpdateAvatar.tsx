import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, Loader2, ShieldAlert, User } from 'lucide-react';
import { uploadFile, request, ApiError, resolveApiAssetUrl } from '../api';
import { useAuthStore } from '../stores/auth.store';
import { useTenantStore } from '../stores/tenant.store';
import { getHomeRoute } from '../utils/tenantRole';

export default function UpdateAvatar() {
    const navigate = useNavigate();
    const { user, setNeedsAvatarUpdate, updateAvatarFromProfile } = useAuthStore();
    const tenant = useTenantStore((s) => s.tenant);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'ZonaPronósticos';
    const primaryColor = tenant?.branding?.primaryColor ?? '#f59e0b';
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'U')}&background=random`;
    const currentAvatar = preview ?? resolveApiAssetUrl(user?.avatar) ?? fallbackAvatar;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Solo se permiten imágenes JPG, PNG o WebP.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('La imagen no puede superar 5 MB.');
            return;
        }

        setError(null);
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Selecciona una imagen para continuar.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('avatar', selectedFile);
            const updated = await uploadFile<{ avatar?: string | null; needsAvatarUpdate?: boolean }>(
                '/auth/profile',
                formData,
                'PATCH',
            );
            updateAvatarFromProfile(updated.avatar, updated.needsAvatarUpdate ?? false);
            setSuccess(true);
            setTimeout(() => navigate(getHomeRoute(user), { replace: true }), 1500);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la foto');
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async () => {
        setLoading(true);
        setError(null);
        try {
            await request('/auth/avatar/dismiss', { method: 'POST' });
            setNeedsAvatarUpdate(false);
            navigate(getHomeRoute(user), { replace: true });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo continuar sin foto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ backgroundColor: `${primaryColor}20` }}
                    >
                        <Camera size={26} style={{ color: primaryColor }} />
                    </div>
                    <h1 className="text-2xl font-black text-white">Actualiza tu foto</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Tu foto anterior no está disponible en {orgName}
                    </p>
                </div>

                {!success && (
                    <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
                        <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-amber-200 text-xs leading-relaxed">
                            <p className="font-semibold mb-0.5">Foto no encontrada</p>
                            <p className="text-amber-300/80">
                                Sube una nueva imagen o continúa sin foto. Si no subes una, eliminaremos la referencia
                                antigua para evitar errores de visualización.
                            </p>
                        </div>
                    </div>
                )}

                {success ? (
                    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-3">
                        <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                        <h2 className="text-lg font-black text-white">¡Foto actualizada!</h2>
                        <p className="text-slate-400 text-sm">Redirigiendo al portal...</p>
                    </div>
                ) : (
                    <div className="bg-slate-900 rounded-2xl p-6 space-y-4 border border-slate-800">
                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <img
                                    src={currentAvatar}
                                    alt={user?.name ?? 'Avatar'}
                                    className="w-24 h-24 rounded-full object-cover border-4 border-slate-800"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = fallbackAvatar;
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <Camera size={14} />
                                </button>
                            </div>
                            <p className="text-slate-400 text-xs flex items-center gap-1">
                                <User size={12} /> {user?.name}
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleUpload}
                            disabled={loading || !selectedFile}
                            className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: primaryColor, color: '#0f172a' }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Guardando...
                                </>
                            ) : (
                                'Guardar foto'
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleDismiss}
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl text-slate-300 hover:text-white text-sm font-semibold border border-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50"
                        >
                            Continuar sin foto
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
