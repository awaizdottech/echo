import { Router } from "express";
import {
  registerUser,
  logoutUser,
  loginUser,
  changeCurrentPassword,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getWatchHistory,
  refreshAccessToken,
  getCurrentUser,
  getUserChannelProfile,
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// unsecured routes
router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

// secured routes
router.use(verifyJWT);
router.route("/logout").post(logoutUser);
router.route("/change-password").post(changeCurrentPassword);
router.route("/update-account").patch(updateAccountDetails);
router.route("/avatar").patch(upload.single("avatar"), updateUserAvatar);
router
  .route("/cover-image")
  .patch(upload.single("coverImage"), updateUserCoverImage);
router.route("/history").get(getWatchHistory);
router.route("/current-user").get(getCurrentUser);
router.route("/c/:username").get(getUserChannelProfile);

export default router;
