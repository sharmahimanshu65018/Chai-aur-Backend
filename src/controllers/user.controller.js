import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/APIError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinry } from "../utils/cloudanry.js";
import { ApiRespose } from "../utils/ApiResponse.js";
import { response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    console.log("user:", user);
    console.log("User:", User);
    const accessToken = user.generateAcessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating Refreshing and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //Get User Detail from Frontend
  //Validation - not empty
  //check if user already exists: username, email
  // chaeck for images, check for avtar
  //upload then to cloudnary, avatar
  //create user object - creat entry in db
  // remove password and refresh token feild from response
  // check user creation
  //return response

  const { fullName, email, username, password } = req.body;
  console.log("username:", username);

  // if (fullName === "") {
  //   throw new ApiError(400, "Full Name is required");
  // }
  if (
    [fullName, username, email, password].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError(400, "All feild are required");
  }
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  console.log(existedUser);
  if (existedUser) {
    throw new ApiError(409, "User is already exist");
  }
  console.log("req.file", req);
  const avtarLocalPath = req.files?.avatar[0].path;
  //const coverImageLocalPath = req.file?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avtarLocalPath) {
    throw new ApiError(400, "Avtar is required");
  }

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverimage is required");
  }

  console.log(coverImageLocalPath);
  const avatar = await uploadOnCloudinry(avtarLocalPath);
  const coverImage = await uploadOnCloudinry(coverImageLocalPath);

  console.log("avatar:", avatar);

  if (!avatar) {
    throw new ApiError(400, "Avtar is not uploaded");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while register the user");
  }

  return res
    .status(201)
    .json(new ApiRespose(200, createdUser, "User regested sucessfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //extract req body Username ,email,password
  //validate Username ,email
  //check if it is present in db or not
  //check password
  //Genereate access and refresh token
  //send cookie and sned response

  const { email, username, password } = req.body;
  if (!(email || username)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User Doesnot exist need to register first");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!user) {
    throw new ApiError(401, "Password incorrect");
  }

  const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  console.log("login access token", accessToken);
  console.log("login refresh token", refreshToken);
  const logginedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiRespose(
        200,
        {
          user: logginedUser,
          accessToken,
          refreshToken,
        },
        "User Logged sucessfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiRespose(200, {}, "User Logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  //extract refresh access token
  //call generate access token in user model
  //update user

  const incommingRefreshToken =
    req.cookie.refreshToken || req.body.refreshToken;

  if (!incommingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }
    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { newRefreshToken, acessToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("refreshToken", newRefreshToken, options)
      .cookie("acessToken", acessToken, options)
      .json(
        new ApiRespose(
          200,
          { accessToken, newRefreshToken },
          "Access token refresed sucessfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiRespose(200, {}, "Password change sucessfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiRespose(200, req.user, "Current user fetched sucessfully"));
});

const upadteAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "All feild are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiRespose(200, user, "Account detail udpated sucessfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avtarLocalPath = req.files?.path;
  if (!avtarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinry(avtarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploadind on avatar");
  }

  //TDDO: Deleted old image
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiRespose(200, user, "Avatar Image updated sucessfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage file is missing");
  }

  const coverImage = await uploadOnCloudinry(CoverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploadind on CoverImage");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiRespose(200, user, "Cover Image updated sucessfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }
  const channel = User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subsciptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subsciptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscibedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscribeTocount: {
          $size: "$subscibedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "&subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscribeTocount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "video",
        localFeild: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipline: [
          {
            $lookup: {
              from: "users",
              localFeild: "owner",
              foreignField: "_id",
              as: "owner",
              pipline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiRespose(200, user[0].WatchHistory, "watchech history fetched")
    );
});

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  upadteAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
