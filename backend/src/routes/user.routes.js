import { Router } from "express";
import {
  registerUser,
  logoutUser,
  loginUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getWatchHistory,
  refreshAccessToken,
  getCurrentUser,
  getUserChannelProfile,
  updateCurrentPassword,
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

// unsecured routes
router
  .route("/register")
  .post(
    upload.fields([
      { name: "avatar", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
    ]),
    registerUser
  )
  .all(() => {
    throw new ApiError(405, "request method not allowed on this route");
  });
router
  .route("/login")
  .post(loginUser)
  .all(() => {
    throw new ApiError(405, "request method not allowed on this route");
  });
router
  .route("/refresh-token")
  .post(refreshAccessToken)
  .all(() => {
    throw new ApiError(405, "request method not allowed on this route");
  });

// secured routes
router.use(verifyJWT);
router.route("/logout").post(logoutUser);
router.route("/update-password").patch(updateCurrentPassword);
router.route("/account").patch(updateAccountDetails);
router.route("/avatar").patch(upload.single("avatar"), updateUserAvatar);
router
  .route("/cover-image")
  .patch(upload.single("coverImage"), updateUserCoverImage);
router.route("/history").get(getWatchHistory);
router.route("/current-user").get(getCurrentUser);
router.route("/c/:username").get(getUserChannelProfile);

export default router;
