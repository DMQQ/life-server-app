import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request } from 'src/types';
import { WalletService } from 'src/wallet/services/wallet.service';

@Injectable()
export class WalletMiddleware implements NestMiddleware {
  constructor(private walletService: WalletService) {}

  async use(req: Request, res: any, next: (error?: any) => void) {
    const userId = req.account?.accountId;

    if (!userId) {
      return next();
    }

    const walletId = await this.walletService.getWalletId(userId);

    if (!walletId) {
      return next();
    }

    req.wallet.walletId = walletId;

    next();
  }
}
