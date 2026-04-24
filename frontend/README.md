# AI Agent Frontend

Next.js-based web application providing a modern chat interface for the AI Agent.

## Tech Stack

- **Next.js 15+**: React framework for the web.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **TypeScript**: For type-safe development.

## Features

- **Real-time Chat**: Interaction with the FastAPI backend agent.
- **Responsive Design**: Optimized for different screen sizes using Tailwind CSS.
- **Markdown Rendering**: Support for rich text responses from the AI.

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the result.

## Configuration

The frontend is configured to communicate with the backend at `http://localhost:8000`. If your backend is running on a different port, update the API calls in `components/ChatInterface.tsx`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
