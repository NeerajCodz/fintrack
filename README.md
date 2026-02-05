# FinTrack AI

## Powered by Vercel V0

A modern, AI-powered personal finance tracking application built with Next.js 16, Supabase, and Groq LLM.

![FinTrack AI](https://img.shields.io/badge/Next.js-16.1.6-black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Groq](https://img.shields.io/badge/Groq-LLaMA%203.3-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)

## Features

### 💬 Natural Language Chat
Track expenses using natural language:
- "I owe Ajay 50 for lunch"
- "Ram needs to pay me 100"
- "@John paid for dinner, split 80"

### 📊 Smart Dashboard
- Monthly spending overview
- Category breakdowns
- Outstanding dues summary
- Quick balance view

### 👥 Contacts Management
- Track balances with people
- View transaction history
- @mention in chat for quick access

### 🔔 Recurring Reminders
- Set up subscriptions: "Netflix 199 every 15th"
- Weekly reminders: "Gym 500 every Monday"
- Mark payments with occurrence tracking
- Undo capability for mistakes

### 🎨 Modern UI
- Dark glassmorphic design
- Smooth animations with Framer Motion
- Fully responsive
- Auto-scroll in chat

## Tech Stack

- **Framework**: Next.js 16.1.6 (Turbopack)
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **AI**: Groq (LLaMA 3.3 70B Versatile)
- **AI SDK**: Vercel AI SDK v6
- **Styling**: Tailwind CSS 4.0
- **Animations**: Framer Motion
- **UI Components**: Radix UI + shadcn/ui
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Supabase account
- Groq API key

### 1. Clone & Install

```bash
git clone https://github.com/NeerajCodz/fintrack.git
cd fintrack
pnpm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For migrations
SUPABASE_DB_URL=postgres://postgres.xxx:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres

# Groq
GROQ_API_KEY=your-groq-api-key
```

### 3. Database Setup

Run the database migration:

```powershell
# PowerShell
$env:SUPABASE_DB_URL="your-connection-string"
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx tsx scripts/run-migration.ts
```

Or manually run `scripts/000_full_reset.sql` in Supabase SQL Editor.

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
fintrack/
├── app/
│   ├── api/
│   │   ├── chat/          # AI chat endpoint
│   │   ├── conversations/ # Chat history
│   │   ├── dashboard/     # Dashboard data
│   │   ├── people/        # Contacts CRUD
│   │   └── reminders/     # Recurring reminders
│   ├── auth/              # Auth pages
│   └── chat/              # Chat UI
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── chat-view.tsx      # Main chat interface
│   ├── sidebar.tsx        # Navigation
│   ├── reminders-manager.tsx
│   └── contacts-manager.tsx
├── lib/
│   ├── db.ts              # Database operations
│   ├── types.ts           # TypeScript types
│   ├── supabase/          # Supabase clients
│   └── financial-utils.ts # Formatting helpers
└── scripts/
    ├── 000_full_reset.sql # Full DB schema
    └── run-migration.ts   # Migration runner
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `people` | Contacts with running balances |
| `transactions` | All financial transactions |
| `dues` | Outstanding payments |
| `bills` | One-time bills |
| `reminders` | Generic reminders |
| `notes` | AI-generated notes |
| `conversations` | Chat sessions |
| `messages` | Chat messages |
| `recurring_reminders` | Subscription tracking |
| `reminder_payments` | Payment occurrences |

## Chat Commands

| Input | Action |
|-------|--------|
| "I owe [name] [amount]" | Record you owe someone |
| "[name] owes me [amount]" | Record someone owes you |
| "Netflix 199 every 15th" | Create monthly reminder |
| "Gym 500 every Monday" | Create weekly reminder |
| "hi" / "hello" | Get started help |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | AI chat processing |
| `/api/people` | GET/POST | List/create contacts |
| `/api/people/[id]` | GET/PATCH/DELETE | Contact operations |
| `/api/conversations` | GET/POST | Chat sessions |
| `/api/reminders` | GET/POST | Recurring reminders |
| `/api/reminders/payments` | GET | Payment occurrences |
| `/api/dashboard` | GET | Dashboard stats |

## Development

### Type Checking

```bash
pnpm exec tsc --noEmit
```

### Linting

```bash
pnpm lint
```

### Build

```bash
pnpm build
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Self-hosted

```bash
pnpm build
pnpm start
```

## License

MIT

## Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Open Pull Request

---

Built with ❤️ using Next.js, Supabase, and Groq
