# Looma

An AI-native zero-code platform that combines traditional SaaS capabilities with AI-powered interactions. Build forms, workflows, and AI agents through natural language and visual drag-and-drop.

## Project Layout

This repository contains two independent Node.js projects:

```text
looma/
├── backend/                  # NestJS API project
│   ├── src/
│   │   ├── controllers/      # Business API controllers
│   │   └── lib/              # Auth, database, forms, data modeling
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Next.js frontend project
│   ├── src/
│   │   ├── app/              # App Router pages and NextAuth route
│   │   ├── components/       # React components
│   │   ├── lib/              # Browser/frontend utilities
│   │   └── server/           # Frontend server helpers
│   ├── package.json
│   └── tsconfig.json
├── docs/
└── .env.example
```

The repository root is not an npm project. Run commands from `backend/` or `frontend/`.

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **Backend API**: NestJS
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: NextAuth.js v5
- **UI Components**: shadcn/ui + Radix
- **Drag & Drop**: dnd-kit / React Flow
- **AI Protocol**: AG-UI Protocol
- **Agent Orchestration**: LangGraph
- **AI SDK**: CopilotKit

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- npm

### Environment

Create a local environment file at the repository root:

```bash
cp .env.example .env.local
```

Update at least these values:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/looma
AUTH_SECRET=your-auth-secret-here
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:3000
NEST_API_URL=http://localhost:4000
API_PORT=4000
```

Both projects load `../.env` and `../.env.local` during development.

### Backend

```bash
cd backend
npm install
npm run db:push
npm run dev
```

The NestJS API runs on `http://localhost:4000` by default.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The frontend proxies business API requests to `NEST_API_URL`, which defaults to `http://localhost:4000`. NextAuth remains inside the Next.js app under `/api/auth/*`; the rest of the business APIs are handled by NestJS.

## Scripts

Backend scripts:

```bash
cd backend
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
npm run db:seed
```

Frontend scripts:

```bash
cd frontend
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test:e2e
```

## Documentation

- [Specification](./SPEC.md) - Detailed feature specifications
- [Project Plan](./docs/PROJECT_PLAN.md) - Product architecture and phased implementation plan
- [Roadmap](./docs/ROADMAP.md) - Project roadmap and execution plan

## License

MIT
