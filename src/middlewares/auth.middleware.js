import { ApiError } from "../utils/APIError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt, { decode } from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // console.log(req.header("Authorization"));
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    console.log("Pandey querry:", token);

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    console.log("token:", token);
    console.log("key:", process.env.ACCESS_TOKEN_SECRET);

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("Decoded hua :", decodedToken);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    console.log(error.message);
    throw new ApiError(401, error?.message || "Invalid token");
  }
});
