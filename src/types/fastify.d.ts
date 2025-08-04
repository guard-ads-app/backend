import 'fastify';
import { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    pg: {
      pool: Pool;
      client: any;
    };
  }
}
