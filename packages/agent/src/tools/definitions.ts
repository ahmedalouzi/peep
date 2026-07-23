export const OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the full contents of a project file. Path is relative to project root or absolute.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path e.g. lib/main.dart' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List files and directories at a path within the project.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path, use "." for project root' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_files',
      description: 'Search for files by name within the project.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Filename search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_content',
      description: 'Search for text content across project source files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_file_edit',
      description:
        'Propose an edit to a file. Provide the complete new file content. User must approve before changes are applied.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to project root' },
          content: { type: 'string', description: 'Complete new file content' },
          description: { type: 'string', description: 'Brief description of the change' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description: 'Run a shell/terminal command in the project root directory. Safe dev commands (flutter pub get, flutter analyze, npm install, etc.) run automatically. Destructive commands (rm -rf, git push --force, etc.) will require user confirmation. Returns stdout and stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The exact shell command line string to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_file',
      description: 'Delete a single file from the project. Requires user confirmation for irreversible deletion.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to project root' },
          reason: { type: 'string', description: 'Why this file is being deleted' },
        },
        required: ['path', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rename_file',
      description: 'Rename or move a file within the project workspace.',
      parameters: {
        type: 'object',
        properties: {
          oldPath: { type: 'string', description: 'Current file path relative to project root' },
          newPath: { type: 'string', description: 'New file path relative to project root' },
        },
        required: ['oldPath', 'newPath'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_design_manifest',
      description: 'Create or update the project Design Manifest (.peep/design.json). Use this to establish or evolve the project\'s visual DNA (colors, typography, spacing, component styles, brand personality). Always call this before generating major UI for the first time.',
      parameters: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Full or partial DesignManifest object to merge into the existing manifest',
          },
        },
        required: ['manifest'],
      },
    },
  },
];
