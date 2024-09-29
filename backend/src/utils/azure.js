import { BlobServiceClient } from "@azure/storage-blob";
import fs from "fs";

const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/?${process.env.AZURE_SAS_TOKEN}`
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME
);

async function uploadImage(fileName, dataStream) {
  const blobClient = containerClient.getBlockBlobClient(fileName);
  await blobClient.uploadStream(dataStream);
  // return blobClient.url;
  return blobClient;
}

const uploadOnAzure = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    // upload On Azure
    console.log("localFilePath", localFilePath);
    const azureResponse = await uploadImage();
    console.log("file uploaded on azure, file object:", azureResponse);
    fs.unlinkSync(localFilePath);
    return azureResponse;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};

// todo design a method to clear azure storage

export { uploadOnAzure };
