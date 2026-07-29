# Casting Search Prototype

A production-oriented prototype for intelligent natural language casting search. This project explores how recruiters and casting directors can search actor profiles using everyday language instead of manually applying filters.

For example, instead of selecting multiple filters, a recruiter can simply search:

> "Male, around 30 years old, fair complexion, speaks English and Hindi, can play a mafia boss."

The system understands the query, extracts structured filters, performs semantic search using vector embeddings, and returns the most relevant actor profiles.

---

## Features

* Natural language search
* Semantic search with vector embeddings
* Structured attribute extraction
* Hybrid search (metadata + embeddings)
* Local LLM inference
* Fast embedding generation
* PostgreSQL + pgvector integration
* Prisma ORM
* Next.js App Router
* Production-ready project structure

---

## Tech Stack

### Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS

### Backend

* Next.js Route Handlers
* Prisma ORM
* PostgreSQL
* pgvector

### AI

* Qwen (local LLM)
* BGE Embedding Model
* Ollama

---

## Project Architecture

```
User Query
     │
     ▼
Natural Language Parser (Qwen)
     │
     ├──────────────► Structured Filters
     │
     ▼
Embedding Generation (BGE)
     │
     ▼
PostgreSQL + pgvector
     │
     ▼
Hybrid Search
     │
     ▼
Ranked Results
```

---

## Current Progress

### Phase 0

* Research
* Architecture planning
* Technology selection

### Phase 1

* PostgreSQL setup
* pgvector extension
* Prisma integration

### Phase 2

* Local AI environment
* Ollama setup
* Qwen model
* BGE embedding model
* Verified local inference pipeline

---

## Project Structure

```
casting-search-prototype/

├── prisma/
├── app/
├── components/
├── lib/
├── public/
├── types/
├── scripts/
└── README.md
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/auditionq-app/casting-search-prototype.git
```

### Install dependencies

```bash
npm install
```

### Configure environment

Create a `.env` file.

Example:

```env
DATABASE_URL="postgresql://..."
```

---

### Start PostgreSQL

Ensure PostgreSQL is running with the `pgvector` extension enabled.

---

### Start Ollama

```bash
ollama serve
```

---

### Pull Required Models

```bash
ollama pull qwen3
ollama pull bge-m3
```

---

### Run the application

```bash
npm run dev
```

---

## Roadmap

* [x] Project planning
* [x] PostgreSQL
* [x] pgvector
* [x] Prisma
* [x] Ollama
* [x] Qwen
* [x] BGE Embeddings
* [ ] Query parser
* [ ] Embedding pipeline
* [ ] Hybrid search
* [ ] Ranking
* [ ] Search API
* [ ] UI implementation
* [ ] Performance optimization
* [ ] Evaluation and benchmarking

---

## Future Improvements

* Reranking model
* Search analytics
* Query caching
* Streaming responses
* Actor profile enrichment
* Multi-language search
* Advanced filtering
* Production deployment

---

## Motivation

Traditional casting platforms rely on manual filters, making it difficult to express complex search requirements.

This prototype explores an AI-first approach where recruiters describe the actor they need in natural language, and the system combines structured filtering with semantic similarity to deliver relevant results.

---

## License

This project is intended for research and prototyping purposes.
