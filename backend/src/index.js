import { app } from "./app.js";
import "dotenv/config";
import connectDB from "./db/index.js";

connectDB()
  .then(() =>
    app.listen(process.env.PORT, () =>
      console.log(`server up & running on ${process.env.PORT}...`)
    )
  )
  .catch((error) => console.log("MongoDB conn error", error));
