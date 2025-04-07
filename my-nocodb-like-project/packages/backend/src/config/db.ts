import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
});

// Optional: Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

// Optional helper for raw SQL identifiers
// export function escapeIdentifier(identifier: string): string {
//     if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
//         throw new Error(`Invalid identifier: ${identifier}`);
//     }
//     return `"${identifier}"`; // Double quotes for PostgreSQL/SQLite
// }
