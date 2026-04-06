import { type User, type InsertUser, type Snippet, type InsertSnippet, type CustomAction, type InsertCustomAction, type Ementa, type InsertEmenta, type AiHistory, type InsertAiHistory, type PromptTemplate, type InsertPromptTemplate, type DocTemplate, type InsertDocTemplate, type SharedParecer, type ProcessoMonitorado, type InsertProcessoMonitorado, type AppSetting, type TramitacaoPublicacao, users, snippets, customActions, ementas, aiHistory, promptTemplates, docTemplates, sharedPareceres, processosMonitorados, appSettings, tramitacaoPublicacoes } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSnippets(): Promise<Snippet[]>;
  getSnippet(id: string): Promise<Snippet | undefined>;
  createSnippet(snippet: InsertSnippet): Promise<Snippet>;
  updateSnippetTitle(id: string, title: string): Promise<Snippet | undefined>;
  deleteSnippet(id: string): Promise<void>;
  getCustomActions(): Promise<CustomAction[]>;
  getCustomAction(id: string): Promise<CustomAction | undefined>;
  createCustomAction(action: InsertCustomAction): Promise<CustomAction>;
  updateCustomAction(id: string, action: InsertCustomAction): Promise<CustomAction | undefined>;
  deleteCustomAction(id: string): Promise<void>;
  getEmentas(): Promise<Ementa[]>;
  getEmenta(id: string): Promise<Ementa | undefined>;
  createEmenta(ementa: InsertEmenta): Promise<Ementa>;
  updateEmenta(id: string, ementa: InsertEmenta): Promise<Ementa | undefined>;
  deleteEmenta(id: string): Promise<void>;
  getAiHistory(): Promise<AiHistory[]>;
  createAiHistory(entry: InsertAiHistory): Promise<AiHistory>;
  deleteAiHistory(id: string): Promise<void>;
  clearAiHistory(): Promise<void>;
  getPromptTemplates(): Promise<PromptTemplate[]>;
  getPromptTemplate(id: string): Promise<PromptTemplate | undefined>;
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  updatePromptTemplate(id: string, template: InsertPromptTemplate): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: string): Promise<void>;
  getDocTemplates(): Promise<DocTemplate[]>;
  getDocTemplate(id: string): Promise<DocTemplate | undefined>;
  createDocTemplate(template: InsertDocTemplate): Promise<DocTemplate>;
  updateDocTemplate(id: string, template: InsertDocTemplate): Promise<DocTemplate | undefined>;
  deleteDocTemplate(id: string): Promise<void>;
  getSharedParecer(id: string): Promise<SharedParecer | undefined>;
  createSharedParecer(id: string, html: string, processo: string): Promise<SharedParecer>;
  getProcessosMonitorados(): Promise<ProcessoMonitorado[]>;
  getProcessoMonitorado(id: string): Promise<ProcessoMonitorado | undefined>;
  createProcessoMonitorado(p: InsertProcessoMonitorado): Promise<ProcessoMonitorado>;
  updateProcessoMonitorado(id: string, data: Partial<InsertProcessoMonitorado>): Promise<ProcessoMonitorado | undefined>;
  deleteProcessoMonitorado(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSnippets(): Promise<Snippet[]> {
    return db.select().from(snippets);
  }

  async getSnippet(id: string): Promise<Snippet | undefined> {
    const [snippet] = await db.select().from(snippets).where(eq(snippets.id, id));
    return snippet;
  }

  async createSnippet(insertSnippet: InsertSnippet): Promise<Snippet> {
    const [snippet] = await db.insert(snippets).values(insertSnippet).returning();
    return snippet;
  }

  async updateSnippetTitle(id: string, title: string): Promise<Snippet | undefined> {
    const [snippet] = await db.update(snippets).set({ title }).where(eq(snippets.id, id)).returning();
    return snippet;
  }

  async deleteSnippet(id: string): Promise<void> {
    await db.delete(snippets).where(eq(snippets.id, id));
  }

  async getCustomActions(): Promise<CustomAction[]> {
    return db.select().from(customActions);
  }

  async getCustomAction(id: string): Promise<CustomAction | undefined> {
    const [action] = await db.select().from(customActions).where(eq(customActions.id, id));
    return action;
  }

  async createCustomAction(action: InsertCustomAction): Promise<CustomAction> {
    const [created] = await db.insert(customActions).values(action).returning();
    return created;
  }

  async updateCustomAction(id: string, action: InsertCustomAction): Promise<CustomAction | undefined> {
    const [updated] = await db.update(customActions).set(action).where(eq(customActions.id, id)).returning();
    return updated;
  }

  async deleteCustomAction(id: string): Promise<void> {
    await db.delete(customActions).where(eq(customActions.id, id));
  }

  async getEmentas(): Promise<Ementa[]> {
    return db.select().from(ementas);
  }

  async getEmenta(id: string): Promise<Ementa | undefined> {
    const [ementa] = await db.select().from(ementas).where(eq(ementas.id, id));
    return ementa;
  }

  async createEmenta(ementa: InsertEmenta): Promise<Ementa> {
    const [created] = await db.insert(ementas).values(ementa).returning();
    return created;
  }

  async updateEmenta(id: string, ementa: InsertEmenta): Promise<Ementa | undefined> {
    const [updated] = await db.update(ementas).set(ementa).where(eq(ementas.id, id)).returning();
    return updated;
  }

  async deleteEmenta(id: string): Promise<void> {
    await db.delete(ementas).where(eq(ementas.id, id));
  }

  async getAiHistory(): Promise<AiHistory[]> {
    return db.select().from(aiHistory).orderBy(desc(aiHistory.createdAt));
  }

  async createAiHistory(entry: InsertAiHistory): Promise<AiHistory> {
    const [created] = await db.insert(aiHistory).values(entry).returning();
    return created;
  }

  async deleteAiHistory(id: string): Promise<void> {
    await db.delete(aiHistory).where(eq(aiHistory.id, id));
  }

  async clearAiHistory(): Promise<void> {
    await db.delete(aiHistory);
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    return db.select().from(promptTemplates);
  }

  async getPromptTemplate(id: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id));
    return template;
  }

  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    const [created] = await db.insert(promptTemplates).values(template).returning();
    return created;
  }

  async updatePromptTemplate(id: string, template: InsertPromptTemplate): Promise<PromptTemplate | undefined> {
    const [updated] = await db.update(promptTemplates).set(template).where(eq(promptTemplates.id, id)).returning();
    return updated;
  }

  async deletePromptTemplate(id: string): Promise<void> {
    await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
  }

  async getDocTemplates(): Promise<DocTemplate[]> {
    return db.select().from(docTemplates);
  }

  async getDocTemplate(id: string): Promise<DocTemplate | undefined> {
    const [template] = await db.select().from(docTemplates).where(eq(docTemplates.id, id));
    return template;
  }

  async createDocTemplate(template: InsertDocTemplate): Promise<DocTemplate> {
    const [created] = await db.insert(docTemplates).values(template).returning();
    return created;
  }

  async updateDocTemplate(id: string, template: InsertDocTemplate): Promise<DocTemplate | undefined> {
    const [updated] = await db.update(docTemplates).set(template).where(eq(docTemplates.id, id)).returning();
    return updated;
  }

  async deleteDocTemplate(id: string): Promise<void> {
    await db.delete(docTemplates).where(eq(docTemplates.id, id));
  }

  async getSharedParecer(id: string): Promise<SharedParecer | undefined> {
    const [parecer] = await db.select().from(sharedPareceres).where(eq(sharedPareceres.id, id));
    return parecer;
  }

  async createSharedParecer(id: string, html: string, processo: string): Promise<SharedParecer> {
    const [created] = await db.insert(sharedPareceres).values({ id, html, processo }).returning();
    return created;
  }

  async getProcessosMonitorados(): Promise<ProcessoMonitorado[]> {
    return db.select().from(processosMonitorados).orderBy(desc(processosMonitorados.updatedAt));
  }

  async getProcessoMonitorado(id: string): Promise<ProcessoMonitorado | undefined> {
    const [p] = await db.select().from(processosMonitorados).where(eq(processosMonitorados.id, id));
    return p;
  }

  async createProcessoMonitorado(p: InsertProcessoMonitorado): Promise<ProcessoMonitorado> {
    const [created] = await db.insert(processosMonitorados).values(p).returning();
    return created;
  }

  async updateProcessoMonitorado(id: string, data: Partial<InsertProcessoMonitorado>): Promise<ProcessoMonitorado | undefined> {
    const [updated] = await db.update(processosMonitorados).set({ ...data, updatedAt: new Date() }).where(eq(processosMonitorados.id, id)).returning();
    return updated;
  }

  async deleteProcessoMonitorado(id: string): Promise<void> {
    await db.delete(processosMonitorados).where(eq(processosMonitorados.id, id));
  }

  async getSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  }

  async getTramitacaoPublicacoes(limit = 100): Promise<TramitacaoPublicacao[]> {
    return db.select().from(tramitacaoPublicacoes).orderBy(desc(tramitacaoPublicacoes.createdAt)).limit(limit);
  }

  async upsertTramitacaoPublicacao(data: {
    extId: string;
    idempotencyKey?: string;
    numeroProcesso: string;
    numeroProcessoMascara: string;
    tribunal: string;
    orgao: string;
    classe: string;
    texto: string;
    disponibilizacaoDate: string;
    publicacaoDate: string;
    inicioPrazoDate: string;
    linkTramitacao: string;
    linkTribunal: string;
    destinatarios: string;
    advogados: string;
  }): Promise<TramitacaoPublicacao> {
    const [created] = await db.insert(tramitacaoPublicacoes).values(data).onConflictDoNothing().returning();
    if (created) return created;
    const [existing] = await db.select().from(tramitacaoPublicacoes).where(eq(tramitacaoPublicacoes.extId, data.extId));
    return existing;
  }

  async markPublicacaoLida(id: string, lida: string): Promise<void> {
    await db.update(tramitacaoPublicacoes).set({ lida }).where(eq(tramitacaoPublicacoes.id, id));
  }
}

export const storage = new DatabaseStorage();
