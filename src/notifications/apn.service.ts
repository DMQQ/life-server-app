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
    const hostname = true ? 'api.push.apple.com' : 'api.development.push.apple.com';
    const path = `/3/device/${deviceToken}`;

    console.log('Sending APNs request to:', {
      hostname,
      path,
      headers,
      body: JSON.stringify(body, null, 2),
    });

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
    return this.sendRequest(apnPayload.payload, apnPayload.headers, notification.liveActivityToken);
  }

  public async updateTimelineActivity(updateToken: string, timeline: any) {
    const apnPayload = await this.constructTimelineUpdatePayload(timeline);
    return this.sendRequest(apnPayload.payload, apnPayload.headers, updateToken);
  }

  public async endTimelineActivity(updateToken: string, timeline: any) {
    const apnPayload = await this.constructTimelineEndPayload(timeline);
    return this.sendRequest(apnPayload.payload, apnPayload.headers, updateToken);
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
        },
      },
    };
  }

  private async constructTimelineUpdatePayload(timeline: any) {
    const completedTodos = timeline.todos ? timeline.todos.filter((todo: any) => todo.isCompleted).length : 0;
    const totalTodos = timeline.todos ? timeline.todos.length : 0;
    const progress = totalTodos > 0 ? completedTodos / totalTodos : 1;

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
          event: 'update',
          'content-state': {
            title: timeline.title,
            description: timeline.description,
            startTime: timeline.beginTime,
            endTime: timeline.endTime,
            isCompleted: timeline.isCompleted === 0 ? false : true,
            progress: progress,
            todos: timeline.todos || [],
          },
        },
      },
    };
  }

  private async constructTimelineEndPayload(timeline: any) {
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
          event: 'end',
          'content-state': {
            title: timeline.title,
            description: timeline.description,
            startTime: timeline.beginTime,
            endTime: timeline.endTime,
            isCompleted: true,
            progress: 1,
            todos: timeline.todos || [],
          },
          'dismissal-date': Math.floor(Date.now() / 1000) + 10, // Dismiss after 10 seconds
        },
      },
    };
  }
}
