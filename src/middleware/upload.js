import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");

    return {
      folder: "onestop/resumes",
      // ⚠️ Reverting to 'raw' because 'auto' (image) is being blocked by Cloudinary security settings
      resource_type: isImage ? "image" : "raw",
      type: "upload",
      access_mode: "public",
      
      // ✅ Fix double extension issue: Ensure we strip existing extension before adding .pdf
      public_id: isImage ? undefined : (file.originalname.replace(/\.pdf$/i, "").replace(/\.[^/.]+$/, "") + "_" + Date.now() + ".pdf"),
      
      use_filename: isImage,
      unique_filename: isImage,
    };
  },
});

const upload = multer({ storage });
export default upload;
