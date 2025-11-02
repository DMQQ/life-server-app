import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { LiveActivityEntity, LiveActivityStatus } from './live-activity.entity';

export interface CreateLiveActivityInput {
  timelineId: string;
  beginTime: number;
  endTime: number;
  status?: LiveActivityStatus;
}

export interface UpdateLiveActivityInput {
  beginTime?: number;
  endTime?: number;
  status?: LiveActivityStatus;
  lastUpdated?: number;
}

@Injectable()
export class LiveActivityService {
  constructor(
    @InjectRepository(LiveActivityEntity)
    private liveActivityRepository: Repository<LiveActivityEntity>,
  ) {}

  async createActivity(input: CreateLiveActivityInput): Promise<LiveActivityEntity> {
    const liveActivity = this.liveActivityRepository.create({
      timelineId: input.timelineId,
      beginTime: input.beginTime,
      endTime: input.endTime,
      status: input.status || LiveActivityStatus.PENDING,
      lastUpdated: Date.now(),
    });

    return this.liveActivityRepository.save(liveActivity);
  }

  async updateActivity(
    id: string,
    input: UpdateLiveActivityInput,
  ): Promise<LiveActivityEntity> {
    await this.liveActivityRepository.update(id, {
      ...input,
      lastUpdated: Date.now(),
    });

    return this.liveActivityRepository.findOne({ where: { id } });
  }

  async setUpdateToken(id: string, updateToken: string): Promise<LiveActivityEntity> {
    await this.liveActivityRepository.update(id, {
      updateToken,
      lastUpdated: Date.now(),
    });

    return this.liveActivityRepository.findOne({ where: { id } });
  }

  async findActivityByTimelineId(timelineId: string): Promise<LiveActivityEntity> {
    return this.liveActivityRepository.findOne({
      where: { timelineId },
      relations: ['timeline'],
    });
  }

  async findActivitiesInTimeRange(
    startTime: number,
    endTime: number,
  ): Promise<LiveActivityEntity[]> {
    return this.liveActivityRepository.find({
      where: [
        {
          beginTime: Between(startTime, endTime),
        },
        {
          endTime: Between(startTime, endTime),
        },
        {
          beginTime: Between(0, startTime),
          endTime: Between(endTime, Number.MAX_SAFE_INTEGER),
        },
      ],
      relations: ['timeline'],
      order: {
        beginTime: 'ASC',
      },
    });
  }

  async findById(id: string): Promise<LiveActivityEntity> {
    return this.liveActivityRepository.findOne({
      where: { id },
      relations: ['timeline'],
    });
  }

  async deleteActivity(id: string): Promise<void> {
    await this.liveActivityRepository.delete(id);
  }
}