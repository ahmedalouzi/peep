import { TerminalService } from '../../../apps/desktop/src/main/services/terminal-service';

export default async function run() {
  console.log('  Testing TerminalService prompt auto-responder...');

  const service = new TerminalService();

  let stdinData = '';
  const mockChild: any = {
    stdin: {
      writable: true,
      write: (data: string) => {
        stdinData = data;
      },
    },
  };

  // Test case 1: normal log line - should not respond
  stdinData = '';
  (service as any).checkAndAutoRespond('session-1', 'Finished task: build successful', mockChild);
  if (stdinData !== '') {
    throw new Error('Expected no auto-response to a standard compilation output log');
  }

  // Test case 2: y/n prompt - should respond 'y\r\n'
  stdinData = '';
  (service as any).checkAndAutoRespond('session-1', 'Do you want to proceed? (y/n)', mockChild);
  if (stdinData !== 'y\r\n') {
    throw new Error('Expected auto-response "y\\r\\n" for (y/n) prompts');
  }

  // Test case 3: Y/N question mark prompt - should respond 'y\r\n'
  stdinData = '';
  (service as any).checkAndAutoRespond('session-1', 'Terminate batch job (Y/N)?', mockChild);
  if (stdinData !== 'y\r\n') {
    throw new Error('Expected auto-response "y\\r\\n" for (Y/N)? prompts');
  }

  console.log('  Testing TerminalService successfully passed!');
}
