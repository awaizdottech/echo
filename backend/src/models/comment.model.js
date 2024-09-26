// id string pk
//   video ObjectId videos
//   owner ObjectId users
//   content string
//   createdAt Date
//   updatedAt Date
import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    video: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
commentSchema.plugin(mongooseAggregatePaginate);
// there are more plugins. go through them
export const Comment = mongoose.model("Comment", commentSchema);
