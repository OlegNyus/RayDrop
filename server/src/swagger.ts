import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RayDrop API',
      version: '1.0.0',
      description: 'API for managing Xray test cases',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Config: {
          type: 'object',
          properties: {
            configured: { type: 'boolean' },
            jiraBaseUrl: { type: 'string' },
            hasCredentials: { type: 'boolean' },
          },
        },
        ConfigInput: {
          type: 'object',
          required: ['xrayClientId', 'xrayClientSecret', 'jiraBaseUrl'],
          properties: {
            xrayClientId: { type: 'string' },
            xrayClientSecret: { type: 'string' },
            jiraBaseUrl: { type: 'string' },
          },
        },
        TestStep: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            action: { type: 'string' },
            data: { type: 'string' },
            result: { type: 'string' },
          },
        },
        Draft: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            testType: { type: 'string', enum: ['Manual', 'Automated'] },
            priority: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } },
            collectionId: { type: 'string', nullable: true },
            steps: { type: 'array', items: { $ref: '#/components/schemas/TestStep' } },
            status: { type: 'string', enum: ['new', 'draft', 'ready', 'imported'] },
            updatedAt: { type: 'number' },
            createdAt: { type: 'number' },
            isComplete: { type: 'boolean' },
            projectKey: { type: 'string' },
            testKey: { type: 'string' },
            testIssueId: { type: 'string' },
          },
        },
        Settings: {
          type: 'object',
          properties: {
            projects: { type: 'array', items: { type: 'string' } },
            hiddenProjects: { type: 'array', items: { type: 'string' } },
            activeProject: { type: 'string', nullable: true },
            projectSettings: { type: 'object', additionalProperties: { $ref: '#/components/schemas/ProjectSettings' } },
          },
        },
        ProjectSettings: {
          type: 'object',
          properties: {
            functionalAreas: { type: 'array', items: { type: 'string' } },
            labels: { type: 'array', items: { type: 'string' } },
            collections: { type: 'array', items: { $ref: '#/components/schemas/Collection' } },
            color: { type: 'string' },
          },
        },
        Collection: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            color: { type: 'string' },
          },
        },
        XrayEntity: {
          type: 'object',
          properties: {
            issueId: { type: 'string' },
            key: { type: 'string' },
            summary: { type: 'string' },
          },
        },
        ImportResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            jobId: { type: 'string' },
            testIssueIds: { type: 'array', items: { type: 'string' } },
            testKeys: { type: 'array', items: { type: 'string' } },
            error: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
