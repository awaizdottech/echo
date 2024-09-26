//  ObjectId users
//   channel ObjectId users
import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    subscriber: { type: Schema.Types.ObjectId, ref: "User" }, // one who is subcribing
    channel: { type: Schema.Types.ObjectId, ref: "User" }, // to the channel subscriber is subscribing
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
