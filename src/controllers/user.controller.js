import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/APIError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinry } from "../utils/cloudanry.js";
import { ApiRespose } from "../utils/ApiResponse.js";

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
    throw new ApiError(400, "All feil are required");
  }
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  console.log(existedUser);
  if (existedUser) {
    throw new ApiError(409, "User is already exist");
  }
  console.log(req.file);
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

export { registerUser };
