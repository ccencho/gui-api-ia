# IA Smelpro - Proyectos, chats, búsqueda web y documentos

Interfaz local con backend Node.js para usar DeepSeek API, búsqueda web con Tavily, modo de pensamiento profundo y documentos adjuntos.

## Estructura

- `server.js`: backend Node.js/Express.
- `public/index.html`: interfaz.
- `public/style.css`: estilos.
- `public/app.js`: lógica de proyectos, chats, búsqueda web, pensamiento profundo y documentos.
- `.env.example`: plantilla de variables de entorno.

## Requisitos

- Node.js 18 o superior. Recomendado: Node.js 20, 22 o 24.

## Instalación

Abre PowerShell en la carpeta del proyecto:

```powershell
cd "D:\5.Archivos-2026\1.Smelpro\4.Programando\ia-smelpro-websearch"
npm.cmd install
```

## Configuración

Copia `.env.example` como `.env` y coloca tus claves reales:

```env
PORT=3010
DEEPSEEK_API_KEY=tu_clave_deepseek
TAVILY_API_KEY=tu_clave_tavily
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
MAX_DOCUMENT_CHARACTERS=30000
```

No subas ni compartas el archivo `.env` porque contiene tus claves.

## Ejecutar

```powershell
npm.cmd run dev
```

Luego abre:

```text
http://localhost:3010
```

## Funcionalidades

- Proyectos.
- Varios chats dentro de cada proyecto.
- Historial local en `localStorage`.
- DeepSeek V4 Flash y Pro.
- Botón visual de `Pensamiento profundo` junto a la barra de consulta.
- Botón visual de `Búsqueda inteligente` junto a la barra de consulta.
- Número de resultados web configurable.
- Adjuntar documentos desde la barra de consulta.
- Soporte inicial para TXT, MD, PDF y DOCX.
- Fuentes web consultadas.
- Tokens de entrada, salida y total.
- Metadatos de documentos usados.

## Notas importantes

- Los documentos adjuntos se leen en el backend y su texto extraído se envía a DeepSeek como contexto.
- La API Key de DeepSeek y Tavily se mantiene en `.env`, no en el navegador.
- El historial todavía se guarda localmente en el navegador. En una futura versión con usuarios, base de datos y despliegue en AWS, convendría guardar proyectos y chats en PostgreSQL o SQLite del servidor.
