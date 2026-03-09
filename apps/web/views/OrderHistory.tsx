import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';
import { ArrowLeft, Package, Calendar, DollarSign, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

interface Order {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  items: Array<{
    name: string;
    amount: number;
    currency: string;
  }>;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
}

const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<'ALL' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'>('ALL');

  React.useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await request<OrdersResponse>('/orders', {
          method: 'GET',
        });
        setOrders(response.orders || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar órdenes';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [user, navigate]);

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 size={16} className="text-lime-600" />;
      case 'PENDING':
        return <Clock size={16} className="text-amber-600" />;
      case 'FAILED':
        return <XCircle size={16} className="text-rose-600" />;
      case 'REFUNDED':
        return <XCircle size={16} className="text-slate-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-lime-50 text-lime-900';
      case 'PENDING':
        return 'bg-amber-50 text-amber-900';
      case 'FAILED':
        return 'bg-rose-50 text-rose-900';
      case 'REFUNDED':
        return 'bg-slate-50 text-slate-900';
      default:
        return 'bg-slate-50 text-slate-900';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount / 100); // Amount in cents
  };

  const filteredOrders = filterStatus === 'ALL'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-4 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft size={12} /> VOLVER
          </button>
          <h1 className="text-2xl font-black font-brand uppercase tracking-tighter">MIS ÓRDENES</h1>
          <div className="w-12" /> {/* Spacer */}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-gap-3 gap-3">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-black uppercase text-rose-900">Error</p>
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        {!isLoading && orders.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                  filterStatus === status
                    ? 'bg-lime-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-600"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-bold">No hay órdenes para mostrar</p>
            <Button
              onClick={() => navigate('/checkout')}
              className="mt-4"
            >
              IR A COMPRAR
            </Button>
          </div>
        )}

        {/* Orders List */}
        {!isLoading && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500">#{order.id.slice(-8)}</span>
                    </div>

                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <p key={idx} className="text-xs font-bold text-slate-700">{item.name}</p>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[8px] text-slate-500 font-bold">
                      <Calendar size={12} />
                      {formatDate(order.createdAt)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <DollarSign size={14} className="text-lime-600" />
                      <span className="text-lg font-black font-brand text-slate-900">
                        {formatCurrency(order.amount, order.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
