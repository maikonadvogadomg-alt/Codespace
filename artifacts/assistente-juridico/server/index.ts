import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const PgSession = connectPg(session);
const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function ensureSessionTable() {
  const client = await sessionPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
  } finally {
    client.release();
  }
}

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const BASE_PATH = process.env.BASE_PATH || "";
if (BASE_PATH) {
  app.use((req, res, next) => {
    if (req.url === BASE_PATH) {
      return res.redirect(301, `${BASE_PATH}/`);
    }
    if (req.url.startsWith(BASE_PATH)) {
      req.url = req.url.slice(BASE_PATH.length) || "/";
    }
    if (req.path.startsWith(BASE_PATH)) {
      (req as any).originalUrl = req.originalUrl.replace(BASE_PATH, "") || "/";
    }
    next();
  });
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "60mb" }));

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(session({
  store: new PgSession({
    pool: sessionPool,
    tableName: "session",
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  },
}));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("pt-BR", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Garante que todas as tabelas existam (desenvolvimento e produção)
  try {
    const migratePool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const migrateDb = drizzle(migratePool);
    const migrationsFolder = process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "migrations")
      : path.join(import.meta.dirname ?? __dirname, "..", "migrations");
    await migrate(migrateDb, { migrationsFolder });
    await migratePool.end();
  } catch (e) {
    console.warn("[migrate] Aviso:", (e as Error).message);
  }

  await ensureSessionTable();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
