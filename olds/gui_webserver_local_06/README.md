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
- Selector de tema visual: Actual Smelpro, Oscuro y Claro.
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

## Actualización: resultados de búsqueda comprimidos

La interfaz ahora muestra las fuentes web en formato comprimido, como un chip tipo `🌐 8 páginas web` debajo de la respuesta. Al hacer clic, se abre un panel lateral derecho con los resultados de búsqueda, título, dominio y extracto de cada fuente.

## Mejora de formato de respuestas

Esta versión renderiza las respuestas del asistente como Markdown enriquecido:

- Títulos `##` y `###` como encabezados visuales.
- Negritas `**texto**`.
- Listas numeradas y con viñetas.
- Tablas Markdown.
- Citas web `[1]`, `[2]`, `[3]` como chips clicables.
- Panel lateral de fuentes al hacer clic en una cita o en el botón de páginas web.

El backend también solicita al modelo responder con Markdown limpio y colocar las citas junto a las afirmaciones correspondientes.

## Cambios de interfaz añadidos

- Indicador animado de procesamiento con tres puntos mientras DeepSeek/Tavily responde.
- Se retiró el aviso visual de API Key del panel izquierdo.
- Se agregó botón para ocultar/mostrar el panel lateral y ampliar el área de conversación.

## Actualización de métricas

La barra inferior de cada respuesta muestra modelo usado, estado de pensamiento profundo, tokens de entrada, tokens de salida, tokens totales y si se usó búsqueda web.
