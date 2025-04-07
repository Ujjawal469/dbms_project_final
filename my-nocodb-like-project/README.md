# My NocoDB-like Project

A web application providing a spreadsheet-like interface for databases.

## Structure

*   `/packages/backend`: Node.js/Express API
*   `/packages/frontend`: React/Ant Design UI

## Setup

*   In `/packages/backend`: create new file .env and copy the contents of .env.example in it with your credentials.
*   `Structure`: DATABASE_URL="YOUR_DATABASE_TYPE://USER_ID:PASSWORD@localhost:5432/YOUR_DATABASE?schema=public"
*   Do, similar in `/packages/frontend`. (You may or may not change the post in frontend).
*   Run the command `npm install` in both backend and frontend folders.
*   Then, run the command `npm run dev` in both backend and frontend folders.