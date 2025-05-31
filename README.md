# NoteShare - Shared Notes
This is a [Next.js](https://nextjs.org) project that creates shared notes.

## Getting Started

First, build the Next.js front end:

```bash
npm i -g next
npm install
npm run build
```

Then, run the Express Server:

```bash
node server.js
```

Open [http://localhost:4000](http://localhost:4000) with your browser to see the result.

If you use VS Code you can run the server using F5 (after you do a build).

## Docker

```bash
# To build a docker image
docker build -t note_share:latest .
docker run -d --name note_share -p 4000:4000 note_share:latest

# To build for GHCR
docker build -t ghcr.io/jonfleming/note_share:latest .
docker run -d --name note_share -p 4000:4000 ghcr.io/jonfleming/note_share:latest