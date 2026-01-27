# RayDrop

Xray Test Case Manager - A web application for managing Xray Cloud test cases.

## Tech Stack

- **Client**: React 19 + Vite + TypeScript + Tailwind CSS
- **Server**: Express + TypeScript
- **Testing**: Vitest + React Testing Library + Playwright

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm

### Installation

```bash
# Install root dependencies (testing tools)
npm install

# Install client dependencies
npm install --prefix client

# Install server dependencies
npm install --prefix server
```

### Running the App

```bash
# Run both client and server
npm run dev

# Or run separately
npm run dev:client  # http://localhost:5173
npm run dev:server  # http://localhost:3001
```

### Building

```bash
npm run build
```

## Testing

### Test Structure

```
tests/                      # Unit + Integration tests
├── setup/                  # Setup/Config feature area
│   ├── form.test.tsx       # Component tests
│   └── api.test.ts         # Server API tests
├── test-cases/             # Test Cases feature area
├── dashboard/              # Dashboard feature area
├── settings/               # Settings feature area
├── fixtures/               # Reusable test data
├── mocks/                  # MSW API mock handlers
└── helpers/                # Test utilities

e2e/                        # End-to-end tests (Playwright)
├── playwright.config.ts
└── setup.spec.ts
```

### Running Tests

```bash
# Run all unit/integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with Vitest UI
npm run test:ui

# Run with coverage report
npm run test:coverage

# Run and open HTML coverage report
npm run test:coverage:html

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests (unit + E2E)
npm run test:all
```

### Coverage Thresholds

| Metric | Global | Critical Files |
|--------|--------|----------------|
| Statements | 80% | 90% |
| Branches | 75% | 85% |
| Functions | 80% | 90% |
| Lines | 80% | 90% |

### Coverage Reports

After running `npm run test:coverage`:

- **HTML Report**: `coverage/index.html` - Browsable coverage report
- **LCOV**: `coverage/lcov.info` - For CI tools (Codecov, Coveralls)
- **JSON**: `coverage/coverage-summary.json` - Programmatic access

### E2E Reports

After running `npm run test:e2e`:

- **HTML Report**: `coverage/e2e-report/index.html`
- **JSON Results**: `coverage/e2e-results.json`

## Project Structure

```
RayDrop/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # UI components
│       ├── context/        # React contexts
│       ├── services/       # API client
│       └── types/          # TypeScript types
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API endpoints
│       └── utils/          # Utilities
├── docs/                   # Documentation
│   └── requirements/       # Feature requirements
├── tests/                  # Unit/Integration tests
├── e2e/                    # E2E tests
└── config/                 # Runtime config (gitignored)
```

## API Endpoints

- `GET /api/config` - Get configuration status
- `POST /api/config` - Save configuration
- `POST /api/config/test-connection` - Test Xray credentials
- `DELETE /api/config` - Delete configuration
- `GET /api/settings` - Get user settings
- `GET /api/drafts` - Get test case drafts

## License

MIT
