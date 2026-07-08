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
import chatRouter from './src/routes/chat.route.js'
import { USER_REPOSITORY } from './src/repository/user.repository.js'
import callRouter from './src/routes/call.route.js'
import env from './src/config/env.js'

dotenv.config()

const SERVER = async () => {
  await connectDB()

  //server restart thì chuyển toàn bộ sang offline tránh online ảo
  await USER_REPOSITORY.updateMany(
    { status: "online" },
    {
      status: "offline",
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    }
  )

  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:30080',
      'http://127.0.0.1:30080',
      'https://videochatsystem-fe.vercel.app'
    ],
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
  app.use('/api', chatRouter)
  app.use('/api', callRouter)

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500

    return res.status(statusCode).json({
      message: err.message || 'Đã xảy ra lỗi vui lòng thử lại'
    })
  })

  try {
    await import('./src/workers/uploadFileWorker.js')
    await import('./src/workers/shareMessageWorker.js')
    await import('./src/workers/getLinkPeviewWorker.js')
    console.log('Worker run successfully')
  } catch (error) {
    console.error('Failed worker:', error)
  }

  const Port = Number(env.PORT) || 5000 || 8080

  server.listen(Port, () => {
    console.log(`Server is running on port ${Port}`)
  })
}

SERVER()
