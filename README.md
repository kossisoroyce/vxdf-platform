# VXDF Platform

The VXDF Platform is an open-source RAG (Retrieval-Augmented Generation) application designed to chat with your documents using the power of the VXDF file format.

[**Features**](#features) · [**Run with Docker (Recommended)**](#running-with-docker-recommended) · [**Run Locally (Manual Setup)**](#running-locally-manual-setup)

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports xAI (default), OpenAI, Fireworks, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template ships with [xAI](https://x.ai) `grok-2-1212` as the default chat model. However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.

## Running with Docker (Recommended)

The easiest way to run the VXDF Platform locally is with Docker and Docker Compose. This method ensures that the entire application, including the Python backend, runs in a consistent and optimized environment.

**Prerequisites:**
- [Docker](https://docs.docker.com/get-docker/) installed on your machine.
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop).

1.  **Clone the repository and navigate to the platform directory:**
    ```bash
    git clone https://github.com/your-username/vxdf-python.git
    cd vxdf-python/VXDF_Platform
    ```

2.  **Run the application:**
    ```bash
    docker-compose up --build
    ```

That's it! The application will be available at [http://localhost:3000](http://localhost:3000).

Any ingested data will be stored in the `VXDF_Platform/vxdf-data` directory, so it will persist between sessions.

## Running locally (Manual Setup)

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).
