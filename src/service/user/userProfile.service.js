import { USER_REPOSITORY } from "../../repository/user.repository.js";
import bcrypt from "bcrypt";
import cloudinary from "../../config/cloudinary.js";
import { uploadBufferToCloudinary } from "../../helper/uploadBuffer.js";

const getPublicIdAvatar = (url) => {
  if (!url) return null;

  const parts = url.split("/upload/");
  if (parts.length < 2) return null;

  const pathWithVersion = parts[1];
  const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, "");
  const publicId = pathWithoutVersion.replace(/\.[^/.]+$/, "");

  return publicId;
};

export const onGetUsers = async (payload) => {
  try {
    const users = await USER_REPOSITORY.findById(payload.id);
    return users;
  } catch (error) {
    console.log("GET DATA ", error);
    throw error;
  }
};

export const onUpdateUser = async ({ _id, payload }) => {
  try {
    const user = await USER_REPOSITORY.findById(_id);
    if (!user) throw new Error("Không tìm thấy tài khoản cần cập nhật");

    const updateData = {};

    if (payload.fullname !== undefined) {
      updateData.fullname = payload.fullname;
    }

    if (payload.username !== undefined) {
      updateData.username = payload.username;
    }

    if (payload.password) {
      if (!payload.currentPass) {
        throw new Error("Vui lòng nhập mật khẩu hiện tại");
      }

      const isMatch = await bcrypt.compare(payload.currentPass, user.password);
      if (!isMatch) {
        throw new Error("Mật khẩu hiện tại không đúng");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(payload.password, saltRounds);
      updateData.password = hashedPassword;
    }

    if (payload.file) {
      if (user.avatar) {
        const OldAvatar = getPublicIdAvatar(user.avatar);

        if (OldAvatar) {
          try {
            await cloudinary.uploader.destroy(OldAvatar);
          } catch (error) {
            console.log("DELETE OLD AVATAR ERROR:", error);
          }
        }
      }

      const upload = await uploadBufferToCloudinary(payload.file.buffer, {
        folder: "Chat_System_Avatars",
      });

      updateData.avatar = upload.secure_url;
    }

    return await USER_REPOSITORY.updateById({
      _id,
      data: updateData,
    });
  } catch (error) {
    console.log("UPDATE USER: ", error);
    throw error;
  }
};

export const onSearchUser = async ({ keyword, currentUserId }) => {
  try {
    if (!keyword?.trim()) return [];

    const users = await USER_REPOSITORY.findByUser({
      keyword,
      currentUserId,
    });

    return users;
  } catch (error) {
    throw error;
  }
};

export const onUpdateStatus = async (userId, data = {}) => {
  const updateData = {
    status: data.status,
  };

  if (data.lastSeenAt !== undefined) {
    updateData.lastSeenAt = data.lastSeenAt;
  }

  return await USER_REPOSITORY.updateById({
    _id: userId,
    data: updateData,
  });
};
