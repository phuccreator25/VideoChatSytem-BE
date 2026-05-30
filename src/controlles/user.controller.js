import env from "../config/env.js";
import { USER_SERVICE } from "../service/user.service.js";

const onRegister = async (req, res, next) => {
  try {
    const dataCreated = await USER_SERVICE.onRegister(req.body);

    return res.status(201).json({
      message: "Vui lòng kiểm tra Email để thực hiện xác thực tài khoản",
      data: dataCreated,
    });
  } catch (error) {
    next(error); // CHUYỂN ĐẾN FUCNTION LỖI Ở SERVER.JS
  }
};

const onActivateAccount = async (req, res, next) => {
  try {
    const dataActivated = await USER_SERVICE.onActiveAccount(req.body.token);
    return res.status(200).json({
      data: dataActivated,
    });
  } catch (error) {
    next(error);
  }
};

const onLogin = async (req, res, next) => {
  try {
    const { email, password, deviceId } = req.body;

    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip;

    const userAgent = req.headers["user-agent"] || null;

    const metaData = {
      ipAddress,
      userAgent,
      deviceId: deviceId || null,
      email,
      password,
    };

    const dataLogin = await USER_SERVICE.onLogin(metaData);

    const isProduction = env.NODE_ENV === "production";

    res.cookie("accessToken", dataLogin.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    res.cookie("refreshToken", dataLogin.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "Đã đăng nhập thành công",
      data: dataLogin.data
    });
  } catch (error) {
    next(error);
  }
};

const onLogOut = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await USER_SERVICE.onLogOut(refreshToken);
    }

    const isProduction = env.NODE_ENV === "production";

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    const isProduction = env.NODE_ENV === "production";

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "Đăng xuất thành công",
    });
  }
};

const onForgotPassword = async (req, res, next) => {
  try {
    await USER_SERVICE.onForgotPassword(req.body);
    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};

const onResetPassword = async (req, res, next) => {
  try {

    if (!req.params.token || !req.body.password) {
      throw new Error("Dữ liệu không hợp lệ");
    }

    const data = {
      token: req.params.token,
      password: req.body.password,
    };

    const result = await USER_SERVICE.onResetPassword(data);
    
    return res.status(200).json({
      message: "Đổi mật khẩu thành công",
      data: {
        email: result.email
      }
    });
  } catch (error) {
    next(error);
  }
};


const onRefreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Vui lòng đăng nhập tài khoản lại",
      });
    }

    const result = await USER_SERVICE.onRefreshToken(refreshToken);

    const isProduction = env.NODE_ENV === "production";

    res.cookie("accessToken", result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
    });

    return res.status(200).json({
      data: result.data
    });

  } catch (error) {
    next(error);
  }
}

const onGetUsers = async (req, res, next) => {
  try {
    const users = await USER_SERVICE.onGetUsers(req.user);
    return res.status(200).json({
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

const onUpdate = async (req, res, next) => {
  try {
    const user = await USER_SERVICE.onUpdateUser({
      _id: req.user.id,
      payload: req.body
    });

    return res.status(200).json({
      message: "Cập nhật thành công",
      data: user
    });
  } catch (error) {
    next(error);
  }
};

const onUpdateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Không có file gửi lên'
      })
    }

    const user = await USER_SERVICE.onUpdateUser({
      _id: req.user.id,
      payload: {file: req.file}
    });

    return res.status(200).json({
      data: user
    });
  } catch (error) {
    next(error)
  }
}

const onSearchUser = async(req, res, next) => {
  try {
    const  keyword = req.params.searchValue;
    
    const users = await USER_SERVICE.onSearchUser({
      keyword: keyword,
      currentUserId: req.user.id
    });

    return res.status(200).json({
      data: users
    })
  } catch (error) {
    next(error)
  }
}

export const USER_CONTROLLER = {
  onRegister,
  onActivateAccount,
  onLogin,
  onLogOut,
  onForgotPassword,
  onResetPassword,
  onGetUsers,
  onRefreshToken,
  onUpdate,
  onUpdateAvatar,
  onSearchUser
};
