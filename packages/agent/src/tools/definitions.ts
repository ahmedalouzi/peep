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
];
