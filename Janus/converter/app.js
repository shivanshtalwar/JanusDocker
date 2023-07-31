import express, { json, urlencoded } from "express";
import logger from "morgan";
import indexRouter from "./routes/webhook.js";
const app = express();
app.use(logger("dev"));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use("/", indexRouter);

export default app;
