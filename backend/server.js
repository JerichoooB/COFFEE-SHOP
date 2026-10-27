import { app } from "./runtime.js";
import { pool } from "./config/database.js";
const server = app.listen(Number(process.env.PORT) || 5000, "0.0.0.0", () =>
  console.log("Brew Haven API listening on port " + (process.env.PORT || 5000)),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
