import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "../server/routes";
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

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "60mb" }));

app.set("trust proxy", 1);

app.use(session({
  store: new PgSession({
    pool: sessionPool,
    tableName: "session",
  }),
  secret: process.env.SESSION_SECRET || "vercel-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  },
}));

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  await ensureSessionTable();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
}

export default async function handler(req: any, res: any) {
  await init();
  return app(req, res);
}
