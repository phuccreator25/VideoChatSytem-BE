import { connectDB } from "../config/database.js";
import "../config/env.js";

const startWorkers = async () => {
  try {
    await connectDB();

    console.log("Worker connected to database");

    await import("./uploadFileWorker.js");
    await import("./shareMessageWorker.js");
    await import("./getLinkPeviewWorker.js");
    await import("./sendMessageWorker.js");

    console.log("BullMQ workers started");
  } catch (error) {
    console.error("Failed to start workers:", error);
    process.exit(1);
  }
};

startWorkers();