# AI Mock Interview Platform

A production-grade, voice-driven AI mock interview platform. Candidates speak with an AI interviewer that listens, adapts, probes, and challenges — powered by LangGraph.js, Groq, LiveKit, Deepgram, and Cartesia.

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** (for PostgreSQL)
- API keys: [Groq](https://console.groq.com) · [LiveKit](https://livekit.io) · [Deepgram](https://deepgram.com) · [Cartesia](https://cartesia.ai)

## Local Setup (5 commands)

```bash
# 1. Copy and fill in your API keys
cp .env.example .env

# 2. Start PostgreSQL + pgAdmin (http://localhost:5050)
docker compose up -d

# 3. Install all workspace dependencies
npm install

# 4. Run database migrations
npm run db:migrate

# 5. Start all three services concurrently
npm run dev
```

Open **http://localhost:5173**

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3001 |
| Agent | http://localhost:3002 |
| pgAdmin | http://localhost:5050 |

## Interview Types

| Type | AI Persona | Focus |
|---|---|---|
| Behavioral | Alex (Sr. Engineering Manager) | STAR structure, leadership, conflict |
| Technical | Jordan (Staff Engineer) | DS&A, system internals, depth |
| System Design | Morgan (Principal Architect) | Scalability, tradeoffs, architecture |
| HR / Culture Fit | Sam (People Partner) | Motivation, values, authenticity |

## Cost Per Session (20 min)

| Service | Cost |
|---|---|
| Deepgram STT | ~$0.052 |
| Groq LLM | ~$0.028 |
| Cartesia TTS | ~$0.35 |
| LiveKit | ~$0.00 |
| **Total** | **~$0.43** |

All services have generous **free tiers** — development is effectively free.

## Architecture

```
Browser → LiveKit WebRTC → Agent (Deepgram STT → LangGraph → Cartesia TTS)
Browser → REST API → PostgreSQL
```

## Tech Stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS + Zustand + React Router v6
- **Backend**: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL
- **AI Engine**: LangGraph.js + Groq (llama-3.3-70b-versatile)
- **Voice**: LiveKit Cloud + Deepgram (STT) + Cartesia (TTS)
- **Auth**: bcryptjs + JWT (httpOnly cookies)
