import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export function executeCodeTool(
  httpService: HttpService,
  config: ConfigService,
) {
  return tool(
    async ({ code }) => {
      const sandboxUrl = config.get<string>('SANDBOX_URL');
      if (!sandboxUrl) {
        return 'Error: SANDBOX_URL not configured';
      }

      try {
        const response = await firstValueFrom(
          httpService.post<{
            output: string;
            result?: string;
            error?: string;
          }>(`${sandboxUrl}/execute`, { code }, { timeout: 10000 }),
        );

        const { output, result, error } = response.data;

        if (error) {
          return `Execution error: ${error}`;
        }

        let resultStr = result !== undefined ? `Result: ${result}` : '';
        if (output) {
          resultStr = (resultStr ? resultStr + '\n' : '') + `Output:\n${output}`;
        }

        return resultStr || 'Execution completed with no output';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Failed to execute code: ${message}`;
      }
    },
    {
      name: 'execute_code',
      description: `Executes JavaScript code in a secure isolated sandbox environment.

Available globals: Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, Proxy, Reflect, Symbol, console.
Not available: require, process, fetch, file system access, network access, global/globalThis, Buffer.

The code will timeout after 5 seconds. Returns console output and the final expression value.
Maximum code length: 10,000 characters.`,
      schema: z.object({
        code: z
          .string()
          .describe(
            'JavaScript code to execute in the sandbox. Can include console.log statements and complex expressions.',
          )
          .max(10000, 'Code must be less than 10,000 characters'),
      }),
    },
  );
}
