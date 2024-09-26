// video ObjectId videos
//    ObjectId comments
//    ObjectId tweets
//    ObjectId users
//   createdAt Date
//   updatedAt Date
import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    video: { type: Schema.Types.ObjectId, ref: "Video" },
    comment: { type: Schema.Types.ObjectId, ref: "Comment" },
    tweet: { type: Schema.Types.ObjectId, ref: "Tweet" },
    likedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Like = mongoose.model("Like", likeSchema);
