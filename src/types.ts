import type { Request as ERequest } from 'express';

export interface Request extends ERequest {
  account: { accountId: string };
  isAuthenticated(): boolean;

  wallet?: {
    walletId: string;
  };
}
