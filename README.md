# Next.js + FastAPI AI Agent Boilerplate

This is a boilerplate for building AI agents with a secure backend and a modern frontend.

## Tech Stack
- **Frontend**: Next.js (App Router), Tailwind CSS
- **Backend**: FastAPI, smolagents, LiteLLM
- **LLM Provider**: OpenRouter

## Project Structure
- `/frontend`: Next.js application.
- `/backend`: FastAPI server handling agent logic and API keys.

## Getting Started

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Copy `.env.example` to `.env`.
   - Add your `OPENROUTER_API_KEY`.
5. Run the backend:
   ```bash
   python main.py
   ```
   The backend will start at `http://localhost:8000`.

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

## Security
- API keys are managed exclusively in the backend `.env` file.
- The frontend communicates with the backend via a secure API endpoint.
- CORS is configured to only allow requests from the trusted frontend origin.

## Extending the Agent
To add tools to your agent, modify `backend/main.py`. You can create new tools using the `smolagents` tool decorator and add them to the `agent = CodeAgent(tools=[...], ...)` initialization.
