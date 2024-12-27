import { config } from 'dotenv';
import path from 'path';

config();

const getAuthorization = async () => {
  const credentials = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`).toString('base64');
  try {
    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });

    if (!response.ok) {
      throw new Error(`Authorization failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error during authorization:', error.message);
    throw error;
  }
};

const getUploadUrl = async (auth) => {
  try {
    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: process.env.B2_BUCKET_ID
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting upload URL:', error.message);
    throw error;
  }
};

export const uploadImageToB2 = async (file) => {
  try {
    console.log("URL OF BLOB:", file);
    console.log("Extracting blob...");
    
    const response = await fetch(file);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch the image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log("Reading complete...");

    const auth = await getAuthorization();
    const uploadUrlData = await getUploadUrl(auth);

    const fileName = `uploads/${Date.now()}.png`;
    
    console.log("Uploading to B2...");
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: uploadUrlData.authorizationToken,
        'X-Bz-File-Name': encodeURIComponent(fileName),
        'Content-Type': 'image/png',
        'X-Bz-Content-Sha1': 'do_not_verify'
      },
      body: arrayBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    console.log("Receiving results...");
    const location = `${auth.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${encodeURIComponent(fileName)}`;
    console.log("Resolving:", location);
    return location;
  } catch (error) {
    console.error("Error uploading to B2:", error);
    throw error;
  }
};
