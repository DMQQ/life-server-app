import { Controller, Get } from '@nestjs/common';

@Controller('.well-known')
export class HostsController {
  @Get('/apple-app-site-association')
  apple() {
    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: 'AWR7MPVJNL.com.dmq.mylifemobile',
            paths: ['*'],
          },
        ],
      },
    };
  }
}
