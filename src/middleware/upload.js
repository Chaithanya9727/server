import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "onestop_resources", // all uploads go into this folder in Cloudinary
    allowed_formats: ["pdf", "doc", "docx", "ppt", "pptx", "jpg", "png"],
    resource_type: "auto",
  },
});

const upload = multer({ storage });

export default upload;
