# AI Agent Frontend

Next.js-based web application providing a modern, responsive chat interface for the AI Agent backend.

---

## Tech Stack

| Technology       | Role                                              |
|------------------|---------------------------------------------------|
| **Next.js 15+**  | React framework with App Router                   |
| **TypeScript**   | Type-safe development                             |
| **Tailwind CSS** | Utility-first CSS framework for styling           |

---

## Features

- **Real-time Chat** — Communicates with the FastAPI backend agent via REST API.
- **Markdown Rendering** — Supports rich text formatting in agent responses.
- **Responsive Design** — Optimized layout for desktop and mobile screens.

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the chat interface.

---

## Configuration

The frontend communicates with the backend at `http://localhost:8000` by default.

To change the backend URL, update the API endpoint in:

```
components/ChatInterface.tsx
```

---

## Project Structure

```text
frontend/
├── app/                  # Next.js App Router: pages and layouts
├── components/           # Reusable React components
│   └── ChatInterface.tsx # Main chat UI component
└── public/               # Static assets
```

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
