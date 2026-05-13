import { connectDB } from './src/config/database.js'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'

import userRouter from './src/routes/user.route.js'
import invitationRouter from './src/routes/invitation.route.js'
import contactRouter from './src/routes/contacts.route.js'
import blockRouter from './src/routes/block.route.js'
import conversationRouter from './src/routes/conversation.route.js'

import { arjectProtection } from './src/middleware/arject.middleware.js'
import { app, server } from './src/sockets/socket.js'

dotenv.config()

const SERVER = async () => {
  await connectDB()

  app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }))

//   app.use(express.json())
  app.use(cookieParser())
  app.use(arjectProtection)

  app.use('/api', userRouter)
  app.use('/api', invitationRouter)
  app.use('/api', contactRouter)
  app.use('/api', blockRouter)
  app.use('/api', conversationRouter)

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500

    return res.status(statusCode).json({
      message: err.message || 'Đã xảy ra lỗi vui lòng thử lại'
    })
  })

  const Port = Number(process.env.PORT) || 3000

  server.listen(Port, () => {
    console.log(`Server is running on port ${Port}`)
  })
}

SERVER()