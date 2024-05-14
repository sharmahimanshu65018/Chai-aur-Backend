// require("dotenv").config({ path: "./env" });
import mongoose from "mongoose";
import { DB_NAME } from "./constant.js";
import express from "express";
import dotenv from "dotenv";
import connectDB from "../db/index.js";
import { app } from "./aap.js";

dotenv.config({
  path: "./env",
});

connectDB()
  .then(() => {
    //create a variable and use it as a PORT
    app.on("error", (error) => {
      console.log("error on talking with server:", error);
      throw error;
    });
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running at port:${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("Mongo DB connection failed");
  });

// const app = express();
// (async () => {
//   try {
//     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
//     app.on("error", (error) => {
//       console.log("error:", error);
//       throw error;
//     });

//     app.listen(process.env.PORT, () => {
//       console.log(`app is lising on port: ${process.env.PORT}`);
//     });
//   } catch (error) {
//     console.error("Error: ", error);
//   }
// })();
