import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  DocxTemplateInfo,
  DocxTemplateValidation,
  DocxTemplatePreview,
} from '../shared/types';

export class PythonBridge {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<
    number | string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();
  private buffer = '';
  private isReady = false;
  private readyPromise: Promise<void> | null = null;

  /**
   * Get the path to the Python executable
   */
  private getPythonPath(): string {
    // Try common Python paths
    if (process.platform === 'win32') {
      return 'python';
    }
    return 'python3';
  }

  /**
   * Get the path to the engine script
   */
  private getEnginePath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'engine', 'main.py');
    }
    return path.join(app.getAppPath(), 'engine', 'main.py');
  }

  /**
   * Start the Python engine
   */
  async start(): Promise<void> {
    if (this.process && this.isReady) {
      return;
    }

    const pythonPath = this.getPythonPath();
    const enginePath = this.getEnginePath();

    console.log(`Starting Python engine: ${pythonPath} ${enginePath}`);

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.process = spawn(pythonPath, [enginePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
          },
        });

        if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
          reject(new Error('Failed to create stdio streams'));
          return;
        }

        // Handle stdout (JSON-RPC responses)
        this.process.stdout.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        // Handle stderr (logs and errors)
        this.process.stderr.on('data', (data: Buffer) => {
          const message = data.toString().trim();
          if (message.includes('Python engine ready')) {
            this.isReady = true;
            console.log('Python engine is ready');
            resolve();
          } else {
            console.log('[Python]', message);
          }
        });

        // Handle process exit
        this.process.on('exit', (code) => {
          console.log(`Python engine exited with code ${code}`);
          this.isReady = false;
          this.process = null;

          // Reject all pending requests
          for (const [, pending] of this.pendingRequests) {
            pending.reject(new Error('Python engine exited'));
          }
          this.pendingRequests.clear();
        });

        // Handle process error
        this.process.on('error', (error) => {
          console.error('Python engine error:', error);
          reject(error);
        });

        // Timeout for startup
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Python engine startup timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });

    return this.readyPromise;
  }

  /**
   * Stop the Python engine
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.isReady = false;
    }
  }

  /**
   * Check if the engine is running
   */
  isRunning(): boolean {
    return this.isReady && this.process !== null;
  }

  /**
   * Handle incoming data from Python
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete JSON-RPC responses (newline-delimited)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (error) {
        console.error('Failed to parse Python response:', line, error);
      }
    }
  }

  /**
   * Call a method on the Python engine
   */
  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.isReady || !this.process?.stdin) {
      // Try to start if not running
      await this.start();

      if (!this.isReady || !this.process?.stdin) {
        throw new Error('Python engine is not running');
      }
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);

      // Send request
      const message = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(message);
    });
  }

  // Convenience methods for common operations

  /**
   * Render a Jinja2 template
   */
  async renderTemplate(template: string, data: Record<string, unknown>): Promise<string> {
    const result = await this.call<{ rendered: string }>('render_template', {
      template,
      data,
    });
    return result.rendered;
  }

  /**
   * Generate a PDF document
   */
  async generatePdf(
    templatePath: string,
    data: Record<string, unknown>,
    outputPath: string
  ): Promise<string> {
    const result = await this.call<{ path: string }>('generate_pdf', {
      template_path: templatePath,
      data,
      output_path: outputPath,
    });
    return result.path;
  }

  /**
   * Generate a DOCX document
   */
  async generateDocx(
    templatePath: string,
    data: Record<string, unknown>,
    outputPath: string
  ): Promise<string> {
    const result = await this.call<{ path: string }>('generate_docx', {
      template_path: templatePath,
      data,
      output_path: outputPath,
    });
    return result.path;
  }

  /**
   * Check for sensitive data in text
   */
  async checkSensitiveData(
    text: string
  ): Promise<{
    hasSensitiveData: boolean;
    findings: Array<{
      type: string;
      value: string;
      position: { start: number; end: number };
    }>;
  }> {
    return this.call('check_sensitive_data', { text });
  }

  /**
   * Get Python engine version info
   */
  async getVersion(): Promise<{ python: string; engine: string }> {
    return this.call('get_version');
  }

  // DOCX Template Methods

  /**
   * Parse a DOCX template and extract variables
   */
  async parseDocxTemplate(docxPath: string): Promise<DocxTemplateInfo> {
    return this.call<DocxTemplateInfo>('parse_docx_template', {
      docx_path: docxPath,
    });
  }

  /**
   * Validate a DOCX template for compatibility
   */
  async validateDocxTemplate(docxPath: string): Promise<DocxTemplateValidation> {
    return this.call<DocxTemplateValidation>('validate_docx_template', {
      docx_path: docxPath,
    });
  }

  /**
   * Render a DOCX template with data
   * @param templatePath Path to the DOCX template
   * @param data Data to fill into the template
   * @param outputPath Where to save the output
   * @param format Output format - "pdf" or "docx"
   */
  async renderDocxTemplate(
    templatePath: string,
    data: Record<string, unknown>,
    outputPath: string,
    format: 'pdf' | 'docx' = 'pdf'
  ): Promise<string> {
    const result = await this.call<{ path: string }>('render_docx_template', {
      template_path: templatePath,
      data,
      output_path: outputPath,
      format,
    });
    return result.path;
  }

  /**
   * Generate a preview of a DOCX template with sample data
   */
  async previewDocxTemplate(
    templatePath: string,
    sampleData: Record<string, unknown>
  ): Promise<DocxTemplatePreview> {
    return this.call<DocxTemplatePreview>('preview_docx_template', {
      template_path: templatePath,
      sample_data: sampleData,
    });
  }
}
