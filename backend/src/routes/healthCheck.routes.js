// every model get its controllers & routes separately

import { Router } from "express";
import { healthCheck } from "../controllers/healthCheck.controllers.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

const allowedRequests = (route, methods) => {
  const routeHandler = router.route(route);

  methods.forEach(({ method, middleware, controller }) => {
    if (typeof middleware == "object")
      routeHandler[method](...middleware, controller);
    else if (middleware) routeHandler[method](middleware, controller);
    else routeHandler[method](controller);
  });

  // Catch all other methods and respond with 405
  routeHandler.all(() => {
    throw new ApiError(405, "request method not allowed on this route");
  });
};

// Example usage:
allowedRequests("/", [{ method: "get", controller: healthCheck }]);

// router.route("/").get(healthCheck);

export default router;
