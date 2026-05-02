import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

const DEFAULT_USERS = [
  {
    email: "dakarai@dkproduction.com",
    password: "admin123",
    name: "Dakarai Kofi",
    role: "admin",
    avatarBg: "#9d3bf1",
  },
  {
    email: "alex.r@dkproduction.com",
    password: "manager123",
    name: "Alex Rivera",
    role: "manager",
    avatarBg: "#22d3ee",
  },
  {
    email: "sarah.c@dkproduction.com",
    password: "operator123",
    name: "Sarah Chen",
    role: "operator",
    avatarBg: "#9d3bf1",
  },
  {
    email: "maya.p@dkproduction.com",
    password: "viewer123",
    name: "Maya Patil",
    role: "viewer",
    avatarBg: "#3b82f6",
  },
];

async function main() {
  for (const u of DEFAULT_USERS) {
    const email = u.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) continue;

    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: {
        email,
        name: u.name,
        role: u.role,
        avatarBg: u.avatarBg,
        passwordHash,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

