import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { deleteFromCloud, uploadOnCloud } from "../utils/cloud.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    // todo check for user
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "something went wrong while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  if (Object.keys(req.body).length === 0)
    throw new ApiError(400, "didnt receive ay data");
  // validation
  // todo: implement zod or some library here instead of manually checking schema received
  if (
    [fullName, username, email, password].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is missing");
  }

  // const avatar = await uploadOnCloud(avatarLocalPath);
  // let coverImage;
  // if (coverLocalPath) {
  //   coverImage = uploadOnCloud(coverLocalPath);
  // }
  let avatar;
  try {
    avatar = await uploadOnCloud(avatarLocalPath, `${username}_avatar.jpg`);
    console.log("uploaded avatar", avatar);
  } catch (error) {
    console.log("error uploading avatar to azure", error);
    throw new ApiError(400, "failed to upload avatar");
  }
  let coverImage;
  if (coverLocalPath) {
    try {
      coverImage = await uploadOnCloud(
        coverLocalPath,
        `${username}_coverImage.jpg`
      );
      console.log("uploaded coverImage", coverImage);
    } catch (error) {
      console.log("error uploading coverImage to azure", error);
      throw new ApiError(400, "failed to upload coverImage");
    }
  }

  try {
    const user = await User.create({
      fullName,
      avatar,
      coverImage,
      email,
      password,
      username,
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering a user");
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "user registered successfully"));
  } catch (error) {
    console.log("user creation failed");
    if (avatar) {
      // todo delete it from azure & similalry for coverImage
      await deleteFromCloud(`${username}_avatar.jpg`);
    }
    if (coverImage) {
      // todo delete it from azure & similalry for coverImage
      await deleteFromCloud(`${username}_coverImage.jpg`);
    }
    throw new ApiError(
      500,
      "Something went wrong while registering a user & images were deleted"
    );
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  // todo more validation needed
  if (!email) throw new ApiError(400, "email is required");

  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) throw new ApiError(400, "user not found");

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) throw new ApiError(401, "invalid password");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await user
    .findById(user._id)
    .select("-password -refreshToken");
  // todo check for loggedInUser

  const options = {
    httpOnly: true, // makes cookie safe, not modifiable by he client
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // cookies cantbe set in mobile apps
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "user logged in successfully"
      )
    );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefrehToken = req.cookies.refreshToken || req.body.refreshToken; // it'll come in body from mobile app

  if (!incomingRefrehToken)
    throw new ApiError(401, "refresh token is required");

  try {
    const decodedToken = jwt.verify(
      incomingRefrehToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "invalid refresh token");

    if (incomingRefrehToken !== user?.refreshToken)
      throw new ApiError(401, "invalid refresh token");

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while refreshing access token"
    );
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: { refreshToken: undefined }, // undefined may not work, depends on the version of mongodb
  }),
    { new: true };

  // todo make options globally accessible or something similar
  const options = {
    httpsOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  const isPasswordValid = user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) throw new ApiError(401, "Old password is incorrect");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user details"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email)
    throw new ApiError(400, "fullname & email are required");

  const user = User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullName, email } },
    { new: true }.select("-password -refreshToken")
  );

  return res
    .status(200)
    .json(new ApiResponse(200, user, "account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) throw new ApiError(400, "file is required");

  const avatar = await uploadOnCloud(
    avatarLocalPath,
    `${req.user?.username}_avatar.jpg`
  );

  if (!avatar)
    throw new ApiError(500, "something went wrong while uploading avatar");
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) throw new ApiError(400, "file is required");

  const coverImage = await uploadOnCloud(
    coverImageLocalPath,
    `${req.user?.username}_coverImage.jpg`
  );
  if (!coverImage)
    throw new ApiError(500, "something went wrong while uploading coverImage");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { coverImage } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage updated successfully"));
});

export {
  registerUser,
  generateAccessAndRefreshToken,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
