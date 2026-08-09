import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function parsePagination(query: unknown) {
  const { page, limit } = paginationSchema.parse(query);
  return { page, limit, offset: (page - 1) * limit };
}
