# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Backend & deployment

The API lives in [`backend/`](./backend/README.md) — FastAPI + SQLAlchemy (async) +
Alembic on Postgres. Frontend and backend deploy as two separate Railway
services from this same repo, gated by the CI/CD workflow in
[`.github/workflows/ci-cd.yml`](./.github/workflows/ci-cd.yml). See the backend
README for local setup and full deployment steps.
