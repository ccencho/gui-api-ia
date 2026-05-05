# IA Smelpro — Local AI Workspace

IA Smelpro is a local web application for working with AI models through API integrations. It provides a ChatGPT-style interface with projects, multiple chats, web search, document reading, streaming responses, code blocks, and usage metrics.

The current version is designed for local/internal use and experimentation. It is not a production-ready multi-user platform yet.

---

## Key Features

### Conversational workspace

- Organize conversations by **projects** and **chats**.
- Expand/collapse projects in a navigation panel.
- Create, rename, move, and delete chats.
- Rename and delete projects.
- Keep chat history locally in the browser using `localStorage`.

### AI model integration

- Connects to **DeepSeek API** through a local Node.js backend.
- Supports base model selection.
- Supports a **Deep Thinking** option when enabled by the backend/model payload.
- Streams responses progressively, so answers appear while they are being generated.

### Web search

- Optional web search using **Tavily API**.
- Automatic or manual selection of the number of search results.
- Search results are shown in a compact chip such as `8 web pages`.
- A right-side drawer displays the consulted sources.
- Inline citations can open the source drawer.

### Document support

- Attach documents from the interface.
- Drag and drop documents into the message box.
- Supported initial formats:
  - `.txt`
  - `.md`
  - `.pdf`
  - `.docx`
- Documents are processed temporarily by the backend for the current request.

### Code generation support

- Markdown rendering for responses.
- Code blocks with syntax highlighting using Highlight.js.
- Code block actions:
  - Copy code
  - Download code
  - Execute HTML/CSS/JavaScript in a sandboxed preview iframe
- Safe fallback rendering if syntax highlighting fails.

### User experience

- Visual themes: **Celestial**, **Dark**, and **Light**.
- Centered reading layout.
- Centered message composer.
- Smart auto-scroll while streaming.
- Stop button during response generation.
- Copy and edit actions for user prompts.
- Response metadata:
  - Model used
  - Web search status
  - Token usage
  - Time to first text
  - Total response time
  - Web search time
  - Document processing time

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **AI API:** DeepSeek API
- **Web Search:** Tavily API
- **Document parsing:** `pdf-parse`, `mammoth`
- **File upload:** `multer`
- **Code highlighting:** Highlight.js via CDN

---

## Project Structure

```text
.
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

### Main files

| File | Purpose |
|---|---|
| `server.js` | Node.js backend, API routes, DeepSeek integration, Tavily search, document processing, streaming. |
| `public/index.html` | Main HTML structure of the interface. |
| `public/style.css` | Visual design, themes, layout, message styling, code block styling. |
| `public/app.js` | Frontend logic: projects, chats, messages, rendering, drag & drop, streaming UI, code actions. |
| `.env.example` | Example environment variables. |
| `package.json` | Project metadata, scripts, and dependencies. |

---

## Requirements

- Node.js **18 or higher**
- npm
- DeepSeek API key
- Tavily API key, optional but required for web search

Check your Node.js version:

```bash
node -v
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USER/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

```env
# DeepSeek API key
DEEPSEEK_API_KEY=your_deepseek_api_key

# Tavily API key for web search
TAVILY_API_KEY=your_tavily_api_key

# Local port
PORT=3010

# DeepSeek endpoint
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions

# Maximum extracted document characters sent as context
MAX_DOCUMENT_CHARACTERS=30000
```

Do not commit your `.env` file to GitHub.

---

## Running the App

Start the local server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3010
```

To stop the server, press:

```text
Ctrl + C
```

---

## How to Use

### Create projects and chats

1. Create a project from the left navigation panel.
2. Open the project to display its chats.
3. Create a new chat inside the selected project.
4. Use the `⋯` menu to rename, move, or delete chats.

### Use web search

1. Enable **Intelligent Search** in the composer.
2. Choose automatic search or a fixed number of results.
3. Ask a question that requires updated information.
4. Click the web results chip to see the sources.

### Attach documents

You can attach documents in two ways:

- Click the attach button.
- Drag and drop a supported file into the message box.

The backend extracts text from the document and sends it as context for the current request.

### Generate and run code

When the model returns a code block, the interface can:

- Copy the code
- Download the code as a file
- Execute HTML/CSS/JavaScript in a sandboxed preview

Execution is intended only for browser-side code examples.

---

## Data Storage and Privacy

This project currently stores user-facing chat data locally in the browser.

| Data | Where it is stored |
|---|---|
| Projects | Browser `localStorage` |
| Chats | Browser `localStorage` |
| Messages | Browser `localStorage` |
| Visual settings | Browser `localStorage` |
| API keys | `.env` file on the backend machine |
| Uploaded files | Processed temporarily in memory by the backend |
| Extracted document text | Sent to the AI provider as context for the request |

Important notes:

- DeepSeek does not automatically know your project history. The application sends the relevant chat history as context.
- Attached files are not stored permanently by this application in the current version.
- If a response contains sensitive document content, that response may remain in the browser history through `localStorage`.
- This application does not currently include login, user roles, database persistence, or encrypted chat storage.

---

## Security Notes

This project is suitable for local testing and internal experimentation.

Before using it in production or with multiple users, consider adding:

- User authentication
- Role-based access control
- Database-backed storage
- Encrypted secrets management
- Server-side session handling
- Audit logs
- Backups
- Rate limits
- Per-user token limits
- File retention policy
- Deployment hardening

Do not expose this application publicly without additional security controls.

---

## Troubleshooting

### `npm` is blocked on Windows PowerShell

If PowerShell blocks npm scripts, use:

```powershell
npm.cmd install
npm.cmd run dev
```

Or adjust your PowerShell execution policy for your user.

### Port already in use

If port `3010` is already being used, change the port in `.env`:

```env
PORT=3020
```

Then restart the server.

### Web search does not work

Check:

1. `TAVILY_API_KEY` exists in `.env`.
2. The backend was restarted after editing `.env`.
3. Web search is enabled in the interface.

You can also check the health endpoint:

```text
http://localhost:3010/api/health
```

### Responses do not appear in real time

Make sure you are using the current version with streaming enabled and that the backend route `/api/chat-stream` is working.

### Documents are not processed

Check that the file type is supported and that the file size is within the backend limits.

---

## Current Limitations

- Chat history is stored in browser `localStorage`, not in a database.
- No authentication or multi-user management.
- No permanent document library.
- Web search quality depends on the search provider and query quality.
- Running code is limited to HTML/CSS/JavaScript previews in a browser iframe.
- Python, Node.js, or system-level code execution is not supported for safety reasons.

---

## Suggested Roadmap

- Add authentication and users.
- Store projects and chats in PostgreSQL or SQLite.
- Add persistent document library per project.
- Add project-level prompts or memories.
- Add admin panel for token usage and cost control.
- Add model provider selection.
- Add export/import of projects and chats.
- Add deployment guide for AWS EC2.
- Add Docker support.

---

## License

Add a license before publishing publicly. If you are unsure, start with an internal/private repository first or use a standard open-source license such as MIT only after reviewing whether you want others to reuse the code.

---

## Disclaimer

This is an experimental local AI interface. Review AI-generated content before using it for technical, legal, financial, commercial, or operational decisions.
