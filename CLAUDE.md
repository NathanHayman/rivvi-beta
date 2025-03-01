# Rivvi Project Guide

## Commands

- Development: `pnpm dev` - Start Next.js development server
- Build: `pnpm build` - Build the application
- Start: `pnpm start` - Start production server
- Lint: `pnpm lint` or `pnpm lint:fix` - Run ESLint checks
- Type Check: `pnpm typecheck` - Run TypeScript type checks
- Format: `pnpm format:write` - Fix formatting with Prettier
- Database: `pnpm db:generate` - Generate migrations, `pnpm db:migrate` - Run migrations

## Code Style Guidelines

- **TypeScript**: Strict typing, explicit return types on exported functions
- **Imports**: Group by external/internal, alphabetical within groups
- **Components**: Use functional components with hooks, domain-driven organization
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Error Handling**: try/catch with proper logging, TRPCError for API errors
- **State Management**: React hooks and context, tRPC for API communication
- **Formatting**: 2-space indentation, trailing commas, semicolons required

## Project Structure

- Next.js 15 with App Router, tRPC for type-safe APIs
- PostgreSQL with Drizzle ORM, Clerk Auth, Shadcn UI components
- Key directories: `/src/app/` (pages), `/src/components/`, `/src/server/` (API)