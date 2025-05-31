# Node.js TypeScript Express Server

A clean, maintainable Node.js server application built with TypeScript and Express.

## Features

- **TypeScript** - Type safety and modern JavaScript features
- **Express** - Fast, unopinionated, minimalist web framework
- **Clean Architecture** - Separation of concerns with controllers, services, and models
- **Error Handling** - Centralized error handling middleware
- **Environment Variables** - Configuration via environment variables
- **Code Quality** - ESLint and Prettier for consistent code style
- **Testing** - Jest for unit and integration testing

## Project Structure

```
├── src/                  # Source code
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # Data models
│   ├── routes/           # Route definitions
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   └── index.ts          # Application entry point
├── .env.example          # Environment variables example
├── .eslintrc.json        # ESLint configuration
├── .gitignore            # Git ignore rules
├── .prettierrc           # Prettier configuration
├── jest.config.js        # Jest configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Copy the environment variables example

```bash
cp .env.example .env
```

4. Start the development server

```bash
npm run dev
# or
yarn dev
```

### Scripts

- `npm run dev` - Start the development server with hot-reload
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## API Endpoints

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update user by ID
- `DELETE /api/users/:id` - Delete user by ID

## Extending the Application

### Adding a New Route

1. Create a new route file in `src/routes/`
2. Create a new controller in `src/controllers/`
3. Create a new service in `src/services/`
4. Register the route in `src/routes/index.ts`

### Adding Middleware

Add new middleware in the `src/middleware/` directory and apply it in `src/index.ts`.

## License

This project is licensed under the ISC License.