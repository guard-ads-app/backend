import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.get('/ads', async (request, reply) => {
    const client = await (fastify as any).pg.connect()
    const { rows } = await client.query('SELECT * FROM ads ORDER BY created_at DESC')
    client.release()
    return rows
  })

  fastify.post('/ads', async (request, reply) => {
    const client = await (fastify as any).pg.connect()
    const { title, description, imageUrl } = request.body as any
    const created_at = new Date()

    await client.query(
      'INSERT INTO ads (title, description, image_url, created_at) VALUES ($1, $2, $3, $4)',
      [title, description, imageUrl, created_at]
    )
    client.release()
    reply.code(201).send({ ok: true })
  })
}
