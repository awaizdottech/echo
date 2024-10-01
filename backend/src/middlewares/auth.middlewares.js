import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/user.model";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies.accessToken ||
    req.body.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  if (!token) throw new ApiError(401, "unauthorised");

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decodedToken) throw new ApiError(401, "unauthorised");

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) throw new ApiError(401, "unauthorised");

    req.user = user;

    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "unauthorised");
  }
});
