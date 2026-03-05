import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class BoldService {
    private readonly baseUrl = 'https://integrations.api.bold.co';
    private readonly apiKey = process.env.BOLD_API_KEY;

    async createPaymentLink(data: {
        amount: number;
        description: string;
        orderId: string;
        notificationUrl?: string;
        redirectUrl?: string;
    }) {
        if (!this.apiKey) {
            // Si no hay API KEY, devolvemos un modo simulación para desarrollo
            console.warn('BOLD_API_KEY no configurada. Usando modo simulación.');
            return {
                link: `https://checkout.bold.co/payment/simulated-${data.orderId}`,
                boldOrderId: `sim-${Date.now()}`
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/online/link/v1`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `x-api-key ${this.apiKey}`
                },
                body: JSON.stringify({
                    amount: data.amount,
                    currency: 'COP',
                    description: data.description,
                    order_id: data.orderId,
                    notification_url: data.notificationUrl,
                    redirect_url: data.redirectUrl
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error al crear link de pago en Bold');
            }

            const result = await response.json();
            return {
                link: result.payload?.url || result.url,
                boldOrderId: result.payload?.id || result.id
            };
        } catch (error) {
            console.error('Error Bold API:', error);
            throw new InternalServerErrorException('Error en la integración con la pasarela de pagos');
        }
    }

    verifyWebhook(payload: any, signature: string): boolean {
        // TODO: Implementar validación de firma HMAC si Bold la provee
        return true;
    }
}
