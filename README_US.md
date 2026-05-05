# Open Chat API GUI — Local AI Interface

Open Chat API GUI is a local web application for working with AI models through API integrations. It provides a ChatGPT/DeepSeek-style interface with projects, multiple chats, web search, document reading, streaming responses, code blocks, code preview tools, and usage metrics.

The current version is intended for local use, internal testing, and experimentation. It is not yet a production-ready multi-user platform.

---

<p align="center">
  <img src="assets/interfaz-principal.png" alt="Main interface preview" width="850">
</p>

## Main Features

### Organized conversational workspace

- Organize conversations by **projects** and **chats**.
- Sidebar navigation with expandable/collapsible projects.
- Create, rename, move, and delete chats.
- Rename and delete projects.
- Chat history is stored locally in the browser using `localStorage`.

### AI model integration

- Connects to the **DeepSeek API** through a local Node.js backend.
- Base model selection.
- Optional **Deep Thinking** mode, depending on model support and backend payload configuration.
- Streaming responses so you can see text as it is generated.

### Web search

- Optional web search using the **Tavily API**.
- Automatic or manual selection of the number of web results.
- Search results are displayed as a compact indicator, for example: `8 web pages`.
- Right-side sources panel for reviewing the web results used.
- Inline citations inside the answer can open the sources panel.

### Document support

- Attach documents from the interface.
- Drag and drop documents into the message composer.
- Initially supported formats:
  - `.txt`
  - `.md`
  - `.pdf`
  - `.docx`
- Documents are processed temporarily in the backend and used as context for the current query.

### Code generation support

- Markdown rendering for responses.
- Syntax-highlighted code blocks using Highlight.js.
- Available actions for code blocks:
  - Copy code.
  - Download code.
  - Run HTML/CSS/JavaScript in an isolated `iframe` preview.
- Safe fallback rendering if syntax highlighting fails.

### User experience

- Visual themes: **Celestial**, **Dark**, and **Light**.
- Centered reading column.
- Centered message composer.
- Smart auto-scroll during streaming responses.
- Button to stop response generation.
- Actions to copy and edit user prompts.
- Response metadata:
  - Model used.
  - Web search status.
  - Token usage.
  - Time to first text.
  - Total response time.
  - Web search time.
  - Document processing time.

---

## Technologies Used

- **Frontend:** HTML, CSS, and JavaScript.
- **Backend:** Node.js + Express.
- **AI API:** DeepSeek API.
- **Web search:** Tavily API.
- **Document parsing:** `pdf-parse` and `mammoth`.
- **File uploads:** `multer`.
- **Code highlighting:** Highlight.js via CDN.

---

## Project Structure

```text
.
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── assets/
│   └── interfaz-principal.png
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

### Main files

| File | Description |
|---|---|
| `server.js` | Node.js backend. Contains API routes, DeepSeek integration, Tavily search, document processing, and streaming. |
| `public/index.html` | Main interface structure. |
| `public/style.css` | Visual design, themes, layout, message styling, and code block styling. |
| `public/app.js` | Frontend logic: projects, chats, messages, rendering, drag and drop, streaming, and code actions. |
| `.env.example` | Environment variable template. |
| `package.json` | Project metadata, scripts, and dependencies. |

---

## Requirements

- Node.js **18 or higher**.
- npm.
- DeepSeek API key.
- Tavily API key, optional but required for web search.

Check your Node.js version:

```bash
node -v
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
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

Then edit the `.env` file:

```env
# DeepSeek API key
DEEPSEEK_API_KEY=your_deepseek_api_key

# Tavily API key for web search
TAVILY_API_KEY=your_tavily_api_key

# Local port
PORT=3010

# DeepSeek endpoint
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions

# Maximum number of extracted document characters sent as context
MAX_DOCUMENT_CHARACTERS=30000
```

Do not upload your `.env` file to GitHub.

---

## Running the Application

Start the local server:

```bash
npm run dev
```

Then open your browser at:

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

1. Create a project from the left sidebar.
2. Open the project to view its chats.
3. Create a new chat inside the selected project.
4. Use the `⋯` menu to rename, move, or delete chats.

### Use web search

1. Enable **Intelligent Search** in the message composer.
2. Select automatic search or a fixed number of results.
3. Ask a question that requires up-to-date information.
4. Click the web pages indicator to review the sources used.

### Attach documents

You can attach documents in two ways:

- Click the attachment button.
- Drag and drop a compatible file into the message composer.

The backend extracts text from the document and sends it as context for the current query.

### Generate, copy, download, and run code

When the model returns a code block, the interface allows you to:

- Copy the code.
- Download it as a file.
- Run HTML/CSS/JavaScript in an isolated preview.

Code execution is intended only for browser-based code examples.

---

## Data Storage and Privacy

Currently, the project stores visible user data locally in the browser.

| Data | Where it is stored |
|---|---|
| Projects | Browser `localStorage`. |
| Chats | Browser `localStorage`. |
| Messages | Browser `localStorage`. |
| Visual settings | Browser `localStorage`. |
| API keys | `.env` file on the machine running the backend. |
| Attached files | Temporarily processed in backend memory. |
| Extracted document text | Sent to the AI provider as context for the query. |

Important notes:

- DeepSeek does not automatically know the history of your projects. The application sends the relevant chat history as context on each request.
- Attached files are not permanently stored in this version.
- If a response contains sensitive information from a document, that response may remain stored in the local browser history through `localStorage`.
- This application does not yet include login, user roles, persistent database storage, or encrypted chat history.

---

## Security Notes

This project is suitable for local testing and internal experimentation.

Before using it in production or with multiple users, consider adding:

- User authentication.
- Role-based access control.
- Database storage.
- Secure and encrypted secret management.
- Server-side session handling.
- Audit logs.
- Backups.
- Usage limits.
- Token limits per user.
- File retention policies.
- Deployment hardening.

Do not expose this application publicly without additional security controls.

---

## Troubleshooting

### `npm` is blocked in Windows PowerShell

If PowerShell blocks npm scripts, you can use:

```powershell
npm.cmd install
npm.cmd run dev
```

Or adjust the PowerShell execution policy for your user.

### The port is already in use

If port `3010` is already being used, change the port in `.env`:

```env
PORT=3020
```

Then restart the server.

### Web search does not work

Check that:

1. `TAVILY_API_KEY` exists in `.env`.
2. You restarted the backend after editing `.env`.
3. Web search is enabled in the interface.

You can also check the health endpoint:

```text
http://localhost:3010/api/health
```

### Responses do not appear progressively

Verify that you are using a version with streaming enabled and that the `/api/chat-stream` route is working correctly.

### Documents are not processed

Check that the file type is supported and that the file size is within the backend limit.

---

## Current Limitations

- Chat history is stored in `localStorage`, not in a database.
- There is no authentication or multi-user administration.
- There is no permanent document library.
- Web search quality depends on the search provider and the query sent.
- Code execution is limited to HTML/CSS/JavaScript inside a browser `iframe`.
- Python, Node.js, and other system-level languages are not executed for security reasons.

---

## Suggested Roadmap

- Add authentication and users.
- Store projects and chats in PostgreSQL or SQLite.
- Create a persistent document library per project.
- Add project-level prompts or memory.
- Create an admin panel for token and cost tracking.
- Add AI provider/model selection.
- Export and import projects and chats.
- Add an AWS EC2 deployment guide.
- Add Docker support.

---

## License

This project is released under the **MIT License**.

You may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, provided that the copyright notice and the MIT license text are included.

If you find this project useful or use it as a base for another project, attribution to the original repository is appreciated.

---

## Disclaimer

This is an experimental local AI interface. Always review AI-generated content before using it for technical, legal, financial, commercial, or operational decisions.
