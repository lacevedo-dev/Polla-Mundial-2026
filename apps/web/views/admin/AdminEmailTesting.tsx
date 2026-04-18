import { useState } from 'react';
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
  Mail, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Server,
  Clock,
  TrendingUp,
  Database
} from 'lucide-react';
import { request } from '../../api';

enum EmailTestType {
  VERIFICATION = 'verification',
  MATCH_REMINDER = 'match_reminder',
  PREDICTION_CLOSING = 'prediction_closing',
  MATCH_RESULT = 'match_result',
  CUSTOM = 'custom',
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
  recentJobs: Array<{
    id: string;
    type: string;
    status: string;
    recipientEmail: string;
    subject: string;
    createdAt: string;
    sentAt: string | null;
    lastError: string | null;
    attemptCount: number;
  }>;
}

interface ProviderStatus {
  providers: Array<{
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
  }>;
  totalProviders: number;
  activeProviders: number;
  blockedProviders: number;
}

export default function AdminEmailTesting() {
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
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const handleSendTest = async () => {
    if (!recipientEmail) {
      alert('Por favor ingresa un correo electrónico');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const response = await request('/email-testing/send-test', {
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
      alert('Por favor ingresa un correo electrónico');
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

  const dispatchPendingJobs = async () => {
    setLoadingQueue(true);
    try {
      const response: any = await request('/email-testing/dispatch-pending?limit=30', {
        method: 'POST',
      });
      alert(`Procesados: ${response.processed}, Enviados: ${response.sent}`);
      await loadQueueStatus();
    } catch (error: any) {
      alert('Error procesando cola: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingQueue(false);
    }
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

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Correo de Prueba</CardTitle>
              <CardDescription>
                Envía correos de prueba directamente o a través de la cola
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico Destinatario</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
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
            <CardContent>
              {queueStatus ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Pendientes</p>
                      <p className="text-2xl font-bold">{queueStatus.stats.pending}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Diferidos</p>
                      <p className="text-2xl font-bold text-yellow-600">{queueStatus.stats.deferred}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Enviados</p>
                      <p className="text-2xl font-bold text-green-600">{queueStatus.stats.sent}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Fallidos</p>
                      <p className="text-2xl font-bold text-red-600">{queueStatus.stats.failed}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Trabajos Recientes</h3>
                    <div className="space-y-2">
                      {queueStatus.recentJobs.map((job) => (
                        <div key={job.id} className="border rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{job.subject}</span>
                            <Badge variant={
                              job.status === 'SENT' ? 'default' :
                              job.status === 'FAILED' ? 'destructive' :
                              job.status === 'PENDING' ? 'secondary' : 'outline'
                            }>
                              {job.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{job.recipientEmail}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Intentos: {job.attemptCount}</span>
                            <span>Creado: {new Date(job.createdAt).toLocaleString()}</span>
                          </div>
                          {job.lastError && (
                            <p className="text-xs text-red-600">{job.lastError}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button onClick={loadQueueStatus} disabled={loadingQueue}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingQueue ? 'animate-spin' : ''}`} />
                    Cargar Estado de Cola
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
            <CardContent>
              {providerStatus ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Proveedores</p>
                      <p className="text-2xl font-bold">{providerStatus.totalProviders}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Activos</p>
                      <p className="text-2xl font-bold text-green-600">{providerStatus.activeProviders}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Bloqueados</p>
                      <p className="text-2xl font-bold text-red-600">{providerStatus.blockedProviders}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {providerStatus.providers.map((provider) => (
                      <div key={provider.key} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{provider.fromName || provider.fromEmail}</p>
                            <p className="text-sm text-muted-foreground">{provider.host}:{provider.port}</p>
                          </div>
                          <Badge variant={provider.isBlocked ? 'destructive' : 'default'}>
                            {provider.isBlocked ? '🔒 Bloqueado' : '✅ Activo'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Enviados Hoy</p>
                            <p className="font-semibold">{provider.sentToday}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Límite Diario</p>
                            <p className="font-semibold">{provider.dailyLimit}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cuota Restante</p>
                            <p className="font-semibold">{provider.remainingQuota}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Uso</p>
                            <p className="font-semibold">
                              {((provider.sentToday / provider.dailyLimit) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {provider.lastError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{provider.lastError}</AlertDescription>
                          </Alert>
                        )}

                        {provider.lastUsedAt && (
                          <p className="text-xs text-muted-foreground">
                            Último uso: {new Date(provider.lastUsedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button onClick={loadProviderStatus} disabled={loadingProviders}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingProviders ? 'animate-spin' : ''}`} />
                    Cargar Estado de Proveedores
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
