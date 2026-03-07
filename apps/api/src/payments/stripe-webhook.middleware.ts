import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class StripeWebhookMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.path === '/payments/webhook/stripe') {
      let rawBody = '';
      req.setEncoding('utf8');

      req.on('data', (chunk: string) => {
        rawBody += chunk;
      });

      req.on('end', () => {
        (req as any).rawBody = Buffer.from(rawBody);
        next();
      });
    } else {
      next();
    }
  }
}
