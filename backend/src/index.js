import { app } from "./app.js";
import logger from "./logger.js";
import morgan from "morgan";
import "dotenv/config";
import connectDB from "./db/index.js";

const morganFormat = ":method :url :status :response-time ms";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

connectDB()
  .then(() =>
    app.listen(process.env.PORT, () =>
      console.log(`server up & running on ${process.env.PORT}...`)
    )
  )
  .catch((error) => console.log("MongoDB conn error", error));
