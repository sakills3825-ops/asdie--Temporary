/**
 * ResourceManager - 시스템 리소스 모니터링
 *
 * 책임: 메모리, CPU 사용량 모니터링
 * - 메모리 사용량 추적
 * - CPU 사용량 추적
 * - 리소스 제한 검사
 *
 * SRP 원칙: 리소스 모니터링만 담당
 * 리소스 강제는 enforcers 계층에 위임
 */

import os from 'os';
import { LoggerImpl, type ILogger, LogLevel } from '../../shared/logger';

export interface MemoryUsage {
  total: number; // 총 메모리 (bytes)
  used: number; // 사용 중인 메모리 (bytes)
  free: number; // 여유 메모리 (bytes)
  percentUsed: number; // 사용률 (%)
}

export interface CPUUsage {
  loadAverage: number[]; // [1분, 5분, 15분]
  cores: number; // CPU 코어 수
}

export interface SystemStatus {
  memory: MemoryUsage;
  cpu: CPUUsage;
  timestamp: number;
}

/**
 * 시스템 리소스 모니터
 */
export class ResourceManager {
  private logger: ILogger;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new LoggerImpl('ResourceManager', LogLevel.INFO);
  }

  /**
   * 메모리 사용량 조회
   *
   * @returns 메모리 정보
   */
  public getMemoryUsage(): MemoryUsage {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentUsed = (usedMem / totalMem) * 100;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentUsed,
    };
  }

  /**
   * CPU 사용량 조회
   *
   * @returns CPU 정보
   */
  public getCpuUsage(): CPUUsage {
    return {
      loadAverage: os.loadavg(),
      cores: os.cpus().length,
    };
  }

  /**
   * 전체 시스템 상태 조회
   *
   * @returns 시스템 상태
   */
  public getSystemStatus(): SystemStatus {
    return {
      memory: this.getMemoryUsage(),
      cpu: this.getCpuUsage(),
      timestamp: Date.now(),
    };
  }

  /**
   * 메모리 부족 여부 확인
   *
   * @returns 메모리 부족 여부
   */
  public isMemoryLow(): boolean {
    const memory = this.getMemoryUsage();
    // 20% 이상 남아있으면 정상
    return memory.percentUsed > 80;
  }

  /**
   * 메모리 심각 부족 여부 확인
   *
   * @returns 메모리 심각 부족 여부
   */
  public isMemoryCritical(): boolean {
    const memory = this.getMemoryUsage();
    // 90% 이상 사용 중이면 위험
    return memory.percentUsed > 90;
  }

  /**
   * 메모리 백분율 조회
   *
   * @returns 메모리 사용률 (0-100)
   */
  public getMemoryPercentage(): number {
    return this.getMemoryUsage().percentUsed;
  }

  /**
   * 여유 메모리 조회 (MB)
   *
   * @returns 여유 메모리 (MB)
   */
  public getFreeMemoryMB(): number {
    const freeBytes = os.freemem();
    return Math.round(freeBytes / (1024 * 1024));
  }

  /**
   * 사용 중인 메모리 조회 (MB)
   *
   * @returns 사용 중인 메모리 (MB)
   */
  public getUsedMemoryMB(): number {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    return Math.round(usedBytes / (1024 * 1024));
  }

  /**
   * 총 메모리 조회 (MB)
   *
   * @returns 총 메모리 (MB)
   */
  public getTotalMemoryMB(): number {
    const totalBytes = os.totalmem();
    return Math.round(totalBytes / (1024 * 1024));
  }

  /**
   * 프로세스 메모리 사용량 조회 (MB)
   *
   * @returns 프로세스 메모리 (MB)
   */
  public getProcessMemoryMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / (1024 * 1024));
  }

  /**
   * 지정된 메모리 크기가 가용한지 확인
   *
   * @param sizeInMB 필요한 메모리 (MB)
   * @returns 가용 여부
   */
  public canAllocate(sizeInMB: number): boolean {
    const freeMemMB = this.getFreeMemoryMB();
    // 안전 마진: 필요 메모리 + 10% 버퍼
    const requiredMemMB = sizeInMB * 1.1;
    return freeMemMB > requiredMemMB;
  }

  /**
   * CPU 평균 부하 조회
   *
   * @returns CPU 평균 부하 (1분)
   */
  public getCpuLoadAverage(): number {
    const avg = os.loadavg()[0];
    return avg ?? 0;
  }

  /**
   * 리소스 상태 로깅
   */
  public logResourceStatus(): void {
    const status = this.getSystemStatus();
    this.logger.info('ResourceManager: System status', {
      module: 'ResourceManager',
      metadata: {
        memory: {
          used: `${Math.round(status.memory.used / (1024 * 1024))}MB`,
          total: `${Math.round(status.memory.total / (1024 * 1024))}MB`,
          percent: `${Math.round(status.memory.percentUsed)}%`,
        },
        cpu: {
          loadAverage: (status.cpu.loadAverage[0] ?? 0).toFixed(2),
          cores: status.cpu.cores,
        },
      },
    });
  }

  /**
   * 리소스 상태 정기 모니터링 시작
   *
   * @param intervalMs 모니터링 간격 (ms)
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval !== null) {
      this.logger.warn('ResourceManager: Monitoring already started');
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.logResourceStatus();

      if (this.isMemoryCritical()) {
        this.logger.warn('ResourceManager: Memory is critical!');
      } else if (this.isMemoryLow()) {
        this.logger.warn('ResourceManager: Memory is low');
      }
    }, intervalMs);

    this.logger.info('ResourceManager: Monitoring started');
  }

  /**
   * 정기 모니터링 중지
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('ResourceManager: Monitoring stopped');
    }
  }
}
