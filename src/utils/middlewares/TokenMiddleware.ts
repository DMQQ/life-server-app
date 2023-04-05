import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request } from 'src/types';
import { AuthenticationService } from '../../authentication/authentication.service';

@Injectable()
export class TokenMiddleware implements NestMiddleware {
  constructor(private authenticationService: AuthenticationService) {}

  async use(req: Request, res: any, next: (error?: any) => void) {
    let token = (req.headers?.authentication ||
      req.headers?.authorization ||
      req.headers?.token) as string | undefined;

    if (token) {
      this.authenticationService.verifyToken(token, (err, dec) => {
        req.account = dec;
      });
    }

    next();
  }
}
