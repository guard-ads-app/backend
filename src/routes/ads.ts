import { FastifyInstance } from 'fastify'

const env = process.env;

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

      const embedRes = await fetch(env.EMBEDDINGS_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${title} ${description}` })
      })

      const { embedding } = await embedRes.json()
      console.log("🚀 ~ embedding:", embedding)

      const insertAd = await client.query(
        'INSERT INTO ads (title, description, category, image_url, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [title, description, moderation.category, imageUrl, created_at]
      )
      const adId = insertAd.rows[0].id
      console.log("🚀 ~ adId:", adId)

      const payload = {
        id: adId,
        vector: embedding,
        payload: {
          title,
          description,
          category: moderation.category,
          imageUrl
        }
      }
      console.log("🚀 ~ payload save to Qdrant:", payload)

      await fetch(`${env.QDRANT_URL}/collections/${env.COLLECTION_NAME}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [
            payload
          ]
        })
      })

      reply.code(201).send({ ok: true })
    } catch (err) {
      console.error(err)
      reply.code(500).send({ error: 'Error interno' })
    } finally {
      client.release()
    }
  })

  fastify.get('/ads/search', async (request, reply) => {
    const query = (request.query as any).q
    const page = parseInt((request.query as any).page || '1');
    const limit = 10;
    const offset = (page - 1) * limit;
    if (!query) {
      const client = await (fastify as any).pg.connect();
      const { rows } = await client.query(
        'SELECT * FROM ads ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      client.release();
      return {
        results: rows.map((row: any) => ({
          id: row.id,
          version: 0, // o null si no quieres
          score: null, // sin score porque no es búsqueda semántica
          title: row.title,
          description: row.description,
          category: row.category,
          imageUrl: row.image_url
        })),
        status: "ok",
        time: null
      };
    }

    // 1. Generar embedding de la búsqueda
    const embedRes = await fetch(env.EMBEDDINGS_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query })
    })
    const { embedding } = await embedRes.json()

    // 2. Buscar en Qdrant
    const searchRes = await fetch(`${env.QDRANT_URL}/collections/${env.COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: embedding,
        limit: 5,
        with_payload: true
      })
    })
    const qdrantResults = await searchRes.json()
    console.log("🚀 ~ results:", qdrantResults)

    return {
      results: (qdrantResults.result || [])
        .filter((item: any) => (item.score ?? 0) >= 0.6)
        .map((item: any) => ({
          id: item.id,
          version: item.version ?? 0,
          score: item.score ?? null,
          title: item.payload.title,
          description: item.payload.description,
          category: item.payload.category,
          imageUrl: item.payload.imageUrl
        })),
      status: qdrantResults.status ?? "ok",
      time: qdrantResults.time ?? null
    };
  })
}
