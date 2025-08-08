/**
 * Parser for Claude Code output to extract structured information
 */

export enum OutputType {
  FILE_CHANGE = 'FILE_CHANGE',
  ERROR = 'ERROR',
  PROGRESS = 'PROGRESS',
  COMPLETION = 'COMPLETION',
  INFO = 'INFO',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structure of a parsed output entry
 */
export interface ParsedOutput {
  type: OutputType;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  lineNumber?: number;
}

/**
 * Structure for file changes
 */
export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete';
  content?: string;
}

/**
 * Options for the OutputParser
 */
export interface OutputParserOptions {
  stripAnsiCodes?: boolean;
  includeLineNumbers?: boolean;
}

/**
 * Parses Claude Code output to extract structured information
 */
export class OutputParser {
  private buffer = '';
  private lineCount = 0;
  private options: Required<OutputParserOptions>;

  constructor(options: OutputParserOptions = {}) {
    this.options = {
      stripAnsiCodes: options.stripAnsiCodes ?? true,
      includeLineNumbers: options.includeLineNumbers ?? true,
    };
  }

  /**
   * Parse a chunk of output
   */
  public parse(text: string): ParsedOutput[] {
    this.buffer += text;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    return lines
      .filter((line) => line.trim().length > 0)
      .map((line, index) => this.parseLine(line, this.lineCount + index));
  }

  /**
   * Process any remaining buffered content
   */
  public flush(): ParsedOutput[] {
    if (!this.buffer) {
      return [];
    }

    const result =
      this.buffer.trim().length > 0
        ? [this.parseLine(this.buffer, this.lineCount)]
        : [];

    this.buffer = '';
    return result;
  }

  /**
   * Parse a single line of output
   */
  private parseLine(line: string, lineNumber: number): ParsedOutput {
    this.lineCount = lineNumber + 1;
    const cleanLine = this.options.stripAnsiCodes ? this.stripAnsi(line) : line;
    const parsed: ParsedOutput = {
      type: OutputType.UNKNOWN,
      message: cleanLine,
      timestamp: new Date(),
    };

    if (this.options.includeLineNumbers) {
      parsed.lineNumber = this.lineCount;
    }

    const fileChange = this.detectFileChange(cleanLine);
    if (fileChange) {
      parsed.type = OutputType.FILE_CHANGE;
      parsed.metadata = { fileChange };
      return parsed;
    }

    if (this.detectError(cleanLine)) {
      parsed.type = OutputType.ERROR;
      return parsed;
    }

    const progress = this.detectProgress(cleanLine);
    if (progress !== null) {
      parsed.type = OutputType.PROGRESS;
      parsed.metadata = { progress };
      return parsed;
    }

    if (this.detectCompletion(cleanLine)) {
      parsed.type = OutputType.COMPLETION;
      return parsed;
    }

    parsed.type = OutputType.INFO;
    return parsed;
  }

  /**
   * Strip ANSI color codes from a string
   */
  private stripAnsi(text: string): string {
    // Using a safer approach to strip ANSI color codes by using character code
    const escapeChar = String.fromCharCode(27);
    const regex = new RegExp(`${escapeChar}\\[[0-9;]*m`, 'g');
    return text.replace(regex, '');
  }

  /**
   * Detect if a line indicates a file change
   */
  private detectFileChange(line: string): FileChange | null {
    const createMatch = line.match(/^Creating file: (.+)$/);
    if (createMatch) {
      return {
        path: createMatch[1],
        action: 'create',
      };
    }

    const modifyMatch = line.match(/^Modifying file: (.+)$/);
    if (modifyMatch) {
      return {
        path: modifyMatch[1],
        action: 'modify',
      };
    }

    const deleteMatch = line.match(/^Deleting file: (.+)$/);
    if (deleteMatch) {
      return {
        path: deleteMatch[1],
        action: 'delete',
      };
    }

    return null;
  }

  /**
   * Detect if a line indicates an error
   */
  private detectError(line: string): boolean {
    const errorPatterns = [/error:/i, /exception:/i, /fatal:/i, /failed to/i];

    return errorPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Detect if a line indicates progress and extract percentage
   */
  private detectProgress(line: string): number | null {
    const percentMatch = line.match(/(\d+)%/);
    if (percentMatch) {
      const percent = Number.parseInt(percentMatch[1], 10);
      if (!Number.isNaN(percent) && percent >= 0 && percent <= 100) {
        return percent;
      }
    }

    return null;
  }

  /**
   * Detect if a line indicates completion
   */
  private detectCompletion(line: string): boolean {
    const completionPatterns = [
      /task completed/i,
      /completed successfully/i,
      /finished successfully/i,
      /all done/i,
    ];

    return completionPatterns.some((pattern) => pattern.test(line));
  }
}
