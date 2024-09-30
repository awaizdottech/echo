import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloud } from "../utils/cloud.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    avatar = await uploadOnCloud(avatarLocalPath);
    console.log("uploaded avatar", avatar);
  } catch (error) {
    console.log("error uploading avatar to azure", error);
    throw new ApiError(400, "failed to upload avatar");
  }
  let coverImage;
  if (coverLocalPath) {
    try {
      coverImage = await uploadOnCloud(coverLocalPath);
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
    }
    throw new ApiError(
      500,
      "Something went wrong while registering a user & images were deleted"
    );
  }
});

export { registerUser };
