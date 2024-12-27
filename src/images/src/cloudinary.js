const uploadImageToCloudinary = async (file) => {
  return new Promise(async (resolve, reject) => {
    console.log("URL OF BLOB:" + file);
    console.log("Extracting blob...");
    
    try {
      const response = await fetch(file); // blob URL, e.g., blob:http://127.0.0.1:8000/e89c5d87-a634-4540-974c-30dc476825cc

      if (!response.ok) {
        throw new Error(`Failed to fetch the image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log("CAME HERE");

      const reader = new FileReader();
      console.log("Reading results...");

      reader.onloadend = async () => {
        console.log("Reading complete...");
        let base64data = reader.result;

        // Creating FormData for Cloudinary upload
        const formData = new FormData();
        formData.append("file", base64data);
        base64data = base64data.replace("file=data:image/png;base64", "file=data%3Aimage%2Fpng%3Bbase64%2C");
        formData.append("api_key", process.env.CLOUDINARY_API_KEY);
        formData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);

        console.log("Posting to Cloudinary...");

        try {
          const uploadResponse = await fetch("https://api.cloudinary.com/v1_1/haelpers-react/image/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`);
          }

          const result = await uploadResponse.json();
          console.log("Receiving results...");
          const imageURL = result.url;
          console.log("Resolving: " + imageURL);
          resolve(imageURL);
        } catch (err) {
          console.log("Error uploading to Cloudinary:", err);
          reject(err);
        }
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error extracting blob:", error);
      reject(error);
    }
  });
};

export { uploadImageToCloudinary };
