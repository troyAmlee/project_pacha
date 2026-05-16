# North Star Ridebook

North Star Ridebook is a React + Node.js MVP for a Minneapolis bike club. Riders can join the club, publish routes, upload ride photos, and contribute to a shared community journal.

## Stack

- React + Vite frontend
- Express backend
- JSON file persistence for club data
- Local file uploads for ride photos

## Run Locally

```bash
npm install
npm run dev
```

That starts:

- frontend at `http://localhost:5173`
- backend API at `http://localhost:3001`

## Production Build

```bash
npm run build
npm start
```

The backend serves the built frontend when `client/dist` exists.

## MVP Features

- Join the club with a rider profile
- Share route details with mileage, start point, terrain, and notes
- Upload ride photos to the local backend
- Publish community blog posts in a shared journal
- Seeded Minneapolis-flavored demo content so the app feels alive on first launch
