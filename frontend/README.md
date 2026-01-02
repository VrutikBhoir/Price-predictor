# Frontend (Next.js)

## Setup

1. Install dependencies

```bash
cd frontend
npm install
```

2. Create env file

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Run dev server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser. 