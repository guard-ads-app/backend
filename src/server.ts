import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import adsRoutes from './routes/ads'
import db from './plugins/db'

dotenv.config()

const app = Fastify({
  logger: true
})

console.log('PORT ENV:', process.env.PORT)

app.register(cors)
app.register(db)
app.register(adsRoutes)

app.listen({ port: parseInt(process.env.PORT || '3000') }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`🚀 Backend running on ${address}`)
})
