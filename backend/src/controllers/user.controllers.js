import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { deleteFromCloud, uploadOnCloud } from "../utils/cloud.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";

export const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    // todo check for user
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    console.log("ac", accessToken, "rf", refreshToken);
    user.refreshToken = refreshToken;
    console.log(user);
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "something went wrong while generating tokens");
  }
};

export const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;
  if (Object.keys(req.body).length === 0)
    throw new ApiError(400, "didnt receive any data");
  // validation
  // todo: implement zod or some library here instead of manually checking schema received
  if (
    [fullname, username, email, password].some(
      (field) => typeof field !== "string" || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is missing");
  }

  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    fs.unlinkSync(avatarLocalPath);
    if (coverLocalPath) fs.unlinkSync(coverLocalPath);
    throw new ApiError(409, "User with email or username already exists");
  }

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
      fullname,
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

export const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  // todo more validation needed
  if (!email) throw new ApiError(400, "email is required");
  // todo as we're finding user either from username or email if one of them is wrong there's no error
  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) throw new ApiError(400, "user not found");

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) throw new ApiError(401, "invalid password");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // todo check for loggedInUser

  const options = {
    httpOnly: true, // makes cookie safe, not modifiable by he client
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // cookies cant be set in mobile apps
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "user logged in successfully"
      )
    );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken; // it'll come in body from mobile app

  if (!incomingRefreshToken)
    throw new ApiError(401, "refresh token is required");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "invalid refresh token");

    if (incomingRefreshToken !== user?.refreshToken)
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
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      "something went wrong while refreshing access token"
    );
  }
});

export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 }, // removes feild from mongo
    },
    { new: true }
  );

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

export const updateCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) throw new ApiError(401, "Old password is incorrect");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user details"));
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email)
    throw new ApiError(400, "fullname & email are required");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullname, email } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "account details updated successfully"));
});

export const updateUserAvatar = asyncHandler(async (req, res) => {
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

export const updateUserCoverImage = asyncHandler(async (req, res) => {
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

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) throw new ApiError(400, "username is required");

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // tells if the current user is subscribed to the channel whose info is being fetched
            then: true,
            else: false,
          },
        },
      },
    },
    {
      // project only required data
      $project: {
        fullname: 1,
        username: 1,
        avatar: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) throw new ApiError(404, "channel not found");

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "channel data found"));
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  if (!user) throw new ApiError(404, "watch history couldnt be found");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user?.[0]?.watchHistory,
        "watch history fetched successfully"
      )
    );
});
