import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request } from 'src/types';
import { AuthenticationService } from '../../authentication/authentication.service';

@Injectable()
export class TokenMiddleware implements NestMiddleware {
  constructor(private authenticationService: AuthenticationService) {}

  async use(req: Request, res: any, next: (error?: any) => void) {
    const token = req.headers['authentication'] as string;

    if (token) {
      this.authenticationService.verifyToken(token, (err, dec) => {
        req.account = dec;
      });
    }

    next();
  }
}
