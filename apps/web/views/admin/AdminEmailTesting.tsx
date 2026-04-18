import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, Send, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Server, Clock, TrendingUp, Database, Users, Trash2, ShieldAlert
} from 'lucide-react';
import { request } from '../../api';

enum EmailTestType {
  VERIFICATION = 'verification',
  MATCH_REMINDER = 'match_reminder',
  PREDICTION_CLOSING = 'prediction_closing',
  MATCH_RESULT = 'match_result',
  CUSTOM = 'custom',
}

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
}

interface TestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  timestamp: Date;
  recipientEmail: string;
  subject: string;
}

interface QueueJob {
  id: string;
  type: string;
  status: string;
  recipientEmail: string;
  subject: string;
  html?: string;
  text?: string;
  providerKey?: string;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
  attemptCount: number;
}

interface QueueStatus {
  stats: {
    pending: number;
    deferred: number;
    sending: number;
    sent: number;
    failed: number;
    dropped: number;
    total: number;
  };
  recentJobs: QueueJob[];
}

interface Provider {
  key: string;
  fromEmail: string;
  fromName: string | null;
  host: string;
  port: number;
  dailyLimit: number;
  reservedHighPriority: number;
  sentToday: number;
  remainingQuota: number;
  isBlocked: boolean;
  blockedUntil: Date | null;
  lastError: string | null;
  lastUsedAt: Date | null;
}

interface ProviderStatus {
  providers: Provider[];
  totalProviders: number;
  activeProviders: number;
  blockedProviders: number;
}

interface BlacklistEntry {
  id: string;
  email: string;
  reason: string;
  createdAt: string;
  failureCount: number;
}

export default function AdminEmailTesting() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailType, setEmailType] = useState<EmailTestType>(EmailTestType.VERIFICATION);
  const [userName, setUserName] = useState('Usuario de Prueba');
  const [customSubject, setCustomSubject] = useState('');
  const [customHtml, setCustomHtml] = useState('');
  const [customText, setCustomText] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingBlacklist, setLoadingBlacklist] = useState(false);
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
  const [nextProvider, setNextProvider] = useState<Provider | null>(null);

  useEffect(() => {
    loadUsers();
    loadQueueStatus();
    loadProviderStatus();
    loadBlacklist();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      if (user) {
        setRecipientEmail(user.email);
        setUserName(user.name);
      }
    }
  }, [selectedUserId, users]);

  useEffect(() => {
    if (providerStatus && providerStatus.providers.length > 0) {
      const available = providerStatus.providers
        .filter(p => !p.isBlocked && p.remainingQuota > 0)
        .sort((a, b) => b.remainingQuota - a.remainingQuota);
      setNextProvider(available[0] || null);
    }
  }, [providerStatus]);

  const loadUsers = async () => {
    try {
      const response: any = await request('/email-testing/active-users');
      setUsers(response.users || []);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const loadQueueStatus = async () => {
    setLoadingQueue(true);
    try {
      const response: any = await request('/email-testing/queue-status');
      setQueueStatus(response);
    } catch (error) {
      console.error('Error cargando estado de cola:', error);
    } finally {
      setLoadingQueue(false);
    }
  };

  const loadProviderStatus = async () => {
    setLoadingProviders(true);
    try {
      const response: any = await request('/email-testing/provider-status');
      setProviderStatus(response);
    } catch (error) {
      console.error('Error cargando estado de proveedores:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadBlacklist = async () => {
    setLoadingBlacklist(true);
    try {
      const response: any = await request('/email-testing/blacklist');
      setBlacklist(response.entries || []);
    } catch (error) {
      console.error('Error cargando blacklist:', error);
    } finally {
      setLoadingBlacklist(false);
    }
  };

  const handleSendTest = async () => {
    if (!recipientEmail) {
      alert('Por favor selecciona un usuario o ingresa un correo electrónico');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const response: any = await request('/email-testing/send-test', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail,
          type: emailType,
          userName: emailType === EmailTestType.VERIFICATION ? userName : undefined,
          subject: emailType === EmailTestType.CUSTOM ? customSubject : undefined,
          htmlContent: emailType === EmailTestType.CUSTOM ? customHtml : undefined,
          textContent: emailType === EmailTestType.CUSTOM ? customText : undefined,
        }),
      });

      setTestResult(response);
      await loadProviderStatus();
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Error desconocido',
        timestamp: new Date(),
        recipientEmail,
        subject: 'Error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToQueue = async () => {
    if (!recipientEmail) {
      alert('Por favor selecciona un usuario o ingresa un correo electrónico');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const response: any = await request('/email-testing/test-queue', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail,
          subject: customSubject || 'Correo de prueba de cola',
          html: customHtml || '<p>Este es un correo de prueba de la cola.</p>',
          text: customText || 'Este es un correo de prueba de la cola.',
        }),
      });

      setTestResult({
        success: response.success,
        messageId: response.jobId,
        timestamp: response.timestamp,
        recipientEmail,
        subject: 'Encolado en sistema de correos',
      });
      await loadQueueStatus();
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Error desconocido',
        timestamp: new Date(),
        recipientEmail,
        subject: 'Error',
      });
    } finally {
      setLoading(false);
    }
  };

  const dispatchPendingJobs = async () => {
    setLoadingQueue(true);
    try {
      const response: any = await request('/email-testing/dispatch-pending?limit=30', {
        method: 'POST',
      });
      alert(`Procesados: ${response.processed}, Enviados: ${response.sent}`);
      await loadQueueStatus();
      await loadProviderStatus();
    } catch (error: any) {
      alert('Error procesando cola: ' + error.message);
    } finally {
      setLoadingQueue(false);
    }
  };

  const removeFromBlacklist = async (email: string) => {
    if (!confirm(`¿Desbloquear el email ${email}?`)) return;

    try {
      await request(`/email-testing/blacklist/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      alert(`Email ${email} desbloqueado exitosamente`);
      await loadBlacklist();
    } catch (error: any) {
      alert('Error desbloqueando email: ' + error.message);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive'; label: string }> = {
      PENDING: { variant: 'default', label: 'Pendiente' },
      DEFERRED: { variant: 'default', label: 'Diferido' },
      SENDING: { variant: 'default', label: 'Enviando' },
      SENT: { variant: 'default', label: 'Enviado' },
      FAILED: { variant: 'destructive', label: 'Fallido' },
      DROPPED: { variant: 'destructive', label: 'Descartado' },
    };
    const config = variants[status] || { variant: 'default', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🧪 Testing de Correos</h1>
          <p className="text-muted-foreground">Panel de pruebas para el sistema de correos electrónicos</p>
        </div>
      </div>

      <Tabs defaultValue="send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="send">
            <Send className="w-4 h-4 mr-2" />
            Enviar Prueba
          </TabsTrigger>
          <TabsTrigger value="queue">
            <Database className="w-4 h-4 mr-2" />
            Cola de Correos
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Server className="w-4 h-4 mr-2" />
            Proveedores
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ENVIAR PRUEBA */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Correo de Prueba</CardTitle>
              <CardDescription>
                Selecciona un usuario real y el tipo de correo a enviar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {nextProvider && (
                <Alert>
                  <Server className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div>
                        <strong>Proveedor que se usará:</strong> {nextProvider.fromEmail} ({nextProvider.key})
                      </div>
                      <div>
                        <strong>Cuota disponible:</strong> {nextProvider.remainingQuota} de {nextProvider.dailyLimit} 
                        ({((nextProvider.sentToday / nextProvider.dailyLimit) * 100).toFixed(1)}% usado)
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        ℹ️ El sistema rota automáticamente entre {providerStatus?.totalProviders || 0} proveedores 
                        usando el que tenga menor uso para balancear la carga.
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {!nextProvider && providerStatus && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>⚠️ No hay proveedores disponibles</strong>
                    <br />
                    Todos los proveedores están bloqueados o han alcanzado su cuota diaria.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="user">Seleccionar Usuario</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">O ingresa un correo manualmente</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    setSelectedUserId('');
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Correo</Label>
                <Select value={emailType} onValueChange={(value) => setEmailType(value as EmailTestType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EmailTestType.VERIFICATION}>Verificación de Email</SelectItem>
                    <SelectItem value={EmailTestType.MATCH_REMINDER}>Recordatorio de Partido</SelectItem>
                    <SelectItem value={EmailTestType.PREDICTION_CLOSING}>Cierre de Predicciones</SelectItem>
                    <SelectItem value={EmailTestType.MATCH_RESULT}>Resultado de Partido</SelectItem>
                    <SelectItem value={EmailTestType.CUSTOM}>Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {emailType === EmailTestType.VERIFICATION && (
                <div className="space-y-2">
                  <Label htmlFor="userName">Nombre de Usuario</Label>
                  <Input
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
              )}

              {emailType === EmailTestType.CUSTOM && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Asunto</Label>
                    <Input
                      id="subject"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Asunto del correo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="html">Contenido HTML</Label>
                    <Textarea
                      id="html"
                      value={customHtml}
                      onChange={(e) => setCustomHtml(e.target.value)}
                      placeholder="<p>Contenido HTML del correo</p>"
                      rows={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="text">Contenido Texto Plano</Label>
                    <Textarea
                      id="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Contenido en texto plano"
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSendTest} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Directo
                    </>
                  )}
                </Button>

                <Button onClick={handleSendToQueue} disabled={loading} variant="outline" className="flex-1">
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Encolando...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Enviar a Cola
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {testResult.success ? (
                      <div className="space-y-1">
                        <p className="font-semibold">✅ Correo enviado exitosamente</p>
                        <p className="text-sm">Destinatario: {testResult.recipientEmail}</p>
                        {testResult.messageId && <p className="text-sm">ID: {testResult.messageId}</p>}
                        {testResult.provider && <p className="text-sm">Proveedor: {testResult.provider}</p>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold">❌ Error al enviar correo</p>
                        <p className="text-sm">{testResult.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: COLA DE CORREOS */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Estado de la Cola de Correos</CardTitle>
                  <CardDescription>Monitoreo de trabajos de correo pendientes y procesados</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={loadQueueStatus} disabled={loadingQueue} variant="outline" size="sm">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingQueue ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                  <Button onClick={dispatchPendingJobs} disabled={loadingQueue} size="sm">
                    <Send className="w-4 h-4 mr-2" />
                    Procesar Cola
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {queueStatus && (
                <>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{queueStatus.stats.pending}</div>
                      <div className="text-xs text-muted-foreground">Pendientes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{queueStatus.stats.deferred}</div>
                      <div className="text-xs text-muted-foreground">Diferidos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{queueStatus.stats.sending}</div>
                      <div className="text-xs text-muted-foreground">Enviando</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{queueStatus.stats.sent}</div>
                      <div className="text-xs text-muted-foreground">Enviados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{queueStatus.stats.failed}</div>
                      <div className="text-xs text-muted-foreground">Fallidos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{queueStatus.stats.dropped}</div>
                      <div className="text-xs text-muted-foreground">Descartados</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Trabajos Recientes</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {queueStatus.recentJobs.map((job) => (
                        <div key={job.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(job.status)}
                              <span className="text-sm font-medium">{job.recipientEmail}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                            >
                              {selectedJob?.id === job.id ? 'Ocultar' : 'Ver detalles'}
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <strong>Asunto:</strong> {job.subject}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span><Clock className="w-3 h-3 inline mr-1" />Creado: {formatDate(job.createdAt)}</span>
                            {job.sentAt && <span><CheckCircle2 className="w-3 h-3 inline mr-1" />Enviado: {formatDate(job.sentAt)}</span>}
                            {job.providerKey && <span><Server className="w-3 h-3 inline mr-1" />Proveedor: {job.providerKey}</span>}
                          </div>
                          {job.lastError && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                              <strong>Error:</strong> {job.lastError}
                            </div>
                          )}
                          {selectedJob?.id === job.id && (
                            <div className="mt-2 space-y-2 border-t pt-2">
                              <div className="text-sm">
                                <strong>Mensaje HTML:</strong>
                                <div className="mt-1 p-2 bg-gray-50 rounded text-xs max-h-40 overflow-y-auto">
                                  {job.html || 'No disponible'}
                                </div>
                              </div>
                              <div className="text-sm">
                                <strong>Mensaje Texto:</strong>
                                <div className="mt-1 p-2 bg-gray-50 rounded text-xs max-h-20 overflow-y-auto">
                                  {job.text || 'No disponible'}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PROVEEDORES */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Estado de Proveedores SMTP</CardTitle>
                  <CardDescription>Monitoreo de proveedores de correo y cuotas diarias</CardDescription>
                </div>
                <Button onClick={loadProviderStatus} disabled={loadingProviders} variant="outline" size="sm">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingProviders ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {providerStatus && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{providerStatus.totalProviders}</div>
                      <div className="text-xs text-muted-foreground">Total Proveedores</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{providerStatus.activeProviders}</div>
                      <div className="text-xs text-muted-foreground">Activos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{providerStatus.blockedProviders}</div>
                      <div className="text-xs text-muted-foreground">Bloqueados</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {providerStatus.providers.map((provider) => (
                      <div key={provider.key} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{provider.fromEmail}</div>
                            <div className="text-sm text-muted-foreground">
                              {provider.fromName || provider.key} • {provider.host}:{provider.port}
                            </div>
                          </div>
                          {provider.isBlocked ? (
                            <Badge variant="destructive">BLOQUEADO</Badge>
                          ) : (
                            <Badge>ACTIVO</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground">Enviados Hoy</div>
                            <div className="font-semibold">{provider.sentToday}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Límite Diario</div>
                            <div className="font-semibold">{provider.dailyLimit}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Cuota Restante</div>
                            <div className="font-semibold text-green-600">{provider.remainingQuota}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Uso</div>
                            <div className="font-semibold">
                              {((provider.sentToday / provider.dailyLimit) * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {provider.lastError && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            <strong>Último Error:</strong> {provider.lastError}
                          </div>
                        )}

                        {provider.lastUsedAt && (
                          <div className="text-xs text-muted-foreground">
                            Último uso: {formatDate(provider.lastUsedAt)}
                          </div>
                        )}

                        {provider.blockedUntil && (
                          <div className="text-xs text-red-600">
                            Bloqueado hasta: {formatDate(provider.blockedUntil)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* SECCIÓN DE BLACKLIST */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5" />
                      Lista Negra de Correos
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Correos bloqueados por rebotes o fallos repetidos
                    </p>
                  </div>
                  <Button onClick={loadBlacklist} disabled={loadingBlacklist} variant="outline" size="sm">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingBlacklist ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                </div>

                {blacklist.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay correos en la lista negra
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {blacklist.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div className="flex-1">
                          <div className="font-medium">{entry.email}</div>
                          <div className="text-sm text-muted-foreground">
                            Razón: {entry.reason} • Fallos: {entry.failureCount} • {formatDate(entry.createdAt)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromBlacklist(entry.email)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Desbloquear
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
