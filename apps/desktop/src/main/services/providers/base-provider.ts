import type { MobileEnvironment, ValidationResult, BuildResult, TestResult, AppStartResult, AppStatusResult, AppLogsResult } from '@peep/shared';

export interface ProviderPreviewSession {
  url: string;
  processId: number;
  logs: string[];
}

export abstract class FrameworkProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly env: MobileEnvironment;

  // Project detection
  abstract detect(projectPath: string): Promise<boolean>;

  // Project Lifecycle
  abstract createProject(name: string, parentPath: string, templateId?: string): Promise<string>;
  
  async bootstrapProject(_projectPath: string, _options?: { template?: string }): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: `Bootstrap is not supported by the ${this.name} provider.`
    };
  }
  
  async installDependencies(_projectPath: string, _packages: string[]): Promise<{ success: boolean; exitCode: number | null; stdout: string; stderr: string; message?: string }> {
    return {
      success: false,
      exitCode: null,
      stdout: '',
      stderr: '',
      message: `Dependency installation is not supported by the ${this.name} provider.`
    };
  }
  
  // Preview System
  abstract startPreview(projectPath: string, port: number, onLog?: (line: string) => void): Promise<ProviderPreviewSession>;
  abstract stopPreview(processId: number): void;
  abstract reloadPreview(processId: number): void;

  // Build System (Optional)
  abstract buildAndroid(projectPath: string): Promise<string>;
  abstract buildIos(projectPath: string): Promise<string>;
  abstract buildWeb(projectPath: string): Promise<string>;

  // Runtime Validation (P1.1)
  abstract validateProject(projectPath: string): Promise<ValidationResult>;

  // Build, Test, Execution (P1.2)
  async buildProject(_projectPath: string, platform: string): Promise<BuildResult> {
    return {
      success: false,
      framework: this.env.framework,
      environment: this.env.environment,
      platform,
      exitCode: null,
      stdout: '',
      stderr: '',
      errorCategory: 'environment_error',
      message: `Build is not supported by the ${this.name} provider in this environment.`
    };
  }

  async runTests(_projectPath: string): Promise<TestResult> {
    return {
      success: true,
      status: 'not_configured',
      message: `Running tests is not supported by the ${this.name} provider.`
    };
  }

  async startApplication(_projectPath: string): Promise<AppStartResult> {
    return {
      success: false,
      processId: 0,
      status: 'error',
      message: `Starting application is not supported by the ${this.name} provider.`,
      errorCategory: 'environment_error'
    };
  }

  async stopApplication(_processId: number): Promise<boolean> {
    return false;
  }

  async getApplicationStatus(processId: number): Promise<AppStatusResult> {
    return {
      processId,
      status: 'unknown',
      command: '',
      framework: this.env.framework,
      environment: this.env.environment,
      startedAt: '',
      exitCode: null
    };
  }

  async getRuntimeLogs(processId: number): Promise<AppLogsResult> {
    return {
      processId,
      status: 'unknown',
      stdout: '',
      stderr: '',
      logs: [],
      detectedErrors: []
    };
  }

  // Agent Context
  abstract getAgentContext(projectPath: string): Promise<string>;
}
