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

    try {
      const res = await fetch('http://localhost:5678/webhook/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${title} ${description}` })
      })

      const moderation = await res.json()
      if (!moderation.isSafe) {
        reply.code(403).send({ error: 'Contenido no permitido' })
        return
      }

      await client.query(
        'INSERT INTO ads (title, description, category, image_url, created_at) VALUES ($1, $2, $3, $4, $5)',
        [title, description, moderation.category, imageUrl, created_at]
      )

      reply.code(201).send({ ok: true })
    } catch (err) {
      console.error(err)
      reply.code(500).send({ error: 'Error interno' })
    } finally {
      client.release()
    }
  })
}
