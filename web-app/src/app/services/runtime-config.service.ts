import { Injectable } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl: string;
  useMockApi: boolean;
  basicAuth: {
    username: string;
    password: string;
  };
}

export interface BuildInfo {
  gitCommit: string;
  buildTimestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class RuntimeConfigService {
  private readonly fallbackConfig: RuntimeConfig = {
    apiBaseUrl: 'http://localhost:8000',
    useMockApi: true,
    basicAuth: {
      username: '',
      password: ''
    }
  };

  private readonly fallbackBuildInfo: BuildInfo = {
    gitCommit: 'unknown',
    buildTimestamp: 'unknown'
  };

  config: RuntimeConfig = this.fallbackConfig;
  buildInfo: BuildInfo = this.fallbackBuildInfo;

  async load(): Promise<void> {
    await Promise.all([this.loadPropertiesConfig(), this.loadBuildInfo()]);
  }

  private async loadPropertiesConfig(): Promise<void> {
    try {
      const response = await fetch('/assets/hsm-web.properties', { cache: 'no-store' });
      if (!response.ok) {
        this.config = this.fallbackConfig;
        return;
      }

      const content = await response.text();
      const parsed = this.parseProperties(content);
      const useMockApi = (parsed['useMockApi'] ?? 'true').trim().toLowerCase() === 'true';
      this.config = {
        apiBaseUrl: (parsed['apiBaseUrl'] ?? this.fallbackConfig.apiBaseUrl).trim(),
        useMockApi,
        basicAuth: {
          username: (parsed['basicAuth.username'] ?? '').trim(),
          password: (parsed['basicAuth.password'] ?? '').trim()
        }
      };
    } catch {
      this.config = this.fallbackConfig;
    }
  }

  private async loadBuildInfo(): Promise<void> {
    try {
      const response = await fetch('/assets/build-info.json', { cache: 'no-store' });
      if (!response.ok) {
        this.buildInfo = this.fallbackBuildInfo;
        return;
      }

      const data = (await response.json()) as Partial<BuildInfo>;
      this.buildInfo = {
        gitCommit: data.gitCommit ?? this.fallbackBuildInfo.gitCommit,
        buildTimestamp: data.buildTimestamp ?? this.fallbackBuildInfo.buildTimestamp
      };
    } catch {
      this.buildInfo = this.fallbackBuildInfo;
    }
  }

  private parseProperties(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      result[key] = value;
    }

    return result;
  }
}
