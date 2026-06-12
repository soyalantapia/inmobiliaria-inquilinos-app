import { PrismaClient } from '@prisma/client';

/** Cliente único compartido (Fastify es single-process). */
export const prisma = new PrismaClient();
