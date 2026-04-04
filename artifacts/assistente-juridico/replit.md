# HTML Playground + Assistente Juridico

## Overview
This project delivers a two-in-one application: an **HTML Playground** for live code preview and an **Assistente Juridico** (Legal Assistant). The Legal Assistant is an AI-powered tool designed to process legal texts using prompts inspired by the Brazilian judicial AI system, Apoia. Its core purpose is to streamline legal document handling, analysis, and generation, aiming for enhanced efficiency and accuracy in legal operations.

The business vision is to provide a comprehensive, AI-driven solution for legal professionals, significantly reducing manual effort in document drafting, review, and analysis. This platform has the potential to capture a significant share of the legal tech market in Brazil by offering tailored features that address specific needs of the Brazilian legal system. The project ambitions include continuous improvement of AI models, integration with more judicial systems, and expansion of legal functionalities to become an indispensable tool for lawyers and legal entities.

## User Preferences
- Portuguese (BR) language for UI
- Simple, easy-to-use interface (user is not technical)
- Mobile-friendly design
- User wants results to persist (not disappear on page refresh)
- User works with large legal documents (up to 50MB)

## System Architecture

### UI/UX Decisions
The application features a professional green (hsl 152) theme, suitable for legal contexts, with both light and dark modes. It is designed to be mobile-responsive, offering a seamless experience across devices. The Assistente Juridico is the main landing page, reflecting its primary importance.

### Technical Implementations
- **Frontend**: Built with React, Vite, Tailwind CSS, and shadcn/ui for a modern and responsive user interface. `wouter` is used for routing, and `TanStack Query` manages server state.
- **Backend**: An Express.js server handles API requests, with PostgreSQL and Drizzle ORM for data persistence.
- **AI Integration**: All AI models (Premium, Econômico, Refine) use custom/demo key when available (via `geminiStream`/`geminiStreamMessages` with `customKey/customUrl/customModel` params), falling back to Replit AI Integrations only when no user key is configured. Custom key with URL → OpenAI-compatible API (Groq, etc.); custom key without URL → direct Google Gemini API. Playground and Previdenciário also use custom keys when available.
- **Workflow Config**: The "Start application" workflow must NOT use `waitForPort` in `.replit` — removing it fixes the persistent DIDNT_OPEN_A_PORT Replit health-check failure. The server binds to 0.0.0.0:5000 and responds HTTP 200 correctly.
- **Document Processing**:
    - **Text Extraction**: `pdf-parse` (v2) for PDFs and `mammoth` for Word documents enable text extraction from various file types.
    - **OCR**: Automatic OCR for scanned PDFs using `pdftoppm` and `Tesseract` (por+eng).
    - **Transcription**: `Whisper API` and `ffmpeg` are used for audio/video transcription (MP3, WAV, M4A, MP4, MOV, .opus, .ptt, .ogg).
- **Formatting Panel**: Built-in formatting settings dialog accessible from result toolbar. User can configure: font family (Times New Roman, Arial, Courier New, Calibri), font size (10-14pt), line spacing (1-2.5), text alignment (justify/left/center/right), paragraph indent (0-4cm), citation indent (2-5cm). Settings persist in localStorage and apply to both screen display and Word export. Designed for mobile use.
- **Financial Audit Calculator**: `/auditoria` page provides a judicial sentence calculator comparing scenarios (Bank vs. Sentence) with TJMG monetary correction, BCB rates, and detailed monthly memorials. It supports Word export and PDF printing.
- **Code Assistant**: `/codigo` page — a separate AI assistant for code generation (HTML, Python, JS, etc.) that uses ONLY the user's own API key (no Replit credits). Supports preset configurations for OpenRouter, DeepSeek, Groq, Together AI, Mistral, Google Gemini, Perplexity, or any OpenAI-compatible API. Chat-style interface with streaming, history persistence in localStorage.
- **PWA Support**: The application is installable as a Progressive Web App (PWA) with offline capabilities.

### Feature Specifications

#### HTML Playground (`/playground`)
- Split-panel editor (HTML/CSS/JS/React/Python) with live iframe preview.
- **Real Python execution**: Uses Python 3.11 interpreter on the server (child_process), NOT AI. Zero API charges.
- **Real JavaScript execution**: Uses Node.js on the server. Zero API charges.
- Supports external CDN resources via blob URLs.
- Snippet management: save, load, delete, rename, search, and filter.
- Auto-save to `localStorage`.
- Export to `.html`, `.jsx`, `.py`, copy to clipboard.
- Editor minimization/expansion.

#### Assistente Juridico (`/`)
- **AI Actions**: Six built-in actions (Summarize, Review, Refine, Simple Language, Draft, Analyze) and support for custom AI models.
- **Document Handling**:
    - Import PDF, Word, and text files (up to 50MB, multiple files).
    - Export results as `.txt` or Word (`.docx`).
    - Document Templates with `{{CONTEUDO}}` placeholder for formatted Word exports.
    - Document selection dialog for multi-file imports.
- **AI Refinement Chat**: Multi-turn chat for refining AI results, maintaining full conversation history and context. All history is sent without truncation.
- **Jurisprudence Library**: Save, manage, and use `ementas` as AI references.
- **AI History**: Persisted history of all AI interactions, viewable and manageable. Full history (no limit) is sent as context to AI for continuity.
- **Cost Management**: Selectable models (Premium/Econômico) with cost comparison and dynamic `max_completion_tokens`. Effort slider and verbosity settings.
- **Minimum Document Length**: Minutas and petições require a minimum of 15 pages (~7,500 words). Prompts enforce extensive development of each section.
- **Custom Key Integration**: All features (text generation, voice chat, conversation chat, refinement) work with user-configured keys (Groq, Gemini, OpenAI, OpenRouter, Perplexity). The system auto-detects the provider from the key prefix and falls back to demo key → Replit integration.
- **Voice Input**: Web Speech API for dictation in Portuguese (BR).
- **JWT Token Generator**: `/token` page for generating PEM-signed JWT tokens for authentication.
- **Large Document Processing**: Chunking for documents over 40K characters, and auto-summarization for models with smaller context windows (e.g., Econômico model).

#### Consulta Processual (`/consulta`)
- Search any Brazilian court process by CNJ number using DataJud public API (CNJ).
- Auto-detects tribunal from process number (TJMG, TJSP, TRF, STJ, etc.).
- Displays process details: class, orgao julgador, ajuizamento date, assuntos.
- Lists all andamentos (movements) sorted by date, with expand/collapse for large lists.
- Copy all data to clipboard.
- Free, no paid API required - uses CNJ public API key.

#### Painel de Processos (`/painel`)
- Dashboard for monitoring multiple court processes saved in database.
- Add processes by CNJ number - auto-fetches data from DataJud.
- Nickname (apelido) for each process for easy identification.
- Shows: class, orgao julgador, assuntos, data ajuizamento, last movement.
- Expand to see all andamentos (movements) with timeline view.
- Refresh individual processes to get latest movements from DataJud.
- Archive/reactivate processes. Filter by ativo/arquivado/todos.
- Copy all process data to clipboard.
- Delete processes from monitoring.
- Persisted in PostgreSQL database.

#### JWT Token Generator (`/token`)
- Generates PEM-signed JWT tokens (RS256) for PDPJ/PJUD authentication.
- Two modes: PDPJ (Swagger) and PJUD (API) with different iss/aud values.
- Fields: CPF (sub), name, tribunal, jti (unique ID), configurable expiry.
- Auto-cleans PEM keys with Bag Attributes and reformats line breaks.
- Email template for PDPJ public key registration.
- Bearer token copy for Swagger authorization.

## External Dependencies
- **OpenAI API**: For all AI processing (GPT-4o, GPT-4o-mini models).
- **pdf-parse (v2)**: For text extraction from PDF files.
- **mammoth**: For text extraction from Word (.docx) files.
- **Tesseract OCR**: Used for Optical Character Recognition on scanned PDF images.
- **ffmpeg**: For audio/video file processing in transcription.
- **Whisper API**: For audio/video transcription services.
- **PostgreSQL**: The primary database for persistent storage.
- **debit.com.br**: Source for TJMG monetary correction factors (accessed via `/api/tjmg/fatores`).
- **SGS API (Banco Central do Brasil)**: Used to fetch BCB interest rates for financial calculations.
- **DataJud API (CNJ)**: Public API for querying process data and movements from all Brazilian courts. Uses public API key from CNJ wiki (can be overridden via DATAJUD_API_KEY env var).
- **Corporativo Proxy (PDPJ/CNJ)**: Public API at `gateway.cloud.pje.jus.br/corporativo-proxy` for querying lawyer data (by CPF or OAB) and magistrates (by tribunal). Accessed via `/api/corporativo/*` proxy endpoints. Only accessible from Brazilian IPs.
  - Swagger docs: `https://gateway.stg.cloud.pje.jus.br/corporativo-proxy/swagger-ui.html`
  - API spec: `https://gateway.stg.cloud.pje.jus.br/corporativo-proxy/v2/api-docs?group=V1`
  - Full controllers: Advogado, Lotacao, Magistrado, Organizacional, Sistema, Usuario
  - Production base: `https://gateway.cloud.pje.jus.br/corporativo-proxy/api/v1`
  - Staging base: `https://gateway.stg.cloud.pje.jus.br/corporativo-proxy/api/v1`
- **Domicílio Judicial Eletrônico (PDPJ/CNJ)**: System for receiving court communications (citações/intimações) from all courts.
  - Docs: `https://docs.pdpj.jus.br/servicos-negociais/domicilio-judicial-eletronico/`
  - Swagger (staging): `https://gateway.stg.cloud.pje.jus.br/domicilio-eletronico-hml/swagger-ui/index.html`
  - Key endpoints: comunicações de representantes, listar representados, verificar habilitação, pessoa física/jurídica, notificações, certidões
  - Auth: OAuth2 via CNJ SSO (Keycloak) - requires Corporativo credentials
  - Requires Brazilian IP for production access
- **ComunicaAPI (CNJ)**: API for sending/receiving court communications.
  - SwaggerHub docs: `https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0`
  - Production: `https://comunicaapi.pje.jus.br/api/v1`
  - Homologation: `https://hcomunicaapi.cnj.jus.br/api/v1`
  - Required header: `On-behalf-Of: [CPF 11 digits]`
  - Auth: Corporativo CNJ credentials
  - Endpoints: autenticação, envio de comunicações, consulta de comunicações, certidões em PDF
- **PDPJ-Br Documentation Portal**: `https://docs.pdpj.jus.br/` - Central documentation for all PDPJ services.
  - Services available: Organizacional, SSO/Auth, Discovery/Gateway, Marketplace, Mensageria, Notificações, BNMP, eCarta, Criminal, MNI Client, Domicílio Eletrônico
  - All PDPJ services use OAuth2 via Keycloak SSO
  - Architecture: microservices with Eureka (discovery), Zuul (gateway), RabbitMQ (messaging)

#### Consulta Corporativo (`/corporativo`)
- Tabs: Advogado (lawyer lookup) and Magistrado (judge search).
- Advogado: Search by CPF (all OAB inscriptions) or by UF + OAB number.
- Magistrado: Search by tribunal (TJMG, TJSP, TRFs, TRTs, STJ, TST, etc.).
- Copy individual results or all results to clipboard.
- Filter magistrates by name.
- Uses PDPJ Corporativo Proxy public API (CNJ).

#### Consulta PDPJ (`/pdpj`)
- Authenticated PDPJ API access using auto-generated JWT tokens (PEM key).
- Tabs: Conexão (test), Comunicações (citações/intimações), Representados, Habilitação, Pessoa.
- Auto-generates JWT tokens server-side using PDPJ_PEM_PRIVATE_KEY.
- Supports PDPJ (Swagger) and PJUD (API) authentication modes.
- Supports Homologação and Produção environments.
- Proxied through backend for security (tokens never exposed to client).
- Geo-restricted: requires Brazilian IP for production access.