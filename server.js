import express from 'express';
import { connectDB} from './src/config/database.js'
import cors from 'cors';
import dotenv from 'dotenv'
import userRouter from './src/routes/user.route.js';
import cookieParser from 'cookie-parser';
dotenv.config();

const SERVER = async() => {
    await connectDB();

    const app = express();

    app.use(cors({
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }))

    app.use(express.json());

    app.use(cookieParser());
    app.use('/api', userRouter);

    app.use((err, req, res, next) => { // Error middleware này run global, tất cả router có next Error đều xuống đây
        const statusCode = err.statusCode || 500

        return res.status(statusCode).json({
            message: err.message || 'Đã xảy ra lỗi vui lòng thử lại'
        })
    })

    const Port = Number(process.env.PORT) || 3000;
     
    app.listen(Port, () => {
      console.log('Server is running on port 3000');
    });
}

SERVER();
