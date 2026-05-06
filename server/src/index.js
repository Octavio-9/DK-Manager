import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db.js";
import { clearAuthCookie, requireAuth, setAuthCookie, signAuthToken } from "./auth.js";

const app = express();

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const presenceState = {
  userConnections: new Map(),
  streams: new Set(),
};

function getActiveUsersCount() {
  let count = 0;
  for (const connections of presenceState.userConnections.values()) {
    if (connections > 0) count += 1;
  }
  return count;
}

function broadcastPresence() {
  const payload = JSON.stringify({ activeUsers: getActiveUsersCount(), ts: Date.now() });
  for (const res of presenceState.streams) {
    try {
      res.write(`event: presence\ndata: ${payload}\n\n`);
    } catch {
      // Ignore broken streams; cleanup happens on close.
    }
  }
}

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/presence/active", requireAuth, (req, res) => {
  return res.json({ activeUsers: getActiveUsersCount() });
});

app.get("/api/presence/stream", requireAuth, (req, res) => {
  // Server-Sent Events stream. A connected browser tab counts as "active".
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  presenceState.streams.add(res);
  const userId = req.auth.sub;
  presenceState.userConnections.set(userId, (presenceState.userConnections.get(userId) ?? 0) + 1);

  res.write(
    `event: presence\ndata: ${JSON.stringify({ activeUsers: getActiveUsersCount(), ts: Date.now() })}\n\n`
  );
  broadcastPresence();

  const keepAlive = setInterval(() => {
    try {
      // Comment line keeps proxies from timing out idle connections.
      res.write(":keepalive\n\n");
    } catch {
      // noop
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    presenceState.streams.delete(res);

    const next = (presenceState.userConnections.get(userId) ?? 1) - 1;
    if (next <= 0) presenceState.userConnections.delete(userId);
    else presenceState.userConnections.set(userId, next);

    broadcastPresence();
  });
});

app.post("/api/auth/signup", asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const allowedRoles = ["admin", "manager", "operator", "viewer"];
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: "Rôle invalide" });

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: "Cet email est déjà utilisé." });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await prisma.user.create({
    data: { name: String(name), email: normalizedEmail, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, avatarBg: true },
  });

  const token = signAuthToken({ sub: user.id, role: user.role });
  setAuthCookie(res, token);
  return res.json({ user });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "Champs manquants" });

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

  const token = signAuthToken({ sub: user.id, role: user.role });
  setAuthCookie(res, token);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarBg: user.avatarBg },
  });
}));

app.post("/api/auth/logout", async (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID");

app.post("/api/auth/google", asyncHandler(async (req, res) => {
  const { credential } = req.body ?? {};
  if (!credential) return res.status(400).json({ error: "Jeton manquant" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
       return res.status(400).json({ error: "Jeton invalide" });
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      const name = payload.name || "Google User";
      const passwordHash = ""; // No password login for Google
      const role = "viewer"; 
      user = await prisma.user.create({
        data: { name, email: normalizedEmail, passwordHash, role },
        select: { id: true, name: true, email: true, role: true, avatarBg: true },
      });
    }

    const token = signAuthToken({ sub: user.id, role: user.role });
    setAuthCookie(res, token);
    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarBg: user.avatarBg },
    });
  } catch (err) {
    return res.status(401).json({ error: "Authentification Google échouée" });
  }
}));

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const id = req.auth.sub;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, avatarBg: true },
  });
  if (!user) return res.status(401).json({ error: "Non authentifié" });
  return res.json({ user });
});

app.get("/api/projects", requireAuth, async (req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      client: true,
      clientId: true,
      clientRel: { select: { id: true, name: true } },
      status: true,
      deadline: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return res.json({ projects });
});

app.post("/api/projects", requireAuth, async (req, res) => {
  const { title, client, clientId, status, deadline, description } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "Titre requis" });

  const allowed = ["PLANNING", "FILMING", "EDITING", "DELIVERED"];
  const normalizedStatus = status ? String(status).toUpperCase() : "PLANNING";
  if (!allowed.includes(normalizedStatus)) return res.status(400).json({ error: "Statut invalide" });

  let parsedDeadline = null;
  if (deadline) {
    const d = new Date(String(deadline));
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Échéance invalide" });
    parsedDeadline = d;
  }

  const project = await prisma.project.create({
    data: {
      title: String(title),
      client: client ? String(client) : "N/A",
      clientId: clientId || null,
      status: normalizedStatus,
      deadline: parsedDeadline,
      description: description ? String(description) : null,
      createdById: req.auth.sub,
    },
    select: {
      id: true,
      title: true,
      client: true,
      clientId: true,
      clientRel: { select: { id: true, name: true } },
      status: true,
      deadline: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.status(201).json({ project });
});

app.put("/api/projects/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, client, clientId, status, deadline, description } = req.body ?? {};

  const updateData = {};
  if (title !== undefined) updateData.title = String(title);
  if (client !== undefined) updateData.client = String(client);
  if (clientId !== undefined) updateData.clientId = clientId || null;
  if (description !== undefined) updateData.description = description ? String(description) : null;

  if (status !== undefined) {
    const allowed = ["PLANNING", "FILMING", "EDITING", "DELIVERED"];
    const normalizedStatus = String(status).toUpperCase();
    if (!allowed.includes(normalizedStatus)) return res.status(400).json({ error: "Statut invalide" });
    updateData.status = normalizedStatus;
  }

  if (deadline !== undefined) {
    if (deadline === null) {
      updateData.deadline = null;
    } else {
      const d = new Date(String(deadline));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Échéance invalide" });
      updateData.deadline = d;
    }
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        client: true,
        clientId: true,
        clientRel: { select: { id: true, name: true } },
        status: true,
        deadline: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ project });
  } catch (err) {
    return res.status(400).json({ error: "Projet introuvable" });
  }
});

app.delete("/api/projects/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.project.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de supprimer le projet" });
  }
});

app.get("/api/tasks", requireAuth, async (req, res) => {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignee: { select: { id: true, name: true, avatarBg: true } },
      project: { select: { id: true, title: true } }
    }
  });
  return res.json({ tasks });
});

app.post("/api/tasks", requireAuth, async (req, res) => {
  const { title, status, priority, projectId, assigneeId, dueDate } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "Le titre est requis" });

  let parsedDate = null;
  if (dueDate) {
    const d = new Date(String(dueDate));
    if (!Number.isNaN(d.getTime())) parsedDate = d;
  }

  const task = await prisma.task.create({
    data: {
      title: String(title),
      status: status || "TODO",
      priority: priority || "MEDIUM",
      dueDate: parsedDate,
      projectId: projectId || null,
      assigneeId: assigneeId || null
    },
    include: {
      assignee: { select: { id: true, name: true, avatarBg: true } },
      project: { select: { id: true, title: true } }
    }
  });
  return res.status(201).json({ task });
});

app.put("/api/tasks/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, status, priority, projectId, assigneeId, dueDate } = req.body ?? {};

  let parsedDate = undefined;
  if (dueDate !== undefined) {
    if (dueDate === null) parsedDate = null;
    else {
      const d = new Date(String(dueDate));
      if (!Number.isNaN(d.getTime())) parsedDate = d;
    }
  }

  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title) }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(projectId !== undefined && { projectId }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(parsedDate !== undefined && { dueDate: parsedDate }),
      },
      include: {
        assignee: { select: { id: true, name: true, avatarBg: true } },
        project: { select: { id: true, title: true } }
      }
    });
    return res.json({ task });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de mettre à jour la tâche" });
  }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de supprimer la tâche" });
  }
});
app.get("/api/clients", requireAuth, async (req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projects: { select: { id: true, title: true, status: true } }
    }
  });
  return res.json({ clients });
});

app.post("/api/clients", requireAuth, async (req, res) => {
  const { name, company, phone, whatsapp, email, address, budget, notes, type, status } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "Le nom est requis" });

  try {
    const client = await prisma.client.create({
      data: {
        name: String(name),
        company: company ? String(company) : null,
        phone: phone ? String(phone) : null,
        whatsapp: whatsapp ? String(whatsapp) : null,
        email: email ? String(email) : null,
        address: address ? String(address) : null,
        budget: budget ? String(budget) : null,
        notes: notes ? String(notes) : null,
        type: type || "ENTREPRISE",
        status: status || "PROSPECT"
      },
      include: { projects: { select: { id: true } } }
    });
    return res.status(201).json({ client });
  } catch (err) {
    return res.status(400).json({ error: "Erreur lors de la création du client" });
  }
});

app.put("/api/clients/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, company, phone, whatsapp, email, address, budget, notes, type, status } = req.body ?? {};
  
  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name) }),
        ...(company !== undefined && { company: company ? String(company) : null }),
        ...(phone !== undefined && { phone: phone ? String(phone) : null }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp ? String(whatsapp) : null }),
        ...(email !== undefined && { email: email ? String(email) : null }),
        ...(address !== undefined && { address: address ? String(address) : null }),
        ...(budget !== undefined && { budget: budget ? String(budget) : null }),
        ...(notes !== undefined && { notes: notes ? String(notes) : null }),
        ...(type !== undefined && { type }),
        ...(status !== undefined && { status }),
      },
      include: {
        projects: { select: { id: true, title: true, status: true } }
      }
    });
    return res.json({ client });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de mettre à jour le client" });
  }
});

app.delete("/api/clients/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.client.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de supprimer le client" });
  }
});

app.get("/api/users", requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, avatarBg: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  // Transform createdAt to joined format and status mapping
  const formattedUsers = users.map(u => ({
    ...u,
    status: "active", // We don't have a status field in Prisma yet, defaulting to active
    joined: u.createdAt.toISOString()
  }));
  return res.json({ users: formattedUsers });
});

app.post("/api/users", requireAuth, async (req, res) => {
  const { name, email, role, password } = req.body ?? {};
  if (!name || !email) return res.status(400).json({ error: "Nom et email requis" });

  try {
    const passwordHash = await bcrypt.hash(password || "password123", 10);
    const colors = ['#9d3bf1', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#3b82f6'];
    const avatarBg = colors[Math.floor(Math.random() * colors.length)];
    
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        role: role || "viewer",
        passwordHash,
        avatarBg
      },
      select: { id: true, name: true, email: true, role: true, avatarBg: true, createdAt: true }
    });
    return res.status(201).json({ user: { ...user, status: "active", joined: user.createdAt.toISOString() } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "Cet email existe déjà" });
    }
    return res.status(400).json({ error: "Erreur création utilisateur" });
  }
});

app.put("/api/users/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body ?? {};
  
  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, avatarBg: true, createdAt: true }
    });
    return res.json({ user: { ...user, status: "active", joined: user.createdAt.toISOString() } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "Cet email est déjà pris" });
    }
    return res.status(400).json({ error: "Erreur mise à jour utilisateur" });
  }
});

app.delete("/api/users/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Erreur suppression utilisateur" });
  }
});

app.get("/api/events", requireAuth, async (req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { date: "asc" }
  });
  return res.json({ events });
});

app.post("/api/events", requireAuth, async (req, res) => {
  const { title, type, date, endTime, location, notes, projectId } = req.body ?? {};
  if (!title || !date) return res.status(400).json({ error: "Titre et date requis" });

  try {
    const event = await prisma.event.create({
      data: {
        title,
        type: type || "Tournage",
        date: new Date(date),
        endTime: endTime ? new Date(endTime) : null,
        location,
        notes,
        projectId
      }
    });
    return res.status(201).json({ event });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de créer l'événement" });
  }
});

app.put("/api/events/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, type, date, endTime, location, notes, projectId } = req.body ?? {};
  
  try {
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
        ...(projectId !== undefined && { projectId }),
      }
    });
    return res.json({ event });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de mettre à jour l'événement" });
  }
});

app.delete("/api/events/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.event.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Impossible de supprimer l'événement" });
  }
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    const activeProjectsCount = await prisma.project.count({ where: { NOT: { status: 'DELIVERED' } } });
    const today = new Date();
    today.setHours(0,0,0,0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    const eventsThisWeekCount = await prisma.event.count({
      where: {
        date: { gte: today, lte: endOfWeek }
      }
    });

    const tasksTodayCount = await prisma.task.count({
      where: {
        status: { not: 'DONE' }
      }
    });

    const notificationsCount = await prisma.notification.count({
      where: {
        userId: req.auth.sub,
        read: false
      }
    });

    const recentProjects = await prisma.project.findMany({
      take: 3,
      orderBy: { updatedAt: 'desc' },
      include: { clientRel: true }
    });

    const upcomingEvents = await prisma.event.findMany({
      where: { date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 3
    });

    return res.json({
      stats: {
        activeProjects: activeProjectsCount,
        eventsThisWeek: eventsThisWeekCount,
        tasksToday: tasksTodayCount,
        notifications: notificationsCount
      },
      recentProjects,
      upcomingEvents
    });
  } catch (err) {
    return res.status(500).json({ error: "Erreur lors du chargement du dashboard" });
  }
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.auth.sub },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ error: "Erreur notifications" });
  }
});

app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notification.updateMany({
      where: { id, userId: req.auth.sub },
      data: { read: true }
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Erreur" });
  }
});

app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.auth.sub, read: false },
      data: { read: true }
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Erreur" });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // eslint-disable-next-line no-console
  console.error(err);

  if (err?.message === "JWT_SECRET manquant") {
    return res.status(500).json({ error: "Configuration serveur incomplete: JWT_SECRET manquant." });
  }

  return res.status(500).json({ error: "Erreur serveur" });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API prête sur http://localhost:${port}`);
});
