// every model get its controllers & routes separately

import { Router } from "express";
import { healthCheck } from "../controllers/healthCheck.controllers.js";

const router = Router();

const allowMethods = (route, methods) => {
  const routeHandler = router.route(route);

  methods.forEach(({ method, middleware, controller }) => {
    if (middleware) {
      routeHandler[method](middleware, controller);
    } else {
      routeHandler[method](controller);
    }
  });

  // Catch all other methods and respond with 405
  routeHandler.all((req, res) =>
    res.status(405).send({ message: "Method Not Allowed" })
  );
};

// Example usage:
allowMethods("/", [
  { method: "get", middleware: null, controller: healthCheck },
]);

// router.route("/").get(healthCheck);

export default router;
