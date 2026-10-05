import { role } from "../../data/user.data.js"
import { handleDeviceSession } from "../../helper/deviceSession.js"
import { USER_REPOSITORY } from "../../repository/user.repository.js"
import bcrypt from 'bcrypt'

const onLogin = async (payload) => {
    try {
        if (!payload.email || !payload.password) throw new Error('Please provide email and password')

        const admin = await USER_REPOSITORY.findByEmail(payload.email)

        if (!admin) throw new Error('Email or password not found.Please try again')

        if (!admin.isActive) throw new Error('Admin is not active.Please try again')

        if (admin.isBanned) throw new Error('Admin is banned.Please try again')

        if (admin.role === role.CLIENT) throw new Error('Admin not found.Please try again')

        const isPasswordMatch = await bcrypt.compare(payload.password, admin.password)
        if (!isPasswordMatch) throw new Error('Invalid password')

        const data = {
            ...admin,
            payload
        }

        return handleDeviceSession(data)
    } catch (error) {
        throw (error)
    }
}



export const ADMIN_AUTH_SERVICE = {
    onLogin,
}
