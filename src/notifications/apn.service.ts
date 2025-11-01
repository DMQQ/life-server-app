import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as http2 from 'http2';
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
    const hostname = false ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const path = `/3/device/${deviceToken}`;

    return new Promise((resolve, reject) => {
      const client = http2.connect(`https://${hostname}`);

      client.on('error', (err) => {
        console.error('HTTP/2 client error:', err);
        client.close();
        reject(err);
      });

      const requestHeaders = {
        ':method': 'POST',
        ':path': path,
        ':scheme': 'https',
        ':authority': hostname,
        authorization: `bearer ${this.generateAPNsToken()}`,
        ...headers,
      };

      const req = client.request(requestHeaders);

      let responseData = '';
      let statusCode = 0;
      let responseHeaders = {};

      req.on('response', (headers) => {
        statusCode = headers[':status'];
        responseHeaders = headers;
        console.log('APNs Response Headers:', headers);
      });

      req.on('data', (chunk) => {
        responseData += chunk;
      });

      req.on('end', () => {
        client.close();

        console.log('APNs Response:', {
          status: statusCode,
          headers: responseHeaders,
          body: responseData,
        });

        if (statusCode === 200) {
          resolve({ success: true, status: statusCode, data: responseData });
        } else {
          let errorResponse;
          try {
            errorResponse = responseData ? JSON.parse(responseData) : { reason: 'Unknown error' };
          } catch (e) {
            errorResponse = { reason: `Parse error: ${responseData}` };
          }

          resolve({
            success: false,
            status: statusCode,
            error: errorResponse,
          });
        }
      });

      req.on('error', (err) => {
        console.error('Request error:', err);
        client.close();
        reject(err);
      });

      const payloadString = JSON.stringify(body);
      req.write(payloadString);
      req.end();
    });
  }

  public async sendTimelineActivity(notification: NotificationsEntity, timeline: any) {
    const apnPayload = await this.constructTimelinePayload(timeline);
    console.log('Constructed APNs Payload:', apnPayload, notification.liveActivityToken);
    return this.sendRequest(apnPayload.payload, apnPayload.headers, notification.liveActivityToken);
  }

  private async constructTimelinePayload(timeline: any) {
    const now = dayjs();

    const startTime = dayjs(timeline.beginTime, 'HH:mm');
    const endTime = dayjs(timeline.endTime, 'HH:mm');

    const startDateTime = startTime.isBefore(now) ? startTime.add(1, 'day') : startTime;
    const endDateTime = endTime.isBefore(now) ? endTime.add(1, 'day') : endTime;

    return {
      headers: {
        'apns-topic': 'com.dmq.mylifemobile.push-type.liveactivity',
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'apns-expiration': '0',
      },
      payload: {
        aps: {
          timestamp: now.unix(),
          event: 'start',
          'attributes-type': 'WidgetAttributes',
          attributes: {
            eventId: timeline.id,
            deepLinkURL: `mylife://timeline/${timeline.id}`,
          },
          'content-state': {
            title: timeline.title,
            description: timeline.description,
            startTime: startDateTime.valueOf(),
            endTime: endDateTime.valueOf(),
            isCompleted: false,
            progress: 1,
          },
          alert: { title: '', body: '', sound: 'default' },
        },
      },
    };
  }
}
