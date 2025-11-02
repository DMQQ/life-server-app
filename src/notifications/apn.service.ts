import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as dayjs from 'dayjs';
import { NotificationsEntity } from './notifications.entity';

@Injectable()
export class ApnService {
  private generateAPNsToken(): string {
    const keyPath = process.env.APN_KEY_PATH || './certs/AuthKey.p8';
    const keyId = process.env.APN_KEY_ID || 'your-key-id';
    const teamId = process.env.APN_TEAM_ID || 'your-team-id';

    const privateKey = fs.readFileSync(keyPath, 'utf8');

    const token = jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      keyid: keyId,
      issuer: teamId,
      expiresIn: '1h',
    });

    return token;
  }

  async sendRequest(body: any, headers: Record<string, string>, deviceToken: string): Promise<any> {
    const hostname = true ? 'api.push.apple.com' : 'api.development.push.apple.com';
    const url = `https://${hostname}/3/device/${deviceToken}`;

    const requestHeaders = {
      authorization: `bearer ${this.generateAPNsToken()}`,
      'content-type': 'application/json',
      ...headers,
    };

    console.log('Sending APNs request to:', {
      url,
      headers: requestHeaders,
      body: JSON.stringify(body, null, 2),
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(body),
      });

      const responseData = await response.text();

      console.log('APNs Response:', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData,
      });

      if (response.status === 200) {
        return { success: true, status: response.status, data: responseData };
      } else {
        let errorResponse;
        try {
          errorResponse = responseData ? JSON.parse(responseData) : { reason: 'Unknown error' };
        } catch (e) {
          errorResponse = { reason: `Parse error: ${responseData}` };
        }

        return {
          success: false,
          status: response.status,
          error: errorResponse,
        };
      }
    } catch (error) {
      console.error('Request error:', error);
      throw error;
    }
  }

  public async sendTimelineActivity(notification: NotificationsEntity, timeline: any) {
    const apnPayload = await this.constructTimelinePayload(timeline);
    return this.sendRequest(apnPayload.payload, apnPayload.headers, notification.liveActivityToken);
  }

  public async endTimelineActivity(notification: NotificationsEntity, timeline: any) {
    const apnPayload = await this.constructTimelinePayload(timeline);
    apnPayload.payload.aps.event = 'end';
    apnPayload.payload.aps['dismissal-date'] = Math.floor(Date.now() / 1000) - 10;
    delete apnPayload.payload.aps['alert'];
    return this.sendRequest(apnPayload.payload, apnPayload.headers, notification.liveActivityToken);
  }

  private async constructTimelinePayload(timeline: any) {
    return {
      headers: {
        'apns-topic': 'com.dmq.mylifemobile.push-type.liveactivity',
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'apns-expiration': '0',
      },
      payload: {
        aps: {
          timestamp: Math.floor(Date.now() / 1000),
          event: 'start',
          'attributes-type': 'WidgetAttributes',
          attributes: {
            eventId: timeline.id,
            deepLinkURL: `mylife://timeline/id/${timeline.id}`,
          },
          'content-state': {
            title: timeline.title,
            description: timeline.description,
            startTime: timeline.beginTime,
            endTime: timeline.endTime,
            isCompleted: timeline.isCompleted === 0 ? false : true,
            progress: 1,
            todos: timeline.todos || [],
          },
          alert: { title: timeline.title, body: timeline.description, sound: 'default' },

          // 'dismissal-date': Math.floor(
          //   dayjs()
          //     .hour(parseInt(timeline.endTime.split(':')[0]))
          //     .minute(parseInt(timeline.endTime.split(':')[1]))
          //     .second(parseInt(timeline.endTime.split(':')[2] || '0'))
          //     .add(1, 'minute')
          //     .valueOf() / 1000,
          // ),
        },
      },
    };
  }
}
