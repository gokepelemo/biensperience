# Contributing to Biensperience

Thanks for taking the time to contribute.

## Quick Start

1. Fork the repo and clone your fork
2. Install dependencies:
   - `bun install`
3. Create a `.env` file:
   - `cp .env.example .env`
4. Create upload directories:
   - `mkdir -p uploads/images uploads/documents uploads/temp`
5. Start dev:
   - `bun run dev` (Vite)
   - `bun run start` (API/server)

If you prefer the existing PM2 flow, see `README.md`.

## Development Guidelines

- Keep changes focused and small.
- Follow existing code patterns (components, hooks, utilities).
- **No `console.log/warn/error`**:
  - Frontend: use `src/utilities/logger.js`
  - Backend: use `utilities/backend-logger.js`
- Avoid adding new dependencies unless necessary.

## Testing

- Frontend: `bun run test:frontend`
- API: `bun run test:api`

Include tests for bug fixes when there’s an existing test harness.

## Submitting Changes

1. Create a branch: `git checkout -b yourname/short-description`
2. Make your changes and run tests.
3. Open a pull request.

### Pull Request Expectations

- Describe what changed and why.
- Link any related issue.
- Include screenshots for UI changes.
- Note any new environment variables and update `.env.example`.

## Reporting Bugs

Please open a GitHub Issue with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs when helpful

## Security Issues

Do **not** open a public issue for security vulnerabilities.

See `SECURITY.md` for responsible disclosure instructions.

## License and Contributions

This project is licensed under **AGPL-3.0** (see `LICENSE`).

By submitting a pull request, you agree that your contribution is licensed under AGPL-3.0 and that you have the right to submit it under those terms.
