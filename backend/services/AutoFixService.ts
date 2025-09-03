/**
 * Auto-Fix Service for Intelligent Error Detection and Resolution
 * 
 * Integrates with various linting tools and uses Claude Code SDK 
 * for intelligent code fixes.
 */

import type { Runtime, CommandResult } from "../runtime/types.ts";
import { query, type PermissionMode } from "@anthropic-ai/claude-code";
import { logger } from "../utils/logger.ts";
import path from "node:path";

export interface LintIssue {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  rule: string;
  message: string;
  source: string; // eslint, prettier, tsc, etc.
}

export interface AutoFix {
  file: string;
  originalCode: string;
  fixedCode: string;
  description: string;
  confidence: number; // 0-1, how confident we are in the fix
  issues: LintIssue[]; // Issues this fix addresses
}

export interface LintResult {
  issues: LintIssue[];
  fixes: AutoFix[];
  summary: {
    totalIssues: number;
    fixableIssues: number;
    errorCount: number;
    warningCount: number;
  };
}

export class AutoFixService {
  private runtime: Runtime;
  private cliPath: string;

  constructor(runtime: Runtime, cliPath: string) {
    this.runtime = runtime;
    this.cliPath = cliPath;
  }

  /**
   * Run comprehensive linting on a project
   */
  async lintProject(projectPath: string): Promise<LintResult> {
    logger.app.info("Starting lint analysis for project: {projectPath}", { projectPath });

    const issues: LintIssue[] = [];
    const fixes: AutoFix[] = [];

    try {
      // Run multiple linters in parallel
      const lintPromises = [
        this.runESLint(projectPath),
        this.runPrettier(projectPath),
        this.runTypeScriptCheck(projectPath),
      ];

      const results = await Promise.allSettled(lintPromises);
      
      // Collect issues from all linters
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          issues.push(...result.value);
        } else {
          logger.app.warn("Linter {index} failed: {error}", {
            index,
            error: result.reason,
          });
        }
      });

      // Generate fixes for issues
      if (issues.length > 0) {
        const generatedFixes = await this.generateFixes(projectPath, issues);
        fixes.push(...generatedFixes);
      }

      const summary = this.createSummary(issues, fixes);

      logger.app.info("Lint analysis complete: {summary}", { summary });

      return { issues, fixes, summary };

    } catch (error) {
      logger.app.error("Lint analysis failed: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Run ESLint on the project
   */
  private async runESLint(projectPath: string): Promise<LintIssue[]> {
    const issues: LintIssue[] = [];

    try {
      // Check if ESLint is available
      const eslintResult = await this.runtime.runCommand('npx', ['eslint', '--version'], {
        env: { PWD: projectPath }
      });

      if (!eslintResult.success) {
        logger.app.debug("ESLint not available in project");
        return issues;
      }

      // Run ESLint with JSON output
      const lintResult = await this.runtime.runCommand('npx', [
        'eslint',
        '.',
        '--format=json',
        '--ext=.js,.jsx,.ts,.tsx'
      ], {
        env: { PWD: projectPath }
      });

      if (lintResult.stdout) {
        try {
          const eslintOutput = JSON.parse(lintResult.stdout);
          
          eslintOutput.forEach((fileResult: any) => {
            fileResult.messages.forEach((message: any) => {
              issues.push({
                file: path.relative(projectPath, fileResult.filePath),
                line: message.line,
                column: message.column,
                severity: message.severity === 2 ? 'error' : 'warning',
                rule: message.ruleId || 'unknown',
                message: message.message,
                source: 'eslint',
              });
            });
          });
        } catch (parseError) {
          logger.app.warn("Failed to parse ESLint output");
        }
      }

    } catch (error) {
      logger.app.debug("ESLint execution failed: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return issues;
  }

  /**
   * Run Prettier formatting check
   */
  private async runPrettier(projectPath: string): Promise<LintIssue[]> {
    const issues: LintIssue[] = [];

    try {
      // Check if Prettier is available
      const prettierResult = await this.runtime.runCommand('npx', ['prettier', '--version'], {
        env: { PWD: projectPath }
      });

      if (!prettierResult.success) {
        return issues;
      }

      // Check formatting
      const checkResult = await this.runtime.runCommand('npx', [
        'prettier',
        '--check',
        '**/*.{js,jsx,ts,tsx,css,scss,html,json,md}'
      ], {
        env: { PWD: projectPath }
      });

      if (!checkResult.success && checkResult.stdout) {
        const unformattedFiles = checkResult.stdout
          .split('\n')
          .filter(line => line.trim())
          .filter(line => !line.startsWith('Checking'));

        unformattedFiles.forEach(filePath => {
          issues.push({
            file: path.relative(projectPath, filePath),
            line: 1,
            column: 1,
            severity: 'warning',
            rule: 'prettier',
            message: 'Code style issues detected',
            source: 'prettier',
          });
        });
      }

    } catch (error) {
      logger.app.debug("Prettier check failed: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return issues;
  }

  /**
   * Run TypeScript type checking
   */
  private async runTypeScriptCheck(projectPath: string): Promise<LintIssue[]> {
    const issues: LintIssue[] = [];

    try {
      // Check if TypeScript is available
      const tscResult = await this.runtime.runCommand('npx', ['tsc', '--version'], {
        env: { PWD: projectPath }
      });

      if (!tscResult.success) {
        return issues;
      }

      // Run TypeScript compiler check
      const typeCheckResult = await this.runtime.runCommand('npx', [
        'tsc',
        '--noEmit',
        '--pretty',
        'false'
      ], {
        env: { PWD: projectPath }
      });

      if (!typeCheckResult.success && typeCheckResult.stdout) {
        const lines = typeCheckResult.stdout.split('\n');
        
        lines.forEach(line => {
          // Parse TypeScript error format: file(line,column): error TS####: message
          const match = line.match(/^(.+?)\((\d+),(\d+)\): (error|warning) TS(\d+): (.+)$/);
          
          if (match) {
            const [, filePath, lineStr, columnStr, severityStr, code, message] = match;
            
            issues.push({
              file: path.relative(projectPath, filePath),
              line: parseInt(lineStr),
              column: parseInt(columnStr),
              severity: severityStr as 'error' | 'warning',
              rule: `TS${code}`,
              message,
              source: 'typescript',
            });
          }
        });
      }

    } catch (error) {
      logger.app.debug("TypeScript check failed: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return issues;
  }

  /**
   * Generate automatic fixes using Claude Code SDK
   */
  private async generateFixes(projectPath: string, issues: LintIssue[]): Promise<AutoFix[]> {
    const fixes: AutoFix[] = [];

    // Group issues by file for batch processing
    const issuesByFile = new Map<string, LintIssue[]>();
    issues.forEach(issue => {
      const fileIssues = issuesByFile.get(issue.file) || [];
      fileIssues.push(issue);
      issuesByFile.set(issue.file, fileIssues);
    });

    // Generate fixes for each file
    for (const [filePath, fileIssues] of issuesByFile) {
      try {
        const fullPath = path.join(projectPath, filePath);
        
        // Read file content
        const fileContentResult = await this.runtime.runCommand('cat', [fullPath]);
        if (!fileContentResult.success) {
          continue;
        }

        const originalCode = fileContentResult.stdout;
        const fixPrompt = this.createFixPrompt(filePath, originalCode, fileIssues);

        // Use Claude Code SDK to generate fix
        let fixedCode = '';
        let fixDescription = '';

        for await (const sdkMessage of query({
          prompt: fixPrompt,
          options: {
            executable: "node" as const,
            executableArgs: [],
            pathToClaudeCodeExecutable: this.cliPath,
            cwd: projectPath,
            permissionMode: "plan" as PermissionMode,
          },
        })) {
          if (sdkMessage.type === 'assistant' && sdkMessage.message.content) {
            for (const content of sdkMessage.message.content) {
              if (content.type === 'text') {
                const text = (content as { text: string }).text;
                
                // Extract fixed code and description from Claude's response
                if (text.includes('```')) {
                  const codeMatch = text.match(/```[\w]*\n([\s\S]*?)\n```/);
                  if (codeMatch) {
                    fixedCode = codeMatch[1];
                  }
                }
                
                fixDescription = text;
                break;
              }
            }
          }
        }

        if (fixedCode && fixedCode !== originalCode) {
          fixes.push({
            file: filePath,
            originalCode,
            fixedCode,
            description: fixDescription,
            confidence: this.calculateConfidence(fileIssues),
            issues: fileIssues,
          });
        }

      } catch (error) {
        logger.app.warn("Failed to generate fix for {filePath}: {error}", {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return fixes;
  }

  /**
   * Create a prompt for Claude to fix the issues
   */
  private createFixPrompt(filePath: string, code: string, issues: LintIssue[]): string {
    const issueDescriptions = issues.map(issue => 
      `- Line ${issue.line}, Column ${issue.column}: ${issue.message} (${issue.rule})`
    ).join('\n');

    return `Please fix the following linting issues in the file ${filePath}:

${issueDescriptions}

Current code:
\`\`\`
${code}
\`\`\`

Please provide the corrected code that fixes these issues while maintaining the original functionality. Focus on:
1. Fixing syntax and type errors
2. Applying consistent code formatting
3. Following best practices
4. Preserving the original logic and behavior

Return only the corrected code in a code block, followed by a brief explanation of the changes made.`;
  }

  /**
   * Calculate confidence score for a fix
   */
  private calculateConfidence(issues: LintIssue[]): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for formatting issues
    const formattingIssues = issues.filter(i => 
      i.source === 'prettier' || 
      i.rule.includes('indent') || 
      i.rule.includes('spacing')
    );
    
    if (formattingIssues.length > 0) {
      confidence += 0.3;
    }

    // Lower confidence for complex logic issues
    const complexIssues = issues.filter(i => 
      i.severity === 'error' || 
      i.rule.includes('no-unused-vars') ||
      i.rule.includes('prefer-const')
    );

    if (complexIssues.length > 0) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  /**
   * Create summary of lint results
   */
  private createSummary(issues: LintIssue[], fixes: AutoFix[]) {
    return {
      totalIssues: issues.length,
      fixableIssues: fixes.length,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
    };
  }

  /**
   * Apply a fix to the file system
   */
  async applyFix(projectPath: string, fix: AutoFix): Promise<boolean> {
    try {
      const fullPath = path.join(projectPath, fix.file);
      
      // Write the fixed code to the file
      const writeResult = await this.runtime.runCommand('tee', [fullPath], {
        env: { PWD: projectPath }
      });

      if (writeResult.success) {
        logger.app.info("Applied fix to {file}", { file: fix.file });
        return true;
      }

      return false;

    } catch (error) {
      logger.app.error("Failed to apply fix to {file}: {error}", {
        file: fix.file,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Apply all fixes with the given confidence threshold
   */
  async applyFixes(
    projectPath: string, 
    fixes: AutoFix[], 
    confidenceThreshold = 0.7
  ): Promise<{ applied: number; failed: number }> {
    let applied = 0;
    let failed = 0;

    const applicableFixes = fixes.filter(fix => fix.confidence >= confidenceThreshold);

    for (const fix of applicableFixes) {
      const success = await this.applyFix(projectPath, fix);
      if (success) {
        applied++;
      } else {
        failed++;
      }
    }

    logger.app.info("Applied {applied} fixes, {failed} failed", { applied, failed });

    return { applied, failed };
  }
}