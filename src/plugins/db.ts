import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(require('@fastify/postgres'), {
    connectionString: process.env.PG_CONNECTION_STRING,
  })
})
