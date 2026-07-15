/**
 * Data Export Routes
 *
 * Provides CSV downloads for all primary business entities.
 * All endpoints are protected by the requireAuth gate in routes/index.ts —
 * unauthenticated requests receive 401 before reaching any handler here.
 *
 * Endpoints
 *   GET /export/clients.csv
 *   GET /export/projects.csv
 *   GET /export/tasks.csv
 *   GET /export/invoices.csv
 *   GET /export/documents.csv
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  clientsTable,
  projectsTable,
  tasksTable,
  paymentsTable,
  documentsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ─── CSV Utilities ────────────────────────────────────────────────────────────

/** RFC 4180-compliant CSV cell escape. */
function cell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = Array.isArray(val) ? val.join("; ") : String(val);
  // Wrap in quotes if the value contains a comma, double-quote, or newline.
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Serialise a list of objects to a RFC 4180 CSV string.
 * `columns` maps human-readable header labels to object keys.
 * Prefixes a UTF-8 BOM so Excel opens the file with correct encoding.
 */
function toCsv(
  rows: Record<string, unknown>[],
  columns: { header: string; key: string }[],
): string {
  const header = columns.map((c) => cell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => cell(row[c.key])).join(","))
    .join("\r\n");
  // BOM ensures Excel reads UTF-8 without garbling non-ASCII characters.
  return "\uFEFF" + header + "\r\n" + body;
}

/** Send a CSV response with the appropriate download headers. */
function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(csv);
}

/** ISO date-time string, or empty string for null. */
function isoOrEmpty(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString();
}

/** Format a numeric DB value as a plain number string. */
function num(v: unknown): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return isNaN(n) ? "" : String(n);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

router.get("/export/clients.csv", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(clientsTable)
    .orderBy(clientsTable.id);

  const data: Record<string, unknown>[] = rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    industry: r.industry,
    email: r.email,
    phone: r.phone,
    website: r.website,
    primaryContact: r.primaryContact,
    secondaryContact: r.secondaryContact,
    address: r.address,
    timezone: r.timezone,
    status: r.status,
    startDate: r.startDate ?? "",
    contractValue: num(r.contractValue),
    monthlyRetainer: num(r.monthlyRetainer),
    paymentMethod: r.paymentMethod,
    notes: r.notes,
    tags: r.tags,
    createdAt: isoOrEmpty(r.createdAt),
    updatedAt: isoOrEmpty(r.updatedAt),
  }));

  const columns = [
    { header: "ID", key: "id" },
    { header: "Company Name", key: "companyName" },
    { header: "Industry", key: "industry" },
    { header: "Email", key: "email" },
    { header: "Phone", key: "phone" },
    { header: "Website", key: "website" },
    { header: "Primary Contact", key: "primaryContact" },
    { header: "Secondary Contact", key: "secondaryContact" },
    { header: "Address", key: "address" },
    { header: "Timezone", key: "timezone" },
    { header: "Status", key: "status" },
    { header: "Start Date", key: "startDate" },
    { header: "Contract Value", key: "contractValue" },
    { header: "Monthly Retainer", key: "monthlyRetainer" },
    { header: "Payment Method", key: "paymentMethod" },
    { header: "Notes", key: "notes" },
    { header: "Tags", key: "tags" },
    { header: "Created At", key: "createdAt" },
    { header: "Updated At", key: "updatedAt" },
  ];

  const date = new Date().toISOString().slice(0, 10);
  sendCsv(res, `clients-${date}.csv`, toCsv(data, columns));
});

// ─── Projects ─────────────────────────────────────────────────────────────────

router.get("/export/projects.csv", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: projectsTable.id,
      clientId: projectsTable.clientId,
      clientName: clientsTable.companyName,
      name: projectsTable.name,
      status: projectsTable.status,
      priority: projectsTable.priority,
      progress: projectsTable.progress,
      startDate: projectsTable.startDate,
      deadline: projectsTable.deadline,
      estimatedBudget: projectsTable.estimatedBudget,
      actualCost: projectsTable.actualCost,
      revenue: projectsTable.revenue,
      description: projectsTable.description,
      ownerNotes: projectsTable.ownerNotes,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .orderBy(projectsTable.id);

  const data: Record<string, unknown>[] = rows.map((r) => ({
    ...r,
    startDate: r.startDate ?? "",
    deadline: r.deadline ?? "",
    estimatedBudget: num(r.estimatedBudget),
    actualCost: num(r.actualCost),
    revenue: num(r.revenue),
    profit: r.revenue !== null && r.actualCost !== null
      ? num(Number(r.revenue) - Number(r.actualCost))
      : "",
    createdAt: isoOrEmpty(r.createdAt),
    updatedAt: isoOrEmpty(r.updatedAt),
  }));

  const columns = [
    { header: "ID", key: "id" },
    { header: "Client ID", key: "clientId" },
    { header: "Client Name", key: "clientName" },
    { header: "Project Name", key: "name" },
    { header: "Status", key: "status" },
    { header: "Priority", key: "priority" },
    { header: "Progress (%)", key: "progress" },
    { header: "Start Date", key: "startDate" },
    { header: "Deadline", key: "deadline" },
    { header: "Estimated Budget", key: "estimatedBudget" },
    { header: "Actual Cost", key: "actualCost" },
    { header: "Revenue", key: "revenue" },
    { header: "Profit", key: "profit" },
    { header: "Description", key: "description" },
    { header: "Owner Notes", key: "ownerNotes" },
    { header: "Created At", key: "createdAt" },
    { header: "Updated At", key: "updatedAt" },
  ];

  const date = new Date().toISOString().slice(0, 10);
  sendCsv(res, `projects-${date}.csv`, toCsv(data, columns));
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

router.get("/export/tasks.csv", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      priority: tasksTable.priority,
      status: tasksTable.status,
      deadline: tasksTable.deadline,
      notes: tasksTable.notes,
      clientId: tasksTable.clientId,
      clientName: clientsTable.companyName,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .orderBy(tasksTable.id);

  const data: Record<string, unknown>[] = rows.map((r) => ({
    ...r,
    deadline: r.deadline ?? "",
    createdAt: isoOrEmpty(r.createdAt),
  }));

  const columns = [
    { header: "ID", key: "id" },
    { header: "Title", key: "title" },
    { header: "Priority", key: "priority" },
    { header: "Status", key: "status" },
    { header: "Deadline", key: "deadline" },
    { header: "Notes", key: "notes" },
    { header: "Client ID", key: "clientId" },
    { header: "Client Name", key: "clientName" },
    { header: "Project ID", key: "projectId" },
    { header: "Project Name", key: "projectName" },
    { header: "Created At", key: "createdAt" },
  ];

  const date = new Date().toISOString().slice(0, 10);
  sendCsv(res, `tasks-${date}.csv`, toCsv(data, columns));
});

// ─── Invoices & Payments ─────────────────────────────────────────────────────

router.get("/export/invoices.csv", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: paymentsTable.id,
      invoiceNumber: paymentsTable.invoiceNumber,
      clientId: paymentsTable.clientId,
      clientName: clientsTable.companyName,
      projectId: paymentsTable.projectId,
      projectName: projectsTable.name,
      amount: paymentsTable.amount,
      status: paymentsTable.status,
      dueDate: paymentsTable.dueDate,
      paidDate: paymentsTable.paidDate,
      paymentMethod: paymentsTable.paymentMethod,
      remainingBalance: paymentsTable.remainingBalance,
      notes: paymentsTable.notes,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .leftJoin(clientsTable, eq(paymentsTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(paymentsTable.projectId, projectsTable.id))
    .orderBy(paymentsTable.id);

  const data: Record<string, unknown>[] = rows.map((r) => ({
    ...r,
    amount: num(r.amount),
    remainingBalance: num(r.remainingBalance),
    dueDate: r.dueDate ?? "",
    paidDate: r.paidDate ?? "",
    createdAt: isoOrEmpty(r.createdAt),
  }));

  const columns = [
    { header: "ID", key: "id" },
    { header: "Invoice Number", key: "invoiceNumber" },
    { header: "Client ID", key: "clientId" },
    { header: "Client Name", key: "clientName" },
    { header: "Project ID", key: "projectId" },
    { header: "Project Name", key: "projectName" },
    { header: "Amount", key: "amount" },
    { header: "Status", key: "status" },
    { header: "Due Date", key: "dueDate" },
    { header: "Paid Date", key: "paidDate" },
    { header: "Payment Method", key: "paymentMethod" },
    { header: "Remaining Balance", key: "remainingBalance" },
    { header: "Notes", key: "notes" },
    { header: "Created At", key: "createdAt" },
  ];

  const date = new Date().toISOString().slice(0, 10);
  sendCsv(res, `invoices-${date}.csv`, toCsv(data, columns));
});

// ─── Documents Metadata ───────────────────────────────────────────────────────

router.get("/export/documents.csv", async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: documentsTable.id,
      title: documentsTable.title,
      type: documentsTable.type,
      clientId: documentsTable.clientId,
      clientName: clientsTable.companyName,
      projectId: documentsTable.projectId,
      projectName: projectsTable.name,
      url: documentsTable.url,
      notes: documentsTable.notes,
      createdAt: documentsTable.createdAt,
    })
    .from(documentsTable)
    .leftJoin(clientsTable, eq(documentsTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(documentsTable.projectId, projectsTable.id))
    .orderBy(documentsTable.id);

  const data: Record<string, unknown>[] = rows.map((r) => ({
    ...r,
    // Omit raw GCS paths — export only the access URL pattern so
    // recipients know the type of storage without leaking internal paths.
    url: r.url?.startsWith("/objects/") ? "[stored file]" : (r.url ?? ""),
    createdAt: isoOrEmpty(r.createdAt),
  }));

  const columns = [
    { header: "ID", key: "id" },
    { header: "Title", key: "title" },
    { header: "Type", key: "type" },
    { header: "Client ID", key: "clientId" },
    { header: "Client Name", key: "clientName" },
    { header: "Project ID", key: "projectId" },
    { header: "Project Name", key: "projectName" },
    { header: "URL / Storage", key: "url" },
    { header: "Notes", key: "notes" },
    { header: "Created At", key: "createdAt" },
  ];

  const date = new Date().toISOString().slice(0, 10);
  sendCsv(res, `documents-${date}.csv`, toCsv(data, columns));
});

export default router;
