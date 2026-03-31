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
    const dataActivated = await USER_SERVICE.onActiveAccount(req.body);
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

    const isProduction = process.env.NODE_ENV === "production";

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
    const isProduction = process.env.NODE_ENV === "production";

    const accessToken = req.cookies?.accessToken;
    if (!accessToken) {
      throw new Error("Bạn chưa đăng nhập");
    }

    await USER_SERVICE.onLogOut(accessToken);
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
      message: "Đã đăng xuất tài khoản thành công",
    });
  } catch (error) {
    next(error);
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

    if (!req.params.email || !req.body.password) {
      throw new Error("Dữ liệu không hợp lệ");
    }

    const data = {
      email: req.params.email,
      password: req.body.password,
    };

    await USER_SERVICE.onResetPassword(data);
    return res.status(200).json({
      message: "Đổi mật khẩu thành công",
    });
  } catch (error) {
    next(error);
  }
};

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

const onRefreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new Error("Vui lòng đăng nhập tài khoản lại");
    }

    const result = await USER_SERVICE.onRefreshToken(refreshToken);

    const isProduction = process.env.NODE_ENV === "production";

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

export const USER_CONTROLLER = {
  onRegister,
  onActivateAccount,
  onLogin,
  onLogOut,
  onForgotPassword,
  onResetPassword,
  onGetUsers,
  onRefreshToken
};
