import { role } from "../../data/user.data.js"
import { handleDeviceSession } from "../../helper/deviceSession.js"
import { DEVICE_SESSION_REPOSITORY } from "../../repository/deviceSession.repository.js"
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

const onRefreshToken = async (refreshToken) => {
    try {

        if(!refreshToken) throw new Error("Refresh token is required")

        const session = await DEVICE_SESSION_REPOSITORY.findOne({ refreshToken, revokedAt: null })
    
        if(!session) throw new Error("Login session dose not exist")

        if (new Date() > new Date(session.expiredAt)) {
            throw new Error("Login session has expired, please log in again");
        }

        const admin = await USER_REPOSITORY.findById(session.userId)

        if(!admin) throw new Error("Account not found")

        if(!admin.isActive) throw new Error("Account is not active")

        if(admin.isBanned) throw new Error("Account is banned")

        if(admin.role === role.CLIENT) throw new Error("Account not found.Please try again")

        const data = {
            ...admin,
            payload: session
        }

        return await handleDeviceSession(data)
    } catch (error) {
        throw (error)
    }
}

export const onLogOut = async (refreshToken) => {
  try {
    if (!refreshToken) {
      throw new Error("Session does not exist");
    }

    const session = await DEVICE_SESSION_REPOSITORY.findOne({
      refreshToken,
      revokedAt: null,
    });

    if (!session) {
      throw new Error(
        "Your session does not exist or has been logged out",
      );
    }

    const revokedAt = new Date();

    const dataLogOut = await DEVICE_SESSION_REPOSITORY.updateOne(
      { refreshToken },
      {
        revokedAt,
        updatedAt: revokedAt,
      },
    );

    return dataLogOut;
  } catch (error) {
    console.error("LOGOUT: ", error);
    throw error;
  }
};


export const ADMIN_AUTH_SERVICE = {
    onLogin,
    onRefreshToken,
    onLogOut
}
